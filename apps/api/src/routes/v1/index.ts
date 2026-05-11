import type { FastifyInstance } from "fastify";
import { openApiDocument } from "../../openapi/openapi-document.js";
import { healthRoutes } from "../health.js";
import { apiKeyRoutes } from "./api-keys.js";
import { apiRequestRoutes } from "./api-requests.js";
import { apiUsageRoutes } from "./api-usage.js";
import { countryPackRoutes } from "./country-packs.js";
import { importUblRoutes } from "./import-ubl.js";
import { invoiceDraftRoutes } from "./invoice-drafts.js";
import { invoiceExportRoutes } from "./invoice-exports.js";
import { parseUblRoutes } from "./parse-ubl.js";
import { transactionRoutes } from "./transactions.js";
import { vatRoutes } from "./vat.js";
import { validateInvoiceRoutes } from "./validate-invoice.js";
import { validationRuleRoutes } from "./validation-rules.js";
import { validationRunRoutes } from "./validation-runs.js";
import { workspaceActivityRoutes } from "./workspace-activity.js";
import { workspaceDeletionRunRoutes } from "./workspace-deletion-runs.js";
import { workspaceExportPackageRoutes } from "./workspace-export-packages.js";
import { workspacePrivacyRequestRoutes } from "./workspace-privacy-requests.js";
import { workspaceRetentionPreviewRoutes } from "./workspace-retention-preview.js";
import { workspaceRetentionRunRoutes } from "./workspace-retention-runs.js";
import { workspaceSettingsRoutes } from "./workspace-settings.js";
import { xmlRoutes } from "./xml.js";

export async function v1Routes(app: FastifyInstance) {
  app.get("/openapi.json", async (_request, reply) => {
    return reply
      .header("Cache-Control", "public, max-age=300")
      .send(openApiDocument);
  });

  await app.register(healthRoutes, {
    prefix: "/health"
  });

  await app.register(apiKeyRoutes, {
    prefix: "/api-keys"
  });

  await app.register(apiRequestRoutes, {
    prefix: "/api-requests"
  });

  await app.register(apiUsageRoutes, {
    prefix: "/api-usage"
  });

  await app.register(countryPackRoutes, {
    prefix: "/country-packs"
  });

  await app.register(validateInvoiceRoutes, {
    prefix: "/invoices"
  });

  await app.register(invoiceDraftRoutes, {
    prefix: "/invoices"
  });

  await app.register(invoiceExportRoutes, {
    prefix: "/invoices"
  });

  await app.register(parseUblRoutes, {
    prefix: "/invoices"
  });

  await app.register(importUblRoutes, {
    prefix: "/invoices"
  });

  await app.register(transactionRoutes, {
    prefix: "/transactions"
  });

  await app.register(validationRunRoutes, {
    prefix: "/validation-runs"
  });

  await app.register(validationRuleRoutes, {
    prefix: "/validation"
  });

  await app.register(vatRoutes, {
    prefix: "/vat"
  });

  await app.register(xmlRoutes, {
    prefix: "/xml"
  });

  await app.register(workspaceActivityRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceSettingsRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspacePrivacyRequestRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceExportPackageRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceRetentionPreviewRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceRetentionRunRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceDeletionRunRoutes, {
    prefix: "/workspace"
  });
}