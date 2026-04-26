import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  invoiceDraftParamsSchema,
  invoiceEditorDraftSchema,
  type InvoiceEditorDraftPayload
} from "../../schemas/invoice.js";
import { readJsonCollection, writeJsonCollection } from "../../storage/json-store.js";
import { formatZodError } from "../../utils/zod-error.js";

type InvoiceDraftRecord = InvoiceEditorDraftPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type InvoiceDraftSummary = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: "Draft";
  amount: string;
  currency: string;
  updatedAt: string;
};

const INVOICE_DRAFTS_FILE = "invoice-drafts.json";

function buildDraftSummary(draft: InvoiceDraftRecord): InvoiceDraftSummary {
  return {
    id: draft.id,
    number: draft.document.number,
    buyer: draft.buyer.name,
    buyerCountry: draft.buyer.country,
    issueDate: draft.document.issueDate,
    status: "Draft",
    amount: `${draft.document.currency} ${draft.totals.payableAmount}`,
    currency: draft.document.currency,
    updatedAt: draft.updatedAt
  };
}

async function readInvoiceDrafts() {
  return readJsonCollection<InvoiceDraftRecord>(INVOICE_DRAFTS_FILE);
}

async function writeInvoiceDrafts(records: InvoiceDraftRecord[]) {
  await writeJsonCollection(INVOICE_DRAFTS_FILE, records);
}

export async function invoiceDraftRoutes(app: FastifyInstance) {
  app.get(
    "/drafts",
    {
      preHandler: requireApiKey
    },
    async () => {
      const drafts = await readInvoiceDrafts();

      return {
        records: drafts
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
          .map(buildDraftSummary)
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

      const now = new Date().toISOString();

      const nextDraft: InvoiceDraftRecord = {
        ...parsedBody.data,
        id: `draft_${randomUUID()}`,
        createdAt: now,
        updatedAt: now
      };

      const currentDrafts = await readInvoiceDrafts();
      const nextDrafts = [nextDraft, ...currentDrafts].slice(0, 250);

      await writeInvoiceDrafts(nextDrafts);

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

      const drafts = await readInvoiceDrafts();
      const draft = drafts.find((item) => item.id === parsedParams.data.id);

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

      const drafts = await readInvoiceDrafts();
      const nextDrafts = drafts.filter((item) => item.id !== parsedParams.data.id);

      if (nextDrafts.length === drafts.length) {
        return reply.status(404).send({
          error: {
            code: "DRAFT_NOT_FOUND",
            message: "Invoice draft was not found.",
            details: null
          }
        });
      }

      await writeInvoiceDrafts(nextDrafts);

      return reply.status(200).send({
        deleted: true,
        id: parsedParams.data.id
      });
    }
  );
}
