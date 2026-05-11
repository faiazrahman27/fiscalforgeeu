import {
  simulateVidaReadiness,
  type VidaReadinessSimulationInput
} from "@invoice-lantern/vida-simulator";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  requireApiKeyScopes,
  requireSupabaseUser
} from "../../middleware/require-api-key.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import {
  getAuthenticatedVidaSimulationRunRecord,
  hasAuthenticatedVidaSimulationRunContext,
  listAuthenticatedVidaSimulationRunRecords,
  saveAuthenticatedVidaSimulationRunRecord,
  type AuthenticatedVidaSimulationRunContext,
  type VidaSimulationRunRecord
} from "../../repositories/vida-simulation-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const vidaBuyerTypeSchema = z.enum([
  "business",
  "consumer",
  "public_authority",
  "unknown"
]);

const vidaTransactionTypeSchema = z.enum([
  "goods",
  "services",
  "digital_service",
  "mixed",
  "unknown"
]);

const vidaRelevanceSchema = z.enum([
  "high",
  "medium",
  "low",
  "not_relevant",
  "review_required"
]);

const vidaTransactionClassSchema = z.enum([
  "intra_eu_b2b_goods",
  "intra_eu_b2b_service",
  "intra_eu_b2b_digital_service",
  "intra_eu_b2b_mixed",
  "intra_eu_b2b_unknown",
  "intra_eu_b2c",
  "intra_eu_public_authority",
  "domestic_eu_business",
  "domestic_eu_consumer",
  "domestic_eu_unknown",
  "non_eu_or_unsupported",
  "insufficient_data"
]);

const vidaSimulationRequestSchema = z
  .object({
    sellerCountry: z.string().trim().min(1).max(8),
    buyerCountry: z.string().trim().min(1).max(8),
    sellerVatId: z.string().trim().max(64).optional(),
    buyerVatId: z.string().trim().max(64).optional(),
    buyerType: vidaBuyerTypeSchema.optional(),
    transactionType: vidaTransactionTypeSchema.optional(),
    invoiceDate: z.string().trim().max(32).optional(),
    currency: z.string().trim().max(8).optional(),
    amount: z.string().trim().max(80).optional(),
    countryPackVersions: z
      .record(z.string().trim().min(1).max(8), z.string().trim().min(1).max(80))
      .optional(),

    /*
     * Persistence is opt-in. Normal developer API calls can run simulations
     * without creating workspace-owned evidence records.
     */
    persist: z.boolean().optional(),

    /*
     * Optional workspace-owned associations. The repository verifies ownership
     * before storing these IDs.
     */
    invoiceDraftId: z.string().trim().min(1).max(120).optional(),
    validationRunId: z.string().trim().min(1).max(120).optional()
  })
  .strict();

const vidaSimulationListQuerySchema = z
  .object({
    invoiceDraftId: z.string().trim().min(1).max(120).optional(),
    validationRunId: z.string().trim().min(1).max(120).optional(),
    vidaRelevance: vidaRelevanceSchema.optional(),
    transactionClass: vidaTransactionClassSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .strict();

const vidaSimulationDetailParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(160)
  })
  .strict();

function getAuthenticatedVidaSimulationRunContext(
  request: FastifyRequest
): AuthenticatedVidaSimulationRunContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedVidaSimulationRunContext(context) ? context : null;
}

function sendWorkspaceAuthRequired(reply: FastifyReply) {
  return reply.status(401).send({
    error: {
      code: "WORKSPACE_AUTH_REQUIRED",
      message:
        "Sign in before creating or reading workspace ViDA simulation records.",
      details: null
    }
  });
}

function sendVidaSimulationStorageError(reply: FastifyReply, error: unknown) {
  console.error("ViDA simulation run storage error:", error);

  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("must be a database UUID") ||
    message.includes("was not found in this workspace")
  ) {
    return reply.status(400).send({
      error: {
        code: "VIDA_SIMULATION_ASSOCIATION_INVALID",
        message:
          "The linked invoice draft or validation run could not be verified for this workspace.",
        details: message || null
      }
    });
  }

  return reply.status(500).send({
    error: {
      code: "VIDA_SIMULATION_STORAGE_ERROR",
      message: "Could not complete the ViDA simulation evidence operation.",
      details: message || null
    }
  });
}

function buildVidaSimulationInput(
  data: z.infer<typeof vidaSimulationRequestSchema>
): VidaReadinessSimulationInput {
  const input: VidaReadinessSimulationInput = {
    sellerCountry: data.sellerCountry,
    buyerCountry: data.buyerCountry
  };

  if (data.sellerVatId !== undefined) {
    input.sellerVatId = data.sellerVatId;
  }

  if (data.buyerVatId !== undefined) {
    input.buyerVatId = data.buyerVatId;
  }

  if (data.buyerType !== undefined) {
    input.buyerType = data.buyerType;
  }

  if (data.transactionType !== undefined) {
    input.transactionType = data.transactionType;
  }

  if (data.invoiceDate !== undefined) {
    input.invoiceDate = data.invoiceDate;
  }

  if (data.currency !== undefined) {
    input.currency = data.currency;
  }

  if (data.amount !== undefined) {
    input.amount = data.amount;
  }

  if (data.countryPackVersions !== undefined) {
    input.countryPackVersions = data.countryPackVersions;
  }

  return input;
}

