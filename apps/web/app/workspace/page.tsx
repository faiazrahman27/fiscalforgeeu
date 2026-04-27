"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Braces,
  Database,
  FileCheck2,
  FileCode2,
  FileText,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  UploadCloud
} from "lucide-react";

type DashboardCounts = {
  invoiceDrafts: number | null;
  validationRuns: number | null;
  xmlReadinessReports: number | null;
  openFindings: number | null;
};

type WorkspaceActivitySeverity = "info" | "warning" | "error";

type WorkspaceActivityEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity: WorkspaceActivitySeverity;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const emptyCounts: DashboardCounts = {
  invoiceDrafts: null,
  validationRuns: null,
  xmlReadinessReports: null,
  openFindings: null
};

const commandFlow = [
  {
    icon: <ReceiptText size={20} />,
    title: "Create invoice data",
    description:
      "Build structured invoice data from seller, buyer, document, payment, VAT, and line-item inputs.",
    href: "/workspace/invoices/new"
  },
  {
    icon: <FileCheck2 size={20} />,
    title: "Review validation reports",
    description:
      "Inspect schema readiness, calculation logic, VAT-number format, XML readiness, confidence labels, findings, and simulation warnings.",
    href: "/workspace/validation-runs"
  },
  {
    icon: <UploadCloud size={20} />,
    title: "Upload XML",
    description:
      "Inspect XML structure, detect invoice fields, review profile signals, and create API-owned XML readiness reports.",
    href: "/workspace/xml-upload"
  },
  {
    icon: <KeyRound size={20} />,
    title: "Prepare API testing",
    description:
      "Model API keys, request logs, webhook tests, scoped access, and rate-limited endpoint behavior.",
    href: "/workspace/developer"
  }
];

