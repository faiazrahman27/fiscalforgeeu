import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getCountryPackCatalogItem,
  listCountryPackCatalog
} from "../../repositories/country-pack-repository.js";

const countryCodeParamsSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .min(2)
    .max(2)
    .regex(/^[A-Za-z]{2}$/)
});

export async function countryPackRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    const catalog = await listCountryPackCatalog();

    return reply.header("Cache-Control", "public, max-age=300").send(catalog);
  });

  app.get("/:countryCode", async (request, reply) => {
    const parsedParams = countryCodeParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        error: {
          code: "INVALID_COUNTRY_CODE",
          message: "Country code must be a two-letter ISO-style code.",
          details: parsedParams.error.flatten()
        }
      });
    }

    const countryPack = await getCountryPackCatalogItem(
      parsedParams.data.countryCode
    );

    if (!countryPack) {
      return reply.status(404).send({
        error: {
          code: "COUNTRY_PACK_NOT_FOUND",
          message: "Country pack is not currently supported by Invoice Lantern.",
          details: {
            countryCode: parsedParams.data.countryCode.toUpperCase()
          }
        }
      });
    }

    return reply.header("Cache-Control", "public, max-age=300").send({
      countryPack,
      disclaimer: countryPack.disclaimer,
      registrySource: countryPack.registry.registrySource
    });
  });
}
