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

const vatIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(32)
  .optional()
  .default("");

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

const invoiceDraftStringAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a decimal string")
  .max(32);

export const invoiceEditorDraftSchema = z
  .object({
    document: z
      .object({
        number: z.string().trim().min(1).max(80),
        issueDate: z.string().trim().max(32),
        dueDate: z.string().trim().max(32),
        currency: currencySchema,
        invoiceType: z.enum(["invoice", "credit_note"]),
        profile: z.enum(["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"]),
        buyerReference: z.string().trim().max(120),
        contractReference: z.string().trim().max(120)
      })
      .strict(),

    seller: z
      .object({
        name: z.string().trim().min(1).max(160),
        country: countrySchema,
        vatId: vatIdSchema,
        city: z.string().trim().max(120),
        postalCode: z.string().trim().max(32),
        street: z.string().trim().max(180),
        electronicAddress: z.string().trim().max(160)
      })
      .strict(),

    buyer: z
      .object({
        name: z.string().trim().min(1).max(160),
        country: countrySchema,
        vatId: vatIdSchema,
        city: z.string().trim().max(120),
        postalCode: z.string().trim().max(32),
        street: z.string().trim().max(180),
        electronicAddress: z.string().trim().max(160)
      })
      .strict(),

    lines: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(64),
            description: z.string().trim().min(1).max(280),
            quantity: z.string().trim().min(1).max(32),
            unitCode: z.string().trim().min(1).max(12),
            unitPrice: z.string().trim().min(1).max(32),
            vatCategory: z.string().trim().min(1).max(12),
            vatRate: z.string().trim().min(1).max(32),
            netAmount: z.string().trim().min(1).max(32)
          })
          .strict()
      )
      .min(1)
      .max(200),

    totals: z
      .object({
        lineExtensionAmount: invoiceDraftStringAmountSchema,
        taxExclusiveAmount: invoiceDraftStringAmountSchema,
        taxAmount: invoiceDraftStringAmountSchema,
        taxInclusiveAmount: invoiceDraftStringAmountSchema,
        payableAmount: invoiceDraftStringAmountSchema
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
