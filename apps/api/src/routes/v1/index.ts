import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../health.js";
import { invoiceDraftRoutes } from "./invoice-drafts.js";
import { validateInvoiceRoutes } from "./validate-invoice.js";
import { validationRunRoutes } from "./validation-runs.js";
import { workspaceActivityRoutes } from "./workspace-activity.js";
import { xmlRoutes } from "./xml.js";

export async function v1Routes(app: FastifyInstance) {
  await app.register(healthRoutes, {
    prefix: "/health"
  });

  await app.register(validateInvoiceRoutes, {
    prefix: "/invoices"
  });

  await app.register(invoiceDraftRoutes, {
    prefix: "/invoices"
  });

  await app.register(validationRunRoutes, {
    prefix: "/validation-runs"
  });

  await app.register(xmlRoutes, {
    prefix: "/xml"
  });

  await app.register(workspaceActivityRoutes, {
    prefix: "/workspace"
  });
}
