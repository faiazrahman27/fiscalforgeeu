import { z } from "zod";
import {
  canonicalInvoiceSchema,
  type CanonicalInvoice
} from "@invoice-lantern/invoice-core";

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

export const invoiceValidationRequestSchema = canonicalInvoiceSchema;

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

export type InvoiceValidationRequest = CanonicalInvoice;

export type InvoiceEditorDraftPayload = z.infer<typeof invoiceEditorDraftSchema>;
