import {
  simulateVidaReadiness,
  type VidaReadinessSimulationInput
} from "@invoice-lantern/vida-simulator";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import { formatZodError } from "../../utils/zod-error.js";

const vidaSimulationRequestSchema = z
  .object({
    sellerCountry: z.string().trim().min(1).max(8),
    buyerCountry: z.string().trim().min(1).max(8),
    sellerVatId: z.string().trim().max(64).optional(),
    buyerVatId: z.string().trim().max(64).optional(),
    buyerType: z
      .enum(["business", "consumer", "public_authority", "unknown"])
      .optional(),
    transactionType: z
      .enum(["goods", "services", "digital_service", "mixed", "unknown"])
      .optional(),
    invoiceDate: z.string().trim().max(32).optional(),
    currency: z.string().trim().max(8).optional(),
    amount: z.string().trim().max(80).optional(),
    countryPackVersions: z
      .record(z.string().trim().min(1).max(8), z.string().trim().min(1).max(80))
      .optional()
  })
  .strict();

function buildVidaSimulationInput(
  data: z.infer<typeof vidaSimulationRequestSchema>
): VidaReadinessSimulationInput {
  const input: VidaReadinessSimulationInput = {
    sellerCountry: data.sellerCountry,
    buyerCountry: data.buyerCountry
  };

  if (data.sellerVatId !== undefined) {
    input.sellerVatId = data.sellerVatId;
  }

  if (data.buyerVatId !== undefined) {
    input.buyerVatId = data.buyerVatId;
  }

  if (data.buyerType !== undefined) {
    input.buyerType = data.buyerType;
  }

  if (data.transactionType !== undefined) {
    input.transactionType = data.transactionType;
  }

  if (data.invoiceDate !== undefined) {
    input.invoiceDate = data.invoiceDate;
  }

  if (data.currency !== undefined) {
    input.currency = data.currency;
  }

  if (data.amount !== undefined) {
    input.amount = data.amount;
  }

  if (data.countryPackVersions !== undefined) {
    input.countryPackVersions = data.countryPackVersions;
  }

  return input;
}

export async function transactionRoutes(app: FastifyInstance) {
  app.post(
    "/simulate-vida",
    {
      preHandler: [
        requireApiKeyScopes(["transactions:simulate_vida"]),
        requireApiKeyRateLimitPolicy("transactions_simulate_vida")
      ]
    },
    async (request, reply) => {
      const parsedBody = vidaSimulationRequestSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "VIDA_SIMULATION_REQUEST_INVALID",
            message: "Request body failed ViDA-readiness simulation validation.",
            details: formatZodError(parsedBody.error)
          }
        });
      }

      return simulateVidaReadiness(buildVidaSimulationInput(parsedBody.data));
    }
  );
}