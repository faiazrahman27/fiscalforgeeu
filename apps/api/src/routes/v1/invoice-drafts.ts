import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  invoiceDraftParamsSchema,
  invoiceEditorDraftSchema
} from "../../schemas/invoice.js";
import {
  buildDraftSummary,
  createInvoiceDraft,
  deleteInvoiceDraftById,
  getInvoiceDraftById,
  listInvoiceDraftSummaries,
  updateInvoiceDraftById
} from "../../repositories/invoice-draft-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

export async function invoiceDraftRoutes(app: FastifyInstance) {
  app.get(
    "/drafts",
    {
      preHandler: requireApiKey
    },
    async () => {
      const summaries = await listInvoiceDraftSummaries();

      return {
        records: summaries
      };
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

      const nextDraft = await createInvoiceDraft(parsedBody.data);

      return reply.status(201).send({
        record: nextDraft,
        summary: buildDraftSummary(nextDraft)
      });
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

      const draft = await getInvoiceDraftById(parsedParams.data.id);

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

      const updatedDraft = await updateInvoiceDraftById(
        parsedParams.data.id,
        parsedBody.data
      );

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

      const wasDeleted = await deleteInvoiceDraftById(parsedParams.data.id);

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
    }
  );
}