const alerts = [
  "API and web are separated. The frontend calls local Next.js proxy routes, which forward requests to the dedicated API service.",
  "Validation outputs must never claim legal, tax, accounting, Peppol, EN 16931, ViDA, or authority certification.",
  "Every real rule later needs a source reference, reviewed date, confidence level, and rule version.",
  "XML upload must block DTD, XXE, external entities, oversized files, and unsafe parser behavior."
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getRecordsFromResponse(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
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

function normalizeActivitySeverity(value: string): WorkspaceActivitySeverity {
  if (value === "warning" || value === "error") {
    return value;
  }

  return "info";
}

function normalizeWorkspaceActivityEvent(
  value: unknown
): WorkspaceActivityEvent | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const eventType = readStringField(value, "eventType");
  const entityType = readStringField(value, "entityType");
  const entityId = readStringField(value, "entityId");
  const entityLabel = readStringField(value, "entityLabel", entityId);
  const source = readStringField(value, "source", "api");
  const createdAt = readStringField(value, "createdAt");
  const severity = normalizeActivitySeverity(readStringField(value, "severity"));
  const metadata = isPlainObject(value.metadata) ? value.metadata : {};

  if (!id || !eventType || !entityType || !entityId || !createdAt) {
    return null;
  }

  return {
    id,
    eventType,
    entityType,
    entityId,
    entityLabel,
    severity,
    source,
    metadata,
    createdAt
  };
}

function readFindingCount(record: unknown) {
  if (!isPlainObject(record)) {
    return 0;
  }

  const directFindingsCount = record.findingsCount;

  if (
    typeof directFindingsCount === "number" &&
    Number.isFinite(directFindingsCount)
  ) {
    return directFindingsCount;
  }

  if (Array.isArray(record.findings)) {
    return record.findings.length;
  }

  if (isPlainObject(record.summary)) {
    const summaryFindingsCount = record.summary.findingsCount;

    if (
      typeof summaryFindingsCount === "number" &&
      Number.isFinite(summaryFindingsCount)
    ) {
      return summaryFindingsCount;
    }
  }

  return 0;
}

function formatCount(value: number | null, isLoading: boolean) {
  if (isLoading) {
    return "Loading";
  }

  if (value === null) {
    return "Not available";
  }

  return String(value);
}

function formatActivityType(eventType: string) {
  return eventType
    .split(".")
    .map((segment) => segment.replace(/_/g, " "))
    .join(" · ");
}

function formatActivityTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildStats(counts: DashboardCounts, isLoading: boolean) {
  return [
    {
      label: "Draft invoices",
      value: formatCount(counts.invoiceDrafts, isLoading),
      note:
        counts.invoiceDrafts === null && !isLoading
          ? "Could not read API-owned invoice draft count."
          : "API-owned invoice drafts. No demo records are counted here."
    },
    {
      label: "Validation reports",
      value: formatCount(counts.validationRuns, isLoading),
      note:
        counts.validationRuns === null && !isLoading
          ? "Could not read API-owned invoice validation report count."
          : "API-owned structured invoice validation reports."
    },
    {
      label: "XML reports",
      value: formatCount(counts.xmlReadinessReports, isLoading),
      note:
        counts.xmlReadinessReports === null && !isLoading
          ? "Could not read API-owned XML readiness report count."
          : "API-owned XML readiness reports created from uploaded XML."
    },
    {
      label: "Returned findings",
      value: formatCount(counts.openFindings, isLoading),
      note:
        counts.openFindings === null && !isLoading
          ? "Could not calculate findings from API-owned records."
          : "Findings returned by real validation or XML readiness checks."
    }
  ];
}

export default function WorkspacePage() {
  const [counts, setCounts] = useState<DashboardCounts>(emptyCounts);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [dashboardMessage, setDashboardMessage] = useState("");

  const [activityEvents, setActivityEvents] = useState<WorkspaceActivityEvent[]>(
    []
  );
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [activityMessage, setActivityMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardCounts() {
      setIsLoadingCounts(true);
      setDashboardMessage("");

      const nextCounts: DashboardCounts = {
        invoiceDrafts: null,
        validationRuns: null,
        xmlReadinessReports: null,
        openFindings: null
      };

      const messages: string[] = [];
      let validationFindings = 0;
      let xmlFindings = 0;

      try {
        const response = await fetch("/api/local/invoices/drafts", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (response.ok) {
          const records = getRecordsFromResponse(responseData);
          nextCounts.invoiceDrafts = records.length;
        } else {
          messages.push("Invoice draft count is unavailable.");
        }
      } catch {
        messages.push("Invoice draft count is unavailable.");
      }

      try {
        const response = await fetch("/api/local/validation-runs", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (response.ok) {
          const records = getRecordsFromResponse(responseData);
          nextCounts.validationRuns = records.length;
          validationFindings = records.reduce((sum, record) => {
            return sum + readFindingCount(record);
          }, 0);
        } else {
          messages.push("Invoice validation report count is unavailable.");
        }
      } catch {
        messages.push("Invoice validation report count is unavailable.");
      }

      try {
        const response = await fetch("/api/local/xml/uploads", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (response.ok) {
          const records = getRecordsFromResponse(responseData);
          nextCounts.xmlReadinessReports = records.length;
          xmlFindings = records.reduce((sum, record) => {
            return sum + readFindingCount(record);
          }, 0);
        } else {
          messages.push("XML readiness report count is unavailable.");
        }
      } catch {
        messages.push("XML readiness report count is unavailable.");
      }

      if (
        nextCounts.validationRuns !== null ||
        nextCounts.xmlReadinessReports !== null
      ) {
        nextCounts.openFindings = validationFindings + xmlFindings;
      }

      if (isMounted) {
        setCounts(nextCounts);
        setDashboardMessage(messages.join(" "));
        setIsLoadingCounts(false);
      }
    }

    loadDashboardCounts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceActivity() {
      setIsLoadingActivity(true);
      setActivityMessage("");

      try {
        const response = await fetch("/api/local/workspace/activity", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setActivityEvents([]);
            setActivityMessage("Workspace activity is unavailable.");
            setIsLoadingActivity(false);
          }

          return;
        }

        const records = getRecordsFromResponse(responseData)
          .map((record) => normalizeWorkspaceActivityEvent(record))
          .filter((record): record is WorkspaceActivityEvent => record !== null);

        if (isMounted) {
          setActivityEvents(records);
          setIsLoadingActivity(false);
        }
      } catch {
        if (isMounted) {
          setActivityEvents([]);
          setActivityMessage("Workspace activity is unavailable.");
          setIsLoadingActivity(false);
        }
      }
    }

    loadWorkspaceActivity();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    return buildStats(counts, isLoadingCounts);
  }, [counts, isLoadingCounts]);

  const visibleActivityEvents = useMemo(() => {
    return activityEvents.slice(0, 6);
  }, [activityEvents]);

  return (
    <div className="workspace-page">
      <section className="workspace-hero">
        <div className="workspace-hero-copy">
          <p className="workspace-kicker">Command center</p>

          <h2>
            Turn invoice data into structured, explainable validation evidence.
          </h2>

          <p>
            This workspace is shaped around the real Invoice Lantern workflow:
            invoice creation, validation report review, XML handling, API testing,
            audit trails, and privacy controls.
          </p>
        </div>
      </section>

      <section className="workspace-stat-strip">
        {stats.map((item) => (
          <div className="workspace-stat" key={item.label}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </div>
        ))}
      </section>

      {dashboardMessage ? (
        <section className="workspace-alerts">
          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>{dashboardMessage}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="workspace-command-grid">
        <div className="workspace-flow">
          {commandFlow.map((item) => (
            <Link href={item.href} className="workspace-flow-row" key={item.title}>
              <span className="flow-symbol">{item.icon}</span>

              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>

              <ArrowRight size={18} />
            </Link>
          ))}
        </div>

        <aside className="workspace-alerts">
          <div className="alerts-head">
            <AlertTriangle size={22} />

            <div>
              <p>Implementation guardrails</p>
              <h3>Do not overclaim.</h3>
            </div>
          </div>

          <div className="alert-list">
            {alerts.map((item) => (
              <div className="alert-item" key={item}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <Activity size={22} />

          <div>
            <p>Workspace activity</p>
            <h3>Recent API-owned events.</h3>
          </div>
        </div>

        <div className="alert-list">
          {isLoadingActivity ? (
            <div className="alert-item">
              <span />
              <p>Loading workspace activity.</p>
            </div>
          ) : activityMessage ? (
            <div className="alert-item">
              <span />
              <p>{activityMessage}</p>
            </div>
          ) : visibleActivityEvents.length > 0 ? (
            visibleActivityEvents.map((event) => (
              <div className="alert-item" key={event.id}>
                <span />
                <p>
                  <strong>{formatActivityType(event.eventType)}</strong>
                  <br />
                  {event.entityLabel || event.entityId} · {event.severity} ·{" "}
                  {formatActivityTime(event.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <div className="alert-item">
              <span />
              <p>
                No workspace activity has been recorded yet. Create, update, or
                delete an invoice draft, validation report, or XML report to
                populate this feed.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="workspace-map">
        <div>
          <Database size={24} />
          <h3>Product data layer</h3>
          <p>
            The frontend consumes invoice drafts, invoice validation reports, XML
            readiness reports, privacy settings, and audit events from the
            dedicated API service. No demo records are shown as product data.
          </p>
        </div>

        <div>
          <ShieldCheck size={24} />
          <h3>Security-first shell</h3>
          <p>
            The interface is planned around organization ownership, RBAC, secure API
            key management, XML upload limits, audit logs, and GDPR-oriented controls.
          </p>
        </div>
      </section>

      <section className="workspace-step-grid">
        <div className="workspace-step">
          <div>
            <FileText size={21} />
          </div>
          <h3>Invoice studio</h3>
          <p>
            Create structured invoice records from canonical fields, not scanned
            pixels or untrusted visual extraction.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <FileCode2 size={21} />
          </div>
          <h3>XML handling</h3>
          <p>
            Build toward UBL XML generation, parsing, upload checks, safe parser
            behavior, and validation-worker handoff.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <Braces size={21} />
          </div>
          <h3>API layer</h3>
          <p>
            Keep web and API separated. The API owns validation, exports, logs, keys,
            webhooks, and rate limits.
          </p>
        </div>

        <div className="workspace-step">
          <div>
            <LockKeyhole size={21} />
          </div>
          <h3>Privacy controls</h3>
          <p>
            Build toward exports, deletion requests, retention settings, audit history,
            and clear data-processing boundaries.
          </p>
        </div>
      </section>
    </div>
  );
}
