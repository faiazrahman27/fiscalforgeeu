import {
  LEARNING_SCENARIO_DISCLAIMER,
  getLearningScenario,
  listLearningScenarios,
  previewLearningScenario
} from "@invoice-lantern/tax-engine";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import { formatZodError } from "../../utils/zod-error.js";

const scenarioIdParamsSchema = z
  .object({
    scenarioId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })
  .strict();

const previewBodySchema = z.object({}).strict();


export async function learningScenarioRoutes(app: FastifyInstance) {
  app.get(
    "/scenarios",
    {
      preHandler: [
        requireApiKeyScopes(["learning_scenarios:read"]),
        requireApiKeyRateLimitPolicy("learning_scenarios_read")
      ]
    },
    async (_request, reply) => {
      return reply.header("Cache-Control", "no-store").send({
        scenarios: listLearningScenarios(),
        disclaimer: LEARNING_SCENARIO_DISCLAIMER,
        notForProductionUse: true
      });
    }
  );

  app.get(
    "/scenarios/:scenarioId",
    {
      preHandler: [
        requireApiKeyScopes(["learning_scenarios:read"]),
        requireApiKeyRateLimitPolicy("learning_scenarios_read")
      ]
    },
    async (request, reply) => {
      const parsedParams = scenarioIdParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "LEARNING_SCENARIO_ID_INVALID",
            message: "Learning scenario ID is invalid.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const scenario = getLearningScenario(parsedParams.data.scenarioId);

      if (!scenario) {
        return reply.status(404).send({
          error: {
            code: "LEARNING_SCENARIO_NOT_FOUND",
            message: "Learning scenario is not currently available.",
            details: {
              scenarioId: parsedParams.data.scenarioId
            }
          }
        });
      }

      return reply.header("Cache-Control", "no-store").send({
        scenario,
        disclaimer: scenario.disclaimer,
        notForProductionUse: true
      });
    }
  );

  app.post(
    "/scenarios/:scenarioId/preview",
    {
      preHandler: [
        requireApiKeyScopes(["learning_scenarios:read"]),
        requireApiKeyRateLimitPolicy("learning_scenarios_read")
      ]
    },
    async (request, reply) => {
      const parsedParams = scenarioIdParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "LEARNING_SCENARIO_ID_INVALID",
            message: "Learning scenario ID is invalid.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const parsedBody = previewBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "LEARNING_SCENARIO_PREVIEW_REQUEST_INVALID",
            message: "Learning scenario preview request does not accept extra fields.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      const preview = previewLearningScenario(parsedParams.data.scenarioId);

      if (!preview) {
        return reply.status(404).send({
          error: {
            code: "LEARNING_SCENARIO_NOT_FOUND",
            message: "Learning scenario is not currently available.",
            details: {
              scenarioId: parsedParams.data.scenarioId
            }
          }
        });
      }

      return reply.header("Cache-Control", "no-store").send({
        ...preview,
        persisted: false
      });
    }
  );
}
