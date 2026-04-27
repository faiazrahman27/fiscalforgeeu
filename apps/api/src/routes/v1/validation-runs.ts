import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  deleteValidationRunById,
  getValidationRunById,
  listValidationRuns,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

type ValidationRunSummary = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  findingsCount: number;
  payableAmount: number;
};

const validationRunParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

function buildValidationRunSummary(
  run: ValidationRunRecord
): ValidationRunSummary {
  return {
    id: run.id,
    invoiceNumber: run.invoiceNumber,
    buyer: run.buyer,
    seller: run.seller,
    createdAt: run.createdAt,
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    countrySimulationStatus: run.countrySimulationStatus,
    vidaReadinessStatus: run.vidaReadinessStatus,
    confidence: run.confidence,
    profile: run.profile,
    currency: run.currency,
    findingsCount: run.findings.length,
    payableAmount: run.totals.payableAmount
  };
}

export async function validationRunRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireApiKey
    },
    async () => {
      const runs = await listValidationRuns();

      return {
        records: runs
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
          .map(buildValidationRunSummary)
      };
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

      const run = await getValidationRunById(parsedParams.data.id);

      if (!run) {
        return reply.status(404).send({
          error: {
            code: "VALIDATION_RUN_NOT_FOUND",
            message: "Validation run was not found.",
            details: null
          }
        });
      }

      return {
        record: run
      };
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

      const wasDeleted = await deleteValidationRunById(parsedParams.data.id);

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
    }
  );
}
