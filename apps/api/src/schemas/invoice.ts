import { z } from "zod";

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO-style code");

const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Country must be a 2-letter ISO-style code");

const draftCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(3)
  .refine(
    (value) => value === "" || /^[A-Z]{3}$/.test(value),
    "Currency must be blank or a 3-letter ISO-style code"
  );

const draftCountrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(2)
  .refine(
    (value) => value === "" || /^[A-Z]{2}$/.test(value),
    "Country must be blank or a 2-letter ISO-style code"
  );

const vatIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(32)
  .optional()
  .default("");

const draftVatIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(32)
  .optional()
  .default("");

const draftTextSchema = (maxLength: number) => z.string().trim().max(maxLength);

const draftRequiredIdSchema = z.string().trim().min(1).max(64);

const draftEditableDecimalStringSchema = z
  .string()
  .trim()
  .max(32)
  .refine(
    (value) => value === "" || /^\d+(\.\d*)?$/.test(value),
    "Value must be blank or a decimal string"
  );

const partySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    country: countrySchema,
    vatId: vatIdSchema
  })
  .strict();

const invoiceLineSchema = z
  .object({
    description: z.string().trim().min(1).max(280),
    quantity: z.number().finite().positive().max(1000000),
    unitPrice: z.number().finite().min(0).max(100000000),
    vatCategory: z.string().trim().min(1).max(12),
    vatRate: z.number().finite().min(0).max(100)
  })
  .strict();

export const invoiceValidationRequestSchema = z
  .object({
    document: z
      .object({
        type: z.enum(["invoice", "credit_note"]).default("invoice"),
        number: z.string().trim().min(1).max(80),
        currency: currencySchema,
        issueDate: z.string().trim().max(32).optional()
      })
      .strict(),

    seller: partySchema,
    buyer: partySchema,

    lines: z.array(invoiceLineSchema).min(1).max(200)
  })
  .strict();

export const invoiceEditorDraftSchema = z
  .object({
    document: z
      .object({
        number: draftTextSchema(80),
        issueDate: draftTextSchema(32),
        dueDate: draftTextSchema(32),
        currency: draftCurrencySchema,
        invoiceType: z.enum(["invoice", "credit_note"]),
        profile: z.enum(["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"]),
        buyerReference: draftTextSchema(120),
        contractReference: draftTextSchema(120)
      })
      .strict(),

    seller: z
      .object({
        name: draftTextSchema(160),
        country: draftCountrySchema,
        vatId: draftVatIdSchema,
        city: draftTextSchema(120),
        postalCode: draftTextSchema(32),
        street: draftTextSchema(180),
        electronicAddress: draftTextSchema(160)
      })
      .strict(),

    buyer: z
      .object({
        name: draftTextSchema(160),
        country: draftCountrySchema,
        vatId: draftVatIdSchema,
        city: draftTextSchema(120),
        postalCode: draftTextSchema(32),
        street: draftTextSchema(180),
        electronicAddress: draftTextSchema(160)
      })
      .strict(),

    lines: z
      .array(
        z
          .object({
            id: draftRequiredIdSchema,
            description: draftTextSchema(280),
            quantity: draftEditableDecimalStringSchema,
            unitCode: draftTextSchema(12),
            unitPrice: draftEditableDecimalStringSchema,
            vatCategory: draftTextSchema(12),
            vatRate: draftEditableDecimalStringSchema,
            netAmount: draftEditableDecimalStringSchema
          })
          .strict()
      )
      .min(1)
      .max(200),

    totals: z
      .object({
        lineExtensionAmount: draftEditableDecimalStringSchema,
        taxExclusiveAmount: draftEditableDecimalStringSchema,
        taxAmount: draftEditableDecimalStringSchema,
        taxInclusiveAmount: draftEditableDecimalStringSchema,
        payableAmount: draftEditableDecimalStringSchema
      })
      .strict()
  })
  .strict();

export const invoiceDraftParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

export type InvoiceValidationRequest = z.infer<
  typeof invoiceValidationRequestSchema
>;

export type InvoiceEditorDraftPayload = z.infer<typeof invoiceEditorDraftSchema>;
