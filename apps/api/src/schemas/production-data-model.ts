import { z } from "zod";

export const PRODUCTION_INVOICE_LEGAL_DISCLAIMER =
  "Invoice Lantern stores this invoice as an independent technical validation and readiness sandbox record. Results are informational only and are not legal, tax, accounting, financial, professional, official filing, authority acceptance, Peppol certification, EN 16931 certification, or compliance advice.";

const DECIMAL_STRING_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

const metadataSchema = z
  .record(z.string(), z.unknown())
  .default({})
  .refine((value) => JSON.stringify(value).length <= 12000, {
    message: "Metadata must be 12KB or less."
  });

const optionalMetadataSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .default({})
  .refine((value) => JSON.stringify(value).length <= 12000, {
    message: "Metadata must be 12KB or less."
  });

const nonEmptyText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const optionalText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable().optional();

const optionalUuid = z.string().trim().uuid().nullable().optional();

const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, "Use a 2-letter uppercase country code.");

const optionalCountryCodeSchema = countryCodeSchema.nullable().optional();

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter uppercase currency code.");

const optionalCurrencyCodeSchema = currencyCodeSchema.nullable().optional();

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const optionalDateOnlySchema = dateOnlySchema.nullable().optional();

const nonNegativeDecimalStringSchema = z
  .string()
  .trim()
  .regex(DECIMAL_STRING_PATTERN, "Use a non-negative decimal string.");

export const businessProfileCreateSchema = z
  .object({
    profileType: z.enum(["seller", "buyer", "both"]),
    displayName: nonEmptyText(200),
    legalName: optionalText(240),
    tradingName: optionalText(240),
    countryCode: countryCodeSchema,
    vatId: optionalText(80),
    taxRegistrationNumber: optionalText(120),
    electronicAddress: optionalText(240),
    electronicAddressScheme: optionalText(40),
    email: optionalText(320),
    phone: optionalText(80),
    website: optionalText(500),
    addressLine1: optionalText(240),
    addressLine2: optionalText(240),
    city: optionalText(160),
    region: optionalText(160),
    postalCode: optionalText(40),
    countrySubdivision: optionalText(80),
    defaultCurrency: optionalCurrencyCodeSchema,
    paymentTerms: optionalText(2000),
    bankAccountLabel: optionalText(120),
    bankAccountLast4: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{2,4}$/)
      .nullable()
      .optional(),
    metadata: optionalMetadataSchema,
    status: z.enum(["active", "archived"]).optional().default("active"),
    createdBy: optionalUuid,
    updatedBy: optionalUuid
  })
  .strict();

export const businessProfileUpdateSchema = businessProfileCreateSchema
  .partial()
  .strict();

export const contactCreateSchema = z
  .object({
    businessProfileId: optionalUuid,
    contactType: z
      .enum(["business", "person", "department", "other"])
      .optional()
      .default("business"),
    displayName: nonEmptyText(200),
    legalName: optionalText(240),
    email: optionalText(320),
    phone: optionalText(80),
    countryCode: optionalCountryCodeSchema,
    vatId: optionalText(80),
    taxRegistrationNumber: optionalText(120),
    electronicAddress: optionalText(240),
    electronicAddressScheme: optionalText(40),
    addressLine1: optionalText(240),
    addressLine2: optionalText(240),
    city: optionalText(160),
    region: optionalText(160),
    postalCode: optionalText(40),
    countrySubdivision: optionalText(80),
    notes: optionalText(4000),
    metadata: optionalMetadataSchema,
    status: z.enum(["active", "archived"]).optional().default("active"),
    createdBy: optionalUuid,
    updatedBy: optionalUuid
  })
  .strict();

export const contactUpdateSchema = contactCreateSchema.partial().strict();

export const invoiceCreateSchema = z
  .object({
    draftId: optionalUuid,
    sellerProfileId: optionalUuid,
    buyerProfileId: optionalUuid,
    buyerContactId: optionalUuid,
    sellerContactId: optionalUuid,
    invoiceNumber: nonEmptyText(120),
    invoiceType: z.enum(["invoice", "credit_note"]),
    profile: z
      .enum(["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"])
      .optional()
      .default("EN16931"),
    issueDate: dateOnlySchema,
    dueDate: optionalDateOnlySchema,
    taxPointDate: optionalDateOnlySchema,
    currency: currencyCodeSchema,
    buyerReference: optionalText(120),
    contractReference: optionalText(120),
    orderReference: optionalText(120),
    projectReference: optionalText(120),
    accountingCost: optionalText(120),
    paymentTerms: optionalText(2000),
    paymentMeansCode: optionalText(40),
    paymentReference: optionalText(120),
    sellerSnapshot: metadataSchema,
    buyerSnapshot: metadataSchema,
    deliverySnapshot: metadataSchema,
    paymentSnapshot: metadataSchema,
    canonicalJson: metadataSchema,
    calculationSummary: metadataSchema,
    validationSummary: metadataSchema,
    legalDisclaimer: nonEmptyText(2000)
      .optional()
      .default(PRODUCTION_INVOICE_LEGAL_DISCLAIMER),
    legalConfidence: z
      .enum([
        "technical",
        "standard_based",
        "official_source_derived",
        "educational_simulation",
        "professional_review_required"
      ])
      .optional()
      .default("technical"),
    status: z
      .enum(["draft", "ready_for_review", "validated", "issued", "archived", "voided"])
      .optional()
      .default("draft"),
    source: z
      .enum(["manual", "api", "ubl_import", "cii_import", "system"])
      .optional()
      .default("manual"),
    createdBy: optionalUuid,
    updatedBy: optionalUuid,
    finalizedAt: z.string().trim().datetime().nullable().optional(),
    issuedAt: z.string().trim().datetime().nullable().optional(),
    archivedAt: z.string().trim().datetime().nullable().optional()
  })
  .strict();

