import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  LegalDocumentRepositoryError,
  acceptLegalDocument,
  getLegalDocumentByKey,
  listLegalDocuments,
  listMyLegalAcceptances,
  listWorkspaceLegalAcceptances,
  type LegalAcceptanceContext
} from "../../repositories/legal-document-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const legalDocumentParamsSchema = z
  .object({
    documentKey: z.string().trim().min(1).max(120)
  })
  .strict();

const legalAcceptanceSchema = z
  .object({
    acceptanceContext: z
      .enum([
        "workspace",
        "developer",
        "api_terms",
        "webhook",
        "privacy",
        "public",
        "country_pack"
      ])
      .default("workspace"),
    metadata: z.record(z.string(), z.unknown()).optional().default({})
  })
  .strict();

function readBearerToken(request: FastifyRequest) {
  const rawAuthorizationHeader = request.headers.authorization;

  if (
    Array.isArray(rawAuthorizationHeader) ||
    typeof rawAuthorizationHeader !== "string"
  ) {
    return "";
  }

  const trimmedHeader = rawAuthorizationHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return trimmedHeader.slice("bearer ".length).trim();
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function normalizeLegalDocument(document: Awaited<ReturnType<typeof getLegalDocumentByKey>>) {
  if (!document) {
    return null;
  }

  return {
    documentKey: document.documentKey,
    title: document.title,
    category: document.category,
    audience: document.audience,
    status: document.status,
    version: document.version,
    effectiveFrom: document.effectiveFrom,
    reviewedAt: document.reviewedAt,
    reviewerLabel: document.reviewerLabel,
    isRequired: document.isRequired,
    requiresAcceptance: document.requiresAcceptance,
    legalReviewRequired: document.legalReviewRequired,
    professionalReviewRequired: document.professionalReviewRequired,
    summary: document.summary,
    bodyMd: document.bodyMd,
    sourceRefs: document.sourceRefs,
    changeNotes: document.changeNotes,
    disclaimers: document.disclaimers
  };
}

function sendLegalError(reply: FastifyReply, error: unknown) {
  if (error instanceof LegalDocumentRepositoryError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: null
      }
    });
  }

  return reply.status(500).send({
    error: {
      code: "LEGAL_DOCUMENT_OPERATION_FAILED",
      message: "Could not complete the legal document operation.",
      details: null
    }
  });
}

async function requireLegalSignedUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.authenticatedUser) {
    return;
  }

  if (env.APP_ENV === "test") {
    const email = readHeaderString(request.headers["x-test-user-email"]);

    if (email) {
      request.authenticatedUser = {
        id:
          readHeaderString(request.headers["x-test-user-id"]) ||
          "00000000-0000-4000-8000-000000000777",
        email,
        role: "authenticated"
      };
      request.authenticatedAccessToken = "test-signed-user-token";
      request.authenticationMode = "supabase_user";

      return;
    }
  }

  return requireSupabaseUser(request, reply);
}

function getSignedUserContext(request: FastifyRequest) {
  const userId = request.authenticatedUser?.id ?? "";
  const accessToken = request.authenticatedAccessToken || readBearerToken(request);

  if (!userId || !accessToken) {
    return null;
  }

  return {
    userId,
    accessToken
  };
}

export async function legalDocumentRoutes(app: FastifyInstance) {
  app.get("/documents", async () => {
    const documents = await listLegalDocuments();

    return {
      documents: documents.map((document) => {
        const normalizedDocument = normalizeLegalDocument(document);

        return normalizedDocument
          ? {
              ...normalizedDocument,
              bodyMd: undefined
            }
          : null;
      }).filter(Boolean),
      disclaimer:
        "Legal documents are product policy drafts and notices. They are not legal advice, do not create official compliance, and require professional review."
    };
  });

  app.get("/documents/:documentKey", async (request, reply) => {
    const parsedParams = legalDocumentParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Legal document key failed validation.",
          details: formatZodError(parsedParams.error)
        }
      });
    }

    const document = await getLegalDocumentByKey(parsedParams.data.documentKey);

    if (!document) {
      return reply.status(404).send({
        error: {
          code: "LEGAL_DOCUMENT_NOT_FOUND",
          message: "Legal document was not found or is not published.",
          details: null
        }
      });
    }

    return {
      document: normalizeLegalDocument(document)
    };
  });

  app.get(
    "/acceptances/me",
    {
      preHandler: [requireLegalSignedUser]
    },
    async (request, reply) => {
      const context = getSignedUserContext(request);

      if (!context) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Legal acceptance status requires a signed-in user.",
            details: null
          }
        });
      }

      try {
        const records = await listMyLegalAcceptances(context);

        return {
          records,
          disclaimer:
            "Acceptance records identify policy versions accepted by the signed-in user. They do not make validation results legally, tax, accounting, privacy, or officially compliant."
        };
      } catch (error) {
        return sendLegalError(reply, error);
      }
    }
  );

  app.get(
    "/acceptances/workspace",
    {
      preHandler: [
        requireLegalSignedUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.privacyManagers, {
          code: "LEGAL_ACCEPTANCE_WORKSPACE_MANAGER_REQUIRED",
          message:
            "Workspace legal acceptance status requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const context = getSignedUserContext(request);

      if (!context) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Workspace legal acceptance status requires a signed-in user.",
            details: null
          }
        });
      }

      try {
        const records = await listWorkspaceLegalAcceptances(context);

        return {
          records,
          disclaimer:
            "Workspace acceptance visibility is an audit aid only and is not legal, tax, accounting, privacy, filing, or compliance advice."
        };
      } catch (error) {
        return sendLegalError(reply, error);
      }
    }
  );

  app.post(
    "/documents/:documentKey/accept",
    {
      preHandler: [requireLegalSignedUser]
    },
    async (request, reply) => {
      const context = getSignedUserContext(request);

      if (!context) {
        return reply.status(401).send({
          error: {
            code: "AUTHENTICATED_USER_REQUIRED",
            message: "Legal document acceptance requires a signed-in user.",
            details: null
          }
        });
      }

      const parsedParams = legalDocumentParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Legal document key failed validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const parsedBody = legalAcceptanceSchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Legal document acceptance failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const result = await acceptLegalDocument({
          userId: context.userId,
          accessToken: context.accessToken,
          documentKey: parsedParams.data.documentKey,
          acceptanceContext:
            parsedBody.data.acceptanceContext as LegalAcceptanceContext,
          ipAddress: request.ip,
          userAgent: readHeaderString(request.headers["user-agent"]),
          metadata: parsedBody.data.metadata
        });

        return reply.status(result.alreadyAccepted ? 200 : 201).send({
          record: result.record,
          alreadyAccepted: result.alreadyAccepted,
          disclaimer:
            "Accepting a legal document records a product policy version. It does not create official compliance, legal advice, tax advice, accounting advice, privacy advice, filing status, or authority acceptance."
        });
      } catch (error) {
        return sendLegalError(reply, error);
      }
    }
  );
}
