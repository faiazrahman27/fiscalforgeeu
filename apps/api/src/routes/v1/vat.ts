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
import {
  hasAuthenticatedVatNumberCheckContext,
  listAuthenticatedVatNumberCheckRecords,
  listVatNumberCheckRecords,
  saveAuthenticatedVatNumberCheckRecord,
  saveVatNumberCheckRecord,
  type AuthenticatedVatNumberCheckContext,
  type VatNumberCheckRecord
} from "../../repositories/vat-number-check-repository.js";
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
  console.error("VAT number check storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VAT_CHECK_STORAGE_ERROR",
      message: "Could not complete the VAT format check evidence operation.",
      details: error instanceof Error ? error.message : null
    }
  });
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

export async function vatRoutes(app: FastifyInstance) {
  app.post(
    "/validate-format",
    {
      preHandler: requireApiKeyScopes(["vat:validate_format"])
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

  app.get(
    "/checks",
    {
      preHandler: requireApiKey
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
