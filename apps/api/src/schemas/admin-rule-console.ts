import { z } from "zod";

const UUID_SCHEMA = z.string().trim().uuid();
const DATE_ONLY_SCHEMA = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const OPTIONAL_DATE_ONLY_SCHEMA = DATE_ONLY_SCHEMA.nullable().optional();
const COUNTRY_CODE_SCHEMA = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a 2-letter uppercase country code.");

const safeText = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => !/<\s*script\b/i.test(value), {
      message: "Text must not contain script tags."
    });

const optionalSafeText = (maxLength: number) =>
  safeText(maxLength).nullable().optional();

const safeStringArray = z
  .array(safeText(500))
  .max(20)
  .optional()
  .default([]);

const metadataSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({})
  .refine((value) => JSON.stringify(value).length <= 12000, {
    message: "Metadata must be 12KB or less."
  });

const sourceUrlSchema = z
  .string()
  .trim()
  .max(1200)
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    },
    {
      message: "Source URL must use http or https."
    }
  );

export const adminRuleStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "deprecated",
  "archived",
  "disabled",
  "suspended"
]);

export const adminRuleCategorySchema = z.enum([
  "CANONICAL",
  "CALCULATION",
  "SCHEMA",
  "UBL",
  "CII",
  "EN16931",
  "PEPPOL",
  "VAT_ID",
  "VIES",
  "COUNTRY_PACK",
  "VIDA_SIMULATION",
  "API",
  "SECURITY",
  "LEGAL_LABEL",
  "OTHER"
]);

export const adminRuleSeveritySchema = z.enum(["info", "warning", "fatal"]);

export const adminLegalConfidenceSchema = z.enum([
  "technical",
  "standard_based",
  "official_source_derived",
  "educational_simulation",
  "professional_review_required"
]);

export const adminSourceTypeSchema = z.enum([
  "eu_law",
  "eu_guidance",
  "national_tax_authority",
  "national_einvoicing_authority",
  "standard",
  "peppol",
  "vies",
  "country_pack",
  "legal_notice",
  "internal_policy",
  "other"
]);

export const adminSourceConfidenceStatusSchema = z.enum([
  "draft",
  "reviewed",
  "professional_review_required",
  "deprecated",
  "suspended"
]);

export const countryPackReviewStatusSchema = z.enum([
  "draft",
  "internal_review",
  "reviewed",
  "professional_review_required",
  "deprecated",
  "suspended"
]);

const effectiveWindowRefinement = (value: unknown, context: z.RefinementCtx) => {
  const effectiveWindow = value as {
    effectiveFrom?: string | null | undefined;
    effectiveTo?: string | null | undefined;
  };
  if (
    effectiveWindow.effectiveFrom &&
    effectiveWindow.effectiveTo &&
    effectiveWindow.effectiveFrom > effectiveWindow.effectiveTo
  ) {
    context.addIssue({
      code: "custom",
      path: ["effectiveTo"],
      message: "effectiveTo must be on or after effectiveFrom."
    });
  }
};

const adminRuleCreateBaseSchema = z
  .object({
    code: safeText(160),
    title: safeText(300),
    description: safeText(3000),
    message: optionalSafeText(1000),
    category: adminRuleCategorySchema,
    severity: adminRuleSeveritySchema.default("warning"),
    legalConfidence: adminLegalConfidenceSchema.default(
      "professional_review_required"
    ),
    checkType: optionalSafeText(120),
    layer: optionalSafeText(120),
    jurisdiction: safeText(80).default("EU"),
    countryCode: COUNTRY_CODE_SCHEMA.nullable().optional(),
    ruleSet: safeText(160).default("INVOICE_LANTERN_ADMIN_RULES"),
    ruleVersion: safeText(80),
    status: adminRuleStatusSchema.default("draft"),
    effectiveFrom: OPTIONAL_DATE_ONLY_SCHEMA,
    effectiveTo: OPTIONAL_DATE_ONLY_SCHEMA,
    reviewedAt: OPTIONAL_DATE_ONLY_SCHEMA,
    reviewerLabel: optionalSafeText(160),
    sourceRefIds: z.array(UUID_SCHEMA).max(20).optional().default([]),
    fixSuggestion: optionalSafeText(2000),
    professionalReviewRequired: z.boolean().optional().default(true),
    internalNotes: optionalSafeText(4000),
    metadata: metadataSchema
  })
  .strict();

