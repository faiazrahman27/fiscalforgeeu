import type {
  Finding,
  FindingSeverity,
  ValidationRunRecord
} from "../repositories/validation-run-repository.js";

export type ValidationReportFindingCounts = Record<FindingSeverity, number>;
export type ValidationReportDimensionCounts = Record<string, number>;

export type ValidationReportRuleSetSummary = {
  code: string;
  version: string;
  sourceLabels: string[];
};

export type ValidationReportSummary = {
  reportTitle: string;
  validationRunId: string;
  createdAt: string;
  invoiceNumber: string;
  issueDate: string;
  seller: string;
  buyer: string;
  currency: string;
  overallStatus: string;
  technicalStatus: ValidationRunRecord["technicalStatus"];
  standardStatus: ValidationRunRecord["standardStatus"];
  findingCounts: ValidationReportFindingCounts;
  categoryCounts: ValidationReportDimensionCounts;
  layerCounts: ValidationReportDimensionCounts;
  checkTypeCounts: ValidationReportDimensionCounts;
  legalConfidenceCounts: ValidationReportDimensionCounts;
  legalConfidenceSummary: string;
  ruleSetsUsed: ValidationReportRuleSetSummary[];
  disclaimer: string;
  recommendedNextActions: string[];
};

export const VALIDATION_REPORT_DISCLAIMER =
  "This validation report checks selected technical structure, calculation logic, canonical invoice rules, and sandbox rule metadata. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority compliance. Before issuing real invoices or making VAT decisions, consult a qualified accountant, tax adviser, or competent authority.";

const EMPTY_FINDING_COUNTS: ValidationReportFindingCounts = {
  info: 0,
  warning: 0,
  fatal: 0,
  blocked: 0
};

function countFindingsBySeverity(findings: Finding[]) {
  return findings.reduce<ValidationReportFindingCounts>(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { ...EMPTY_FINDING_COUNTS }
  );
}

function incrementDimension(counts: ValidationReportDimensionCounts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function countFindingsByDimension(
  findings: Finding[],
  readKey: (finding: Finding) => string
) {
  const counts: ValidationReportDimensionCounts = {};

  for (const finding of findings) {
    incrementDimension(counts, readKey(finding));
  }

  return counts;
}

function buildOverallStatus(counts: ValidationReportFindingCounts) {
  if (counts.blocked > 0 || counts.fatal > 0) {
    return "technical_issues_found";
  }

  if (counts.warning > 0) {
    return "warnings_require_review";
  }

  return "no_selected_technical_issues_detected";
}

function buildLegalConfidenceSummary(findings: Finding[]) {
  if (
    findings.some(
      (finding) =>
        finding.legalConfidence === "professional_review_required" ||
        (finding.legalConfidence as string) === "review_required"
    )
  ) {
    return "Professional review required for one or more findings.";
  }

  if (
    findings.some(
      (finding) => finding.legalConfidence === "educational_simulation"
    )
  ) {
    return "Educational simulation metadata is present on one or more findings.";
  }

  if (findings.length > 0) {
    return "Technical rule metadata only.";
  }

  return "No finding-level legal confidence labels were returned.";
}

function buildRuleSetKey(code: string, version: string) {
  return `${code}::${version}`;
}

function buildRuleSetsUsed(findings: Finding[]) {
  const ruleSets = new Map<string, ValidationReportRuleSetSummary>();

  for (const finding of findings) {
    const code = finding.ruleSetCode?.trim() ?? "";
    const version = finding.ruleVersion?.trim() ?? "";

    if (!code && !version) {
      continue;
    }

    const key = buildRuleSetKey(code || "not_linked", version || "not_versioned");
    const existing = ruleSets.get(key);
    const sourceLabels = finding.sourceLabels ?? [];

    if (existing) {
      existing.sourceLabels = [
        ...new Set([...existing.sourceLabels, ...sourceLabels])
      ];
      continue;
    }

    ruleSets.set(key, {
      code: code || "not_linked",
      version: version || "not_versioned",
      sourceLabels: [...new Set(sourceLabels)]
    });
  }

  return [...ruleSets.values()];
}

function buildRecommendedNextActions(counts: ValidationReportFindingCounts) {
  if (counts.blocked > 0 || counts.fatal > 0) {
    return ["Fix blocking/fatal technical issues before relying on this draft."];
  }

  if (counts.warning > 0) {
    return ["Review warnings and seek professional advice where required."];
  }

  const totalFindings =
    counts.info + counts.warning + counts.fatal + counts.blocked;

  if (totalFindings === 0) {
    return [
      "No selected technical issues were detected by this sandbox rule set. This is not legal/tax certification."
    ];
  }

  return [
    "Review informational findings and keep supporting records for professional review where appropriate."
  ];
}

export function buildValidationReportSummary(
  run: ValidationRunRecord
): ValidationReportSummary {
  const findingCounts = countFindingsBySeverity(run.findings);

  return {
    reportTitle: "Validation report",
    validationRunId: run.id,
    createdAt: run.createdAt,
    invoiceNumber: run.invoiceNumber,
    issueDate: run.issueDate ?? "",
    seller: run.seller,
    buyer: run.buyer,
    currency: run.currency,
    overallStatus: buildOverallStatus(findingCounts),
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    findingCounts,
    categoryCounts: countFindingsByDimension(
      run.findings,
      (finding) => finding.category || "uncategorized"
    ),
    layerCounts: countFindingsByDimension(
      run.findings,
      (finding) => finding.layer ?? "not_recorded"
    ),
    checkTypeCounts: countFindingsByDimension(
      run.findings,
      (finding) => finding.checkType ?? "not_recorded"
    ),
    legalConfidenceCounts: countFindingsByDimension(
      run.findings,
      (finding) => finding.legalConfidence
    ),
    legalConfidenceSummary: buildLegalConfidenceSummary(run.findings),
    ruleSetsUsed: buildRuleSetsUsed(run.findings),
    disclaimer: VALIDATION_REPORT_DISCLAIMER,
    recommendedNextActions: buildRecommendedNextActions(findingCounts)
  };
}
