"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  FileText,
  ShieldAlert
} from "lucide-react";

type VatCheckPartyRole = "seller" | "buyer" | "other";

type VatCheckRecord = {
  id: string;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  partyRole: VatCheckPartyRole | null;
  inputCountryHint: string | null;
  detectedCountryCode: string | null;
  normalizedVatId: string;
  checkLevel: "local_format";
  source: "invoice_lantern_vat_format_rules";
  formatValid: boolean;
  message: string;
  warnings: string[];
  disclaimer: string;
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

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizePartyRole(value: unknown): VatCheckPartyRole | null {
  if (value === "seller" || value === "buyer" || value === "other") {
    return value;
  }

  return null;
}

function normalizeVatCheckRecord(value: unknown): VatCheckRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const normalizedVatId = readStringField(value, "normalizedVatId");
  const message = readStringField(value, "message");
  const disclaimer = readStringField(value, "disclaimer");
  const createdAt = readStringField(value, "createdAt");
  const checkLevel = readStringField(value, "checkLevel");
  const source = readStringField(value, "source");

  if (
    !id ||
    !message ||
    !disclaimer ||
    !createdAt ||
    checkLevel !== "local_format" ||
    source !== "invoice_lantern_vat_format_rules" ||
    typeof value.formatValid !== "boolean"
  ) {
    return null;
  }

  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  return {
    id,
    invoiceDraftId: readNullableStringField(value, "invoiceDraftId"),
    validationRunId: readNullableStringField(value, "validationRunId"),
    partyRole: normalizePartyRole(value.partyRole),
    inputCountryHint: readNullableStringField(value, "inputCountryHint"),
    detectedCountryCode: readNullableStringField(value, "detectedCountryCode"),
    normalizedVatId,
    checkLevel: "local_format",
    source: "invoice_lantern_vat_format_rules",
    formatValid: value.formatValid,
    message,
    warnings,
    disclaimer,
    createdAt
  };
}

function getRecordsFromResponse(value: unknown) {
  if (!isPlainObject(value) || !Array.isArray(value.records)) {
    return [];
  }

  return value.records;
}

function getApiErrorMessage(data: unknown) {
  if (typeof data === "string" && data.trim()) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return "VAT format check history could not be loaded.";
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim()
    ? message
    : "VAT format check history could not be loaded.";
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

function formatPartyRole(value: VatCheckPartyRole | null) {
  if (!value) {
    return "Unknown party";
  }

  return value[0]?.toUpperCase() + value.slice(1);
}

function formatSource(value: string) {
  return value.replaceAll("_", " ");
}

export default function WorkspaceVatChecksPage() {
  const [records, setRecords] = useState<VatCheckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadVatCheckHistory() {
      setIsLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/local/vat/checks?limit=50", {
          method: "GET",
          cache: "no-store"
        });
        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setRecords([]);
            setMessage(getApiErrorMessage(responseData));
          }

          return;
        }

        const nextRecords = getRecordsFromResponse(responseData)
          .map((record) => normalizeVatCheckRecord(record))
          .filter((record): record is VatCheckRecord => record !== null);

        if (isMounted) {
          setRecords(nextRecords);
        }
      } catch {
        if (isMounted) {
          setRecords([]);
          setMessage(
            "VAT format check history is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVatCheckHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    return {
      total: records.length,
      matched: records.filter((record) => record.formatValid).length,
      notMatched: records.filter((record) => !record.formatValid).length,
      warnings: records.reduce((sum, record) => sum + record.warnings.length, 0)
    };
  }, [records]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">VAT evidence records</p>
        <h2>VAT format check history.</h2>
        <p>
          Review persisted Invoice Lantern local-format check records. These are
          technical evidence records only, not VIES results and not proof of VAT
          registration.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Total records</p>
          <strong>{isLoading ? "Loading" : counts.total}</strong>
          <span>Recent persisted local-format evidence records.</span>
        </div>

        <div className="workspace-stat">
          <p>Format matched</p>
          <strong>{isLoading ? "Loading" : counts.matched}</strong>
          <span>VAT IDs that matched the expected local pattern.</span>
        </div>

        <div className="workspace-stat">
          <p>Format did not match</p>
          <strong>{isLoading ? "Loading" : counts.notMatched}</strong>
          <span>Records where the local pattern check did not pass.</span>
        </div>

        <div className="workspace-stat">
          <p>Warnings</p>
          <strong>{isLoading ? "Loading" : counts.warnings}</strong>
          <span>Technical warnings returned by local format rules.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Legal boundary</p>
            <h3>Local format checks only.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              A matched local format means only that the VAT ID appears to match
              an expected local format pattern. It does not mean the VAT ID
              exists, is active, belongs to the party, is registered for VAT, is
              valid in VIES, or is accepted by any authority.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Recent records</p>
            <h3>VAT local-format checks</h3>
          </div>
        </div>

        {message ? (
          <div className="alert-item">
            <span />
            <p>{message}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoading ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading VAT format check history</strong>
                <span>Reading evidence records from the local API proxy.</span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <div>
                <span>local format</span>
              </div>

              <strong>pending</strong>

              <BadgeCheck size={17} />
            </div>
          ) : records.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No VAT format check records</strong>
                <span>
                  Run a seller or buyer local VAT format check from the invoice
                  editor to create an evidence record.
                </span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <div>
                <span>not VIES</span>
              </div>

              <strong>0</strong>

              <FileText size={17} />
            </div>
          ) : (
            records.map((record) => (
              <div className="workspace-table-row" key={record.id}>
                <div>
                  <strong>{record.normalizedVatId || "No VAT ID supplied"}</strong>
                  <span>{record.message}</span>
                  <span>
                    Party: {formatPartyRole(record.partyRole)}. Country:{" "}
                    {record.detectedCountryCode ?? record.inputCountryHint ?? "not detected"}.
                    Warnings: {record.warnings.length}.
                  </span>
                  <span>{record.disclaimer}</span>
                </div>

                <div>
                  <span className="status-pill">
                    {record.formatValid ? "format matched" : "format did not match"}
                  </span>
                </div>

                <div>
                  <span>
                    <Clock3 size={14} /> {formatDateTime(record.createdAt)}
                  </span>
                </div>

                <strong>{formatSource(record.source)}</strong>

                {record.formatValid ? (
                  <BadgeCheck size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
