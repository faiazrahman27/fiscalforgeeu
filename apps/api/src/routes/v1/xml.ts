import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireApiKey } from "../../middleware/require-api-key.js";

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

export async function xmlRoutes(app: FastifyInstance) {
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

      return reply.status(200).send({
        uploadInspectionId: `xml_${randomUUID()}`,
        detectedDocument,
        rootElement,
        invoiceId: extractFirstTagValue(xml, "ID"),
        issueDate: extractFirstTagValue(xml, "IssueDate"),
        currency: extractFirstTagValue(xml, "DocumentCurrencyCode"),
        status: detectedDocument === "unknown" ? "review_required" : "parsed",
        disclaimer:
          "This endpoint performs a safe development inspection only. It does not perform official XML, Peppol, EN 16931, ViDA, tax, legal, or authority validation."
      });
    }
  );
}
