import { env, isSupabaseConfigured, resolveApiStorageBackend } from "../config/env.js";
import { API_RATE_LIMIT_POLICY_LIST } from "./api-rate-limit-policy.js";

export type ReadinessStatus =
  | "ready"
  | "configured"
  | "partially_configured"
  | "not_configured"
  | "disabled"
  | "review_required"
  | "attention_required";

export type ReadinessSeverity = "info" | "warning" | "critical";

export type HealthStatus = {
  status: "ok";
  service: "Invoice Lantern API";
  timestamp: string;
};

export type PublicReadinessStatus = {
  status: "ready" | "attention_required";
  service: "Invoice Lantern API";
  timestamp: string;
  checks: {
    key: string;
    label: string;
    status: ReadinessStatus;
  }[];
  disclaimer: string;
};

export type SecurityReadinessCheck = {
  key: string;
  label: string;
  category:
    | "platform"
    | "database"
    | "authentication"
    | "api"
    | "xml"
    | "vat"
    | "webhooks"
    | "privacy"
    | "legal"
    | "pwa"
    | "monitoring"
    | "incident";
  status: ReadinessStatus;
  severity: ReadinessSeverity;
  summary: string;
  evidence: string[];
};

export type MonitoringReadinessMetric = {
  key: string;
  label: string;
  status: ReadinessStatus;
  source: string;
  privacyNote: string;
};

export type IncidentReadinessChecklistItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  summary: string;
};

export type WorkspaceSecurityReadinessResponse = {
  status: "ready_for_review" | "attention_required";
  generatedAt: string;
  workspace: {
    organizationId: string;
    role: string;
  };
  disclaimer: string;
  contacts: {
    securityContactConfigured: boolean;
    incidentContactConfigured: boolean;
    monitoringProviderConfigured: boolean;
  };
  checks: SecurityReadinessCheck[];
  monitoringMetrics: MonitoringReadinessMetric[];
  incidentChecklist: IncidentReadinessChecklistItem[];
  operationalChecklist: IncidentReadinessChecklistItem[];
  offlineCapabilityBoundaries: IncidentReadinessChecklistItem[];
  rateLimitPolicies: {
    policyKey: string;
    scope: string;
    windowSeconds: number;
    maxRequests: number;
    appliesTo: string;
  }[];
};

const READINESS_DISCLAIMER =
  "Invoice Lantern readiness diagnostics are operational and security-support signals only. They are not legal, tax, accounting, privacy, security, uptime, certification, official filing, authority acceptance, or compliance guarantees. Professional review is required before production reliance.";

