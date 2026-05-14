import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { canonicalToUblInvoiceXml } from "@invoice-lantern/ubl";
import {
  buildVidaSimulationInputFromCanonicalInvoice,
  simulateVidaReadinessFromCanonicalInvoice
} from "@invoice-lantern/vida-simulator";
import { z } from "zod";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole,
  type WorkspaceAuthorizationContext
} from "../../middleware/require-workspace-role.js";
import {
  productionInvoiceCreateRequestSchema,
  productionInvoiceFromDraftRequestSchema,
  productionInvoiceListQuerySchema,
  productionInvoiceParamsSchema,
  productionInvoiceTransitionRequestSchema,
  productionInvoiceUpdateRequestSchema
} from "../../schemas/canonical-invoice.js";
import {
  InvoiceLifecycleServiceError,
  createProductionInvoice,
  createProductionInvoiceFromDraft,
  getProductionInvoice,
  listProductionInvoiceLifecycleEvents,
  listProductionInvoices,
  mapRepositoryError,
  transitionProductionInvoice,
  updateProductionInvoice
} from "../../services/invoice-lifecycle-service.js";
import { saveOrganizationInvoiceExportRecord } from "../../repositories/invoice-export-repository.js";
import { saveAuthenticatedVidaSimulationRunRecord } from "../../repositories/vida-simulation-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const PRODUCTION_UBL_EXPORT_DISCLAIMER =
  "Invoice Lantern generated this technical UBL 2.1 export from a production invoice canonical record. It is not official validation, not Peppol-certified, not legal/tax/accounting advice, not official filing, and not authority acceptance.";

const vidaInvoiceSimulationRequestSchema = z
  .object({
    buyerType: z
      .enum(["business", "consumer", "public_authority", "unknown"])
      .optional(),
    sellerType: z.enum(["business", "public_authority", "unknown"]).optional(),
    transactionType: z
      .enum(["goods", "services", "digital_service", "mixed", "unknown"])
      .optional(),
    supplyScenario: z
      .enum(["domestic", "intra_eu", "non_eu", "unknown"])
      .optional(),
    structuredInvoiceSignals: z
      .object({
        hasCanonicalInvoice: z.boolean().optional(),
        hasUblXml: z.boolean().optional(),
        hasCiiXml: z.boolean().optional(),
        xsdStatus: z
          .enum([
            "passed",
            "failed",
            "warning",
            "not_configured",
            "not_checked",
            "unavailable",
            "unknown"
          ])
          .optional(),
        schematronPeppolStatus: z
          .enum([
            "passed",
            "failed",
            "warning",
            "not_configured",
            "not_checked",
            "unavailable",
            "unknown"
          ])
          .optional(),
        schematronEn16931Status: z
          .enum([
            "passed",
            "failed",
            "warning",
            "not_configured",
            "not_checked",
            "unavailable",
            "unknown"
          ])
          .optional(),
        validationSummary: z
          .object({
            status: z.string().trim().max(80).optional(),
            totalFindings: z.number().int().min(0).max(10000).optional(),
            blockedCount: z.number().int().min(0).max(10000).optional(),
            fatalCount: z.number().int().min(0).max(10000).optional(),
            warningCount: z.number().int().min(0).max(10000).optional(),
            infoCount: z.number().int().min(0).max(10000).optional()
          })
          .strict()
          .optional()
      })
      .strict()
      .optional(),
    vatEvidence: z
      .object({
        sellerFormatStatus: z
          .enum(["valid", "invalid", "not_checked", "unknown"])
          .optional(),
        buyerFormatStatus: z
          .enum(["valid", "invalid", "not_checked", "unknown"])
          .optional(),
        buyerViesStatus: z
          .enum(["valid", "invalid", "unavailable", "not_checked", "unknown"])
          .optional(),
        sellerViesStatus: z
          .enum(["valid", "invalid", "unavailable", "not_checked", "unknown"])
          .optional(),
        checkedAt: z.string().trim().max(80).optional(),
        sourceLabel: z.string().trim().max(160).optional()
      })
      .strict()
      .optional(),
    countryPackContext: z
      .object({
        sellerCountryPackVersion: z.string().trim().max(80).optional(),
        buyerCountryPackVersion: z.string().trim().max(80).optional(),
        sellerCountryPackStatus: z
          .enum([
            "eu_core_only",
            "draft",
            "beta",
            "reviewed",
            "professional_review_required",
            "deprecated",
            "suspended",
            "unknown"
          ])
          .optional(),
        buyerCountryPackStatus: z
          .enum([
            "eu_core_only",
            "draft",
            "beta",
            "reviewed",
            "professional_review_required",
            "deprecated",
            "suspended",
            "unknown"
          ])
          .optional(),
        sourceCoverageStatus: z
          .enum([
            "reviewed",
            "beta",
            "draft",
            "not_reviewed",
            "unknown",
            "professional_review_required",
            "eu_core_only"
          ])
          .optional()
      })
      .strict()
      .optional(),
    sourceRefs: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
    sourceLabels: z.array(z.string().trim().min(1).max(240)).max(50).optional()
  })
  .strict();

