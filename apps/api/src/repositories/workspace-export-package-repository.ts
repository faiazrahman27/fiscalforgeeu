import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../lib/supabase/server-client.js";

export type WorkspaceExportPackageType = "full_workspace";
export type WorkspaceExportPackageStatus = "prepared" | "failed";
export type WorkspaceExportPackageFormat = "json";

export type WorkspaceExportPackageRecordCounts = {
  organizationProfile: number;
  members: number;
  invitations: number;
  businessProfiles: number;
  contacts: number;
  productionInvoices: number;
  invoiceLines: number;
  invoiceTaxes: number;
  invoiceAllowances: number;
  invoiceCharges: number;
  invoiceExports: number;
  invoiceDrafts: number;
  validationRuns: number;
  vatNumberChecks: number;
  viesEvidenceChecks: number;
  vidaSimulationRuns: number;
  xmlValidationJobs: number;
  xmlReadinessReports: number;
  workspaceSettings: number;
  apiKeys: number;
  apiRequests: number;
  webhookEndpoints: number;
  webhookDeliveries: number;
  legalAcceptances: number;
  privacyRequests: number;
  privacyRequestEvents: number;
  retentionRuns: number;
  deletionRuns: number;
  activityEvents: number;
  securityEvents: number;
  privacyAuditEvents: number;
};

export type WorkspaceExportPackagePayload = {
  exportVersion: "1.0";
  generatedAt: string;
  packageType: WorkspaceExportPackageType;
  exportFormat: WorkspaceExportPackageFormat;
  workspace: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    membershipRole: string;
    userEmail: string;
  };
  recordCounts: WorkspaceExportPackageRecordCounts;
  manifest: {
    schemaVersion: "privacy-export-v2";
    includedDatasets: string[];
    redactedDatasets: string[];
    excludedFields: string[];
    warnings: string[];
  };
  redactionNotice: string;
  retentionDeletionNotes: string[];
  data: {
    organizationProfile: unknown[];
    members: unknown[];
    invitations: unknown[];
    businessProfiles: unknown[];
    contacts: unknown[];
    productionInvoices: unknown[];
    invoiceLines: unknown[];
    invoiceTaxes: unknown[];
    invoiceAllowances: unknown[];
    invoiceCharges: unknown[];
    invoiceExports: unknown[];
    invoiceDrafts: unknown[];
    validationRuns: unknown[];
    vatNumberChecks: unknown[];
    viesEvidenceChecks: unknown[];
    vidaSimulationRuns: unknown[];
    xmlValidationJobs: unknown[];
    xmlReadinessReports: unknown[];
    workspaceSettings: unknown[];
    apiKeys: unknown[];
    apiRequests: unknown[];
    webhookEndpoints: unknown[];
    webhookDeliveries: unknown[];
    legalAcceptances: unknown[];
    privacyRequests: unknown[];
    privacyRequestEvents: unknown[];
    retentionRuns: unknown[];
    deletionRuns: unknown[];
    activityEvents: unknown[];
    securityEvents: unknown[];
    privacyAuditEvents: unknown[];
  };
  disclaimer: string;
};

