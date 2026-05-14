import { z } from "zod";

export const validationFindingSeveritySchema = z.enum([
  "info",
  "warning",
  "fatal",
  "blocked"
]);

export const validationRuleCategorySchema = z.enum([
  "SCHEMA",
  "CANONICAL",
  "CALCULATION",
  "VAT_ID",
  "VIES",
  "EN16931",
  "PEPPOL",
  "UBL",
  "CII",
  "COUNTRY_PACK",
  "VIDA_SIMULATION",
  "SECURITY",
  "LEGAL_LABEL"
]);

export const legalConfidenceSchema = z.enum([
  "technical",
  "standard_based",
  "official_source_derived",
  "educational_simulation",
  "professional_review_required"
]);

export const validationSourceReferenceSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    sourceName: z.string().trim().min(1),
    sourceLabel: z.string().trim().min(1).optional(),
    sourceType: z.string().trim().min(1).optional(),
    sourceUrl: z.string().trim().url().optional(),
    jurisdiction: z.string().trim().min(1).optional(),
    reviewedAt: z.string().trim().min(1).optional(),
    effectiveFrom: z.string().trim().min(1).optional(),
    effectiveUntil: z.string().trim().min(1).optional(),
    notes: z.string().trim().min(1).optional()
  })
  .strict();

export const enrichedValidationFindingSchema = z
  .object({
    code: z.string().trim().min(1),
    severity: validationFindingSeveritySchema,
    category: validationRuleCategorySchema,
    field: z.string().trim().min(1),
    fieldPath: z.string().trim().min(1),
    message: z.string().trim().min(1),
    fixSuggestion: z.string().trim().min(1).optional(),
    sourceRefIds: z.array(z.string().trim().min(1)).optional(),
    sourceLabels: z.array(z.string().trim().min(1)).optional(),
    sourceReferences: z.array(validationSourceReferenceSchema).optional(),
    ruleId: z.string().trim().min(1),
    ruleSetCode: z.string().trim().min(1).optional(),
    ruleVersion: z.string().trim().min(1),
    legalConfidence: legalConfidenceSchema,
    checkType: z.string().trim().min(1),
    layer: z.string().trim().min(1),
    createdAt: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    evidenceId: z.string().trim().min(1).optional(),
    xmlLine: z.number().int().positive().optional(),
    technicalCode: z.string().trim().min(1).optional(),
    technicalMessage: z.string().trim().min(1).optional(),
    businessRuleId: z.string().trim().min(1).optional(),
    countryPackVersion: z.string().trim().min(1).optional(),
    countryPackStatus: z.string().trim().min(1).optional(),
    countryPackCountryCode: z.string().trim().min(1).optional()
  })
  .strict();

export const viesModeSchema = z.enum(["skip", "use_cached", "live"]);

export const validationSummaryCountsSchema = z.record(
  z.string(),
  z.number().int().min(0)
);

export const validationEngineSummarySchema = z
  .object({
    totalFindings: z.number().int().min(0),
    bySeverity: validationSummaryCountsSchema,
    byCategory: validationSummaryCountsSchema,
    byLayer: validationSummaryCountsSchema,
    byCheckType: validationSummaryCountsSchema,
    byLegalConfidence: validationSummaryCountsSchema,
    ruleVersions: z.array(z.string().trim().min(1)),
    sourceLabels: z.array(z.string().trim().min(1)),
    disclaimer: z.string().trim().min(1)
  })
  .strict();

export type EnrichedValidationFinding = z.infer<
  typeof enrichedValidationFindingSchema
>;
export type ValidationFindingSeverity = z.infer<
  typeof validationFindingSeveritySchema
>;
export type ValidationRuleCategory = z.infer<typeof validationRuleCategorySchema>;
export type LegalConfidence = z.infer<typeof legalConfidenceSchema>;
export type ValidationSourceReference = z.infer<
  typeof validationSourceReferenceSchema
>;
export type ViesMode = z.infer<typeof viesModeSchema>;
export type ValidationEngineSummary = z.infer<
  typeof validationEngineSummarySchema
>;
