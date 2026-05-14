import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  validateCanonicalInvoice,
  type CanonicalInvoice,
  type ValidationFindingSeverity
} from "@invoice-lantern/invoice-core";
import { canonicalToUblInvoiceXml } from "@invoice-lantern/ubl";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  getAuthenticatedInvoiceDraftById,
  getInvoiceDraftById,
  hasAuthenticatedInvoiceDraftContext,
  type AuthenticatedInvoiceDraftContext
} from "../../repositories/invoice-draft-repository.js";
import {
  buildValidationFindings,
  calculateValidationTotals,
  hasAuthenticatedValidationRunContext,
  saveAuthenticatedValidationRun,
  saveOrganizationValidationRun,
  saveValidationRun,
  type AuthenticatedValidationRunContext,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import {
  runValidationEngine,
  type ValidationEngineResult
} from "../../services/validation-engine-service.js";
import { enrichValidationFindings } from "../../services/validation-finding-enrichment.js";
import {
  viesModeSchema,
  type ViesMode
} from "../../schemas/validation-engine.js";
import type { XmlValidationJobFinding } from "../../services/xml-validation-job-service.js";
import {
  hasAuthenticatedInvoiceExportContext,
  saveAuthenticatedInvoiceExportRecord,
  saveOrganizationInvoiceExportRecord,
  saveInvoiceExportRecord,
  type AuthenticatedInvoiceExportContext
} from "../../repositories/invoice-export-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

type UblExportRequestPayload = {
  invoiceInput: unknown;
  invoiceDraftId: string | null;
  validationRunId: string | null;
};

type InvoiceValidationRequestPayload = {
  invoiceInput: unknown;
  viesMode: ViesMode;
  xmlFindings: XmlValidationJobFinding[];
};

const validationRequestWrapperSchema = z
  .object({
    invoice: z.unknown().optional(),
    payload: z.unknown().optional(),
    viesMode: viesModeSchema.optional(),
    xmlFindings: z.array(z.object({}).passthrough()).max(200).optional()
  })
  .strict()
  .superRefine((value, context) => {
    const hasInvoice = value.invoice !== undefined;
    const hasPayload = value.payload !== undefined;

    if (hasInvoice === hasPayload) {
      context.addIssue({
        code: "custom",
        path: ["invoice"],
        message: "Provide exactly one invoice or payload wrapper field."
      });
    }
  });

function getAuthenticatedValidationRunContext(
  request: FastifyRequest
): AuthenticatedValidationRunContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedValidationRunContext(context) ? context : null;
}

function resolveValidationOrganizationContext(request: FastifyRequest) {
  if (request.authenticatedApiKey) {
    return {
      organizationId: request.authenticatedApiKey.organizationId,
      userId: request.authenticatedApiKey.createdBy
    };
  }

  if (request.workspaceAuthorization) {
    return {
      organizationId: request.workspaceAuthorization.organizationId,
      userId: request.workspaceAuthorization.userId
    };
  }

  return {
    organizationId: "local",
    userId: request.authenticatedUser?.id ?? null
  };
}

function getAuthenticatedInvoiceDraftContext(
  request: FastifyRequest
): AuthenticatedInvoiceDraftContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedInvoiceDraftContext(context) ? context : null;
}