export type WorkspaceExportPackageRecord = {
  id: string;
  packageType: WorkspaceExportPackageType;
  status: WorkspaceExportPackageStatus;
  exportName: string;
  exportFormat: WorkspaceExportPackageFormat;
  sourcePrivacyRequestId: string;
  recordCounts: WorkspaceExportPackageRecordCounts;
  packagePayload: WorkspaceExportPackagePayload | null;
  packageSizeBytes: number;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceExportPackageCreatePayload = {
  exportName: string;
  sourcePrivacyRequestId?: string;
};

export type AuthenticatedWorkspaceExportPackageContext = {
  userId: string;
  accessToken: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseWorkspaceExportPackageRow = {
  id: string;
  organization_id: string;
  requested_by: string;
  source_privacy_request_id: string | null;
  package_type: string;
  status: string;
  export_name: string;
  export_format: string;
  record_counts: unknown;
  package_payload: unknown;
  package_size_bytes: number | string;
  error_message: string;
  created_at: string;
  updated_at: string;
};

const MAX_EXPORT_PACKAGES = 100;
const MAX_EXPORTED_RECORDS_PER_COLLECTION = 1000;

const WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS =
  "id, organization_id, requested_by, source_privacy_request_id, package_type, status, export_name, export_format, record_counts, package_payload, package_size_bytes, error_message, created_at, updated_at";

const INVOICE_DRAFT_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, seller_name, seller_country, buyer_name, buyer_country, issue_date, due_date, invoice_type, profile, buyer_reference, contract_reference, currency, line_extension_amount, tax_exclusive_amount, tax_amount, tax_inclusive_amount, payable_amount, payload, summary, created_at, updated_at";

const VALIDATION_RUN_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, invoice_number, buyer_name, seller_name, profile, issue_date, seller_country, buyer_country, technical_status, standard_status, country_simulation_status, vida_readiness_status, confidence, currency, findings_count, payable_amount, totals, findings, payload, disclaimer, created_at, updated_at";

const XML_REPORT_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, file_name, file_size, detected_document, root_element, invoice_id, issue_date, currency, api_status, status, note, technical_status, readiness_status, document_status, calculation_status, profile_status, extracted_data, findings, findings_count, seller_name, buyer_name, line_count, payable_amount, tax_amount, summary, disclaimer, uploaded_at, created_at, updated_at";

const WORKSPACE_SETTINGS_EXPORT_SELECT_FIELDS =
  "organization_id, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, xml_validation_job_retention_days, invoice_export_retention_days, api_request_log_retention_days, webhook_delivery_log_retention_days, vies_evidence_retention_days, vida_simulation_retention_days, activity_log_retention_days, privacy_request_retention_days, retention_run_retention_days, deletion_run_retention_days, legal_acceptance_retention_days, store_uploaded_xml_after_validation, retain_validation_reports, retain_vies_evidence, retain_webhook_payload_previews, allow_data_export_requests, allow_deletion_requests, include_api_logs_in_exports, include_webhook_logs_in_exports, include_legal_acceptances_in_exports, data_minimization_mode, privacy_contact_email, security_contact_email, updated_by, created_at, updated_at";

const PRIVACY_REQUEST_EXPORT_SELECT_FIELDS =
  "id, organization_id, requester_user_id, request_type, status, subject, details, requester_email, reviewer_user_id, review_note, completed_at, created_at, updated_at";

const ACTIVITY_EVENT_EXPORT_SELECT_FIELDS =
  "id, organization_id, actor_user_id, event_type, entity_type, entity_id, entity_label, severity, source, metadata, created_at";

const ORGANIZATION_EXPORT_SELECT_FIELDS =
  "id, name, slug, created_by, created_at, updated_at";

const MEMBER_EXPORT_SELECT_FIELDS =
  "id, organization_id, user_id, role, created_at, updated_at";

const INVITATION_EXPORT_SELECT_FIELDS =
  "id, organization_id, email, role, token_prefix, status, invited_by, accepted_by, revoked_by, expires_at, accepted_at, revoked_at, metadata, created_at, updated_at";

const BUSINESS_PROFILE_EXPORT_SELECT_FIELDS =
  "id, organization_id, profile_type, display_name, legal_name, trading_name, country_code, vat_id, tax_registration_number, electronic_address, electronic_address_scheme, email, phone, website, address_line1, address_line2, city, region, postal_code, country_subdivision, default_currency, payment_terms, bank_account_label, bank_account_last4, metadata, status, created_by, updated_by, created_at, updated_at";

const CONTACT_EXPORT_SELECT_FIELDS =
  "id, organization_id, business_profile_id, contact_type, display_name, legal_name, email, phone, country_code, vat_id, tax_registration_number, electronic_address, electronic_address_scheme, address_line1, address_line2, city, region, postal_code, country_subdivision, notes, metadata, status, created_by, updated_by, created_at, updated_at";

const PRODUCTION_INVOICE_EXPORT_SELECT_FIELDS =
  "id, organization_id, draft_id, seller_profile_id, buyer_profile_id, buyer_contact_id, seller_contact_id, invoice_number, invoice_type, profile, issue_date, due_date, tax_point_date, currency, buyer_reference, contract_reference, order_reference, project_reference, accounting_cost, payment_terms, payment_means_code, payment_reference, seller_snapshot, buyer_snapshot, delivery_snapshot, payment_snapshot, canonical_json, calculation_summary, validation_summary, legal_disclaimer, legal_confidence, status, source, created_by, updated_by, created_at, updated_at, finalized_at, issued_at, archived_at";

const INVOICE_LINE_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_id, line_number, description, item_name, quantity, unit_code, unit_price, discount_amount, charge_amount, net_amount, vat_category, vat_rate, tax_scheme, accounting_cost, order_line_reference, metadata, created_at, updated_at";

const INVOICE_TAX_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_id, invoice_line_id, tax_category, tax_scheme, vat_rate, taxable_amount, tax_amount, exemption_reason, exemption_reason_code, metadata, created_at, updated_at";

const INVOICE_ALLOWANCE_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_id, invoice_line_id, scope, reason, reason_code, amount, base_amount, percentage, tax_category, vat_rate, metadata, created_at, updated_at";

const INVOICE_CHARGE_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_id, invoice_line_id, scope, reason, reason_code, amount, base_amount, percentage, tax_category, vat_rate, metadata, created_at, updated_at";

const INVOICE_EXPORT_METADATA_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, export_type, format, profile, filename, content_type, xml_sha256, xml_size_bytes, status, disclaimer, generated_by, created_at";

const VAT_CHECK_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, party_role, input_country_hint, detected_country_code, normalized_vat_id, vat_id_fingerprint, check_level, source, format_valid, message, warnings, disclaimer, checked_by, created_at";

const VIES_EVIDENCE_EXPORT_SELECT_FIELDS =
  "id, organization_id, invoice_draft_id, validation_run_id, party_role, country_code, vat_number_normalized, vat_number_display, vat_number_fingerprint, request_source, status, vies_valid, vies_name, vies_address, request_identifier, checked_at, source_label, source_url, response_time_ms, error_code, error_message_safe, raw_response_hash, metadata, created_by, created_at";

const VIDA_SIMULATION_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, api_key_id, invoice_draft_id, validation_run_id, source, status, simulation_version, seller_country_code, buyer_country_code, buyer_type, transaction_type, transaction_class, vida_relevance, legal_confidence, invoice_date, currency_code, amount_text, country_pack_versions, input_payload, normalized_input, country_context, result_payload, findings, source_labels, recommended_next_actions, finding_count, info_count, warning_count, review_required_count, reason, effective_date_context, disclaimer, error_code, error_message, request_metadata, created_at, updated_at";

const XML_VALIDATION_JOB_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, xml_readiness_report_id, invoice_draft_id, validation_run_id, source_type, document_type, filename, xml_sha256, xml_size_bytes, status, requested_checks, completed_checks, failed_checks, worker_name, worker_version, started_at, completed_at, failed_at, error_code, error_message, result_summary, findings, disclaimer, created_at, updated_at";

const API_KEY_EXPORT_SELECT_FIELDS =
  "id, organization_id, name, key_prefix, environment, scopes, status, expires_at, last_used_at, last_used_ip, created_by, revoked_by, revoked_at, created_at, updated_at";

const API_REQUEST_EXPORT_SELECT_FIELDS =
  "id, organization_id, api_key_id, request_method, request_path, status_code, duration_ms, ip_address, user_agent, error_code, created_at";

const WEBHOOK_ENDPOINT_EXPORT_SELECT_FIELDS =
  "id, organization_id, created_by, updated_by, name, url, description, event_types, status, signing_secret_last4, signing_secret_key_id, last_delivery_at, last_success_at, last_failure_at, failure_count, created_at, updated_at, disabled_at";

const WEBHOOK_DELIVERY_EXPORT_SELECT_FIELDS =
  "id, organization_id, webhook_endpoint_id, event_type, status, attempt_number, max_attempts, request_method, request_url, request_headers_redacted, request_payload, payload_hash, signature_header, response_status, response_headers_redacted, response_body_preview, response_time_ms, error_code, error_message_safe, next_retry_at, delivered_at, created_by, created_at";

const LEGAL_ACCEPTANCE_EXPORT_SELECT_FIELDS =
  "id, organization_id, user_id, legal_document_id, legal_document_version_id, accepted_at, acceptance_context, ip_hash, user_agent_hash, metadata";

const PRIVACY_REQUEST_EVENT_EXPORT_SELECT_FIELDS =
  "id, organization_id, privacy_request_id, actor_user_id, event_type, status, metadata, created_at";

const RETENTION_RUN_EXPORT_SELECT_FIELDS =
  "id, organization_id, initiated_by, run_type, status, retention_mode, invoice_draft_retention_days, validation_run_retention_days, xml_report_retention_days, xml_validation_job_retention_days, invoice_export_retention_days, api_request_log_retention_days, webhook_delivery_log_retention_days, vies_evidence_retention_days, vida_simulation_retention_days, activity_log_retention_days, privacy_request_retention_days, retention_run_retention_days, deletion_run_retention_days, legal_acceptance_retention_days, invoice_draft_cutoff_date, validation_run_cutoff_date, xml_report_cutoff_date, xml_validation_job_cutoff_date, invoice_export_cutoff_date, api_request_log_cutoff_date, webhook_delivery_log_cutoff_date, vies_evidence_cutoff_date, vida_simulation_cutoff_date, activity_log_cutoff_date, privacy_request_cutoff_date, retention_run_cutoff_date, deletion_run_cutoff_date, legal_acceptance_cutoff_date, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, xml_validation_job_affected_count, invoice_export_affected_count, api_request_log_affected_count, webhook_delivery_log_affected_count, vies_evidence_affected_count, vida_simulation_affected_count, activity_event_affected_count, privacy_request_affected_count, retention_run_affected_count, deletion_run_affected_count, legal_acceptance_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, xml_validation_job_executed_count, invoice_export_executed_count, api_request_log_executed_count, webhook_delivery_log_executed_count, vies_evidence_executed_count, vida_simulation_executed_count, activity_event_executed_count, privacy_request_executed_count, retention_run_executed_count, deletion_run_executed_count, legal_acceptance_executed_count, error_message, executed_at, created_at, updated_at";

const DELETION_RUN_EXPORT_SELECT_FIELDS =
  "id, organization_id, source_privacy_request_id, initiated_by, run_type, status, invoice_draft_affected_count, validation_run_affected_count, xml_report_affected_count, workspace_export_package_affected_count, activity_event_affected_count, production_invoice_affected_count, business_profile_affected_count, contact_affected_count, invoice_export_affected_count, vat_number_check_affected_count, xml_validation_job_affected_count, api_key_affected_count, api_request_log_affected_count, webhook_endpoint_affected_count, webhook_delivery_affected_count, vies_evidence_affected_count, vida_simulation_affected_count, legal_acceptance_affected_count, privacy_request_event_affected_count, privacy_audit_event_affected_count, invoice_draft_executed_count, validation_run_executed_count, xml_report_executed_count, workspace_export_package_executed_count, activity_event_executed_count, production_invoice_executed_count, business_profile_executed_count, contact_executed_count, invoice_export_executed_count, vat_number_check_executed_count, xml_validation_job_executed_count, api_key_executed_count, api_request_log_executed_count, webhook_endpoint_executed_count, webhook_delivery_executed_count, vies_evidence_executed_count, vida_simulation_executed_count, legal_acceptance_executed_count, privacy_request_event_executed_count, privacy_audit_event_executed_count, error_message, executed_at, created_at, updated_at";

const SECURITY_EVENT_EXPORT_SELECT_FIELDS =
  "id, organization_id, actor_user_id, event_type, entity_type, entity_id, severity, ip_hash, user_agent_hash, metadata, created_at";

const PRIVACY_AUDIT_EVENT_EXPORT_SELECT_FIELDS =
  "id, organization_id, actor_user_id, event_type, entity_type, entity_id, severity, metadata, created_at";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "member");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function normalizePackageType(value: string): WorkspaceExportPackageType {
  return value === "full_workspace" ? "full_workspace" : "full_workspace";
}

function normalizePackageStatus(value: string): WorkspaceExportPackageStatus {
  return value === "failed" ? "failed" : "prepared";
}

function normalizePackageFormat(value: string): WorkspaceExportPackageFormat {
  return value === "json" ? "json" : "json";
}

function normalizeRecordCounts(value: unknown): WorkspaceExportPackageRecordCounts {
  const emptyCounts: WorkspaceExportPackageRecordCounts = {
    organizationProfile: 0,
    members: 0,
    invitations: 0,
    businessProfiles: 0,
    contacts: 0,
    productionInvoices: 0,
    invoiceLines: 0,
    invoiceTaxes: 0,
    invoiceAllowances: 0,
    invoiceCharges: 0,
    invoiceExports: 0,
    invoiceDrafts: 0,
    validationRuns: 0,
    vatNumberChecks: 0,
    viesEvidenceChecks: 0,
    vidaSimulationRuns: 0,
    xmlValidationJobs: 0,
    xmlReadinessReports: 0,
    workspaceSettings: 0,
    apiKeys: 0,
    apiRequests: 0,
    webhookEndpoints: 0,
    webhookDeliveries: 0,
    legalAcceptances: 0,
    privacyRequests: 0,
    privacyRequestEvents: 0,
    retentionRuns: 0,
    deletionRuns: 0,
    activityEvents: 0,
    securityEvents: 0,
    privacyAuditEvents: 0
  };

  if (!isPlainObject(value)) {
    return emptyCounts;
  }

  return {
    organizationProfile: readNumberField(value, "organizationProfile"),
    members: readNumberField(value, "members"),
    invitations: readNumberField(value, "invitations"),
    businessProfiles: readNumberField(value, "businessProfiles"),
    contacts: readNumberField(value, "contacts"),
    productionInvoices: readNumberField(value, "productionInvoices"),
    invoiceLines: readNumberField(value, "invoiceLines"),
    invoiceTaxes: readNumberField(value, "invoiceTaxes"),
    invoiceAllowances: readNumberField(value, "invoiceAllowances"),
    invoiceCharges: readNumberField(value, "invoiceCharges"),
    invoiceExports: readNumberField(value, "invoiceExports"),
    invoiceDrafts: readNumberField(value, "invoiceDrafts"),
    validationRuns: readNumberField(value, "validationRuns"),
    vatNumberChecks: readNumberField(value, "vatNumberChecks"),
    viesEvidenceChecks: readNumberField(value, "viesEvidenceChecks"),
    vidaSimulationRuns: readNumberField(value, "vidaSimulationRuns"),
    xmlValidationJobs: readNumberField(value, "xmlValidationJobs"),
    xmlReadinessReports: readNumberField(value, "xmlReadinessReports"),
    workspaceSettings: readNumberField(value, "workspaceSettings"),
    apiKeys: readNumberField(value, "apiKeys"),
    apiRequests: readNumberField(value, "apiRequests"),
    webhookEndpoints: readNumberField(value, "webhookEndpoints"),
    webhookDeliveries: readNumberField(value, "webhookDeliveries"),
    legalAcceptances: readNumberField(value, "legalAcceptances"),
    privacyRequests: readNumberField(value, "privacyRequests"),
    privacyRequestEvents: readNumberField(value, "privacyRequestEvents"),
    retentionRuns: readNumberField(value, "retentionRuns"),
    deletionRuns: readNumberField(value, "deletionRuns"),
    activityEvents: readNumberField(value, "activityEvents"),
    securityEvents: readNumberField(value, "securityEvents"),
    privacyAuditEvents: readNumberField(value, "privacyAuditEvents")
  };
}

function normalizePackagePayload(
  value: unknown
): WorkspaceExportPackagePayload | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return value as WorkspaceExportPackagePayload;
}

