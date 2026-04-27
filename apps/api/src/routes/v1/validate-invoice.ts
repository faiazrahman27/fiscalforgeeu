import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireApiKey } from "../../middleware/require-api-key.js";
import { invoiceValidationRequestSchema } from "../../schemas/invoice.js";
import {
  buildValidationFindings,
  calculateValidationTotals,
  hasAuthenticatedValidationRunContext,
  saveAuthenticatedValidationRun,
  saveValidationRun,
  type AuthenticatedValidationRunContext,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import { formatZodError } from "../../utils/zod-error.js";

function getAuthenticatedValidationRunContext(
  request: FastifyRequest
): AuthenticatedValidationRunContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedValidationRunContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Validation run storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VALIDATION_RUN_STORAGE_ERROR",
      message: "Could not save the validation run.",
      details: error instanceof Error ? error.message : null
    }
  });
}

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

      /*
       * Local JSON fallback still uses a readable development ID.
       * Supabase-backed validation runs use the database UUID returned after insert.
       */
      const localValidationRunId = `val_${randomUUID()}`;

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
        id: localValidationRunId,
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

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const savedRecord = authenticatedContext
          ? await saveAuthenticatedValidationRun(
              authenticatedContext,
              record,
              payload
            )
          : await saveValidationRun(record);

        return reply.status(200).send({
          validationRunId: savedRecord.id,
          invoiceNumber: payload.document.number,
          technicalStatus,
          standardStatus,
          countrySimulationStatus,
          vidaReadinessStatus,
          totals,
          findings,
          disclaimer
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
