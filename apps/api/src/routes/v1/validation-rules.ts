import type { FastifyInstance, FastifyReply } from "fastify";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import { listPublishedValidationRules } from "../../repositories/validation-rule-repository.js";

function sendRuleCatalogError(reply: FastifyReply, error: unknown) {
  console.error("Validation rule catalog error:", error);

  return reply.status(500).send({
    error: {
      code: "VALIDATION_RULE_CATALOG_ERROR",
      message: "Could not load the published validation rule catalog.",
      details: error instanceof Error ? error.message : null
    }
  });
}

export async function validationRuleRoutes(app: FastifyInstance) {
  app.get(
    "/rules",
    {
      preHandler: requireApiKeyScopes(["rules:read"])
    },
    async (_request, reply) => {
      try {
        return await listPublishedValidationRules();
      } catch (error) {
        return sendRuleCatalogError(reply, error);
      }
    }
  );
}