function normalizeWorkspaceExportPackageRow(
  row: SupabaseWorkspaceExportPackageRow
): WorkspaceExportPackageRecord {
  return {
    id: row.id,
    packageType: normalizePackageType(row.package_type),
    status: normalizePackageStatus(row.status),
    exportName: row.export_name,
    exportFormat: normalizePackageFormat(row.export_format),
    sourcePrivacyRequestId: row.source_privacy_request_id ?? "",
    recordCounts: normalizeRecordCounts(row.record_counts),
    packagePayload: normalizePackagePayload(row.package_payload),
    packageSizeBytes: readNumberField(
      row as unknown as Record<string, unknown>,
      "package_size_bytes"
    ),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createAuthenticatedSupabaseClient(
  context: AuthenticatedWorkspaceExportPackageContext
) {
  return getSupabaseUserClient(context.accessToken);
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new Error(`Workspace bootstrap failed: ${error.message}`);
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new Error("Workspace bootstrap returned an unreadable record.");
  }

  return workspace;
}

async function readWorkspaceCollection({
  supabase,
  tableName,
  selectFields,
  organizationId,
  orderColumn
}: {
  supabase: SupabaseClient;
  tableName: string;
  selectFields: string;
  organizationId: string;
  orderColumn: string;
}) {
  const { data, error } = await supabase
    .from(tableName)
    .select(selectFields)
    .eq("organization_id", organizationId)
    .order(orderColumn, {
      ascending: false
    })
    .limit(MAX_EXPORTED_RECORDS_PER_COLLECTION);

  if (error) {
    throw new Error(`Could not read ${tableName} for export: ${error.message}`);
  }

  return data ?? [];
}

async function readWorkspaceCollectionSafe(input: {
  supabase: SupabaseClient;
  tableName: string;
  selectFields: string;
  organizationId: string;
  orderColumn: string;
  warnings: string[];
}) {
  try {
    return await readWorkspaceCollection(input);
  } catch (error) {
    input.warnings.push(
      `Dataset ${input.tableName} could not be exported: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );

    return [];
  }
}

async function readOrganizationRecordSafe(input: {
  supabase: SupabaseClient;
  organizationId: string;
  warnings: string[];
}) {
  try {
    const { data, error } = await input.supabase
      .from("organizations")
      .select(ORGANIZATION_EXPORT_SELECT_FIELDS)
      .eq("id", input.organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? [data] : [];
  } catch (error) {
    input.warnings.push(
      `Dataset organizations could not be exported: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );

    return [];
  }
}

const SECRET_FIELD_PATTERN =
  /(secret|token|password|private|key_hash|signing_secret_encrypted|signing_secret_iv|signing_secret_tag|service_role|database_url|raw_xml|raw_soap|raw_response|stack|local_path|absolute_path)/i;

function redactSensitiveValue(key: string, value: unknown): unknown {
  if (SECRET_FIELD_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (
    key === "ip_address" ||
    key === "last_used_ip" ||
    key === "user_agent" ||
    key === "signature_header"
  ) {
    return value ? "[redacted_personal_metadata]" : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactExportRecord(item));
  }

  if (isPlainObject(value)) {
    return redactExportRecord(value);
  }

  return value;
}

function redactExportRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactExportRecord(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const redactedRecord: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    redactedRecord[key] = redactSensitiveValue(key, rawValue);
  }

  return redactedRecord;
}

