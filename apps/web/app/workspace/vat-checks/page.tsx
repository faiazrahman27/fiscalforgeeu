"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
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

type ViesStatus =
  | "valid"
  | "invalid"
  | "unavailable"
  | "error"
  | "not_checked"
  | "unsupported"
  | "rate_limited";

type ViesFormatCheckResult = {
  normalized: string;
  countryCode: string | null;
  countryName: string | null;
  formatValid: boolean;
  message: string;
  warnings: string[];
  disclaimer: string;
};

type ViesEvidenceSummary = {
  id: string;
  status: ViesStatus;
  checkedAt: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  responseTimeMs: number | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  requestIdentifier: string | null;
  viesName: string | null;
  createdAt: string;
};

type ViesFinding = {
  code: string;
  severity: string;
  category: string;
  message: string;
  legalConfidence: string;
  fixSuggestion: string | null;
  sourceLabels: string[];
};

type ViesCheckResult = {
  status: ViesStatus;
  viesValid: boolean | null;
  checkedAt: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  disclaimer: string;
  formatCheck: ViesFormatCheckResult | null;
  evidence: ViesEvidenceSummary | null;
  findings: ViesFinding[];
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

function readNullableNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function normalizeViesStatus(value: unknown): ViesStatus | null {
  if (
    value === "valid" ||
    value === "invalid" ||
    value === "unavailable" ||
    value === "error" ||
    value === "not_checked" ||
    value === "unsupported" ||
    value === "rate_limited"
  ) {
    return value;
  }

  return null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeViesFormatCheck(value: unknown): ViesFormatCheckResult | null {
  if (!isPlainObject(value) || typeof value.formatValid !== "boolean") {
    return null;
  }

  return {
    normalized: readStringField(value, "normalized"),
    countryCode: readNullableStringField(value, "countryCode"),
    countryName: readNullableStringField(value, "countryName"),
    formatValid: value.formatValid,
    message: readStringField(value, "message"),
    warnings: normalizeStringArray(value.warnings),
    disclaimer: readStringField(value, "disclaimer")
  };
}

function normalizeViesEvidence(value: unknown): ViesEvidenceSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const status = normalizeViesStatus(value.status);
  const id = readStringField(value, "id");
  const checkedAt = readStringField(value, "checkedAt");
  const createdAt = readStringField(value, "createdAt");

  if (!status || !id || !checkedAt || !createdAt) {
    return null;
  }

  return {
    id,
    status,
    checkedAt,
    sourceLabel: readNullableStringField(value, "sourceLabel"),
    sourceUrl: readNullableStringField(value, "sourceUrl"),
    responseTimeMs: readNullableNumberField(value, "responseTimeMs"),
    errorCode: readNullableStringField(value, "errorCode"),
    errorMessageSafe: readNullableStringField(value, "errorMessageSafe"),
    requestIdentifier: readNullableStringField(value, "requestIdentifier"),
    viesName: readNullableStringField(value, "viesName"),
    createdAt
  };
}

function normalizeViesFinding(value: unknown): ViesFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");
  const message = readStringField(value, "message");

  if (!code || !message) {
    return null;
  }

  return {
    code,
    severity: readStringField(value, "severity", "warning"),
    category: readStringField(value, "category", "VIES"),
    message,
    legalConfidence: readStringField(value, "legalConfidence", "technical"),
    fixSuggestion: readNullableStringField(value, "fixSuggestion"),
    sourceLabels: normalizeStringArray(value.sourceLabels)
  };
}

