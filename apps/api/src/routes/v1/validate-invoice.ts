import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import {
  invoiceValidationRequestSchema,
  type InvoiceValidationRequest
} from "../../schemas/invoice.js";
import { readJsonCollection, writeJsonCollection } from "../../storage/json-store.js";
import { formatZodError } from "../../utils/zod-error.js";

type FindingSeverity = "info" | "warning" | "fatal";

type Finding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  legalConfidence: "technical" | "educational_simulation" | "review_required";
};

type ValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

type ValidationRunRecord = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: "passed" | "failed";
  standardStatus: "ready" | "warning";
  countrySimulationStatus: "not_relevant" | "review_required";
  vidaReadinessStatus: "not_relevant" | "relevant_simulation";
  confidence: "technical_preview" | "educational_simulation";
  profile: "API_VALIDATION";
  currency: string;
  totals: ValidationTotals;
  findings: Finding[];
  disclaimer: string;
};

const VALIDATION_RUNS_FILE = "validation-runs.json";

function calculateTotals(payload: InvoiceValidationRequest): ValidationTotals {
  const lineExtensionAmount = payload.lines.reduce((sum, line) => {
    return sum + line.quantity * line.unitPrice;
  }, 0);

  const taxAmount = payload.lines.reduce((sum, line) => {
    const lineNet = line.quantity * line.unitPrice;
    return sum + (lineNet * line.vatRate) / 100;
  }, 0);

  const taxInclusiveAmount = lineExtensionAmount + taxAmount;

  return {
    lineExtensionAmount: Number(lineExtensionAmount.toFixed(2)),
    taxExclusiveAmount: Number(lineExtensionAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    taxInclusiveAmount: Number(taxInclusiveAmount.toFixed(2)),
    payableAmount: Number(taxInclusiveAmount.toFixed(2))
  };
}

function buildFindings(payload: InvoiceValidationRequest): Finding[] {
  const findings: Finding[] = [];
  const isCrossBorder = payload.seller.country !== payload.buyer.country;

  if (isCrossBorder && !payload.buyer.vatId) {
    findings.push({
      code: "BUYER_VAT_ID_REQUIRED",
      severity: "fatal",
      field: "buyer.vatId",
      message: "Buyer VAT ID is required for this cross-border B2B simulation.",
      legalConfidence: "educational_simulation"
    });
  }

  if (isCrossBorder) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      field: "buyer.country",
      message:
        "Seller and buyer countries differ. Country and VAT treatment require professional review.",
      legalConfidence: "review_required"
    });
  }

  const hasZeroValueLine = payload.lines.some(
    (line) => line.quantity * line.unitPrice === 0
  );

  if (hasZeroValueLine) {
    findings.push({
      code: "ZERO_VALUE_LINE_REVIEW",
      severity: "warning",
      field: "lines",
      message: "One or more invoice lines have zero value and should be reviewed.",
      legalConfidence: "technical"
    });
  }

  return findings;
}

async function saveValidationRun(record: ValidationRunRecord) {
  const currentRuns =
    await readJsonCollection<ValidationRunRecord>(VALIDATION_RUNS_FILE);

  const nextRuns = [
    record,
    ...currentRuns.filter((existingRun) => existingRun.id !== record.id)
  ].slice(0, 250);

  await writeJsonCollection(VALIDATION_RUNS_FILE, nextRuns);
}

export async function validateInvoiceRoutes(app: FastifyInstance) {
  app.post(
    "/validate",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedBody = invoiceValidationRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      const payload = parsedBody.data;
      const findings = buildFindings(payload);
      const totals = calculateTotals(payload);

      const hasFatal = findings.some((finding) => finding.severity === "fatal");
      const hasWarning = findings.some(
        (finding) => finding.severity === "warning"
      );
      const isCrossBorder = payload.seller.country !== payload.buyer.country;

      const validationRunId = `val_${randomUUID()}`;

      const technicalStatus = hasFatal ? "failed" : "passed";
      const standardStatus = hasWarning ? "warning" : "ready";
      const countrySimulationStatus = isCrossBorder
        ? "review_required"
        : "not_relevant";
      const vidaReadinessStatus = isCrossBorder
        ? "relevant_simulation"
        : "not_relevant";
      const confidence = isCrossBorder
        ? "educational_simulation"
        : "technical_preview";

      const disclaimer =
        "This API response is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation.";

      const record: ValidationRunRecord = {
        id: validationRunId,
        invoiceNumber: payload.document.number,
        buyer: payload.buyer.name,
        seller: payload.seller.name,
        createdAt: new Date().toISOString(),
        technicalStatus,
        standardStatus,
        countrySimulationStatus,
        vidaReadinessStatus,
        confidence,
        profile: "API_VALIDATION",
        currency: payload.document.currency,
        totals,
        findings,
        disclaimer
      };

      await saveValidationRun(record);

      return reply.status(200).send({
        validationRunId,
        invoiceNumber: payload.document.number,
        technicalStatus,
        standardStatus,
        countrySimulationStatus,
        vidaReadinessStatus,
        totals,
        findings,
        disclaimer
      });
    }
  );
}