function redactExportCollection(records: unknown[]) {
  return records.map((record) => redactExportRecord(record));
}

export function redactExportRecordForTesting(value: unknown) {
  return redactExportRecord(value);
}

function buildRecordCounts(data: WorkspaceExportPackagePayload["data"]) {
  return {
    organizationProfile: data.organizationProfile.length,
    members: data.members.length,
    invitations: data.invitations.length,
    businessProfiles: data.businessProfiles.length,
    contacts: data.contacts.length,
    productionInvoices: data.productionInvoices.length,
    invoiceLines: data.invoiceLines.length,
    invoiceTaxes: data.invoiceTaxes.length,
    invoiceAllowances: data.invoiceAllowances.length,
    invoiceCharges: data.invoiceCharges.length,
    invoiceExports: data.invoiceExports.length,
    invoiceDrafts: data.invoiceDrafts.length,
    validationRuns: data.validationRuns.length,
    vatNumberChecks: data.vatNumberChecks.length,
    viesEvidenceChecks: data.viesEvidenceChecks.length,
    vidaSimulationRuns: data.vidaSimulationRuns.length,
    xmlValidationJobs: data.xmlValidationJobs.length,
    xmlReadinessReports: data.xmlReadinessReports.length,
    workspaceSettings: data.workspaceSettings.length,
    apiKeys: data.apiKeys.length,
    apiRequests: data.apiRequests.length,
    webhookEndpoints: data.webhookEndpoints.length,
    webhookDeliveries: data.webhookDeliveries.length,
    legalAcceptances: data.legalAcceptances.length,
    privacyRequests: data.privacyRequests.length,
    privacyRequestEvents: data.privacyRequestEvents.length,
    retentionRuns: data.retentionRuns.length,
    deletionRuns: data.deletionRuns.length,
    activityEvents: data.activityEvents.length,
    securityEvents: data.securityEvents.length,
    privacyAuditEvents: data.privacyAuditEvents.length
  };
}

function calculateJsonByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function buildExportPayload({
  workspace,
  exportData,
  warnings
}: {
  workspace: SupabaseWorkspaceBootstrapRecord;
  exportData: WorkspaceExportPackagePayload["data"];
  warnings: string[];
}): WorkspaceExportPackagePayload {
  const recordCounts = buildRecordCounts(exportData);
  const includedDatasets = Object.entries(recordCounts)
    .filter(([, count]) => count > 0)
    .map(([datasetKey]) => datasetKey);

  return {
    exportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    packageType: "full_workspace",
    exportFormat: "json",
    workspace: {
      organizationId: workspace.organizationId,
      organizationName: workspace.organizationName,
      organizationSlug: workspace.organizationSlug,
      membershipRole: workspace.membershipRole,
      userEmail: workspace.userEmail
    },
    recordCounts,
    manifest: {
      schemaVersion: "privacy-export-v2",
      includedDatasets,
      redactedDatasets: [
        "apiKeys",
        "apiRequests",
        "webhookEndpoints",
        "webhookDeliveries",
        "activityEvents",
        "securityEvents",
        "privacyAuditEvents"
      ],
      excludedFields: [
        "api key hashes",
        "full API key secrets",
        "webhook encrypted signing secrets",
        "webhook raw signing secrets",
        "service-role keys",
        "database URLs",
        "raw SOAP",
        "raw XML unless explicitly retained by a reviewed future policy",
        "local filesystem paths",
        "internal stack traces"
      ],
      warnings
    },
    redactionNotice:
      "This export intentionally redacts or excludes secrets, hashes, raw SOAP, raw XML, local paths, raw IP/user-agent metadata, and internal stack traces.",
    retentionDeletionNotes: [
      "Retention and deletion controls are workspace privacy-support workflows and do not decide statutory legal, tax, accounting, filing, or authority recordkeeping duties.",
      "Legal acceptance, security, audit, privacy request, retention, and deletion evidence may be preserved or minimized where appropriate.",
      "Professional legal and privacy review is required before production reliance."
    ],
    data: exportData,
    disclaimer:
      "This export package contains workspace data available to the signed-in user through Invoice Lantern. It is not legal advice, tax advice, accounting advice, privacy advice, official filing, Peppol certification, EN 16931 certification, ViDA compliance evidence, government record, authority acceptance, or a compliance guarantee."
  };
}

