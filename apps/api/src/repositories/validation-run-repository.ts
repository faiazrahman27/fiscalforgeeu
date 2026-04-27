import type { InvoiceValidationRequest } from "../schemas/invoice.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type FindingSeverity = "info" | "warning" | "fatal";

export type Finding = {
  code: string;
  severity: FindingSeverity;
  field: string;
  message: string;
  legalConfidence: "technical" | "educational_simulation" | "review_required";
};

export type ValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

export type ValidationRunRecord = {
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
const MAX_STORED_VALIDATION_RUNS = 250;
const storageProvider = getCollectionStorageProvider();

function sortValidationRunsByCreatedAt(records: ValidationRunRecord[]) {
  return [...records].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt)
  );
}

function numberToCents(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function centsToMoney(value: number) {
  return Number((value / 100).toFixed(2));
}

function calculateLineNetCents(quantity: number, unitPrice: number) {
  const unitPriceCents = numberToCents(unitPrice);

  return Math.round(quantity * unitPriceCents);
}

export function calculateValidationTotals(
  payload: InvoiceValidationRequest
): ValidationTotals {
  const lineExtensionCents = payload.lines.reduce((sum, line) => {
    return sum + calculateLineNetCents(line.quantity, line.unitPrice);
  }, 0);

  const taxCents = payload.lines.reduce((sum, line) => {
    const lineNetCents = calculateLineNetCents(line.quantity, line.unitPrice);
    const lineTaxCents = Math.round((lineNetCents * line.vatRate) / 100);

    return sum + lineTaxCents;
  }, 0);

  const taxInclusiveCents = lineExtensionCents + taxCents;

  return {
    lineExtensionAmount: centsToMoney(lineExtensionCents),
    taxExclusiveAmount: centsToMoney(lineExtensionCents),
    taxAmount: centsToMoney(taxCents),
    taxInclusiveAmount: centsToMoney(taxInclusiveCents),
    payableAmount: centsToMoney(taxInclusiveCents)
  };
}

export function buildValidationFindings(
  payload: InvoiceValidationRequest
): Finding[] {
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

  const hasZeroValueLine = payload.lines.some((line) => {
    return calculateLineNetCents(line.quantity, line.unitPrice) === 0;
  });

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

export async function listValidationRuns() {
  const records = await storageProvider.readCollection<ValidationRunRecord>(
    VALIDATION_RUNS_FILE
  );

  return sortValidationRunsByCreatedAt(records);
}

export async function getValidationRunById(id: string) {
  const runs = await listValidationRuns();

  return runs.find((run) => run.id === id) ?? null;
}

export async function saveValidationRun(record: ValidationRunRecord) {
  const currentRuns = await listValidationRuns();

  const nextRuns = sortValidationRunsByCreatedAt([
    record,
    ...currentRuns.filter((existingRun) => existingRun.id !== record.id)
  ]).slice(0, MAX_STORED_VALIDATION_RUNS);

  await storageProvider.writeCollection(VALIDATION_RUNS_FILE, nextRuns);

  return record;
}

export async function deleteValidationRunById(id: string) {
  const runs = await listValidationRuns();
  const nextRuns = runs.filter((run) => run.id !== id);

  if (nextRuns.length === runs.length) {
    return false;
  }

  await storageProvider.writeCollection(VALIDATION_RUNS_FILE, nextRuns);

  return true;
}
