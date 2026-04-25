import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../health.js";
import { validateInvoiceRoutes } from "./validate-invoice.js";
import { xmlRoutes } from "./xml.js";

export async function v1Routes(app: FastifyInstance) {
  await app.register(healthRoutes, {
    prefix: "/health"
  });

  await app.register(validateInvoiceRoutes, {
    prefix: "/invoices"
  });

  await app.register(xmlRoutes, {
    prefix: "/xml"
  });
}
