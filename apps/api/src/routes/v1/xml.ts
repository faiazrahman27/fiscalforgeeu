import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  createXmlUploadRecord,
  listXmlUploadRecords,
  type XmlApiInspectionStatus
} from "../../repositories/xml-upload-repository.js";

const xmlBodySchema = z
  .string()
  .min(1, "XML body cannot be empty")
  .max(env.API_BODY_LIMIT_BYTES, "XML body is too large");

function detectRootElement(xml: string) {
  const match = xml.match(/<([A-Za-z_][\w:.-]*)(\s|>)/);
  const rawRoot = match?.[1] ?? "unknown";

  return rawRoot.includes(":") ? rawRoot.split(":").pop() ?? rawRoot : rawRoot;
}

function detectDocumentType(rootElement: string) {
  const normalized = rootElement.toLowerCase();

  if (normalized.includes("creditnote")) {
    return "credit_note";
  }

  if (normalized.includes("invoice")) {
    return "invoice";
  }

  return "unknown";
}

function extractFirstTagValue(xml: string, tagName: string) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const namespacedPattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );

  const match = xml.match(namespacedPattern);

  return match?.[1]?.trim().slice(0, 180) || "not_detected";
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(value: string) {
  const cleaned = value
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.trim()
    .slice(0, 180);

  return cleaned || "uploaded-invoice.xml";
}

function formatBytesFromHeader(value: string) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export async function xmlRoutes(app: FastifyInstance) {
  app.get(
    "/uploads",
    {
      preHandler: requireApiKey
    },
    async () => {
      const records = await listXmlUploadRecords();

      return {
        records
      };
    }
  );

  app.post(
    "/inspect",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const contentType = request.headers["content-type"] ?? "";

      if (
        typeof contentType !== "string" ||
        (!contentType.includes("text/xml") &&
          !contentType.includes("application/xml"))
      ) {
        return reply.status(415).send({
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Use content-type text/xml or application/xml.",
            details: null
          }
        });
      }

      const rawBody = typeof request.body === "string" ? request.body : "";
      const parsedBody = xmlBodySchema.safeParse(rawBody);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "XML_BODY_INVALID",
            message: "XML body failed validation.",
            details: parsedBody.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
              code: issue.code
            }))
          }
        });
      }

      const xml = parsedBody.data;
      const rootElement = detectRootElement(xml);
      const detectedDocument = detectDocumentType(rootElement);
      const apiStatus: XmlApiInspectionStatus =
        detectedDocument === "unknown" ? "review_required" : "parsed";

      const disclaimer =
        "This endpoint performs a safe development inspection only. It does not perform official XML, Peppol, EN 16931, ViDA, tax, legal, or authority validation.";

      const record = await createXmlUploadRecord({
        fileName: safeFileName(readHeaderString(request.headers["x-file-name"])),
        fileSize: formatBytesFromHeader(
          readHeaderString(request.headers["x-file-size"])
        ),
        detectedDocument,
        rootElement,
        invoiceId: extractFirstTagValue(xml, "ID"),
        issueDate: extractFirstTagValue(xml, "IssueDate"),
        currency: extractFirstTagValue(xml, "DocumentCurrencyCode"),
        apiStatus,
        disclaimer
      });

      return reply.status(200).send({
        uploadInspectionId: record.id,
        detectedDocument: record.detectedDocument,
        rootElement: record.rootElement,
        invoiceId: record.invoiceId,
        issueDate: record.issueDate,
        currency: record.currency,
        status: record.apiStatus,
        disclaimer: record.disclaimer,
        record
      });
    }
  );
}
