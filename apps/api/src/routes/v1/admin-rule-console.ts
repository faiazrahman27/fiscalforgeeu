import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  adminCountryPackReviewPatchSchema,
  adminCountryPackSourceLinkSchema,
  adminRuleCreateSchema,
  adminRuleIdParamSchema,
  adminRulePatchSchema,
  adminSourceCreateSchema,
  adminSourcePatchSchema,
  countryCodeParamSchema,
  countryPackSourceParamSchema,
  uuidParamSchema
} from "../../schemas/admin-rule-console.js";
import {
  requirePlatformAdmin,
  requirePlatformAdminSignedUser,
  isPlatformAdminEmail
} from "../../middleware/require-platform-admin.js";
import {
  ADMIN_RULE_CONSOLE_DISCLAIMER,
  archiveRule,
  createRule,
  createSource,
  deprecateRule,
  deprecateSource,
  disableRule,
  getCountryPackAdminRecord,
  getRule,
  getSource,
  linkCountryPackSource,
  listCountryPackAdminRecords,
  listRules,
  listSources,
  publishRule,
  submitRuleForReview,
  unlinkCountryPackSource,
  updateCountryPackReview,
  updateRule,
  updateSource
} from "../../services/admin-rule-console-service.js";
import { HttpError, sendHttpError } from "../../utils/http-error.js";
import { formatZodError } from "../../utils/zod-error.js";

function sendValidationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: formatZodError(error)
    }
  });
}

function sendSafeRouteError(
  reply: FastifyReply,
  error: unknown,
  fallbackCode: string
) {
  if (error instanceof HttpError) {
    return sendHttpError(reply, error);
  }

  return reply.status(500).send({
    error: {
      code: fallbackCode,
      message: "The admin rule console request could not be completed.",
      details: null
    }
  });
}

function parseOrSend<T>(
  schema: z.ZodType<T>,
  value: unknown,
  reply: FastifyReply
) {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    sendValidationError(reply, parsed.error);
    return null;
  }

  return parsed.data;
}

function getActor(request: { platformAdmin?: { userId: string; emailHash: string } }) {
  if (!request.platformAdmin) {
    throw new HttpError({
      statusCode: 403,
      code: "PLATFORM_ADMIN_REQUIRED",
      message:
        "Platform rule, source, and country-pack administration requires a platform administrator."
    });
  }

  return {
    userId: request.platformAdmin.userId,
    emailHash: request.platformAdmin.emailHash
  };
}

