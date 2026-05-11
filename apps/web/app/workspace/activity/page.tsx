"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  FileCheck2,
  FileCode2,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  ShieldCheck
} from "lucide-react";

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

function getErrorMessageFromResponse(data: unknown, fallback: string) {
  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim()
    ? message.trim()
    : fallback;
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
  const severity = normalizeActivitySeverity(readStringField(value, "severity"));
  const source = readStringField(value, "source", "api");
  const createdAt = readStringField(value, "createdAt");
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

function formatEventType(eventType: string) {
  return eventType
    .split(".")
    .map((segment) => segment.replace(/_/g, " "))
    .join(" · ");
}

function formatEntityType(entityType: string) {
  return entityType.replace(/_/g, " ");
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getEventIcon(eventType: string) {
  if (eventType.startsWith("invoice_draft.")) {
    return <ReceiptText size={18} />;
  }

  if (eventType.startsWith("validation_run.")) {
    return <FileCheck2 size={18} />;
  }

  if (eventType.startsWith("xml_report.")) {
    return <FileCode2 size={18} />;
  }

  if (eventType.startsWith("api_key.")) {
    return <KeyRound size={18} />;
  }

  if (
    eventType.startsWith("privacy_request.") ||
    eventType.startsWith("workspace_settings.") ||
    eventType.startsWith("workspace_retention.") ||
    eventType.startsWith("workspace_deletion.") ||
    eventType.startsWith("workspace_export.")
  ) {
    return <LockKeyhole size={18} />;
  }

  return <Activity size={18} />;
}

function getMetadataSummary(event: WorkspaceActivityEvent) {
  const metadata = event.metadata;
  const parts: string[] = [];

  const invoiceNumber = metadata.invoiceNumber;
  const currency = metadata.currency;
  const payableAmount = metadata.payableAmount;
  const findingsCount = metadata.findingsCount;
  const fileName = metadata.fileName;
  const technicalStatus = metadata.technicalStatus;
  const requestType = metadata.requestType;
  const status = metadata.status;
  const retentionMode = metadata.retentionMode;

  if (typeof invoiceNumber === "string" && invoiceNumber.trim()) {
    parts.push(`Invoice ${invoiceNumber}`);
  }

  if (typeof fileName === "string" && fileName.trim()) {
    parts.push(fileName);
  }

  if (
    (typeof currency === "string" && currency.trim()) ||
    typeof payableAmount === "string" ||
    typeof payableAmount === "number"
  ) {
    parts.push(
      `${String(currency || "").trim()} ${String(payableAmount || "").trim()}`.trim()
    );
  }

  if (typeof findingsCount === "number" && Number.isFinite(findingsCount)) {
    parts.push(`${findingsCount} finding(s)`);
  }

  if (typeof technicalStatus === "string" && technicalStatus.trim()) {
    parts.push(`Technical status: ${technicalStatus}`);
  }

  if (typeof requestType === "string" && requestType.trim()) {
    parts.push(`Request type: ${requestType.replace(/_/g, " ")}`);
  }

  if (typeof status === "string" && status.trim()) {
    parts.push(`Status: ${status.replace(/_/g, " ")}`);
  }

  if (typeof retentionMode === "string" && retentionMode.trim()) {
    parts.push(`Retention mode: ${retentionMode}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No additional event metadata.";
}

export default function WorkspaceActivityPage() {
  const [events, setEvents] = useState<WorkspaceActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadActivityEvents() {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/local/workspace/activity", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setEvents([]);
            setMessage(
              getErrorMessageFromResponse(
                responseData,
                "Workspace activity could not be loaded."
              )
            );
            setIsLoading(false);
          }

          return;
        }

        const records = getRecordsFromResponse(responseData)
          .map((record) => normalizeWorkspaceActivityEvent(record))
          .filter((record): record is WorkspaceActivityEvent => record !== null);

        if (isMounted) {
          setEvents(records);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setEvents([]);
          setMessage("Workspace activity could not be loaded.");
          setIsLoading(false);
        }
      }
    }

    loadActivityEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  const eventCounts = useMemo(() => {
    return {
      total: events.length,
      warnings: events.filter((event) => event.severity === "warning").length,
      errors: events.filter((event) => event.severity === "error").length
    };
  }, [events]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Audit trail</p>
        <h2>Workspace activity.</h2>
        <p>
          Review API-owned activity events created by invoice drafts, validation
          reports, XML readiness reports, privacy actions, retention actions,
          deletion actions, exports, and developer operations. Activity access is
          restricted to owner, admin, and developer workspace roles.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Total events</p>
          <strong>{isLoading ? "Loading" : eventCounts.total}</strong>
          <span>Recent activity records returned by the API.</span>
        </div>

        <div className="workspace-stat">
          <p>Warning events</p>
          <strong>{isLoading ? "Loading" : eventCounts.warnings}</strong>
          <span>Events marked as warnings by platform operations.</span>
        </div>

        <div className="workspace-stat">
          <p>Error events</p>
          <strong>{isLoading ? "Loading" : eventCounts.errors}</strong>
          <span>Events marked as failed or high-risk operations.</span>
        </div>

        <div className="workspace-stat">
          <p>Allowed roles</p>
          <strong>3</strong>
          <span>Owner, admin, and developer roles can view activity.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldCheck size={22} />

          <div>
            <p>Activity boundary</p>
            <h3>Operational history, not legal evidence.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              These events help trace platform actions inside the workspace. They
              do not replace official accounting logs, tax records, Peppol access
              point logs, VIES evidence, or authority submission receipts.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Workspace activity is available to owner, admin, and developer
              roles. Privacy settings, privacy-request review, retention runs,
              and deletion runs remain restricted to owner and admin roles.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Recent events</p>
            <h3>Activity feed</h3>
          </div>
        </div>

        <div className="alert-list">
          {isLoading ? (
            <div className="alert-item">
              <span />
              <p>Loading workspace activity.</p>
            </div>
          ) : message ? (
            <div className="alert-item">
              <span />
              <p>{message}</p>
            </div>
          ) : events.length > 0 ? (
            events.map((event) => (
              <div className="alert-item" key={event.id}>
                <span />
                <p>
                  <strong>{formatEventType(event.eventType)}</strong>
                  <br />
                  {getEventIcon(event.eventType)} {event.entityLabel || event.entityId}
                  <br />
                  {formatEntityType(event.entityType)} · {event.severity} ·{" "}
                  {event.source}
                  <br />
                  <Clock3 size={14} /> {formatDateTime(event.createdAt)}
                  <br />
                  <Database size={14} /> {getMetadataSummary(event)}
                </p>
              </div>
            ))
          ) : (
            <div className="alert-item">
              <span />
              <p>
                No workspace activity has been recorded yet. Create or update an
                invoice draft, validation run, XML report, privacy request,
                export package, retention run, deletion run, or API key to
                populate this operational audit trail.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="workspace-map">
        <div>
          <Activity size={24} />
          <h3>Tracked actions</h3>
          <p>
            The current activity table records invoice draft changes, validation
            report creation and deletion, XML readiness report changes, privacy
            request actions, workspace settings changes, export packages,
            retention runs, deletion runs, and selected developer operations.
          </p>
        </div>

        <div>
          <AlertTriangle size={24} />
          <h3>Audit boundary</h3>
          <p>
            Activity records support operational traceability inside Invoice
            Lantern. They are not an official audit certificate, legal record,
            tax filing receipt, Peppol transmission receipt, or authority
            acknowledgement.
          </p>
        </div>
      </section>
    </div>
  );
}