const MONITORING_METRIC_DEFINITIONS: Omit<MonitoringReadinessMetric, "status">[] = [
  {
    key: "validation_runs_total",
    label: "Validation runs total",
    source: "validation run repository",
    privacyNote: "Counts only; no invoice payloads or findings bodies required."
  },
  {
    key: "validation_errors_by_rule",
    label: "Validation errors by rule",
    source: "validation findings and rule metadata",
    privacyNote: "Aggregate rule codes only; no customer or raw invoice content."
  },
  {
    key: "ubl_exports_total",
    label: "UBL exports total",
    source: "invoice export repository",
    privacyNote: "Export metadata and hashes only; no raw XML required."
  },
  {
    key: "xml_uploads_total",
    label: "XML uploads total",
    source: "XML upload repository",
    privacyNote: "Upload metadata only; raw XML/SOAP bodies are excluded."
  },
  {
    key: "xml_rejected_total",
    label: "XML rejected total",
    source: "XML inspection outcomes",
    privacyNote: "Status counts only; unsafe XML is not stored in metrics."
  },
  {
    key: "xsd_validation_jobs_total",
    label: "XSD validation jobs total",
    source: "XML validation jobs",
    privacyNote: "Job status and safe summaries only."
  },
  {
    key: "schematron_jobs_total",
    label: "Schematron jobs total",
    source: "XML validation jobs",
    privacyNote: "Configured-check status only; no local artefact paths."
  },
  {
    key: "vies_checks_total",
    label: "VIES checks total",
    source: "VAT/VIES evidence repositories",
    privacyNote: "Minimized evidence metadata; no raw SOAP bodies."
  },
  {
    key: "vida_simulations_total",
    label: "ViDA simulations total",
    source: "ViDA simulation repository",
    privacyNote: "Simulation metadata and counts only."
  },
  {
    key: "api_requests_total",
    label: "API requests total",
    source: "API request logs",
    privacyNote: "Scoped request metadata; no API key secrets."
  },
  {
    key: "api_errors_total",
    label: "API errors total",
    source: "API request logs and application logs",
    privacyNote: "Error codes/classes only; no stack traces in exported metrics."
  },
  {
    key: "rate_limit_blocks",
    label: "Rate-limit blocks",
    source: "rate-limit service",
    privacyNote: "Policy keys and counts only."
  },
  {
    key: "auth_failures_total",
    label: "Auth failures total",
    source: "auth middleware and Supabase auth logs",
    privacyNote: "Aggregate counts only; no raw credentials."
  },
  {
    key: "webhook_delivery_total",
    label: "Webhook deliveries total",
    source: "webhook delivery repository",
    privacyNote: "Delivery status and safe previews only; no signing secrets."
  },
  {
    key: "webhook_delivery_failures",
    label: "Webhook delivery failures",
    source: "webhook delivery repository",
    privacyNote: "Failure classes only; no full endpoint secrets."
  },
  {
    key: "webhook_retry_total",
    label: "Webhook retries total",
    source: "webhook retry flow",
    privacyNote: "Retry counts only."
  },
  {
    key: "country_pack_usage",
    label: "Country-pack usage",
    source: "country pack and validation metadata",
    privacyNote: "Country code and version aggregates only."
  },
  {
    key: "validation_worker_timeouts",
    label: "Validation worker timeouts",
    source: "XML worker/job status",
    privacyNote: "Timeout counts and check types only."
  },
  {
    key: "retention_runs_total",
    label: "Retention runs total",
    source: "retention run repository",
    privacyNote: "Run status/counts only."
  },
  {
    key: "deletion_runs_total",
    label: "Deletion runs total",
    source: "deletion run repository",
    privacyNote: "Run status/counts only."
  },
  {
    key: "privacy_requests_total",
    label: "Privacy requests total",
    source: "privacy request repository",
    privacyNote: "Request type/status counts only."
  },
  {
    key: "legal_acceptances_total",
    label: "Legal acceptances total",
    source: "legal acceptance repository",
    privacyNote: "Document/version counts only; hashed request evidence only."
  },
  {
    key: "admin_rule_changes_total",
    label: "Admin rule changes total",
    source: "rule lifecycle events",
    privacyNote: "Rule/version/lifecycle metadata only."
  },
  {
    key: "suspicious_activity_events_total",
    label: "Suspicious activity events total",
    source: "security events and workspace activity",
    privacyNote: "Safe event metadata only; no secrets, raw XML, raw SOAP, or credentials."
  }
];

function hasValue(value: string) {
  return value.trim().length > 0;
}

function hasLongSecret(value: string) {
  return value.trim().length >= 32;
}

function getStorageBackendStatus(): ReadinessStatus {
  try {
    return resolveApiStorageBackend() === "supabase"
      ? "configured"
      : "review_required";
  } catch {
    return "attention_required";
  }
}

function isSupabaseStorageBackend() {
  try {
    return resolveApiStorageBackend() === "supabase";
  } catch {
    return false;
  }
}

function check(input: SecurityReadinessCheck): SecurityReadinessCheck {
  return input;
}

function configuredOrMissing(
  condition: boolean,
  missingStatus: ReadinessStatus = "not_configured"
): ReadinessStatus {
  return condition ? "configured" : missingStatus;
}

