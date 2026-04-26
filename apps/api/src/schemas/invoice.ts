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

export type InvoiceValidationRequest = z.infer<
  typeof invoiceValidationRequestSchema
>;

