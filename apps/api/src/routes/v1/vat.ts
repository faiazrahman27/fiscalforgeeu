import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  validateVatFormat,
  type VatFormatResult
} from "@invoice-lantern/tax-engine";
import { z } from "zod";
import {
  requireApiKey,
  requireApiKeyScopes
} from "../../middleware/require-api-key.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import {
  WORKSPACE_ROLE_SETS,
  rejectOrganizationApiKey,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  hasAuthenticatedVatNumberCheckContext,
  listAuthenticatedVatNumberCheckRecords,
  listVatNumberCheckRecords,
  saveAuthenticatedVatNumberCheckRecord,
  saveVatNumberCheckRecord,
  type AuthenticatedVatNumberCheckContext,
  type VatNumberCheckRecord
} from "../../repositories/vat-number-check-repository.js";
import {
  buildViesFindingFromEvidence,
  buildViesFindingFromStatus
} from "../../services/validation-finding-enrichment.js";
import { checkViesEvidence } from "../../services/vies-check-service.js";
import { formatZodError } from "../../utils/zod-error.js";

const vatFormatRequestSchema = z.object({
  vatId: z.string().max(64),
  countryHint: z.string().max(8).optional(),
  persist: z.boolean().optional(),
  invoiceDraftId: z.string().trim().min(1).max(120).optional(),
  validationRunId: z.string().trim().min(1).max(120).optional(),
  partyRole: z.enum(["seller", "buyer", "other"]).optional()
});

