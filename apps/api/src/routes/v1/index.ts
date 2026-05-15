import type { FastifyInstance } from "fastify";
import { openApiDocument } from "../../openapi/openapi-document.js";
import { healthRoutes } from "../health.js";
import { apiKeyRoutes } from "./api-keys.js";
import { apiRequestRoutes } from "./api-requests.js";
import { apiUsageRoutes } from "./api-usage.js";
import { adminRuleConsoleRoutes } from "./admin-rule-console.js";
import { countryPackRoutes } from "./country-packs.js";
import { importUblRoutes } from "./import-ubl.js";
import { invoiceDraftRoutes } from "./invoice-drafts.js";
import { invoiceExportRoutes } from "./invoice-exports.js";
import { invoiceRoutes } from "./invoices.js";
import { legalDocumentRoutes } from "./legal-documents.js";
import { parseUblRoutes } from "./parse-ubl.js";
import { securityReadinessRoutes } from "./security-readiness.js";
import { transactionRoutes } from "./transactions.js";
import { vatRoutes } from "./vat.js";
import { validateInvoiceRoutes } from "./validate-invoice.js";
import { validationRuleRoutes } from "./validation-rules.js";
import { validationRunRoutes } from "./validation-runs.js";
import { webhookRoutes } from "./webhooks.js";
import { workspaceActivityRoutes } from "./workspace-activity.js";
import { workspaceBusinessProfileRoutes } from "./workspace-business-profiles.js";
import { workspaceContactRoutes } from "./workspace-contacts.js";
import { workspaceDeletionRunRoutes } from "./workspace-deletion-runs.js";
import { workspaceExportPackageRoutes } from "./workspace-export-packages.js";
import { workspaceMemberRoutes } from "./workspace-members.js";
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

  await app.register(adminRuleConsoleRoutes, {
    prefix: "/admin"
  });

  await app.register(legalDocumentRoutes, {
    prefix: "/legal"
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

  await app.register(invoiceRoutes, {
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

  await app.register(webhookRoutes, {
    prefix: "/webhooks"
  });

  await app.register(workspaceActivityRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceBusinessProfileRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceContactRoutes, {
    prefix: "/workspace"
  });

  await app.register(securityReadinessRoutes, {
    prefix: "/workspace"
  });

  await app.register(workspaceMemberRoutes, {
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
