"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardList,
  LockKeyhole,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  WifiOff
} from "lucide-react";
import { offlineCapabilities } from "../../../lib/pwa/offline-capabilities";

type ReadinessStatus =
  | "ready"
  | "configured"
  | "partially_configured"
  | "not_configured"
  | "disabled"
  | "review_required"
  | "attention_required";

type SecurityReadinessCheck = {
  key: string;
  label: string;
  category: string;
  status: ReadinessStatus;
  severity: "info" | "warning" | "critical";
  summary: string;
  evidence: string[];
};

type MonitoringReadinessMetric = {
  key: string;
  label: string;
  status: ReadinessStatus;
  source: string;
  privacyNote: string;
};

type ChecklistItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  summary: string;
};

type SecurityReadinessResponse = {
  status: "ready_for_review" | "attention_required";
  generatedAt: string;
  disclaimer: string;
  contacts: {
    securityContactConfigured: boolean;
    incidentContactConfigured: boolean;
    monitoringProviderConfigured: boolean;
  };
  checks: SecurityReadinessCheck[];
  monitoringMetrics: MonitoringReadinessMetric[];
  incidentChecklist: ChecklistItem[];
  operationalChecklist: ChecklistItem[];
  offlineCapabilityBoundaries: ChecklistItem[];
  rateLimitPolicies: {
    policyKey: string;
    scope: string;
    windowSeconds: number;
    maxRequests: number;
    appliesTo: string;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusTone(status: ReadinessStatus) {
  if (status === "configured" || status === "ready") {
    return "ready";
  }

  if (status === "disabled" || status === "review_required") {
    return "review";
  }

  return "attention";
}

function normalizeChecklistItem(value: unknown): ChecklistItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = typeof value.key === "string" ? value.key : "";
  const label = typeof value.label === "string" ? value.label : key;
  const status =
    typeof value.status === "string"
      ? (value.status as ReadinessStatus)
      : "review_required";
  const summary = typeof value.summary === "string" ? value.summary : "";

  if (!key || !label || !summary) {
    return null;
  }

  return {
    key,
    label,
    status,
    summary
  };
}

function normalizeReadiness(value: unknown): SecurityReadinessResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const checks = Array.isArray(value.checks)
    ? value.checks.filter(isRecord).map((item) => ({
        key: String(item.key ?? ""),
        label: String(item.label ?? item.key ?? ""),
        category: String(item.category ?? "platform"),
        status: String(item.status ?? "review_required") as ReadinessStatus,
        severity: String(item.severity ?? "warning") as
          | "info"
          | "warning"
          | "critical",
        summary: String(item.summary ?? ""),
        evidence: Array.isArray(item.evidence)
          ? item.evidence.filter(
              (evidence): evidence is string => typeof evidence === "string"
            )
          : []
      }))
    : [];

  const monitoringMetrics = Array.isArray(value.monitoringMetrics)
    ? value.monitoringMetrics.filter(isRecord).map((item) => ({
        key: String(item.key ?? ""),
        label: String(item.label ?? item.key ?? ""),
        status: String(item.status ?? "review_required") as ReadinessStatus,
        source: String(item.source ?? ""),
        privacyNote: String(item.privacyNote ?? "")
      }))
    : [];

  const contacts = isRecord(value.contacts) ? value.contacts : {};

  return {
    status:
      value.status === "attention_required"
        ? "attention_required"
        : "ready_for_review",
    generatedAt:
      typeof value.generatedAt === "string" ? value.generatedAt : "",
    disclaimer:
      typeof value.disclaimer === "string"
        ? value.disclaimer
        : "Readiness diagnostics require professional security, privacy, and legal review.",
    contacts: {
      securityContactConfigured: contacts.securityContactConfigured === true,
      incidentContactConfigured: contacts.incidentContactConfigured === true,
      monitoringProviderConfigured: contacts.monitoringProviderConfigured === true
    },
    checks,
    monitoringMetrics,
    incidentChecklist: Array.isArray(value.incidentChecklist)
      ? value.incidentChecklist
          .map(normalizeChecklistItem)
          .filter((item): item is ChecklistItem => item !== null)
      : [],
    operationalChecklist: Array.isArray(value.operationalChecklist)
      ? value.operationalChecklist
          .map(normalizeChecklistItem)
          .filter((item): item is ChecklistItem => item !== null)
      : [],
    offlineCapabilityBoundaries: Array.isArray(value.offlineCapabilityBoundaries)
      ? value.offlineCapabilityBoundaries
          .map(normalizeChecklistItem)
          .filter((item): item is ChecklistItem => item !== null)
      : [],
    rateLimitPolicies: Array.isArray(value.rateLimitPolicies)
      ? value.rateLimitPolicies.filter(isRecord).map((policy) => ({
          policyKey: String(policy.policyKey ?? ""),
          scope: String(policy.scope ?? ""),
          windowSeconds:
            typeof policy.windowSeconds === "number" ? policy.windowSeconds : 0,
          maxRequests:
            typeof policy.maxRequests === "number" ? policy.maxRequests : 0,
          appliesTo: String(policy.appliesTo ?? "")
        }))
      : []
  };
}

