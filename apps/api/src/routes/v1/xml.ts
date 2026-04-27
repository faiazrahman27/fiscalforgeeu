import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  createAuthenticatedXmlUploadRecord,
  createXmlUploadRecord,
  deleteAuthenticatedXmlUploadRecordById,
  deleteXmlUploadRecordById,
  getAuthenticatedXmlUploadRecordById,
  getXmlUploadRecordById,
  hasAuthenticatedXmlUploadContext,
  listAuthenticatedXmlUploadRecords,
  listXmlUploadRecords,
  type AuthenticatedXmlUploadContext,
  type XmlApiInspectionStatus
} from "../../repositories/xml-upload-repository.js";
import {
  buildXmlUploadSummary,
  inspectXmlReadiness
} from "../../services/xml-readiness-engine.js";

const xmlBodySchema = z.string().min(1, "XML body cannot be empty");

const xmlUploadParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

function getAuthenticatedXmlUploadContext(
  request: FastifyRequest
): AuthenticatedXmlUploadContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedXmlUploadContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("XML upload storage error:", error);

  return reply.status(500).send({
    error: {
      code: "XML_UPLOAD_STORAGE_ERROR",
      message: "Could not complete the XML upload storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function isXmlContentType(value: string) {
  const normalizedContentType = value.toLowerCase();

  return (
    normalizedContentType.includes("text/xml") ||
    normalizedContentType.includes("application/xml") ||
    normalizedContentType.includes("+xml")
  );
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[^\x20-\x7E]/g, "_")
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/^[-.]+|[-.]+$/g, "")
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

function buildValidationError(message: string, details: unknown) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message,
      details
    }
  };
}

export async function xmlRoutes(app: FastifyInstance) {
  app.get(
    "/uploads",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const records = authenticatedContext
          ? await listAuthenticatedXmlUploadRecords(authenticatedContext)
          : await listXmlUploadRecords();

        return {
          records
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/uploads/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = xmlUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML upload ID failed schema validation.",
            formatZodIssues(parsedParams.error)
          )
        );
      }

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const record = authenticatedContext
          ? await getAuthenticatedXmlUploadRecordById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await getXmlUploadRecordById(parsedParams.data.id);

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "XML_UPLOAD_NOT_FOUND",
              message: "XML upload record was not found.",
              details: null
            }
          });
        }

        return {
          record
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.delete(
    "/uploads/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = xmlUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML upload ID failed schema validation.",
            formatZodIssues(parsedParams.error)
          )
        );
      }

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const wasDeleted = authenticatedContext
          ? await deleteAuthenticatedXmlUploadRecordById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await deleteXmlUploadRecordById(parsedParams.data.id);

        if (!wasDeleted) {
          return reply.status(404).send({
            error: {
              code: "XML_UPLOAD_NOT_FOUND",
              message: "XML upload record was not found.",
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

  app.post(
    "/inspect",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const contentType = readHeaderString(request.headers["content-type"]);

      if (!isXmlContentType(contentType)) {
        return reply.status(415).send({
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message:
              "Use content-type text/xml, application/xml, or another XML media type.",
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
            details: formatZodIssues(parsedBody.error)
          }
        });
      }

      const xml = parsedBody.data;

      if (getUtf8ByteLength(xml) > env.API_BODY_LIMIT_BYTES) {
        return reply.status(413).send({
          error: {
            code: "XML_BODY_TOO_LARGE",
            message: "XML body is too large.",
            details: {
              maxBytes: env.API_BODY_LIMIT_BYTES
            }
          }
        });
      }

      const inspection = inspectXmlReadiness(xml);
      const readinessReport = inspection.report;

      const apiStatus: XmlApiInspectionStatus =
        readinessReport.documentStatus === "unsupported"
          ? "review_required"
          : "parsed";

      const disclaimer =
        "Invoice Lantern performs a technical readiness simulation only. This result is not official XML, Peppol, EN 16931, ViDA, tax, legal, accounting, government, or authority validation.";

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const recordInput = {
          fileName: safeFileName(readHeaderString(request.headers["x-file-name"])),
          fileSize: formatBytesFromHeader(
            readHeaderString(request.headers["x-file-size"])
          ),
          detectedDocument: inspection.detectedDocument,
          rootElement: inspection.rootElement,
          invoiceId: inspection.invoiceId,
          issueDate: inspection.issueDate,
          currency: inspection.currency,
          apiStatus,
          disclaimer,
          readinessReport,
          summary: buildXmlUploadSummary(readinessReport)
        };

        const record = authenticatedContext
          ? await createAuthenticatedXmlUploadRecord(
              authenticatedContext,
              recordInput
            )
          : await createXmlUploadRecord(recordInput);

        return reply.status(200).send({
          uploadInspectionId: record.id,
          detectedDocument: record.detectedDocument,
          rootElement: record.rootElement,
          invoiceId: record.invoiceId,
          issueDate: record.issueDate,
          currency: record.currency,
          status: record.apiStatus,
          technicalStatus: record.technicalStatus,
          readinessStatus: record.readinessStatus,
          documentStatus: record.documentStatus,
          calculationStatus: record.calculationStatus,
          profileStatus: record.profileStatus,
          extractedData: record.extractedData,
          findings: record.findings,
          disclaimer: record.disclaimer,
          record
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