export const invoiceUpdateSchema = invoiceCreateSchema.partial().strict();

export const invoiceLineCreateSchema = z
  .object({
    lineNumber: z.number().int().min(1),
    description: nonEmptyText(1000),
    itemName: optionalText(240),
    quantity: nonNegativeDecimalStringSchema,
    unitCode: nonEmptyText(24),
    unitPrice: nonNegativeDecimalStringSchema,
    discountAmount: nonNegativeDecimalStringSchema.optional().default("0"),
    chargeAmount: nonNegativeDecimalStringSchema.optional().default("0"),
    netAmount: nonNegativeDecimalStringSchema,
    vatCategory: nonEmptyText(40),
    vatRate: nonNegativeDecimalStringSchema.optional().default("0"),
    taxScheme: nonEmptyText(40).optional().default("VAT"),
    accountingCost: optionalText(120),
    orderLineReference: optionalText(120),
    metadata: optionalMetadataSchema
  })
  .strict();

export const invoiceTaxCreateSchema = z
  .object({
    invoiceLineId: optionalUuid,
    taxCategory: nonEmptyText(40),
    taxScheme: nonEmptyText(40).optional().default("VAT"),
    vatRate: nonNegativeDecimalStringSchema.optional().default("0"),
    taxableAmount: nonNegativeDecimalStringSchema.optional().default("0"),
    taxAmount: nonNegativeDecimalStringSchema.optional().default("0"),
    exemptionReason: optionalText(500),
    exemptionReasonCode: optionalText(80),
    metadata: optionalMetadataSchema
  })
  .strict();

const invoiceAdjustmentSchema = z
  .object({
    invoiceLineId: optionalUuid,
    scope: z.enum(["document", "line"]),
    reason: optionalText(500),
    reasonCode: optionalText(80),
    amount: nonNegativeDecimalStringSchema,
    baseAmount: nonNegativeDecimalStringSchema.nullable().optional(),
    percentage: nonNegativeDecimalStringSchema.nullable().optional(),
    taxCategory: optionalText(40),
    vatRate: nonNegativeDecimalStringSchema.nullable().optional(),
    metadata: optionalMetadataSchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === "line" && !value.invoiceLineId) {
      context.addIssue({
        code: "custom",
        path: ["invoiceLineId"],
        message: "Line-scoped adjustments require an invoice line ID."
      });
    }

    if (value.scope === "document" && value.invoiceLineId) {
      context.addIssue({
        code: "custom",
        path: ["invoiceLineId"],
        message: "Document-scoped adjustments must not reference a line."
      });
    }
  });

export const invoiceAllowanceCreateSchema = invoiceAdjustmentSchema;
export const invoiceChargeCreateSchema = invoiceAdjustmentSchema;

export const invoiceAttachmentCreateSchema = z
  .object({
    invoiceId: optionalUuid,
    invoiceDraftId: optionalUuid,
    fileUploadId: optionalUuid,
    storageBucket: optionalText(120),
    storagePath: optionalText(1200),
    originalFilename: nonEmptyText(260),
    contentType: nonEmptyText(160),
    sizeBytes: z.number().int().positive(),
    checksumSha256: z.string().trim().regex(SHA_256_PATTERN).nullable().optional(),
    attachmentType: z
      .enum([
        "supporting_evidence",
        "source_xml",
        "generated_pdf",
        "imported_pdf",
        "manual_entry_helper",
        "other"
      ])
      .optional()
      .default("supporting_evidence"),
    validationRole: z
      .enum(["structured_source", "supporting_only", "generated_output"])
      .optional()
      .default("supporting_only"),
    metadata: optionalMetadataSchema,
    createdBy: optionalUuid
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.invoiceId && !value.invoiceDraftId) {
      context.addIssue({
        code: "custom",
        path: ["invoiceId"],
        message: "Attachment metadata must reference an invoice or draft."
      });
    }

    if (
      value.validationRole === "structured_source" &&
      value.attachmentType !== "source_xml"
    ) {
      context.addIssue({
        code: "custom",
        path: ["validationRole"],
        message: "Only source XML can be marked as a structured source."
      });
    }
  });