function buildSupabaseExportPackageValues({
  payload,
  workspace,
  userId,
  packagePayload
}: {
  payload: WorkspaceExportPackageCreatePayload;
  workspace: SupabaseWorkspaceBootstrapRecord;
  userId: string;
  packagePayload: WorkspaceExportPackagePayload;
}) {
  return {
    organization_id: workspace.organizationId,
    requested_by: userId,
    source_privacy_request_id: payload.sourcePrivacyRequestId || null,
    package_type: "full_workspace",
    status: "prepared",
    export_name: payload.exportName,
    export_format: "json",
    record_counts: packagePayload.recordCounts,
    package_payload: packagePayload,
    package_size_bytes: calculateJsonByteLength(packagePayload),
    error_message: ""
  };
}

async function insertExportPackageActivityEvent({
  supabase,
  organizationId,
  userId,
  record
}: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  record: WorkspaceExportPackageRecord;
}) {
  await supabase.from("workspace_activity_events").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    event_type: "workspace_export_package.created",
    entity_type: "workspace_export_package",
    entity_id: record.id,
    entity_label: record.exportName,
    severity: "info",
    source: "api",
    metadata: {
      exportName: record.exportName,
      packageType: record.packageType,
      exportFormat: record.exportFormat,
      packageSizeBytes: record.packageSizeBytes,
      recordCounts: record.recordCounts,
      sourcePrivacyRequestId: record.sourcePrivacyRequestId
    }
  });
}

