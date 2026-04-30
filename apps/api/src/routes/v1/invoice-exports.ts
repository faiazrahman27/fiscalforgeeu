import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  hasAuthenticatedInvoiceExportContext,
  listAuthenticatedInvoiceExportRecords,
  listInvoiceExportRecords,
  type AuthenticatedInvoiceExportContext,
  type InvoiceExportRecord
} from "../../repositories/invoice-export-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

const invoiceExportListQuerySchema = z
  .object({
    invoiceDraftId: z.string().trim().min(1).max(120).optional(),
    validationRunId: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .strict();

function getAuthenticatedInvoiceExportContext(
  request: FastifyRequest
): AuthenticatedInvoiceExportContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedInvoiceExportContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Invoice export storage error:", error);

  return reply.status(500).send({
    error: {
      code: "INVOICE_EXPORT_STORAGE_ERROR",
      message: "Could not complete the invoice export storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function buildInvoiceExportSummary(record: InvoiceExportRecord) {
  return {
    id: record.id,
    invoiceDraftId: record.invoiceDraftId,
    validationRunId: record.validationRunId,
    exportType: record.exportType,
    format: record.format,
    profile: record.profile,
    filename: record.filename,
    contentType: record.contentType,
    xmlSha256: record.xmlSha256,
    xmlSizeBytes: record.xmlSizeBytes,
    status: record.status,
    createdAt: record.createdAt
  };
}

export async function invoiceExportRoutes(app: FastifyInstance) {
  app.get(
    "/exports",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedQuery = invoiceExportListQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invoice export list query failed schema validation.",
            details: formatZodError(parsedQuery.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceExportContext(request);

        const records = authenticatedContext
          ? await listAuthenticatedInvoiceExportRecords(
              authenticatedContext,
              parsedQuery.data
            )
          : await listInvoiceExportRecords(parsedQuery.data);

        return {
          records: records.map(buildInvoiceExportSummary)
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