export async function adminRuleConsoleRoutes(app: FastifyInstance) {
  app.get(
    "/context",
    {
      preHandler: [requirePlatformAdminSignedUser]
    },
    async (request, reply) => {
      if (reply.sent) {
        return;
      }

      const user = request.authenticatedUser;

      return reply.send({
        isPlatformAdmin: Boolean(user && isPlatformAdminEmail(user.email)),
        disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
      });
    }
  );

  app.get(
    "/rules",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (_request, reply) => {
      try {
        return reply.send({
          rules: await listRules(),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULES_LIST_FAILED");
      }
    }
  );

  app.post(
    "/rules",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const body = parseOrSend(adminRuleCreateSchema, request.body, reply);

      if (!body) {
        return;
      }

      try {
        return reply.status(201).send({
          rule: await createRule(body, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_CREATE_FAILED");
      }
    }
  );

  app.get(
    "/rules/:id",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          ...(await getRule(params.id)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_READ_FAILED");
      }
    }
  );

  app.patch(
    "/rules/:id",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);
      const body = parseOrSend(adminRulePatchSchema, request.body, reply);

      if (!params || !body) {
        return;
      }

      try {
        return reply.send({
          rule: await updateRule(params.id, body, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_UPDATE_FAILED");
      }
    }
  );

  app.post(
    "/rules/:id/submit-review",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          rule: await submitRuleForReview(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_REVIEW_FAILED");
      }
    }
  );

  app.post(
    "/rules/:id/publish",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          rule: await publishRule(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_PUBLISH_FAILED");
      }
    }
  );

  app.post(
    "/rules/:id/deprecate",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          rule: await deprecateRule(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_DEPRECATE_FAILED");
      }
    }
  );

  app.post(
    "/rules/:id/archive",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          rule: await archiveRule(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_ARCHIVE_FAILED");
      }
    }
  );

  app.post(
    "/rules/:id/disable",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(adminRuleIdParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          rule: await disableRule(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_RULE_DISABLE_FAILED");
      }
    }
  );

  app.get(
    "/sources",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (_request, reply) => {
      try {
        return reply.send({
          sources: await listSources(),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_SOURCES_LIST_FAILED");
      }
    }
  );

  app.post(
    "/sources",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const body = parseOrSend(adminSourceCreateSchema, request.body, reply);

      if (!body) {
        return;
      }

      try {
        return reply.status(201).send({
          source: await createSource(body, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_SOURCE_CREATE_FAILED");
      }
    }
  );

  app.get(
    "/sources/:id",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(uuidParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          ...(await getSource(params.id)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_SOURCE_READ_FAILED");
      }
    }
  );

  app.patch(
    "/sources/:id",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(uuidParamSchema, request.params, reply);
      const body = parseOrSend(adminSourcePatchSchema, request.body, reply);

      if (!params || !body) {
        return;
      }

      try {
        return reply.send({
          source: await updateSource(params.id, body, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_SOURCE_UPDATE_FAILED");
      }
    }
  );

  app.post(
    "/sources/:id/deprecate",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(uuidParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          source: await deprecateSource(params.id, getActor(request)),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_SOURCE_DEPRECATE_FAILED");
      }
    }
  );

  app.get(
    "/country-packs",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (_request, reply) => {
      try {
        return reply.send({
          countryPacks: await listCountryPackAdminRecords(),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_COUNTRY_PACKS_LIST_FAILED");
      }
    }
  );

  app.get(
    "/country-packs/:countryCode",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(countryCodeParamSchema, request.params, reply);

      if (!params) {
        return;
      }

      try {
        return reply.send({
          countryPack: await getCountryPackAdminRecord(params.countryCode),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(reply, error, "ADMIN_COUNTRY_PACK_READ_FAILED");
      }
    }
  );

  app.patch(
    "/country-packs/:countryCode/review",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(countryCodeParamSchema, request.params, reply);
      const body = parseOrSend(
        adminCountryPackReviewPatchSchema,
        request.body,
        reply
      );

      if (!params || !body) {
        return;
      }

      try {
        return reply.send({
          countryPack: await updateCountryPackReview(
            params.countryCode,
            body,
            getActor(request)
          ),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(
          reply,
          error,
          "ADMIN_COUNTRY_PACK_REVIEW_FAILED"
        );
      }
    }
  );

  app.post(
    "/country-packs/:countryCode/sources",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(countryCodeParamSchema, request.params, reply);
      const body = parseOrSend(
        adminCountryPackSourceLinkSchema,
        request.body,
        reply
      );

      if (!params || !body) {
        return;
      }

      try {
        return reply.status(201).send({
          countryPack: await linkCountryPackSource(
            params.countryCode,
            body,
            getActor(request)
          ),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(
          reply,
          error,
          "ADMIN_COUNTRY_PACK_SOURCE_LINK_FAILED"
        );
      }
    }
  );

  app.delete(
    "/country-packs/:countryCode/sources/:sourceId",
    {
      preHandler: [requirePlatformAdmin]
    },
    async (request, reply) => {
      const params = parseOrSend(
        countryPackSourceParamSchema,
        request.params,
        reply
      );

      if (!params) {
        return;
      }

      try {
        return reply.send({
          countryPack: await unlinkCountryPackSource(
            params.countryCode,
            params.sourceId,
            getActor(request)
          ),
          disclaimer: ADMIN_RULE_CONSOLE_DISCLAIMER
        });
      } catch (error) {
        return sendSafeRouteError(
          reply,
          error,
          "ADMIN_COUNTRY_PACK_SOURCE_UNLINK_FAILED"
        );
      }
    }
  );
}

