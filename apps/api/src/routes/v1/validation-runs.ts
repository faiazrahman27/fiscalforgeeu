import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  deleteAuthenticatedValidationRunById,
  deleteValidationRunById,
  getAuthenticatedValidationRunById,
  getValidationRunById,
  hasAuthenticatedValidationRunContext,
  listAuthenticatedValidationRuns,
  listValidationRuns,
  type AuthenticatedValidationRunContext,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import {
  buildValidationReportSummary,
  type ValidationReportFindingCounts,
  type ValidationReportSummary
} from "../../services/validation-report-summary.js";
import { formatZodError } from "../../utils/zod-error.js";

type ValidationRunSummary = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  issueDate: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  overallStatus: string;
  findingCounts: ValidationReportFindingCounts;
  findingsCount: number;
  payableAmount: string;
  reportLabel: string;
};

const validationRunParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

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

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Validation run storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VALIDATION_RUN_STORAGE_ERROR",
      message: "Could not complete the validation run storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function buildValidationRunSummary(
  run: ValidationRunRecord
): ValidationRunSummary {
  const reportSummary = buildValidationReportSummary(run);

  return {
    id: run.id,
    invoiceNumber: run.invoiceNumber,
    buyer: run.buyer,
    seller: run.seller,
    issueDate: run.issueDate ?? "",
    createdAt: run.createdAt,
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    countrySimulationStatus: run.countrySimulationStatus,
    vidaReadinessStatus: run.vidaReadinessStatus,
    confidence: run.confidence,
    profile: run.profile,
    currency: run.currency,
    overallStatus: reportSummary.overallStatus,
    findingCounts: reportSummary.findingCounts,
    findingsCount: run.findings.length,
    payableAmount: run.totals.payableAmount,
    reportLabel: "sandbox report"
  };
}

function buildValidationRunDetailResponse(run: ValidationRunRecord): {
  record: ValidationRunRecord;
  reportSummary: ValidationReportSummary;
} {
  return {
    record: run,
    reportSummary: buildValidationReportSummary(run)
  };
}

export async function validationRunRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const runs = authenticatedContext
          ? await listAuthenticatedValidationRuns(authenticatedContext)
          : await listValidationRuns();

        return {
          records: runs.map(buildValidationRunSummary)
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const run = authenticatedContext
          ? await getAuthenticatedValidationRunById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await getValidationRunById(parsedParams.data.id);

        if (!run) {
          return reply.status(404).send({
            error: {
              code: "VALIDATION_RUN_NOT_FOUND",
              message: "Validation run was not found.",
              details: null
            }
          });
        }

        return buildValidationRunDetailResponse(run);
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const wasDeleted = authenticatedContext
          ? await deleteAuthenticatedValidationRunById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await deleteValidationRunById(parsedParams.data.id);

        if (!wasDeleted) {
          return reply.status(404).send({
            error: {
              code: "VALIDATION_RUN_NOT_FOUND",
              message: "Validation run was not found.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          deleted: true,
          id: parsedParams.data.id
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