export default function WorkspaceSecurityReadinessPage() {
  const [readiness, setReadiness] =
    useState<SecurityReadinessResponse | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const criticalCount = useMemo(
    () =>
      readiness?.checks.filter(
        (check) =>
          check.severity === "critical" &&
          (check.status === "not_configured" ||
            check.status === "attention_required")
      ).length ?? 0,
    [readiness]
  );

  const reviewCount = useMemo(
    () =>
      readiness?.checks.filter((check) => check.status === "review_required")
        .length ?? 0,
    [readiness]
  );

  async function loadReadiness() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/local/workspace/security/readiness", {
        method: "GET",
        cache: "no-store"
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const fallbackMessage =
          isRecord(data) &&
          isRecord(data.error) &&
          typeof data.error.message === "string"
            ? data.error.message
            : "Security readiness could not be loaded.";

        setMessage(fallbackMessage);
        setReadiness(null);
        return;
      }

      setReadiness(normalizeReadiness(data));
    } catch {
      setMessage(
        "Security readiness is unavailable. Make sure apps/api and apps/web are running and that you are signed in."
      );
      setReadiness(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReadiness();
  }, []);

  return (
    <div className="workspace-page workspace-security-page">
      <section className="workspace-page-head workspace-security-head">
        <p className="workspace-kicker">Security readiness</p>
        <h2>Review PWA, monitoring, and incident readiness.</h2>
        <p>
          This page shows safe readiness state for workspace operators. It does
          not expose secrets, internal paths, raw XML/SOAP, API keys, webhook
          secrets, provider credentials, stack traces, or compliance guarantees.
        </p>
      </section>

      <section className="workspace-stat-strip workspace-security-stats">
        <div className="workspace-stat">
          <p>Status</p>
          <strong>{readiness ? formatLabel(readiness.status) : "Loading"}</strong>
          <span>Operational readiness signal, not a security certification.</span>
        </div>

        <div className="workspace-stat">
          <p>Critical</p>
          <strong>{criticalCount}</strong>
          <span>Items needing configuration before production reliance.</span>
        </div>

        <div className="workspace-stat">
          <p>Review</p>
          <strong>{reviewCount}</strong>
          <span>Items requiring professional security/privacy/legal review.</span>
        </div>

        <div className="workspace-stat">
          <p>Metrics</p>
          <strong>{readiness?.monitoringMetrics.length ?? 0}</strong>
          <span>Monitoring inventory entries without sensitive payloads.</span>
        </div>
      </section>

      <section className="developer-console workspace-security-panel">
        <div className="developer-console-head workspace-security-panel-head">
          <div>
            <p>Diagnostics</p>
            <h3>Readiness source</h3>
          </div>

          <button type="button" onClick={loadReadiness} disabled={isLoading}>
            <RefreshCcw size={16} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {message ? (
          <div className="workspace-security-message">
            <span />
            <p>{message}</p>
          </div>
        ) : null}

        {readiness ? (
          <p className="workspace-muted-copy">
            Generated {new Date(readiness.generatedAt).toLocaleString()}.{" "}
            {readiness.disclaimer}
          </p>
        ) : (
          <p className="workspace-muted-copy">
            Loading safe configured/unconfigured status from the API.
          </p>
        )}
      </section>

      <ReadinessSection
        title="Security checks"
        icon={<ShieldCheck size={20} />}
        items={
          readiness?.checks.map((check) => ({
            key: check.key,
            label: check.label,
            status: check.status,
            summary: check.summary,
            evidence: check.evidence
          })) ?? []
        }
        emptyLabel="No security checks loaded yet."
      />

      <section className="developer-console workspace-security-panel">
        <div className="developer-console-head workspace-security-panel-head">
          <div>
            <p>Monitoring</p>
            <h3>Metrics inventory</h3>
          </div>

          <ClipboardList size={20} />
        </div>

        {readiness?.monitoringMetrics.length ? (
          <div className="workspace-security-card-grid">
            {readiness.monitoringMetrics.map((metric) => (
              <article className="workspace-security-card" key={metric.key}>
                <div>
                  <strong>{metric.label}</strong>
                  <p>{metric.source}</p>
                  <p>{metric.privacyNote}</p>
                </div>

                <StatusPill status={metric.status} />
              </article>
            ))}
          </div>
        ) : (
          <p className="workspace-muted-copy">
            Monitoring metrics load from the API readiness model. They are
            aggregate and minimized by design.
          </p>
        )}
      </section>

      <ReadinessSection
        title="Incident response"
        icon={<ShieldAlert size={20} />}
        items={readiness?.incidentChecklist ?? []}
        emptyLabel="No incident checklist loaded yet."
      />

      <ReadinessSection
        title="Operational checklist"
        icon={<LockKeyhole size={20} />}
        items={readiness?.operationalChecklist ?? []}
        emptyLabel="No operational checklist loaded yet."
      />

      <ReadinessSection
        title="PWA/offline boundaries"
        icon={<WifiOff size={20} />}
        items={
          readiness?.offlineCapabilityBoundaries.length
            ? readiness.offlineCapabilityBoundaries
            : offlineCapabilities.map((item) => ({
                key: item.key,
                label: item.label,
                status:
                  item.status === "available"
                    ? "configured"
                    : item.status === "limited"
                      ? "review_required"
                      : "disabled",
                summary: item.summary
              }))
        }
        emptyLabel="No PWA/offline boundaries loaded yet."
      />

      <section className="developer-console workspace-security-panel">
        <div className="developer-console-head workspace-security-panel-head">
          <div>
            <p>API safety</p>
            <h3>Rate-limit policy summary</h3>
          </div>

          <BadgeCheck size={20} />
        </div>

        {readiness?.rateLimitPolicies.length ? (
          <div className="workspace-security-card-grid">
            {readiness.rateLimitPolicies.map((policy) => (
              <article className="workspace-security-card" key={policy.policyKey}>
                <div>
                  <strong>{policy.policyKey}</strong>
                  <p>
                    {policy.scope} · {policy.appliesTo}
                  </p>
                  <p>
                    {policy.maxRequests} requests per{" "}
                    {Math.round(policy.windowSeconds / 60)} minutes
                  </p>
                </div>

                <StatusPill status="configured" />
              </article>
            ))}
          </div>
        ) : (
          <p className="workspace-muted-copy">
            Rate-limit policy summary is unavailable until the API response is
            loaded.
          </p>
        )}
      </section>

      <section className="developer-console workspace-security-panel">
        <div className="developer-console-head workspace-security-panel-head">
          <div>
            <p>Contacts</p>
            <h3>Configuration state</h3>
          </div>

          <AlertTriangle size={20} />
        </div>

        <div className="workspace-readiness-contact-grid">
          <ContactState
            label="Security contact"
            configured={readiness?.contacts.securityContactConfigured === true}
          />
          <ContactState
            label="Incident contact"
            configured={readiness?.contacts.incidentContactConfigured === true}
          />
          <ContactState
            label="Monitoring provider"
            configured={readiness?.contacts.monitoringProviderConfigured === true}
          />
        </div>
      </section>
    </div>
  );
}

