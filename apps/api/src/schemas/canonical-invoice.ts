import { z } from "zod";
import { canonicalInvoiceSchema } from "@invoice-lantern/invoice-core";

export const productionInvoiceParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

export const productionInvoiceListQuerySchema = z
  .object({
    status: z
      .enum(["draft", "ready_for_review", "validated", "issued", "archived", "voided"])
      .optional(),
    invoiceNumber: z.string().trim().min(1).max(120).optional()
  })
  .strict();

export const productionInvoiceCreateRequestSchema = z
  .object({
    canonicalInvoice: z.unknown(),
    source: z
      .enum(["manual", "api", "ubl_import", "cii_import"])
      .optional()
      .default("manual"),
    draftId: z.string().trim().uuid().nullable().optional()
  })
  .strict();

export const productionInvoiceUpdateRequestSchema = z
  .object({
    canonicalInvoice: z.unknown()
  })
  .strict();

export const productionInvoiceFromDraftRequestSchema = z
  .object({
    draftId: z.string().trim().min(1).max(120),
    source: z
      .enum(["manual", "api", "ubl_import", "cii_import"])
      .optional()
      .default("manual")
  })
  .strict();

export const productionInvoiceTransitionRequestSchema = z
  .object({
    toStatus: z.enum([
      "draft",
      "ready_for_review",
      "validated",
      "issued",
      "archived",
      "voided"
    ]),
    reason: z.string().trim().min(1).max(1000).optional()
  })
  .strict();

export const canonicalInvoiceRequestSchema = canonicalInvoiceSchema;

export type ProductionInvoiceListQuery = z.infer<
  typeof productionInvoiceListQuerySchema
>;
export type ProductionInvoiceCreateRequest = z.infer<
  typeof productionInvoiceCreateRequestSchema
>;
export type ProductionInvoiceUpdateRequest = z.infer<
  typeof productionInvoiceUpdateRequestSchema
>;
export type ProductionInvoiceFromDraftRequest = z.infer<
  typeof productionInvoiceFromDraftRequestSchema
>;
export type ProductionInvoiceTransitionRequest = z.infer<
  typeof productionInvoiceTransitionRequestSchema
>;