export const adminRuleCreateSchema =
  adminRuleCreateBaseSchema.superRefine(effectiveWindowRefinement);

export const adminRulePatchSchema = adminRuleCreateBaseSchema
  .omit({
    code: true,
    ruleSet: true,
    ruleVersion: true
  })
  .partial()
  .strict()
  .superRefine(effectiveWindowRefinement);

const adminSourceCreateBaseSchema = z
  .object({
    title: safeText(300),
    publisher: safeText(200),
    jurisdiction: safeText(80).default("EU"),
    url: sourceUrlSchema,
    sourceType: adminSourceTypeSchema,
    reviewedAt: OPTIONAL_DATE_ONLY_SCHEMA,
    effectiveFrom: OPTIONAL_DATE_ONLY_SCHEMA,
    effectiveTo: OPTIONAL_DATE_ONLY_SCHEMA,
    confidenceStatus: adminSourceConfidenceStatusSchema.default("draft"),
    notes: optionalSafeText(4000),
    language: optionalSafeText(20),
    retrievedAt: OPTIONAL_DATE_ONLY_SCHEMA,
    versionLabel: optionalSafeText(120),
    metadata: metadataSchema
  })
  .strict();

export const adminSourceCreateSchema =
  adminSourceCreateBaseSchema.superRefine(effectiveWindowRefinement);

export const adminSourcePatchSchema = adminSourceCreateBaseSchema
  .partial()
  .strict()
  .superRefine(effectiveWindowRefinement);

export const adminCountryPackReviewPatchSchema = z
  .object({
    reviewStatus: countryPackReviewStatusSchema.optional(),
    legalConfidence: adminLegalConfidenceSchema.optional(),
    reviewNotes: optionalSafeText(4000),
    sourceRefIds: z.array(UUID_SCHEMA).max(20).optional(),
    reviewedAt: OPTIONAL_DATE_ONLY_SCHEMA,
    reviewerLabel: optionalSafeText(160),
    versionLabel: optionalSafeText(120),
    professionalReviewRequired: z.boolean().optional(),
    warnings: safeStringArray,
    metadata: metadataSchema
  })
  .strict();

export const adminCountryPackSourceLinkSchema = z
  .object({
    sourceRefId: UUID_SCHEMA,
    linkType: z
      .enum(["supports", "explains", "derived_from", "reviewed_against"])
      .optional()
      .default("supports")
  })
  .strict();

export const adminRuleIdParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .regex(/^[A-Za-z0-9:_.-]+$/, "Use a safe rule identifier.")
  })
  .strict();
export const uuidParamSchema = z.object({ id: UUID_SCHEMA }).strict();
export const countryCodeParamSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use a 2-letter country code.")
  })
  .strict();
export const countryPackSourceParamSchema = z
  .object({
    countryCode: countryCodeParamSchema.shape.countryCode,
    sourceId: UUID_SCHEMA
  })
  .strict();

export type AdminRuleCreateInput = z.output<typeof adminRuleCreateSchema>;
export type AdminRulePatchInput = z.output<typeof adminRulePatchSchema>;
export type AdminRuleStatus = z.output<typeof adminRuleStatusSchema>;
export type AdminRuleCategory = z.output<typeof adminRuleCategorySchema>;
export type AdminRuleSeverity = z.output<typeof adminRuleSeveritySchema>;
export type AdminLegalConfidence = z.output<
  typeof adminLegalConfidenceSchema
>;
export type AdminSourceCreateInput = z.output<typeof adminSourceCreateSchema>;
export type AdminSourcePatchInput = z.output<typeof adminSourcePatchSchema>;
export type AdminSourceType = z.output<typeof adminSourceTypeSchema>;
export type AdminSourceConfidenceStatus = z.output<
  typeof adminSourceConfidenceStatusSchema
>;
export type AdminCountryPackReviewPatchInput = z.output<
  typeof adminCountryPackReviewPatchSchema
>;
export type CountryPackReviewStatus = z.output<
  typeof countryPackReviewStatusSchema
>;
export type AdminCountryPackSourceLinkInput = z.output<
  typeof adminCountryPackSourceLinkSchema
>;