function ReadinessSection({
  title,
  icon,
  items,
  emptyLabel
}: {
  title: string;
  icon: ReactNode;
  items: Array<ChecklistItem & { evidence?: string[] }>;
  emptyLabel: string;
}) {
  return (
    <section className="developer-console workspace-security-panel">
      <div className="developer-console-head workspace-security-panel-head">
        <div>
          <p>Checklist</p>
          <h3>{title}</h3>
        </div>

        {icon}
      </div>

      {items.length ? (
        <div className="workspace-readiness-list">
          {items.map((item) => (
            <article className="workspace-readiness-item" key={item.key}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.summary}</p>

                {item.evidence?.length ? (
                  <ul className="workspace-security-evidence">
                    {item.evidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <StatusPill status={item.status} />
            </article>
          ))}
        </div>
      ) : (
        <p className="workspace-muted-copy">{emptyLabel}</p>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: ReadinessStatus }) {
  return (
    <span className={`workspace-status-pill ${getStatusTone(status)}`}>
      {formatLabel(status)}
    </span>
  );
}

function ContactState({
  label,
  configured
}: {
  label: string;
  configured: boolean;
}) {
  return (
    <div className="workspace-readiness-contact">
      <p>{label}</p>
      <strong>{configured ? "Configured" : "Review required"}</strong>
      <span>
        {configured
          ? "The API reports a configured placeholder."
          : "Set a reviewed operational contact before production reliance."}
      </span>
    </div>
  );
}