export function hasAuthenticatedWorkspaceExportPackageContext(
  context: AuthenticatedWorkspaceExportPackageContext | null | undefined
) {
  return Boolean(context?.userId && context?.accessToken);
}

export async function listAuthenticatedWorkspaceExportPackages(
  context: AuthenticatedWorkspaceExportPackageContext
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("created_at", {
      ascending: false
    })
    .limit(MAX_EXPORT_PACKAGES);

  if (error) {
    throw new Error(`Could not list export packages: ${error.message}`);
  }

  return ((data ?? []) as SupabaseWorkspaceExportPackageRow[]).map((row) =>
    normalizeWorkspaceExportPackageRow(row)
  );
}

export async function getAuthenticatedWorkspaceExportPackageById(
  context: AuthenticatedWorkspaceExportPackageContext,
  id: string
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read export package: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return normalizeWorkspaceExportPackageRow(
    data as SupabaseWorkspaceExportPackageRow
  );
}

export async function createAuthenticatedWorkspaceExportPackage(
  context: AuthenticatedWorkspaceExportPackageContext,
  payload: WorkspaceExportPackageCreatePayload
) {
  const supabase = createAuthenticatedSupabaseClient(context);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const warnings: string[] = [];

  const exportData: WorkspaceExportPackagePayload["data"] = {
    organizationProfile: redactExportCollection(
      await readOrganizationRecordSafe({
        supabase,
        organizationId: workspace.organizationId,
        warnings
      })
    ),
    members: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "organization_memberships",
        selectFields: MEMBER_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    invitations: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "workspace_member_invitations",
        selectFields: INVITATION_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    businessProfiles: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "business_profiles",
        selectFields: BUSINESS_PROFILE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    contacts: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "contacts",
        selectFields: CONTACT_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    productionInvoices: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoices",
        selectFields: PRODUCTION_INVOICE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    invoiceLines: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoice_lines",
        selectFields: INVOICE_LINE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    invoiceTaxes: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoice_taxes",
        selectFields: INVOICE_TAX_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    invoiceAllowances: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoice_allowances",
        selectFields: INVOICE_ALLOWANCE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    invoiceCharges: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoice_charges",
        selectFields: INVOICE_CHARGE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "updated_at",
        warnings
      })
    ),
    invoiceExports: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "invoice_exports",
        selectFields: INVOICE_EXPORT_METADATA_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    invoiceDrafts: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "invoice_drafts",
      selectFields: INVOICE_DRAFT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "updated_at",
      warnings
    })),
    validationRuns: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "validation_runs",
      selectFields: VALIDATION_RUN_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at",
      warnings
    })),
    vatNumberChecks: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "vat_number_checks",
        selectFields: VAT_CHECK_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    viesEvidenceChecks: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "vies_evidence_checks",
        selectFields: VIES_EVIDENCE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    vidaSimulationRuns: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "vida_simulation_runs",
        selectFields: VIDA_SIMULATION_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    xmlValidationJobs: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "xml_validation_jobs",
        selectFields: XML_VALIDATION_JOB_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    xmlReadinessReports: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "xml_readiness_reports",
      selectFields: XML_REPORT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "uploaded_at",
      warnings
    })),
    workspaceSettings: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "workspace_settings",
      selectFields: WORKSPACE_SETTINGS_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "updated_at",
      warnings
    })),
    apiKeys: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "api_keys",
        selectFields: API_KEY_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    apiRequests: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "api_requests",
        selectFields: API_REQUEST_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    webhookEndpoints: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "webhook_endpoints",
        selectFields: WEBHOOK_ENDPOINT_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    webhookDeliveries: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "webhook_deliveries",
        selectFields: WEBHOOK_DELIVERY_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    legalAcceptances: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "legal_document_acceptances",
        selectFields: LEGAL_ACCEPTANCE_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "accepted_at",
        warnings
      })
    ),
    privacyRequests: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "workspace_privacy_requests",
      selectFields: PRIVACY_REQUEST_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at",
      warnings
    })),
    privacyRequestEvents: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "privacy_request_events",
        selectFields: PRIVACY_REQUEST_EVENT_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    retentionRuns: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "workspace_retention_runs",
        selectFields: RETENTION_RUN_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    deletionRuns: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "workspace_deletion_runs",
        selectFields: DELETION_RUN_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    activityEvents: redactExportCollection(await readWorkspaceCollectionSafe({
      supabase,
      tableName: "workspace_activity_events",
      selectFields: ACTIVITY_EVENT_EXPORT_SELECT_FIELDS,
      organizationId: workspace.organizationId,
      orderColumn: "created_at",
      warnings
    })),
    securityEvents: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "security_events",
        selectFields: SECURITY_EVENT_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    ),
    privacyAuditEvents: redactExportCollection(
      await readWorkspaceCollectionSafe({
        supabase,
        tableName: "workspace_privacy_audit_events",
        selectFields: PRIVACY_AUDIT_EVENT_EXPORT_SELECT_FIELDS,
        organizationId: workspace.organizationId,
        orderColumn: "created_at",
        warnings
      })
    )
  };

  const packagePayload = buildExportPayload({
    workspace,
    exportData,
    warnings
  });

  const { data, error } = await supabase
    .from("workspace_export_packages")
    .insert(
      buildSupabaseExportPackageValues({
        payload,
        workspace,
        userId: context.userId,
        packagePayload
      })
    )
    .select(WORKSPACE_EXPORT_PACKAGE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Could not create export package: ${error.message}`);
  }

  const record = normalizeWorkspaceExportPackageRow(
    data as SupabaseWorkspaceExportPackageRow
  );

  try {
    await insertExportPackageActivityEvent({
      supabase,
      organizationId: workspace.organizationId,
      userId: context.userId,
      record
    });
  } catch {
    /*
     * Export package creation should not fail only because activity logging
     * failed. Activity logging can be repaired independently.
     */
  }

  return record;
}
