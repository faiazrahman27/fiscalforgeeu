import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import { invoiceValidationRequestSchema } from "../../schemas/invoice.js";
import {
  buildValidationFindings,
  calculateValidationTotals,
  saveValidationRun,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

export async function validateInvoiceRoutes(app: FastifyInstance) {
  app.post(
    "/validate",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedBody = invoiceValidationRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body failed schema validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      const payload = parsedBody.data;
      const findings = buildValidationFindings(payload);
      const totals = calculateValidationTotals(payload);

      const hasFatal = findings.some((finding) => finding.severity === "fatal");
      const hasWarning = findings.some(
        (finding) => finding.severity === "warning"
      );
      const isCrossBorder = payload.seller.country !== payload.buyer.country;

      const validationRunId = `val_${randomUUID()}`;

      const technicalStatus: ValidationRunRecord["technicalStatus"] = hasFatal
        ? "failed"
        : "passed";

      const standardStatus: ValidationRunRecord["standardStatus"] = hasWarning
        ? "warning"
        : "ready";

      const countrySimulationStatus: ValidationRunRecord["countrySimulationStatus"] =
        isCrossBorder ? "review_required" : "not_relevant";

      const vidaReadinessStatus: ValidationRunRecord["vidaReadinessStatus"] =
        isCrossBorder ? "relevant_simulation" : "not_relevant";

      const confidence: ValidationRunRecord["confidence"] = isCrossBorder
        ? "educational_simulation"
        : "technical_preview";

      const disclaimer =
        "This API response is a development sandbox result. It is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation.";

      const record: ValidationRunRecord = {
        id: validationRunId,
        invoiceNumber: payload.document.number,
        buyer: payload.buyer.name,
        seller: payload.seller.name,
        createdAt: new Date().toISOString(),
        technicalStatus,
        standardStatus,
        countrySimulationStatus,
        vidaReadinessStatus,
        confidence,
        profile: "API_VALIDATION",
        currency: payload.document.currency,
        totals,
        findings,
        disclaimer
      };

      await saveValidationRun(record);

      return reply.status(200).send({
        validationRunId,
        invoiceNumber: payload.document.number,
        technicalStatus,
        standardStatus,
        countrySimulationStatus,
        vidaReadinessStatus,
        totals,
        findings,
        disclaimer
      });
    }
  );
}