function buildConfigurationChecks(): SecurityReadinessCheck[] {
  const xsdConfigured =
    hasValue(env.UBL_XSD_ROOT_DIR) &&
    hasValue(env.UBL_INVOICE_XSD_PATH) &&
    hasValue(env.UBL_CREDIT_NOTE_XSD_PATH);
  const schematronArtefactsConfigured =
    hasValue(env.PEPPOL_SCHEMATRON_ROOT_DIR) &&
    hasValue(env.PEPPOL_BIS_SCHEMATRON_PATH) &&
    hasValue(env.EN16931_SCHEMATRON_PATH);
  const schematronExecutionConfigured =
    schematronArtefactsConfigured &&
    env.SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION &&
    hasValue(env.SCHEMATRON_ENGINE) &&
    hasValue(env.SCHEMATRON_EXECUTION_MODE);

  return [
    check({
      key: "database_connection",
      label: "Database connection",
      category: "database",
      status: configuredOrMissing(hasValue(env.DATABASE_URL)),
      severity: hasValue(env.DATABASE_URL) ? "info" : "warning",
      summary:
        "Server-side database configuration is reported as a boolean state only.",
      evidence: [
        "No database URL, credentials, or hostnames are returned by this endpoint."
      ]
    }),
    check({
      key: "storage_backend",
      label: "Storage backend policy",
      category: "database",
      status: getStorageBackendStatus(),
      severity: isSupabaseStorageBackend() ? "info" : "warning",
      summary:
        "Production must use Supabase-backed persistence; local JSON remains development/test only.",
      evidence: [
        "Readiness reports policy state, not storage connection details."
      ]
    }),
    check({
      key: "supabase_auth",
      label: "Supabase auth and RLS boundary",
      category: "authentication",
      status: configuredOrMissing(
        isSupabaseConfigured() &&
          hasValue(env.SUPABASE_PUBLISHABLE_KEY) &&
          hasValue(env.SUPABASE_JWT_SECRET)
      ),
      severity:
        isSupabaseConfigured() && hasValue(env.SUPABASE_JWT_SECRET)
          ? "info"
          : "warning",
      summary:
        "Signed-user workspace endpoints depend on Supabase auth, service-role backend access, and RLS-backed repositories.",
      evidence: [
        "Only configured/unconfigured state is exposed; keys and JWT secrets are never returned."
      ]
    }),
    check({
      key: "api_rate_limits",
      label: "API rate-limit policies",
      category: "api",
      status:
        API_RATE_LIMIT_POLICY_LIST.length > 0 ? "configured" : "not_configured",
      severity: API_RATE_LIMIT_POLICY_LIST.length > 0 ? "info" : "critical",
      summary:
        "Developer API scopes have bounded request windows for validation, VAT, VIES, UBL, XML jobs, and ViDA simulations.",
      evidence: [
        `${API_RATE_LIMIT_POLICY_LIST.length} scoped rate-limit policy entries loaded.`
      ]
    }),
    check({
      key: "xml_transient_payload_policy",
      label: "XML transient payload policy",
      category: "xml",
      status: configuredOrMissing(hasValue(env.XML_TRANSIENT_PAYLOAD_DIR), "review_required"),
      severity: hasValue(env.XML_TRANSIENT_PAYLOAD_DIR) ? "info" : "warning",
      summary:
        "XML payload handling remains transient and bounded; readiness does not expose local paths.",
      evidence: [
        "Raw XML and SOAP bodies must stay out of metrics, incidents, cache storage, and readiness responses."
      ]
    }),
    check({
      key: "ubl_xsd_artifacts",
      label: "UBL XSD artefacts",
      category: "xml",
      status: configuredOrMissing(xsdConfigured, "not_configured"),
      severity: xsdConfigured ? "info" : "warning",
      summary:
        "Local XSD validation requires reviewed local UBL artefacts and worker configuration.",
      evidence: [
        "Readiness reports only whether artefacts are configured; filesystem paths are omitted."
      ]
    }),
    check({
      key: "schematron_execution_gates",
      label: "Schematron execution gates",
      category: "xml",
      status: schematronExecutionConfigured
        ? "configured"
        : schematronArtefactsConfigured
          ? "partially_configured"
          : "not_configured",
      severity: schematronExecutionConfigured ? "info" : "warning",
      summary:
        "Peppol-style and EN 16931-style Schematron checks remain guarded by reviewed local artefacts and explicit execution gates.",
      evidence: [
        "No external Schematron fetching is implied or enabled by readiness diagnostics."
      ]
    }),
    check({
      key: "vies_evidence",
      label: "VIES evidence workflow",
      category: "vat",
      status: env.VIES_CHECK_ENABLED
        ? configuredOrMissing(hasValue(env.VIES_SERVICE_URL), "attention_required")
        : "disabled",
      severity:
        env.VIES_CHECK_ENABLED && !hasValue(env.VIES_SERVICE_URL)
          ? "warning"
          : "info",
      summary:
        "Live VIES checks are explicit, rate-limited evidence attempts. Unavailable is not invalid.",
      evidence: [
        "Readiness never stores or returns raw VIES SOAP bodies."
      ]
    }),
    check({
      key: "webhook_secret_encryption",
      label: "Webhook secret encryption",
      category: "webhooks",
      status: configuredOrMissing(
        hasLongSecret(env.WEBHOOK_SECRET_ENCRYPTION_KEY)
      ),
      severity: hasLongSecret(env.WEBHOOK_SECRET_ENCRYPTION_KEY)
        ? "info"
        : "critical",
      summary:
        "Webhook simulator signing secrets require backend-only encryption before persistent endpoint secrets can be managed.",
      evidence: [
        "Readiness does not return signing secrets, encryption keys, or endpoint credentials."
      ]
    }),
    check({
      key: "legal_documents",
      label: "Legal document system",
      category: "legal",
      status: "configured",
      severity: "info",
      summary:
        "Versioned legal documents and acceptance tracking are part of the platform policy model.",
      evidence: [
        "Published policy text still requires professional legal/privacy review."
      ]
    }),
    check({
      key: "privacy_controls",
      label: "Privacy, export, deletion, and retention controls",
      category: "privacy",
      status: "configured",
      severity: "info",
      summary:
        "Workspace privacy settings, data map, subprocessors, export packages, deletion reviews, and retention runs are present.",
      evidence: [
        "Controls are GDPR-aware support, not a GDPR compliance guarantee."
      ]
    }),
    check({
      key: "pwa_cache_policy",
      label: "PWA cache and offline policy",
      category: "pwa",
      status: "review_required",
      severity: "warning",
      summary:
        "PWA support must keep authenticated API responses, workspace data, XML/SOAP, API keys, webhooks, privacy requests, and admin writes network-only/no-store.",
      evidence: [
        "Offline drafts are local-only and must use encrypted storage when enabled."
      ]
    }),
    check({
      key: "monitoring_provider",
      label: "Monitoring provider hook",
      category: "monitoring",
      status: configuredOrMissing(hasValue(env.MONITORING_PROVIDER), "review_required"),
      severity: "warning",
      summary:
        "Provider-specific monitoring is optional and must be explicitly configured; no third-party tracking is enabled by this readiness surface.",
      evidence: [
        "Readiness reports whether a provider placeholder is configured, not the provider value."
      ]
    }),
    check({
      key: "incident_contacts",
      label: "Security and incident contacts",
      category: "incident",
      status:
        hasValue(env.SECURITY_CONTACT_EMAIL) && hasValue(env.INCIDENT_CONTACT_EMAIL)
          ? "configured"
          : "review_required",
      severity: "warning",
      summary:
        "Incident readiness needs reviewed contact routing for security reports and privacy/breach assessment.",
      evidence: [
        "No contact email values are returned by this endpoint."
      ]
    })
  ];
}

