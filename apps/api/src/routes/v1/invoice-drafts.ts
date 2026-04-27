import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  invoiceDraftParamsSchema,
  invoiceEditorDraftSchema
} from "../../schemas/invoice.js";
import {
  buildDraftSummary,
  createAuthenticatedInvoiceDraft,
  createInvoiceDraft,
  deleteAuthenticatedInvoiceDraftById,
  deleteInvoiceDraftById,
  getAuthenticatedInvoiceDraftById,
  getInvoiceDraftById,
  hasAuthenticatedInvoiceDraftContext,
  listAuthenticatedInvoiceDraftSummaries,
  listInvoiceDraftSummaries,
  updateAuthenticatedInvoiceDraftById,
  updateInvoiceDraftById,
  type AuthenticatedInvoiceDraftContext
} from "../../repositories/invoice-draft-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

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

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Invoice draft storage error:", error);

  return reply.status(500).send({
    error: {
      code: "INVOICE_DRAFT_STORAGE_ERROR",
      message: "Could not complete the invoice draft storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

export async function invoiceDraftRoutes(app: FastifyInstance) {
  app.get(
    "/drafts",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const summaries = authenticatedContext
          ? await listAuthenticatedInvoiceDraftSummaries(authenticatedContext)
          : await listInvoiceDraftSummaries();

        return {
          records: summaries
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.post(
    "/drafts",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedBody = invoiceEditorDraftSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invoice draft failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const nextDraft = authenticatedContext
          ? await createAuthenticatedInvoiceDraft(
              authenticatedContext,
              parsedBody.data
            )
          : await createInvoiceDraft(parsedBody.data);

        return reply.status(201).send({
          record: nextDraft,
          summary: buildDraftSummary(nextDraft)
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/drafts/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = invoiceDraftParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Draft ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const draft = authenticatedContext
          ? await getAuthenticatedInvoiceDraftById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await getInvoiceDraftById(parsedParams.data.id);

        if (!draft) {
          return reply.status(404).send({
            error: {
              code: "DRAFT_NOT_FOUND",
              message: "Invoice draft was not found.",
              details: null
            }
          });
        }

        return {
          record: draft
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.put(
    "/drafts/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = invoiceDraftParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Draft ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const parsedBody = invoiceEditorDraftSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invoice draft failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const updatedDraft = authenticatedContext
          ? await updateAuthenticatedInvoiceDraftById(
              authenticatedContext,
              parsedParams.data.id,
              parsedBody.data
            )
          : await updateInvoiceDraftById(parsedParams.data.id, parsedBody.data);

        if (!updatedDraft) {
          return reply.status(404).send({
            error: {
              code: "DRAFT_NOT_FOUND",
              message: "Invoice draft was not found.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          record: updatedDraft,
          summary: buildDraftSummary(updatedDraft)
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.delete(
    "/drafts/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = invoiceDraftParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Draft ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const wasDeleted = authenticatedContext
          ? await deleteAuthenticatedInvoiceDraftById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await deleteInvoiceDraftById(parsedParams.data.id);

        if (!wasDeleted) {
          return reply.status(404).send({
            error: {
              code: "DRAFT_NOT_FOUND",
              message: "Invoice draft was not found.",
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