function getAuthenticatedInvoiceExportContext(
  request: FastifyRequest
): AuthenticatedInvoiceExportContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedInvoiceExportContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Validation run storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VALIDATION_RUN_STORAGE_ERROR",
      message: "Could not save the validation run.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function sendUblExportStorageError(reply: FastifyReply, error: unknown) {
  console.error("UBL export storage error:", error);

  return reply.status(500).send({
    error: {
      code: "UBL_EXPORT_STORAGE_ERROR",
      message: "Could not save the generated UBL XML export record.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function hasBlockingFinding(findings: { severity: ValidationFindingSeverity }[]) {
  return findings.some(
    (finding) => finding.severity === "fatal" || finding.severity === "blocked"
  );
}

function hasWarningFinding(findings: { severity: ValidationFindingSeverity }[]) {
  return findings.some((finding) => finding.severity === "warning");
}

function isCrossBorderInvoice(payload: CanonicalInvoice) {
  return (
    payload.seller.country.trim().length > 0 &&
    payload.buyer.country.trim().length > 0 &&
    payload.seller.country !== payload.buyer.country
  );
}

function buildSandboxDisclaimer(subject: "validation" | "ubl_export") {
  return subject === "ubl_export"
    ? "Invoice Lantern generated this UBL XML as an independent export readiness sandbox output. It is not official validation, certification, legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority approval."
    : "This API response is a technical validation and readiness sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation.";
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function hasCanonicalInvoiceShape(value: Record<string, unknown>) {
  return (
    isPlainObject(value.document) &&
    isPlainObject(value.seller) &&
    isPlainObject(value.buyer) &&
    Array.isArray(value.lines)
  );
}

function getWrappedInvoiceInput(value: Record<string, unknown>) {
  if ("invoice" in value) {
    return value.invoice;
  }

  if ("payload" in value) {
    return value.payload;
  }

  return undefined;
}

function readInvoicePayloadForValidation(
  requestBody: unknown
):
  | { success: true; data: InvoiceValidationRequestPayload }
  | { success: false; error: z.ZodError } {
  if (
    !isPlainObject(requestBody) ||
    (!("invoice" in requestBody) &&
      !("payload" in requestBody) &&
      !("viesMode" in requestBody) &&
      !("xmlFindings" in requestBody))
  ) {
    return {
      success: true,
      data: {
        invoiceInput: requestBody,
        viesMode: "skip",
        xmlFindings: []
      }
    };
  }

  const parsedWrapper = validationRequestWrapperSchema.safeParse(requestBody);

  if (!parsedWrapper.success) {
    return {
      success: false,
      error: parsedWrapper.error
    };
  }

  return {
    success: true,
    data: {
      invoiceInput: parsedWrapper.data.invoice ?? parsedWrapper.data.payload,
      viesMode: parsedWrapper.data.viesMode ?? "skip",
      xmlFindings: (parsedWrapper.data.xmlFindings ??
        []) as XmlValidationJobFinding[]
    }
  };
}

function isDraftOnlyUblExportRequest(request: FastifyRequest) {
  if (!isPlainObject(request.body)) {
    return false;
  }

  const invoiceDraftId =
    readOptionalStringField(request.body, "invoiceDraftId") ??
    readOptionalStringField(request.body, "draftId");
  const wrappedInvoiceInput = getWrappedInvoiceInput(request.body);

  return Boolean(
    invoiceDraftId &&
      wrappedInvoiceInput === undefined &&
      !hasCanonicalInvoiceShape(request.body)
  );
}

async function readInvoicePayloadForUblExport(
  request: FastifyRequest
): Promise<UblExportRequestPayload> {
  if (!isPlainObject(request.body)) {
    return {
      invoiceInput: request.body,
      invoiceDraftId: null,
      validationRunId: null
    };
  }

  const invoiceDraftId =
    readOptionalStringField(request.body, "invoiceDraftId") ??
    readOptionalStringField(request.body, "draftId");

  const validationRunId = readOptionalStringField(
    request.body,
    "validationRunId"
  );

  const wrappedInvoiceInput = getWrappedInvoiceInput(request.body);

  if (wrappedInvoiceInput !== undefined) {
    return {
      invoiceInput: wrappedInvoiceInput,
      invoiceDraftId,
      validationRunId
    };
  }

  if (!invoiceDraftId || hasCanonicalInvoiceShape(request.body)) {
    return {
      invoiceInput: request.body,
      invoiceDraftId,
      validationRunId
    };
  }

  const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);
  const draft = authenticatedContext
    ? await getAuthenticatedInvoiceDraftById(
        authenticatedContext,
        invoiceDraftId
      )
    : await getInvoiceDraftById(invoiceDraftId);

  return {
    invoiceInput: draft,
    invoiceDraftId,
    validationRunId
  };
}

function calculateXmlSha256(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

function buildValidationViesChecks(result: ValidationEngineResult) {
  return result.viesChecks.map((check) => ({
    status: check.status,
    viesValid: check.viesValid,
    checkedAt: check.checkedAt,
    source: check.source,
    evidence: check.evidence
      ? {
          id: check.evidence.id,
          countryCode: check.evidence.countryCode,
          vatNumberNormalized: check.evidence.vatNumberNormalized,
          vatNumberDisplay: check.evidence.vatNumberDisplay,
          requestSource: check.evidence.requestSource,
          status: check.evidence.status,
          viesValid: check.evidence.viesValid,
          requestIdentifier: check.evidence.requestIdentifier,
          checkedAt: check.evidence.checkedAt,
          sourceLabel: check.evidence.sourceLabel,
          sourceUrl: check.evidence.sourceUrl,
          responseTimeMs: check.evidence.responseTimeMs,
          errorCode: check.evidence.errorCode,
          errorMessageSafe: check.evidence.errorMessageSafe,
          rawResponseHash: check.evidence.rawResponseHash
        }
      : null
  }));
}

export async function validateInvoiceRoutes(app: FastifyInstance) {
  app.post(
    "/validate",
    {
      preHandler: [
        requireApiKeyScopes(["invoices:validate"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "INVOICE_VALIDATE_ROLE_REQUIRED",
          message:
            "Invoice validation requires an organization owner, admin, accountant, developer, or reviewer role."
        }),
        requireApiKeyRateLimitPolicy("invoices_validate")
      ]
    },
    async (request, reply) => {
      const validationRequest = readInvoicePayloadForValidation(request.body);

      if (!validationRequest.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_REQUEST_INVALID",
            message: "Request body failed validation request validation.",
            details: formatZodError(validationRequest.error)
          },
          disclaimer: buildSandboxDisclaimer("validation")
        });
      }

      if (request.authenticatedApiKey && !request.authenticatedApiKey.createdBy) {
        return reply.status(403).send({
          error: {
            code: "API_KEY_WORKSPACE_ACTOR_REQUIRED",
            message:
              "This API key cannot create workspace validation records because it is not linked to a creating workspace user.",
            details: null
          }
        });
      }

      const parsedBody = validateCanonicalInvoice(
        validationRequest.data.invoiceInput
      );

      if (!parsedBody.success) {
        const findings = enrichValidationFindings(
          parsedBody.findings.map((finding) => ({
            ...finding,
            field: finding.fieldPath
          }))
        );

        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body failed schema validation.",
            details: formatZodError(parsedBody.error)
          },
          findings,
          disclaimer: buildSandboxDisclaimer("validation")
        });
      }

      const payload = parsedBody.invoice;
      const organizationContext = resolveValidationOrganizationContext(request);
      const engineResult = await runValidationEngine({
        invoice: payload,
        organizationId: organizationContext.organizationId,
        createdBy: organizationContext.userId ?? null,
        viesMode: validationRequest.data.viesMode,
        xmlFindings: validationRequest.data.xmlFindings
      });
      const findings = engineResult.findings;
      const totals = engineResult.totals;

      const hasFatal = hasBlockingFinding(findings);
      const hasWarning = hasWarningFinding(findings);
      const isCrossBorder = isCrossBorderInvoice(payload);
      const hasCountryPackFinding = findings.some(
        (finding) => finding.category === "COUNTRY_PACK"
      );

      /*
       * Local JSON fallback still uses a readable development ID.
       * Supabase-backed validation runs use the database UUID returned after insert.
       */
      const localValidationRunId = `val_${randomUUID()}`;

      const technicalStatus: ValidationRunRecord["technicalStatus"] = hasFatal
        ? "failed"
        : "passed";

      const standardStatus: ValidationRunRecord["standardStatus"] = hasWarning
        ? "warning"
        : "ready";

      const countrySimulationStatus: ValidationRunRecord["countrySimulationStatus"] =
        isCrossBorder || hasCountryPackFinding ? "review_required" : "not_relevant";

      const vidaReadinessStatus: ValidationRunRecord["vidaReadinessStatus"] =
        isCrossBorder ? "relevant_simulation" : "not_relevant";

      const confidence: ValidationRunRecord["confidence"] = isCrossBorder
        ? "educational_simulation"
        : hasCountryPackFinding
          ? "educational_simulation"
          : "technical_preview";

      const disclaimer = `${buildSandboxDisclaimer("validation")} ${engineResult.disclaimer}`;

      const record: ValidationRunRecord = {
        id: localValidationRunId,
        invoiceNumber: payload.document.number,
        buyer: payload.buyer.name,
        buyerCountry: payload.buyer.country,
        seller: payload.seller.name,
        sellerCountry: payload.seller.country,
        issueDate: payload.document.issueDate,
        createdAt: new Date().toISOString(),
        technicalStatus,
        standardStatus,
        countrySimulationStatus,
        vidaReadinessStatus,
        confidence,
        profile: "API_VALIDATION",
        currency: payload.document.currency,
        totals,
        findings,
        disclaimer
      };

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const savedRecord = request.authenticatedApiKey
          ? await saveOrganizationValidationRun(
              {
                organizationId: request.authenticatedApiKey.organizationId,
                userId: request.authenticatedApiKey.createdBy ?? ""
              },
              record,
              payload
            )
          : authenticatedContext
            ? await saveAuthenticatedValidationRun(
                authenticatedContext,
                record,
                payload
              )
            : await saveValidationRun(record);

        return reply.status(200).send({
          validationRunId: savedRecord.id,
          invoiceNumber: payload.document.number,
          technicalStatus,
          standardStatus,
          countrySimulationStatus,
          vidaReadinessStatus,
          totals,
          findings,
          validationSummary: engineResult.summary,
          viesMode: engineResult.viesMode,
          viesChecks: buildValidationViesChecks(engineResult),
          disclaimer
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.post(
    "/export/ubl",
    {
      preHandler: [
        requireApiKeyScopes(["invoices:export_ubl"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceExporters, {
          code: "INVOICE_EXPORT_ROLE_REQUIRED",
          message:
            "UBL export requires an organization owner, admin, accountant, or developer role."
        }),
        requireApiKeyRateLimitPolicy("invoices_export_ubl")
      ]
    },
    async (request, reply) => {
      let exportRequest: UblExportRequestPayload;

      if (request.authenticatedApiKey && isDraftOnlyUblExportRequest(request)) {
        return reply.status(403).send({
          error: {
            code: "API_KEY_DRAFT_EXPORT_UNSUPPORTED",
            message:
              "API-key UBL export requests must include invoice payload data. Draft lookup stays limited to signed-in workspace users in this step.",
            details: null
          }
        });
      }

      try {
        exportRequest = await readInvoicePayloadForUblExport(request);
      } catch (error) {
        return sendStorageError(reply, error);
      }

      if (!exportRequest.invoiceInput) {
        return reply.status(404).send({
          error: {
            code: "DRAFT_NOT_FOUND",
            message: "Invoice draft was not found for UBL export readiness.",
            details: null
          }
        });
      }

      const parsedInvoice = validateCanonicalInvoice(exportRequest.invoiceInput);

      if (!parsedInvoice.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body failed canonical invoice schema validation.",
            details: formatZodError(parsedInvoice.error)
          },
          findings: parsedInvoice.findings,
          disclaimer: buildSandboxDisclaimer("ubl_export")
        });
      }

      const invoice = parsedInvoice.invoice;
      const findings = buildValidationFindings(invoice);
      const totals = calculateValidationTotals(invoice);
      const hasBlocking = hasBlockingFinding(findings);
      const hasWarning = hasWarningFinding(findings);
      const disclaimer = buildSandboxDisclaimer("ubl_export");
      const suggestedFilename = `invoice-lantern-ubl-${sanitizeFilenamePart(
        invoice.document.number
      )}.xml`;
      const contentType = "application/xml; charset=utf-8";
      const profile = invoice.document.profile.trim() || "UBL export readiness";

      const responseMetadata = {
        contentType,
        suggestedFilename,
        readinessLabel: "UBL export readiness"
      };

      if (hasBlocking) {
        return reply.status(422).send({
          xml: "",
          metadata: responseMetadata,
          readinessStatus: "blocked",
          totals,
          findings,
          disclaimer
        });
      }

      const xml = canonicalToUblInvoiceXml(invoice);
      const xmlSha256 = calculateXmlSha256(xml);
      const xmlSizeBytes = Buffer.byteLength(xml, "utf8");

      try {
        const authenticatedContext = getAuthenticatedInvoiceExportContext(request);
        const exportRecordInput = {
          invoiceDraftId: exportRequest.invoiceDraftId,
          validationRunId: exportRequest.validationRunId,
          exportType: "ubl_invoice" as const,
          format: "xml" as const,
          profile,
          filename: suggestedFilename,
          contentType,
          xmlSha256,
          xmlSizeBytes,
          status: "generated" as const,
          disclaimer
        };

        const exportRecord = request.authenticatedApiKey
          ? await saveOrganizationInvoiceExportRecord(
              {
                organizationId: request.authenticatedApiKey.organizationId,
                userId: request.authenticatedApiKey.createdBy
              },
              exportRecordInput
            )
          : authenticatedContext
            ? await saveAuthenticatedInvoiceExportRecord(
                authenticatedContext,
                exportRecordInput
              )
            : await saveInvoiceExportRecord(exportRecordInput);

        return reply.status(200).send({
          xml,
          metadata: {
            ...responseMetadata,
            exportId: exportRecord.id,
            filename: exportRecord.filename,
            xmlSha256: exportRecord.xmlSha256,
            xmlSizeBytes: exportRecord.xmlSizeBytes,
            createdAt: exportRecord.createdAt,
            status: exportRecord.status,
            profile: exportRecord.profile
          },
          exportId: exportRecord.id,
          filename: exportRecord.filename,
          contentType: exportRecord.contentType,
          xmlSha256: exportRecord.xmlSha256,
          xmlSizeBytes: exportRecord.xmlSizeBytes,
          createdAt: exportRecord.createdAt,
          status: exportRecord.status,
          profile: exportRecord.profile,
          readinessStatus: hasWarning ? "generated_with_warnings" : "generated",
          totals,
          findings,
          disclaimer
        });
      } catch (error) {
        return sendUblExportStorageError(reply, error);
      }
    }
  );
}