function buildMonitoringMetrics(): MonitoringReadinessMetric[] {
  return MONITORING_METRIC_DEFINITIONS.map((metric) => ({
    ...metric,
    status: "review_required"
  }));
}

function buildIncidentChecklist(): IncidentReadinessChecklistItem[] {
  return [
    {
      key: "detect",
      label: "Detect",
      status: "review_required",
      summary:
        "Use application logs, security events, API request logs, worker failures, and provider alerts to identify incidents."
    },
    {
      key: "classify",
      label: "Classify severity",
      status: "review_required",
      summary:
        "Classify operational, security, privacy, data breach, XML safety, API-key, webhook, VIES, and admin-rule incidents."
    },
    {
      key: "contain",
      label: "Contain",
      status: "review_required",
      summary:
        "Contain by revoking API keys, rotating webhook secrets, disabling unsafe jobs, blocking endpoints, and pausing risky flows."
    },
    {
      key: "investigate",
      label: "Investigate",
      status: "review_required",
      summary:
        "Collect minimized evidence without secrets, raw XML, raw SOAP, credentials, stack traces, or local paths."
    },
    {
      key: "notify_if_required",
      label: "Notify if required",
      status: "review_required",
      summary:
        "Run legal/privacy breach assessment before any external notification decision."
    },
    {
      key: "fix",
      label: "Fix",
      status: "review_required",
      summary:
        "Patch the cause, add regression checks, and preserve tenant isolation and authorization controls."
    },
    {
      key: "document",
      label: "Document",
      status: "review_required",
      summary:
        "Record timeline, impact, containment, evidence, and decisions without exposing secrets or raw payloads."
    },
    {
      key: "post_incident_review",
      label: "Post-incident review",
      status: "review_required",
      summary:
        "Review detection, response time, communication, controls, tests, and documentation gaps."
    }
  ];
}