const vatCheckListQuerySchema = z
  .object({
    invoiceDraftId: z.string().trim().min(1).max(120).optional(),
    validationRunId: z.string().trim().min(1).max(120).optional(),
    partyRole: z.enum(["seller", "buyer", "other"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .strict();

const viesCheckRequestSchema = z
  .object({
    countryCode: z.string().trim().min(2).max(8),
    vatNumber: z.string().trim().min(1).max(64),
    invoiceDraftId: z.string().trim().min(1).max(120).optional(),
    validationRunId: z.string().trim().min(1).max(120).optional(),
    partyRole: z.enum(["seller", "buyer", "other"]).optional()
  })
  .strict();

function getAuthenticatedVatNumberCheckContext(
  request: FastifyRequest
): AuthenticatedVatNumberCheckContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedVatNumberCheckContext(context) ? context : null;
}

function sendVatCheckStorageError(reply: FastifyReply, error: unknown) {
  console.error("VAT/VIES check storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VAT_CHECK_STORAGE_ERROR",
      message: "Could not complete the VAT/VIES evidence operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function resolveViesOrganizationContext(request: FastifyRequest) {
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

function buildVatCheckCreateInput(
  result: VatFormatResult,
  requestBody: z.infer<typeof vatFormatRequestSchema>
) {
  return {
    invoiceDraftId: requestBody.invoiceDraftId ?? null,
    validationRunId: requestBody.validationRunId ?? null,
    partyRole: requestBody.partyRole ?? null,
    inputCountryHint: requestBody.countryHint ?? null,
    detectedCountryCode: result.countryCode ?? null,
    normalizedVatId: result.normalized,
    formatValid: result.formatValid,
    message: result.message,
    warnings: result.warnings,
    disclaimer: result.disclaimer
  };
}

function buildVatCheckSummary(record: VatNumberCheckRecord) {
  return {
    id: record.id,
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    partyRole: record.partyRole,
    inputCountryHint: record.inputCountryHint,
    detectedCountryCode: record.detectedCountryCode,
    normalizedVatId: record.normalizedVatId,
    checkLevel: record.checkLevel,
    source: record.source,
    formatValid: record.formatValid,
    message: record.message,
    warnings: record.warnings,
    disclaimer: record.disclaimer,
    createdAt: record.createdAt
  };
}

function buildViesEvidenceSummary(
  record: Awaited<ReturnType<typeof checkViesEvidence>>["evidence"]
) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    organizationId: record.organizationId,
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    partyRole: record.partyRole,
    countryCode: record.countryCode,
    vatNumberNormalized: record.vatNumberNormalized,
    vatNumberDisplay: record.vatNumberDisplay,
    requestSource: record.requestSource,
    status: record.status,
    viesValid: record.viesValid,
    viesName: record.viesName,
    viesAddress: record.viesAddress,
    requestIdentifier: record.requestIdentifier,
    checkedAt: record.checkedAt,
    sourceLabel: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    responseTimeMs: record.responseTimeMs,
    errorCode: record.errorCode,
    errorMessageSafe: record.errorMessageSafe,
    rawResponseHash: record.rawResponseHash,
    metadata: record.metadata,
    createdAt: record.createdAt
  };
}

export async function vatRoutes(app: FastifyInstance) {
  app.post(
    "/validate-format",
    {
      preHandler: [
        requireApiKeyScopes(["vat:validate_format"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "VAT_VALIDATE_ROLE_REQUIRED",
          message:
            "VAT format checks require an organization owner, admin, accountant, developer, or reviewer role."
        }),
        requireApiKeyRateLimitPolicy("vat_validate_format")
      ]
    },
    async (request, reply) => {
      const parsedBody = vatFormatRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VAT_FORMAT_REQUEST_INVALID",
            message: "Request body failed VAT format request validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      if (request.authenticatedApiKey && parsedBody.data.persist) {
        return reply.status(403).send({
          error: {
            code: "API_KEY_VAT_PERSIST_UNSUPPORTED",
            message:
              "API-key VAT format requests can run technical checks, but cannot persist workspace evidence records in this step.",
            details: null
          }
        });
      }

      const vatFormatResult = validateVatFormat(
        parsedBody.data.vatId,
        parsedBody.data.countryHint
      );

      if (!parsedBody.data.persist) {
        return {
          ...vatFormatResult,
          persisted: false
        };
      }

      try {
        const authenticatedContext =
          getAuthenticatedVatNumberCheckContext(request);
        const createInput = buildVatCheckCreateInput(
          vatFormatResult,
          parsedBody.data
        );

        const record = authenticatedContext
          ? await saveAuthenticatedVatNumberCheckRecord(
              authenticatedContext,
              createInput
            )
          : await saveVatNumberCheckRecord(createInput);

        return {
          ...vatFormatResult,
          persisted: true,
          checkRecordId: record.id
        };
      } catch (error) {
        return sendVatCheckStorageError(reply, error);
      }
    }
  );

  app.post(
    "/check-vies",
    {
      preHandler: [
        requireApiKeyScopes(["vat:check_vies"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "VAT_CHECK_VIES_ROLE_REQUIRED",
          message:
            "VIES evidence checks require an organization owner, admin, accountant, developer, or reviewer role."
        }),
        requireApiKeyRateLimitPolicy("vat_check_vies")
      ]
    },
    async (request, reply) => {
      const parsedBody = viesCheckRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VIES_CHECK_REQUEST_INVALID",
            message: "Request body failed VIES evidence request validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const organizationContext = resolveViesOrganizationContext(request);
        const result = await checkViesEvidence({
          organizationId: organizationContext.organizationId,
          countryCode: parsedBody.data.countryCode,
          vatNumber: parsedBody.data.vatNumber,
          invoiceDraftId: parsedBody.data.invoiceDraftId ?? null,
          validationRunId: parsedBody.data.validationRunId ?? null,
          partyRole: parsedBody.data.partyRole ?? null,
          createdBy: organizationContext.userId ?? null
        });
        const findings = [
          result.evidence
            ? buildViesFindingFromEvidence({
                record: result.evidence,
                fieldPath:
                  parsedBody.data.partyRole === "seller"
                    ? "seller.vatId"
                    : parsedBody.data.partyRole === "buyer"
                      ? "buyer.vatId"
                      : "parties.vatId"
              })
            : buildViesFindingFromStatus({
                status: result.status,
                countryCode: parsedBody.data.countryCode,
                vatNumberDisplay: parsedBody.data.vatNumber,
                fieldPath:
                  parsedBody.data.partyRole === "seller"
                    ? "seller.vatId"
                    : parsedBody.data.partyRole === "buyer"
                      ? "buyer.vatId"
                      : "parties.vatId",
                checkedAt: result.checkedAt
              })
        ];

        return {
          formatCheck: result.formatCheck,
          viesCheck: {
            status: result.status,
            viesValid: result.viesValid,
            checkedAt: result.checkedAt,
            source: result.source,
            evidence: buildViesEvidenceSummary(result.evidence)
          },
          evidence: buildViesEvidenceSummary(result.evidence),
          status: result.status,
          checkedAt: result.checkedAt,
          source: result.source,
          disclaimer: result.disclaimer,
          findings
        };
      } catch (error) {
        return sendVatCheckStorageError(reply, error);
      }
    }
  );

  app.get(
    "/checks",
    {
      preHandler: [
        requireApiKey,
        rejectOrganizationApiKey,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.validationRunReaders, {
          code: "VAT_CHECK_READ_ROLE_REQUIRED",
          message:
            "VAT check history requires workspace membership with an allowed report-read role."
        })
      ]
    },
    async (request, reply) => {
      const parsedQuery = vatCheckListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VAT_CHECK_QUERY_INVALID",
            message: "VAT format check history query failed validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      try {
        const authenticatedContext =
          getAuthenticatedVatNumberCheckContext(request);
        const records = authenticatedContext
          ? await listAuthenticatedVatNumberCheckRecords(
              authenticatedContext,
              parsedQuery.data
            )
          : await listVatNumberCheckRecords(parsedQuery.data);

        return {
          records: records.map(buildVatCheckSummary)
        };
      } catch (error) {
        return sendVatCheckStorageError(reply, error);
      }
    }
  );
}