export const securityEventCreateSchema = z
  .object({
    organizationId: optionalUuid,
    actorUserId: optionalUuid,
    actorApiKeyId: optionalUuid,
    eventType: nonEmptyText(160),
    severity: z
      .enum(["info", "warning", "high", "critical"])
      .optional()
      .default("info"),
    category: nonEmptyText(80).optional().default("security"),
    ipHash: optionalText(160),
    userAgent: optionalText(512),
    requestId: optionalText(120),
    resourceType: optionalText(120),
    resourceId: optionalUuid,
    outcome: z
      .enum(["success", "failure", "blocked", "recorded"])
      .optional()
      .default("recorded"),
    metadata: optionalMetadataSchema
  })
  .strict();

export const sourceReferenceCreateSchema = z
  .object({
    sourceType: z.enum([
      "eu_law",
      "eu_guidance",
      "national_tax_authority",
      "standard",
      "peppol",
      "vies",
      "country_pack",
      "legal_notice",
      "internal_policy",
      "other"
    ]),
    title: nonEmptyText(300),
    publisher: optionalText(200),
    jurisdiction: optionalText(80),
    url: optionalText(1200),
    citation: optionalText(1000),
    reviewedAt: optionalDateOnlySchema,
    effectiveFrom: optionalDateOnlySchema,
    effectiveTo: optionalDateOnlySchema,
    versionLabel: optionalText(120),
    confidenceStatus: z
      .enum([
        "draft",
        "reviewed",
        "professional_review_required",
        "deprecated",
        "suspended"
      ])
      .optional()
      .default("draft"),
    languageCode: optionalText(20),
    metadata: optionalMetadataSchema,
    createdBy: optionalUuid,
    updatedBy: optionalUuid
  })
  .strict();

export const sourceReferenceLinkCreateSchema = z
  .object({
    sourceReferenceId: z.string().trim().uuid(),
    targetTable: nonEmptyText(120),
    targetId: z.string().trim().uuid(),
    linkType: z
      .enum(["supports", "explains", "derived_from", "reviewed_against", "disclaimer"])
      .optional()
      .default("supports"),
    metadata: optionalMetadataSchema,
    createdBy: optionalUuid
  })
  .strict();

export type BusinessProfileCreateInput = z.input<
  typeof businessProfileCreateSchema
>;
export type BusinessProfileCreateData = z.output<
  typeof businessProfileCreateSchema
>;
export type BusinessProfileUpdateInput = z.input<
  typeof businessProfileUpdateSchema
>;
export type BusinessProfileUpdateData = z.output<
  typeof businessProfileUpdateSchema
>;
export type ContactCreateInput = z.input<typeof contactCreateSchema>;
export type ContactCreateData = z.output<typeof contactCreateSchema>;
export type ContactUpdateInput = z.input<typeof contactUpdateSchema>;
export type ContactUpdateData = z.output<typeof contactUpdateSchema>;
export type InvoiceCreateInput = z.input<typeof invoiceCreateSchema>;
export type InvoiceCreateData = z.output<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.input<typeof invoiceUpdateSchema>;
export type InvoiceUpdateData = z.output<typeof invoiceUpdateSchema>;
export type InvoiceLineCreateInput = z.input<typeof invoiceLineCreateSchema>;
export type InvoiceLineCreateData = z.output<typeof invoiceLineCreateSchema>;
export type InvoiceTaxCreateInput = z.input<typeof invoiceTaxCreateSchema>;
export type InvoiceTaxCreateData = z.output<typeof invoiceTaxCreateSchema>;
export type InvoiceAllowanceCreateInput = z.input<
  typeof invoiceAllowanceCreateSchema
>;
export type InvoiceAllowanceCreateData = z.output<
  typeof invoiceAllowanceCreateSchema
>;
export type InvoiceChargeCreateInput = z.input<typeof invoiceChargeCreateSchema>;
export type InvoiceChargeCreateData = z.output<typeof invoiceChargeCreateSchema>;
export type InvoiceAttachmentCreateInput = z.input<
  typeof invoiceAttachmentCreateSchema
>;
export type InvoiceAttachmentCreateData = z.output<
  typeof invoiceAttachmentCreateSchema
>;
export type SecurityEventCreateInput = z.input<typeof securityEventCreateSchema>;
export type SecurityEventCreateData = z.output<typeof securityEventCreateSchema>;
export type SourceReferenceCreateInput = z.input<
  typeof sourceReferenceCreateSchema
>;
export type SourceReferenceCreateData = z.output<
  typeof sourceReferenceCreateSchema
>;
export type SourceReferenceLinkCreateInput = z.input<
  typeof sourceReferenceLinkCreateSchema
>;
export type SourceReferenceLinkCreateData = z.output<
  typeof sourceReferenceLinkCreateSchema
>;
