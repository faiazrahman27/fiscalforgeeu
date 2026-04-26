import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  createXmlUploadRecord,
  deleteXmlUploadRecordById,
  listXmlUploadRecords,
  type XmlApiInspectionStatus
} from "../../repositories/xml-upload-repository.js";

type XmlFindingSeverity = "info" | "warning" | "fatal";

type XmlReadinessFinding = {
  code: string;
  severity: XmlFindingSeverity;
  field: string;
  message: string;
  confidence: "technical" | "readiness_simulation" | "review_required";
};

type XmlReadinessReport = {
  technicalStatus: "passed" | "failed";
  readinessStatus: "ready_for_review" | "needs_attention" | "unsupported";
  documentStatus: "recognized" | "unsupported";
  calculationStatus: "not_checked" | "surface_checked";
  profileStatus: "ubl_surface_check" | "unknown_profile";
  findings: XmlReadinessFinding[];
};

const xmlBodySchema = z
  .string()
  .min(1, "XML body cannot be empty")
  .max(env.API_BODY_LIMIT_BYTES, "XML body is too large");

const xmlUploadParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildNamespacedTagPattern(tagName: string) {
  const escapedTag = escapeRegex(tagName);

  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[A-Za-z_][\\w.-]*:)?${escapedTag}>`,
    "i"
  );
}

function hasTag(xml: string, tagName: string) {
  return buildNamespacedTagPattern(tagName).test(xml);
}

function extractFirstTagValue(xml: string, tagName: string) {
  const escapedTag = escapeRegex(tagName);

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

function hasParseRisk(xml: string) {
  const openingLikeTags = xml.match(/<[A-Za-z_][\w:.-]*(?:\s[^>]*)?>/g) ?? [];
  const closingLikeTags = xml.match(/<\/[A-Za-z_][\w:.-]*>/g) ?? [];

  if (openingLikeTags.length === 0) {
    return true;
  }

  return closingLikeTags.length === 0;
}

function pushMissingTagFinding(
  findings: XmlReadinessFinding[],
  xml: string,
  tagName: string,
  field: string,
  label: string,
  severity: XmlFindingSeverity = "warning"
) {
  if (hasTag(xml, tagName)) {
    return;
  }

  findings.push({
    code: `${tagName.toUpperCase()}_MISSING`,
    severity,
    field,
    message: `${label} was not detected in the uploaded XML.`,
    confidence: "readiness_simulation"
  });
}

function buildReadinessReport({
  xml,
  detectedDocument,
  rootElement,
  invoiceId,
  issueDate,
  currency
}: {
  xml: string;
  detectedDocument: string;
  rootElement: string;
  invoiceId: string;
  issueDate: string;
  currency: string;
}): XmlReadinessReport {
  const findings: XmlReadinessFinding[] = [];

  if (hasParseRisk(xml)) {
    findings.push({
      code: "XML_SURFACE_PARSE_RISK",
      severity: "fatal",
      field: "xml",
      message:
        "The XML text does not look structurally complete enough for readiness inspection.",
      confidence: "technical"
    });
  }

  if (rootElement === "unknown" || detectedDocument === "unknown") {
    findings.push({
      code: "UNSUPPORTED_DOCUMENT_ROOT",
      severity: "fatal",
      field: "rootElement",
      message:
        "The root element is not recognized as an Invoice or CreditNote document.",
      confidence: "technical"
    });
  }

  if (detectedDocument !== "unknown") {
    findings.push({
      code: "DOCUMENT_ROOT_RECOGNIZED",
      severity: "info",
      field: "rootElement",
      message: `Detected a ${detectedDocument} XML document from root element ${rootElement}.`,
      confidence: "technical"
    });
  }

  if (invoiceId === "not_detected") {
    findings.push({
      code: "DOCUMENT_ID_MISSING",
      severity: "fatal",
      field: "ID",
      message: "Document ID was not detected.",
      confidence: "readiness_simulation"
    });
  }

  if (issueDate === "not_detected") {
    findings.push({
      code: "ISSUE_DATE_MISSING",
      severity: "warning",
      field: "IssueDate",
      message: "Issue date was not detected.",
      confidence: "readiness_simulation"
    });
  }

  if (currency === "not_detected") {
    findings.push({
      code: "DOCUMENT_CURRENCY_MISSING",
      severity: "warning",
      field: "DocumentCurrencyCode",
      message: "Document currency code was not detected.",
      confidence: "readiness_simulation"
    });
  }

  pushMissingTagFinding(
    findings,
    xml,
    "AccountingSupplierParty",
    "AccountingSupplierParty",
    "Seller/supplier party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
    "AccountingCustomerParty",
    "AccountingCustomerParty",
    "Buyer/customer party block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
    "TaxTotal",
    "TaxTotal",
    "Tax total block",
    "warning"
  );

  pushMissingTagFinding(
    findings,
    xml,
    "LegalMonetaryTotal",
    "LegalMonetaryTotal",
    "Legal monetary total block",
    "warning"
  );

  if (!hasTag(xml, "InvoiceLine") && !hasTag(xml, "CreditNoteLine")) {
    findings.push({
      code: "DOCUMENT_LINE_MISSING",
      severity: "warning",
      field: "InvoiceLine",
      message: "No InvoiceLine or CreditNoteLine block was detected.",
      confidence: "readiness_simulation"
    });
  }

  if (hasTag(xml, "LegalMonetaryTotal")) {
    pushMissingTagFinding(
      findings,
      xml,
      "LineExtensionAmount",
      "LegalMonetaryTotal.LineExtensionAmount",
      "Line extension amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
      "TaxExclusiveAmount",
      "LegalMonetaryTotal.TaxExclusiveAmount",
      "Tax exclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
      "TaxInclusiveAmount",
      "LegalMonetaryTotal.TaxInclusiveAmount",
      "Tax inclusive amount",
      "warning"
    );

    pushMissingTagFinding(
      findings,
      xml,
      "PayableAmount",
      "LegalMonetaryTotal.PayableAmount",
      "Payable amount",
      "warning"
    );
  }

  const hasFatal = findings.some((finding) => finding.severity === "fatal");
  const hasWarning = findings.some((finding) => finding.severity === "warning");

  return {
    technicalStatus: hasFatal ? "failed" : "passed",
    readinessStatus:
      detectedDocument === "unknown"
        ? "unsupported"
        : hasFatal || hasWarning
          ? "needs_attention"
          : "ready_for_review",
    documentStatus: detectedDocument === "unknown" ? "unsupported" : "recognized",
    calculationStatus: hasTag(xml, "LegalMonetaryTotal")
      ? "surface_checked"
      : "not_checked",
    profileStatus:
      detectedDocument === "unknown" ? "unknown_profile" : "ubl_surface_check",
    findings
  };
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

  app.delete(
    "/uploads/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = xmlUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "XML upload ID failed schema validation.",
            details: parsedParams.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
              code: issue.code
            }))
          }
        });
      }

      const wasDeleted = await deleteXmlUploadRecordById(parsedParams.data.id);

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
      const invoiceId = extractFirstTagValue(xml, "ID");
      const issueDate = extractFirstTagValue(xml, "IssueDate");
      const currency = extractFirstTagValue(xml, "DocumentCurrencyCode");

      const readinessReport = buildReadinessReport({
        xml,
        detectedDocument,
        rootElement,
        invoiceId,
        issueDate,
        currency
      });

      const apiStatus: XmlApiInspectionStatus =
        readinessReport.documentStatus === "unsupported"
          ? "review_required"
          : "parsed";

      const disclaimer =
        "Invoice Lantern performs a technical readiness simulation only. This result is not official XML, Peppol, EN 16931, ViDA, tax, legal, accounting, government, or authority validation.";

      const record = await createXmlUploadRecord({
        fileName: safeFileName(readHeaderString(request.headers["x-file-name"])),
        fileSize: formatBytesFromHeader(
          readHeaderString(request.headers["x-file-size"])
        ),
        detectedDocument,
        rootElement,
        invoiceId,
        issueDate,
        currency,
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
        technicalStatus: readinessReport.technicalStatus,
        readinessStatus: readinessReport.readinessStatus,
        documentStatus: readinessReport.documentStatus,
        calculationStatus: readinessReport.calculationStatus,
        profileStatus: readinessReport.profileStatus,
        findings: readinessReport.findings,
        disclaimer: record.disclaimer,
        record
      });
    }
  );
}