function normalizeViesCheckResult(value: unknown): ViesCheckResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const status = normalizeViesStatus(value.status);
  const viesCheck = isPlainObject(value.viesCheck) ? value.viesCheck : {};
  const source = isPlainObject(value.source) ? value.source : {};

  if (!status) {
    return null;
  }

  return {
    status,
    viesValid:
      typeof viesCheck.viesValid === "boolean" ? viesCheck.viesValid : null,
    checkedAt: readStringField(value, "checkedAt"),
    sourceLabel: readNullableStringField(source, "label"),
    sourceUrl: readNullableStringField(source, "url"),
    disclaimer: readStringField(value, "disclaimer"),
    formatCheck: normalizeViesFormatCheck(value.formatCheck),
    evidence: normalizeViesEvidence(value.evidence),
    findings: Array.isArray(value.findings)
      ? value.findings
          .map((finding) => normalizeViesFinding(finding))
          .filter((finding): finding is ViesFinding => finding !== null)
      : []
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

function formatViesStatus(value: ViesStatus) {
  return value.replaceAll("_", " ");
}

function formatViesValidity(value: boolean | null) {
  if (value === true) {
    return "VIES valid at check time";
  }

  if (value === false) {
    return "VIES invalid at check time";
  }

  return "No VIES validity evidence";
}

export default function WorkspaceVatChecksPage() {
  const [records, setRecords] = useState<VatCheckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viesCountryCode, setViesCountryCode] = useState("DE");
  const [viesVatNumber, setViesVatNumber] = useState("");
  const [viesPartyRole, setViesPartyRole] = useState<VatCheckPartyRole>("seller");
  const [viesResult, setViesResult] = useState<ViesCheckResult | null>(null);
  const [viesMessage, setViesMessage] = useState("");
  const [isCheckingVies, setIsCheckingVies] = useState(false);

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

  async function handleViesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCheckingVies(true);
    setViesMessage("");
    setViesResult(null);

    try {
      const response = await fetch("/api/local/vat/check-vies", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          countryCode: viesCountryCode.trim().toUpperCase(),
          vatNumber: viesVatNumber.trim(),
          partyRole: viesPartyRole
        }),
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setViesMessage(getApiErrorMessage(responseData));
        return;
      }

      const normalizedResult = normalizeViesCheckResult(responseData);

      if (!normalizedResult) {
        setViesMessage("The VIES evidence response could not be read safely.");
        return;
      }

      setViesResult(normalizedResult);
    } catch {
      setViesMessage(
        "VIES evidence check is unavailable through the local API proxy. Make sure apps/api is running."
      );
    } finally {
      setIsCheckingVies(false);
    }
  }

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
            <p>VIES evidence</p>
            <h3>Optional time-of-check check</h3>
          </div>

          <span className="status-pill">
            {viesResult ? formatViesStatus(viesResult.status) : "not checked"}
          </span>
        </div>

        <form className="workspace-form-grid" onSubmit={handleViesSubmit}>
          <label>
            <span>Country code</span>
            <input
              maxLength={2}
              value={viesCountryCode}
              onChange={(event) => setViesCountryCode(event.target.value)}
              placeholder="DE"
            />
          </label>

          <label>
            <span>VAT number</span>
            <input
              value={viesVatNumber}
              onChange={(event) => setViesVatNumber(event.target.value)}
              placeholder="DE123456789"
            />
          </label>

          <label>
            <span>Party role</span>
            <select
              value={viesPartyRole}
              onChange={(event) =>
                setViesPartyRole(event.target.value as VatCheckPartyRole)
              }
            >
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
              <option value="other">Other</option>
            </select>
          </label>

          <button
            className="workspace-auth-action"
            type="submit"
            disabled={isCheckingVies || !viesVatNumber.trim() || !viesCountryCode.trim()}
          >
            {isCheckingVies ? "Checking VIES" : "Check VIES evidence"}
          </button>
        </form>

        {viesMessage ? (
          <div className="alert-item">
            <span />
            <p>{viesMessage}</p>
          </div>
        ) : null}

        {viesResult ? (
          <div className="workspace-data-grid">
            <article className="workspace-data-card">
              <span>Local format result</span>
              <strong>
                {viesResult.formatCheck?.formatValid
                  ? "Format matched"
                  : "Format did not match"}
              </strong>
              <p>
                {viesResult.formatCheck?.message ??
                  "Local format result was not returned."}
              </p>
              <p>
                Country:{" "}
                {viesResult.formatCheck?.countryCode ??
                  (viesCountryCode.trim().toUpperCase() || "not detected")}
                {viesResult.formatCheck?.countryName
                  ? ` (${viesResult.formatCheck.countryName})`
                  : ""}
                . Warnings: {viesResult.formatCheck?.warnings.length ?? 0}.
              </p>
              <p>
                Format valid is not VIES valid and is not proof of VAT
                registration.
              </p>
            </article>

            <article className="workspace-data-card">
              <span>VIES evidence result</span>
              <strong>{formatViesStatus(viesResult.status)}</strong>
              <p>{formatViesValidity(viesResult.viesValid)}</p>
              <p>
                Checked:{" "}
                {viesResult.checkedAt
                  ? formatDateTime(viesResult.checkedAt)
                  : "not recorded"}
                . Source: {viesResult.sourceLabel ?? "VIES"}.
              </p>
              <p>
                VIES unavailable is not invalid. VIES valid is not legal, tax,
                accounting, filing, or compliance proof.
              </p>
            </article>

            <article className="workspace-data-card">
              <span>Evidence metadata</span>
              <strong>{viesResult.evidence?.id ?? "No cached evidence"}</strong>
              <p>
                Status:{" "}
                {viesResult.evidence
                  ? formatViesStatus(viesResult.evidence.status)
                  : "not checked"}
                . Response time:{" "}
                {viesResult.evidence?.responseTimeMs !== null &&
                viesResult.evidence?.responseTimeMs !== undefined
                  ? `${viesResult.evidence.responseTimeMs} ms`
                  : "not recorded"}
                .
              </p>
              <p>
                Request ID: {viesResult.evidence?.requestIdentifier ?? "not returned"}.
                Error: {viesResult.evidence?.errorCode ?? "none"}.
              </p>
              <p>
                {viesResult.evidence?.errorMessageSafe ??
                  "No safe VIES error message returned."}
              </p>
            </article>
          </div>
        ) : (
          <div className="alert-item">
            <span />
            <p>
              No VIES evidence check has been run in this page session. VIES
              evidence depends on EU and national systems at the time of
              checking.
            </p>
          </div>
        )}

        {viesResult?.disclaimer ? (
          <div className="alert-item">
            <span />
            <p>{viesResult.disclaimer}</p>
          </div>
        ) : null}

        {viesResult?.findings.length ? (
          <div className="workspace-table">
            {viesResult.findings.map((finding) => (
              <div className="workspace-table-row" key={finding.code}>
                <div>
                  <strong>{finding.code}</strong>
                  <span>{finding.message}</span>
                  {finding.fixSuggestion ? <span>{finding.fixSuggestion}</span> : null}
                  <span>
                    Sources:{" "}
                    {finding.sourceLabels.length > 0
                      ? finding.sourceLabels.join(", ")
                      : "not returned"}
                    .
                  </span>
                </div>

                <div>
                  <span className="status-pill">{finding.severity}</span>
                </div>

                <div>
                  <span>{finding.category}</span>
                </div>

                <strong>{formatSource(finding.legalConfidence)}</strong>

                <ShieldAlert size={17} />
              </div>
            ))}
          </div>
        ) : null}
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