function buildSafeRequestMetadata(request: FastifyRequest) {
  return {
    method: request.method,
    path: request.routeOptions.url ?? request.url.split("?")[0],
    authenticationMode: request.authenticationMode ?? null,
    userAgent:
      typeof request.headers["user-agent"] === "string"
        ? request.headers["user-agent"].slice(0, 240)
        : null,
    ipAddress: request.ip ?? null
  };
}

function buildVidaSimulationRunSummary(record: VidaSimulationRunRecord) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    createdBy: record.createdBy,
    apiKeyId: record.apiKeyId,
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    source: record.source,
    status: record.status,
    simulationVersion: record.simulationVersion,
    sellerCountryCode: record.sellerCountryCode,
    buyerCountryCode: record.buyerCountryCode,
    buyerType: record.buyerType,
    transactionType: record.transactionType,
    transactionClass: record.transactionClass,
    vidaRelevance: record.vidaRelevance,
    legalConfidence: record.legalConfidence,
    invoiceDate: record.invoiceDate,
    currencyCode: record.currencyCode,
    amountText: record.amountText,
    countryPackVersions: record.countryPackVersions,
    countryContext: record.countryContext,
    normalizedInput: record.normalizedInput,
    findingCount: record.findingCount,
    infoCount: record.infoCount,
    warningCount: record.warningCount,
    reviewRequiredCount: record.reviewRequiredCount,
    reason: record.reason,
    effectiveDateContext: record.effectiveDateContext,
    disclaimer: record.disclaimer,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function buildVidaSimulationRunDetail(record: VidaSimulationRunRecord) {
  return {
    ...buildVidaSimulationRunSummary(record),
    inputPayload: record.inputPayload,
    resultPayload: record.resultPayload,
    findings: record.findings,
    sourceLabels: record.sourceLabels,
    recommendedNextActions: record.recommendedNextActions,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    requestMetadata: record.requestMetadata
  };
}

export async function transactionRoutes(app: FastifyInstance) {
  app.post(
    "/simulate-vida",
    {
      preHandler: [
        requireApiKeyScopes(["transactions:simulate_vida"]),
        requireApiKeyRateLimitPolicy("transactions_simulate_vida")
      ]
    },
    async (request, reply) => {
      const parsedBody = vidaSimulationRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VIDA_SIMULATION_REQUEST_INVALID",
            message: "Request body failed ViDA-readiness simulation validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      const simulationInput = buildVidaSimulationInput(parsedBody.data);
      const simulationResult = simulateVidaReadiness(simulationInput);

      if (!parsedBody.data.persist) {
        return {
          ...simulationResult,
          persisted: false
        };
      }

      /*
       * Organization API keys may run the simulator, but they cannot create
       * workspace-owned audit/history records. Persistence requires a signed-in
       * Supabase workspace session so database RLS evaluates the real user.
       */
      if (request.authenticationMode === "organization_api_key") {
        return reply.status(403).send({
          error: {
            code: "API_KEY_VIDA_PERSIST_UNSUPPORTED",
            message:
              "API-key ViDA simulation requests can run technical simulations, but workspace persistence requires a signed-in workspace user.",
            details: null
          }
        });
      }

      const authenticatedContext = getAuthenticatedVidaSimulationRunContext(request);

      if (!authenticatedContext) {
        return sendWorkspaceAuthRequired(reply);
      }

      try {
        const record = await saveAuthenticatedVidaSimulationRunRecord(
          authenticatedContext,
          {
            inputPayload: simulationInput,
            result: simulationResult,
            invoiceDraftId: parsedBody.data.invoiceDraftId ?? null,
            validationRunId: parsedBody.data.validationRunId ?? null,
            source: "workspace",
            requestMetadata: buildSafeRequestMetadata(request)
          }
        );

        return {
          ...simulationResult,
          persisted: true,
          simulationRunId: record.id,
          simulationRun: buildVidaSimulationRunSummary(record)
        };
      } catch (error) {
        return sendVidaSimulationStorageError(reply, error);
      }
    }
  );

  app.get(
    "/vida-simulations",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedQuery = vidaSimulationListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VIDA_SIMULATION_LIST_QUERY_INVALID",
            message: "ViDA simulation history query failed validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      const authenticatedContext = getAuthenticatedVidaSimulationRunContext(request);

      if (!authenticatedContext) {
        return sendWorkspaceAuthRequired(reply);
      }

      try {
        const records = await listAuthenticatedVidaSimulationRunRecords(
          authenticatedContext,
          parsedQuery.data
        );

        return {
          records: records.map(buildVidaSimulationRunSummary)
        };
      } catch (error) {
        return sendVidaSimulationStorageError(reply, error);
      }
    }
  );

  app.get(
    "/vida-simulations/:id",
    {
      preHandler: requireSupabaseUser
    },
    async (request, reply) => {
      const parsedParams = vidaSimulationDetailParamsSchema.safeParse(
        request.params
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VIDA_SIMULATION_DETAIL_PARAMS_INVALID",
            message: "ViDA simulation detail parameters failed validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const authenticatedContext = getAuthenticatedVidaSimulationRunContext(request);

      if (!authenticatedContext) {
        return sendWorkspaceAuthRequired(reply);
      }

      try {
        const record = await getAuthenticatedVidaSimulationRunRecord(
          authenticatedContext,
          parsedParams.data.id
        );

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "VIDA_SIMULATION_RUN_NOT_FOUND",
              message: "ViDA simulation run was not found.",
              details: null
            }
          });
        }

        return {
          record: buildVidaSimulationRunDetail(record)
        };
      } catch (error) {
        return sendVidaSimulationStorageError(reply, error);
      }
    }
  );
}