function buildOperationalChecklist(): IncidentReadinessChecklistItem[] {
  return [
    {
      key: "rbac_tenant_isolation",
      label: "RBAC and tenant isolation",
      status: "review_required",
      summary:
        "Confirm organization-scoped records, workspace roles, scoped API keys, RLS, and object authorization."
    },
    {
      key: "xml_safety",
      label: "XML safety",
      status: "review_required",
      summary:
        "Confirm DTD/entity blocking, size limits, local artefact gates, transient payloads, and no external schema fetching."
    },
    {
      key: "webhook_safety",
      label: "Webhook safety",
      status: "review_required",
      summary:
        "Confirm SSRF protections, signing, secret rotation, retry limits, and no secret exposure in logs."
    },
    {
      key: "privacy_retention_deletion",
      label: "Privacy, export, retention, deletion",
      status: "review_required",
      summary:
        "Confirm data-map, minimization, export package, deletion, retention, legal acceptance, and review workflows."
    },
    {
      key: "deployment_env",
      label: "Deployment environment",
      status: "review_required",
      summary:
        "Confirm production Supabase, database, secrets, HTTPS app URL, webhook encryption, and local JSON disabled."
    }
  ];
}

function buildOfflineCapabilityBoundaries(): IncidentReadinessChecklistItem[] {
  return [
    {
      key: "offline_allowed",
      label: "Allowed offline",
      status: "review_required",
      summary:
        "Installable shell, public legal pages, offline capability notice, encrypted local-only invoice draft work, and local calculation hints where available."
    },
    {
      key: "offline_disabled",
      label: "Disabled offline",
      status: "configured",
      summary:
        "VIES, API key management, webhook management, XML/XSD/Schematron validation, ViDA persistence, deletion/export/retention execution, and platform-admin writes stay online-only."
    },
    {
      key: "offline_cache_exclusions",
      label: "Sensitive cache exclusions",
      status: "configured",
      summary:
        "Authenticated APIs, workspace pages, XML/SOAP, API request logs, webhook logs, API keys, privacy requests, and admin pages must not be served from stale service-worker cache."
    }
  ];
}

function overallStatus(checks: SecurityReadinessCheck[]) {
  return checks.some(
    (item) =>
      item.severity === "critical" &&
      (item.status === "not_configured" || item.status === "attention_required")
  )
    ? "attention_required"
    : "ready_for_review";
}

export function buildHealthStatus(now = new Date()): HealthStatus {
  return {
    status: "ok",
    service: "Invoice Lantern API",
    timestamp: now.toISOString()
  };
}

export function buildPublicReadinessStatus(
  now = new Date()
): PublicReadinessStatus {
  const checks = buildConfigurationChecks();
  const publicChecks: PublicReadinessStatus["checks"] = [
    {
      key: "api",
      label: "API process",
      status: "ready" as const
    },
    {
      key: "storage_backend",
      label: "Storage policy",
      status: getStorageBackendStatus()
    },
    {
      key: "rate_limit_policy",
      label: "Rate-limit policy",
      status:
        API_RATE_LIMIT_POLICY_LIST.length > 0
          ? ("configured" as const)
          : ("not_configured" as const)
    }
  ];

  return {
    status: checks.some((item) => item.severity === "critical")
      ? "attention_required"
      : "ready",
    service: "Invoice Lantern API",
    timestamp: now.toISOString(),
    checks: publicChecks,
    disclaimer:
      "Public readiness is intentionally minimal and does not expose secrets, environment values, provider credentials, internal paths, raw XML, or raw SOAP."
  };
}

export function buildWorkspaceSecurityReadiness(input: {
  organizationId: string;
  membershipRole: string;
  now?: Date;
}): WorkspaceSecurityReadinessResponse {
  const checks = buildConfigurationChecks();

  return {
    status: overallStatus(checks),
    generatedAt: (input.now ?? new Date()).toISOString(),
    workspace: {
      organizationId: input.organizationId,
      role: input.membershipRole
    },
    disclaimer: READINESS_DISCLAIMER,
    contacts: {
      securityContactConfigured: hasValue(env.SECURITY_CONTACT_EMAIL),
      incidentContactConfigured: hasValue(env.INCIDENT_CONTACT_EMAIL),
      monitoringProviderConfigured: hasValue(env.MONITORING_PROVIDER)
    },
    checks,
    monitoringMetrics: buildMonitoringMetrics(),
    incidentChecklist: buildIncidentChecklist(),
    operationalChecklist: buildOperationalChecklist(),
    offlineCapabilityBoundaries: buildOfflineCapabilityBoundaries(),
    rateLimitPolicies: API_RATE_LIMIT_POLICY_LIST.map((policy) => ({
      policyKey: policy.policyKey,
      scope: policy.scope,
      windowSeconds: policy.windowSeconds,
      maxRequests: policy.maxRequests,
      appliesTo: policy.appliesTo
    }))
  };
}