function sendError(
  reply: FastifyReply,
  input: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }
) {
  return reply.status(input.statusCode).send({
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? null
    }
  });
}

function sendValidationError(
  reply: FastifyReply,
  message: string,
  details: unknown
) {
  return sendError(reply, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    details
  });
}

function sendInvoiceLifecycleError(reply: FastifyReply, error: unknown) {
  const mappedError = mapRepositoryError(error);

  if (mappedError instanceof InvoiceLifecycleServiceError) {
    return reply.status(mappedError.statusCode).send({
      error: {
        code: mappedError.code,
        message: mappedError.message,
        details: null
      },
      findings: mappedError.findings,
      calculationSummary: mappedError.calculationSummary,
      validationSummary: mappedError.validationSummary
    });
  }

  console.error("Production invoice lifecycle error:", mappedError);

  return sendError(reply, {
    statusCode: 500,
    code: "PRODUCTION_INVOICE_OPERATION_FAILED",
    message: "Could not complete the production invoice lifecycle operation."
  });
}

function getWorkspaceAuthorizationContext(
  request: FastifyRequest,
  reply: FastifyReply
): WorkspaceAuthorizationContext | null {
  const context = request.workspaceAuthorization;

  if (context) {
    return context;
  }

  sendError(reply, {
    statusCode: 401,
    code: "AUTHENTICATED_USER_REQUIRED",
    message: "Production invoice lifecycle routes require a signed-in Supabase user."
  });

  return null;
}

function sendNotFound(reply: FastifyReply) {
  return sendError(reply, {
    statusCode: 404,
    code: "PRODUCTION_INVOICE_NOT_FOUND",
    message: "Production invoice was not found in this workspace."
  });
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return cleaned || "invoice";
}

