import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  getValidationRunById,
  listValidationRuns,
  type FindingSeverity,
  type ValidationRunRecord,
  type ValidationTotals
} from "../../repositories/validation-run-repository.js";
import {
  getXmlUploadRecordById,
  listXmlUploadRecords,
  type XmlUploadRecord
} from "../../repositories/xml-upload-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

type ValidationRunSourceType = "invoice_validation" | "xml_readiness";

type ValidationRunSummary = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  findingsCount: number;
  payableAmount: number;
  sourceType: ValidationRunSourceType;
};

type UnifiedValidationRunRecord = ValidationRunRecord & {
  sourceType?: ValidationRunSourceType;
  sourceFileName?: string;
  sourceRootElement?: string;
  sourceDocumentType?: string;
};

const validationRunParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

function buildValidationRunSummary(
  run: ValidationRunRecord
): ValidationRunSummary {
  return {
    id: run.id,
    invoiceNumber: run.invoiceNumber,
    buyer: run.buyer,
    seller: run.seller,
    createdAt: run.createdAt,
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    countrySimulationStatus: run.countrySimulationStatus,
    vidaReadinessStatus: run.vidaReadinessStatus,
    confidence: run.confidence,
    profile: run.profile,
    currency: run.currency,
    findingsCount: run.findings.length,
    payableAmount: run.totals.payableAmount,
    sourceType: "invoice_validation"
  };
}

function parseMoneyValue(value: string) {
  if (!value || value === "not_detected") {
    return 0;
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return 0;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeDetectedLabel(value: string, fallback: string) {
  if (!value || value === "not_detected") {
    return fallback;
  }

  return value;
}

function mapXmlReadinessToStandardStatus(
  readinessStatus: XmlUploadRecord["readinessStatus"]
): ValidationRunRecord["standardStatus"] {
  return readinessStatus === "ready_for_review" ? "ready" : "warning";
}

function mapXmlConfidence(
  record: XmlUploadRecord
): ValidationRunRecord["confidence"] {
  const hasReviewFinding = record.findings.some((finding) => {
    return finding.severity === "warning" || finding.severity === "fatal";
  });

  return record.technicalStatus === "passed" && !hasReviewFinding
    ? "technical_preview"
    : "educational_simulation";
}

function mapXmlCountrySimulationStatus(
  record: XmlUploadRecord
): ValidationRunRecord["countrySimulationStatus"] {
  return record.extractedData.profileSignal.crossBorderSignal
    ? "review_required"
    : "not_relevant";
}

function mapXmlVidaReadinessStatus(
  record: XmlUploadRecord
): ValidationRunRecord["vidaReadinessStatus"] {
  const profileSignal = record.extractedData.profileSignal;

  return profileSignal.crossBorderSignal ||
    profileSignal.peppolSignalDetected ||
    profileSignal.en16931SignalDetected
    ? "relevant_simulation"
    : "not_relevant";
}

function mapXmlFindingSeverity(severity: string): FindingSeverity {
  if (severity === "fatal" || severity === "warning" || severity === "info") {
    return severity;
  }

  return "info";
}

function mapXmlConfidenceToLegalConfidence(
  confidence: string
): "technical" | "educational_simulation" | "review_required" {
  if (confidence === "technical") {
    return "technical";
  }

  if (confidence === "review_required") {
    return "review_required";
  }

  return "educational_simulation";
}

function buildXmlValidationTotals(record: XmlUploadRecord): ValidationTotals {
  const totals = record.extractedData.monetaryTotals;

  return {
    lineExtensionAmount: parseMoneyValue(totals.lineExtensionAmount),
    taxExclusiveAmount: parseMoneyValue(totals.taxExclusiveAmount),
    taxAmount: parseMoneyValue(totals.taxAmount),
    taxInclusiveAmount: parseMoneyValue(totals.taxInclusiveAmount),
    payableAmount: parseMoneyValue(totals.payableAmount)
  };
}

function buildXmlValidationRunRecord(
  record: XmlUploadRecord
): UnifiedValidationRunRecord {
  const seller = normalizeDetectedLabel(
    record.extractedData.sellerName,
    "Unknown seller"
  );
  const buyer = normalizeDetectedLabel(
    record.extractedData.buyerName,
    "Unknown buyer"
  );
  const invoiceNumber = normalizeDetectedLabel(
    record.invoiceId,
    record.fileName || "XML readiness report"
  );

  return {
    id: record.id,
    invoiceNumber,
    buyer,
    seller,
    createdAt: record.uploadedAt,
    technicalStatus: record.technicalStatus,
    standardStatus: mapXmlReadinessToStandardStatus(record.readinessStatus),
    countrySimulationStatus: mapXmlCountrySimulationStatus(record),
    vidaReadinessStatus: mapXmlVidaReadinessStatus(record),
    confidence: mapXmlConfidence(record),
    profile: "API_VALIDATION",
    currency: normalizeDetectedLabel(record.currency, record.summary.currency),
    totals: buildXmlValidationTotals(record),
    findings: record.findings.map((finding) => ({
      code: finding.code,
      severity: mapXmlFindingSeverity(finding.severity),
      field: finding.field,
      message: finding.message,
      legalConfidence: mapXmlConfidenceToLegalConfidence(finding.confidence)
    })),
    disclaimer: record.disclaimer,
    sourceType: "xml_readiness",
    sourceFileName: record.fileName,
    sourceRootElement: record.rootElement,
    sourceDocumentType: record.detectedDocument
  };
}

function buildXmlValidationRunSummary(
  record: XmlUploadRecord
): ValidationRunSummary {
  const mappedRecord = buildXmlValidationRunRecord(record);

  return {
    id: mappedRecord.id,
    invoiceNumber: mappedRecord.invoiceNumber,
    buyer: mappedRecord.buyer,
    seller: mappedRecord.seller,
    createdAt: mappedRecord.createdAt,
    technicalStatus: mappedRecord.technicalStatus,
    standardStatus: mappedRecord.standardStatus,
    countrySimulationStatus: mappedRecord.countrySimulationStatus,
    vidaReadinessStatus: mappedRecord.vidaReadinessStatus,
    confidence: mappedRecord.confidence,
    profile: "XML_READINESS",
    currency: mappedRecord.currency,
    findingsCount: mappedRecord.findings.length,
    payableAmount: mappedRecord.totals.payableAmount,
    sourceType: "xml_readiness"
  };
}

export async function validationRunRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireApiKey
    },
    async () => {
      const [invoiceRuns, xmlUploadRecords] = await Promise.all([
        listValidationRuns(),
        listXmlUploadRecords()
      ]);

      const invoiceRunSummaries = invoiceRuns.map(buildValidationRunSummary);
      const xmlReadinessSummaries = xmlUploadRecords.map(
        buildXmlValidationRunSummary
      );

      return {
        records: [...invoiceRunSummaries, ...xmlReadinessSummaries].sort(
          (first, second) => second.createdAt.localeCompare(first.createdAt)
        )
      };
    }
  );

  app.get(
    "/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      const invoiceRun = await getValidationRunById(parsedParams.data.id);

      if (invoiceRun) {
        return {
          record: {
            ...invoiceRun,
            sourceType: "invoice_validation"
          }
        };
      }

      const xmlUploadRecord = await getXmlUploadRecordById(parsedParams.data.id);

      if (xmlUploadRecord) {
        return {
          record: buildXmlValidationRunRecord(xmlUploadRecord)
        };
      }

      return reply.status(404).send({
        error: {
          code: "VALIDATION_RUN_NOT_FOUND",
          message: "Validation run was not found.",
          details: null
        }
      });
    }
  );
}