function calculateXmlSha256(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

export async function invoiceRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "PRODUCTION_INVOICE_READ_ROLE_REQUIRED",
          message:
            "Production invoice reading requires workspace membership with an allowed invoice-read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedQuery = productionInvoiceListQuerySchema.safeParse(
        request.query
      );

      if (!parsedQuery.success) {
        return sendValidationError(
          reply,
          "Production invoice list query failed schema validation.",
          formatZodError(parsedQuery.error)
        );
      }

      try {
        const filters = {
          ...(parsedQuery.data.status ? { status: parsedQuery.data.status } : {}),
          ...(parsedQuery.data.invoiceNumber
            ? { invoiceNumber: parsedQuery.data.invoiceNumber }
            : {})
        };
        const records = await listProductionInvoices({
          context,
          filters
        });

        return {
          records
        };
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.post(
    "/",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
          message:
            "Production invoice creation requires an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedBody = productionInvoiceCreateRequestSchema.safeParse(
        request.body
      );

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Production invoice create request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await createProductionInvoice({
          context,
          canonicalInvoice: parsedBody.data.canonicalInvoice,
          source: parsedBody.data.source,
          draftId: parsedBody.data.draftId ?? null
        });

        return reply.status(201).send({
          record
        });
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.post(
    "/from-draft",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
          message:
            "Draft-to-production conversion requires an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedBody = productionInvoiceFromDraftRequestSchema.safeParse(
        request.body
      );

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Production invoice from-draft request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await createProductionInvoiceFromDraft({
          context,
          draftId: parsedBody.data.draftId,
          source: parsedBody.data.source
        });

        if (!record) {
          return sendError(reply, {
            statusCode: 404,
            code: "INVOICE_DRAFT_NOT_FOUND",
            message: "Invoice draft was not found in this workspace."
          });
        }

        return reply.status(201).send({
          record
        });
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.get(
    "/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "PRODUCTION_INVOICE_READ_ROLE_REQUIRED",
          message:
            "Production invoice reading requires workspace membership with an allowed invoice-read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await getProductionInvoice({
          context,
          id: parsedParams.data.id
        });

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record
        };
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
          message:
            "Production invoice updates require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = productionInvoiceUpdateRequestSchema.safeParse(
        request.body
      );

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Production invoice update request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await updateProductionInvoice({
          context,
          id: parsedParams.data.id,
          canonicalInvoice: parsedBody.data.canonicalInvoice
        });

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record
        };
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.post(
    "/:id/export/ubl",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceExporters, {
          code: "PRODUCTION_INVOICE_EXPORT_ROLE_REQUIRED",
          message:
            "Production invoice UBL export requires an organization owner, admin, accountant, or developer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const record = await getProductionInvoice({
          context,
          id: parsedParams.data.id
        });

        if (!record) {
          return sendNotFound(reply);
        }

        const xml = canonicalToUblInvoiceXml(record.canonicalInvoice);
        const xmlSha256 = calculateXmlSha256(xml);
        const xmlSizeBytes = Buffer.byteLength(xml, "utf8");
        const filename = `invoice-lantern-ubl-${sanitizeFilenamePart(
          record.invoiceNumber
        )}.xml`;
        const contentType = "application/xml; charset=utf-8";
        const exportRecord = await saveOrganizationInvoiceExportRecord(
          {
            organizationId: context.organizationId,
            userId: context.userId
          },
          {
            invoiceDraftId: record.draftId,
            validationRunId: null,
            exportType: "ubl_invoice",
            format: "xml",
            profile: record.profile,
            filename,
            contentType,
            xmlSha256,
            xmlSizeBytes,
            status: "generated",
            disclaimer: PRODUCTION_UBL_EXPORT_DISCLAIMER
          }
        );

        return reply.status(200).send({
          xml,
          metadata: {
            exportId: exportRecord.id,
            productionInvoiceId: record.id,
            invoiceNumber: record.invoiceNumber,
            invoiceType: record.invoiceType,
            filename: exportRecord.filename,
            contentType: exportRecord.contentType,
            xmlSha256: exportRecord.xmlSha256,
            xmlSizeBytes: exportRecord.xmlSizeBytes,
            createdAt: exportRecord.createdAt,
            status: exportRecord.status,
            profile: exportRecord.profile,
            readinessLabel: "technical UBL 2.1 export"
          },
          exportId: exportRecord.id,
          productionInvoiceId: record.id,
          filename: exportRecord.filename,
          contentType: exportRecord.contentType,
          xmlSha256: exportRecord.xmlSha256,
          xmlSizeBytes: exportRecord.xmlSizeBytes,
          createdAt: exportRecord.createdAt,
          status: exportRecord.status,
          profile: exportRecord.profile,
          readinessStatus:
            record.validationSummary.warningCount > 0
              ? "generated_with_warnings"
              : "generated",
          totals: record.calculationSummary,
          findings: record.validationSummary.findings,
          disclaimer: PRODUCTION_UBL_EXPORT_DISCLAIMER
        });
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.post(
    "/:id/simulate-vida",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "PRODUCTION_INVOICE_VIDA_SIMULATION_ROLE_REQUIRED",
          message:
            "Production invoice ViDA-readiness simulation requires an organization owner, admin, accountant, developer, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = vidaInvoiceSimulationRequestSchema.safeParse(
        request.body ?? {}
      );

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Production invoice ViDA simulation request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const record = await getProductionInvoice({
          context,
          id: parsedParams.data.id
        });

        if (!record) {
          return sendNotFound(reply);
        }

        const simulationInput = buildVidaSimulationInputFromCanonicalInvoice(
          record.canonicalInvoice,
          parsedBody.data
        );
        const simulationResult = simulateVidaReadinessFromCanonicalInvoice(
          record.canonicalInvoice,
          parsedBody.data
        );
        const simulationRun = await saveAuthenticatedVidaSimulationRunRecord(
          {
            userId: context.userId,
            accessToken: context.accessToken
          },
          {
            inputPayload: simulationInput,
            result: simulationResult,
            source: "workspace",
            requestMetadata: {
              method: request.method,
              path: request.routeOptions.url ?? request.url.split("?")[0],
              authenticationMode: request.authenticationMode ?? null,
              productionInvoiceId: record.id,
              invoiceNumber: record.invoiceNumber,
              invoiceStatus: record.status,
              normalizedInput: simulationResult.normalizedInput
            }
          }
        );

        return reply.status(201).send({
          ...simulationResult,
          simulationId: simulationRun.id,
          persisted: true,
          simulationRunId: simulationRun.id,
          simulationRun: {
            id: simulationRun.id,
            productionInvoiceId: record.id,
            invoiceNumber: record.invoiceNumber,
            transactionClass: simulationRun.transactionClass,
            vidaRelevance: simulationRun.vidaRelevance,
            readinessScore: simulationRun.readinessScore,
            readinessStatus: simulationRun.readinessStatus,
            legalConfidence: simulationRun.legalConfidence,
            createdAt: simulationRun.createdAt
          },
          invoiceSimulationDisclaimer:
            "This production invoice ViDA-readiness simulation did not change invoice lifecycle status and is not official filing, legal advice, tax advice, accounting advice, or a compliance guarantee."
        });
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.post(
    "/:id/transition",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "PRODUCTION_INVOICE_MUTATION_ROLE_REQUIRED",
          message:
            "Production invoice status transitions require an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      const parsedBody = productionInvoiceTransitionRequestSchema.safeParse(
        request.body
      );

      if (!parsedBody.success) {
        return sendValidationError(
          reply,
          "Production invoice transition request failed schema validation.",
          formatZodError(parsedBody.error)
        );
      }

      try {
        const transitionInput = {
          context,
          id: parsedParams.data.id,
          toStatus: parsedBody.data.toStatus,
          ...(parsedBody.data.reason ? { reason: parsedBody.data.reason } : {})
        };
        const record = await transitionProductionInvoice(transitionInput);

        if (!record) {
          return sendNotFound(reply);
        }

        return {
          record
        };
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );

  app.get(
    "/:id/lifecycle-events",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftReaders, {
          code: "PRODUCTION_INVOICE_READ_ROLE_REQUIRED",
          message:
            "Production invoice lifecycle event reading requires workspace membership with an allowed invoice-read role."
        })
      ]
    },
    async (request, reply) => {
      const context = getWorkspaceAuthorizationContext(request, reply);

      if (!context) {
        return reply;
      }

      const parsedParams = productionInvoiceParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return sendValidationError(
          reply,
          "Production invoice ID failed schema validation.",
          formatZodError(parsedParams.error)
        );
      }

      try {
        const records = await listProductionInvoiceLifecycleEvents({
          context,
          invoiceId: parsedParams.data.id
        });

        if (!records) {
          return sendNotFound(reply);
        }

        return {
          records
        };
      } catch (error) {
        return sendInvoiceLifecycleError(reply, error);
      }
    }
  );
}
