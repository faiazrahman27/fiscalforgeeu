"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Globe2,
  Layers3,
  Play,
  ShieldAlert
} from "lucide-react";

type VidaBuyerType = "business" | "consumer" | "public_authority" | "unknown";

type VidaTransactionType =
  | "goods"
  | "services"
  | "digital_service"
  | "mixed"
  | "unknown";

type VidaFinding = {
  code: string;
  severity: string;
  message: string;
  legalConfidence: string;
  sourceLabels: string[];
  fixSuggestion: string;
};

type VidaSimulationResult = {
  simulationVersion: string;
  transactionClass: string;
  vidaRelevance: string;
  reason: string;
  effectiveDateContext: string;
  confidence: string;
  legalConfidence: string;
  countryContext: {
    sellerInEu: boolean;
    buyerInEu: boolean;
    sameCountry: boolean;
    crossBorderEu: boolean;
  };
  normalizedInput: {
    sellerCountryCode: string | null;
    buyerCountryCode: string | null;
    sellerVatId: string | null;
    buyerVatId: string | null;
    buyerType: VidaBuyerType;
    transactionType: VidaTransactionType;
    invoiceDate: string | null;
    currency: string | null;
    amount: string | null;
    countryPackVersions: Record<string, string>;
  };
  findings: VidaFinding[];
  recommendedNextActions: string[];
  disclaimer: string;
};

type VidaSimulationForm = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId: string;
  buyerVatId: string;
  buyerType: VidaBuyerType;
  transactionType: VidaTransactionType;
  invoiceDate: string;
  currency: string;
  amount: string;
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

function getApiErrorMessage(
  data: unknown,
  fallback = "The ViDA simulation request failed."
) {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
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

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFinding(value: unknown): VidaFinding | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    severity: readStringField(value, "severity", "info"),
    message: readStringField(value, "message"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    sourceLabels: readStringArrayField(value, "sourceLabels"),
    fixSuggestion: readStringField(value, "fixSuggestion")
  };
}

function normalizeVidaResult(value: unknown): VidaSimulationResult | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const countryContext = isPlainObject(value.countryContext)
    ? value.countryContext
    : {};
  const normalizedInput = isPlainObject(value.normalizedInput)
    ? value.normalizedInput
    : {};
  const countryPackVersions = isPlainObject(normalizedInput.countryPackVersions)
    ? Object.fromEntries(
        Object.entries(normalizedInput.countryPackVersions)
          .filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === "string" && typeof entry[1] === "string"
          )
          .map(([key, version]) => [key, version])
      )
    : {};

  return {
    simulationVersion: readStringField(
      value,
      "simulationVersion",
      "unversioned"
    ),
    transactionClass: readStringField(
      value,
      "transactionClass",
      "insufficient_data"
    ),
    vidaRelevance: readStringField(value, "vidaRelevance", "review_required"),
    reason: readStringField(value, "reason"),
    effectiveDateContext: readStringField(value, "effectiveDateContext"),
    confidence: readStringField(value, "confidence", "educational_simulation"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    countryContext: {
      sellerInEu: readBooleanField(countryContext, "sellerInEu"),
      buyerInEu: readBooleanField(countryContext, "buyerInEu"),
      sameCountry: readBooleanField(countryContext, "sameCountry"),
      crossBorderEu: readBooleanField(countryContext, "crossBorderEu")
    },
    normalizedInput: {
      sellerCountryCode: readNullableStringField(
        normalizedInput,
        "sellerCountryCode"
      ),
      buyerCountryCode: readNullableStringField(
        normalizedInput,
        "buyerCountryCode"
      ),
      sellerVatId: readNullableStringField(normalizedInput, "sellerVatId"),
      buyerVatId: readNullableStringField(normalizedInput, "buyerVatId"),
      buyerType: readStringField(
        normalizedInput,
        "buyerType",
        "unknown"
      ) as VidaBuyerType,
      transactionType: readStringField(
        normalizedInput,
        "transactionType",
        "unknown"
      ) as VidaTransactionType,
      invoiceDate: readNullableStringField(normalizedInput, "invoiceDate"),
      currency: readNullableStringField(normalizedInput, "currency"),
      amount: readNullableStringField(normalizedInput, "amount"),
      countryPackVersions
    },
    findings: Array.isArray(value.findings)
      ? value.findings
          .map((finding) => normalizeFinding(finding))
          .filter((finding): finding is VidaFinding => finding !== null)
      : [],
    recommendedNextActions: readStringArrayField(
      value,
      "recommendedNextActions"
    ),
    disclaimer: readStringField(value, "disclaimer")
  };
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatLegalConfidence(value: string) {
  const labels: Record<string, string> = {
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required"
  };

  return labels[value] ?? formatStatus(value || "not labelled");
}

function buildRequestBody(form: VidaSimulationForm) {
  const body: Record<string, unknown> = {
    sellerCountry: form.sellerCountry,
    buyerCountry: form.buyerCountry,
    buyerType: form.buyerType,
    transactionType: form.transactionType
  };

  if (form.sellerVatId.trim()) {
    body.sellerVatId = form.sellerVatId.trim();
  }

  if (form.buyerVatId.trim()) {
    body.buyerVatId = form.buyerVatId.trim();
  }

  if (form.invoiceDate.trim()) {
    body.invoiceDate = form.invoiceDate.trim();
  }

  if (form.currency.trim()) {
    body.currency = form.currency.trim();
  }

  if (form.amount.trim()) {
    body.amount = form.amount.trim();
  }

  return body;
}

export default function WorkspaceVidaSimulatorPage() {
  const [form, setForm] = useState<VidaSimulationForm>({
    sellerCountry: "DE",
    buyerCountry: "HU",
    sellerVatId: "DE123456789",
    buyerVatId: "HU12345678",
    buyerType: "business",
    transactionType: "services",
    invoiceDate: "2026-05-01",
    currency: "EUR",
    amount: "100.00"
  });
  const [simulationResult, setSimulationResult] =
    useState<VidaSimulationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState("");

  const findingCounts = useMemo(() => {
    const counts = {
      info: 0,
      warning: 0,
      reviewRequired: 0
    };

    for (const finding of simulationResult?.findings ?? []) {
      if (finding.severity === "review_required") {
        counts.reviewRequired += 1;
      } else if (finding.severity === "warning") {
        counts.warning += 1;
      } else {
        counts.info += 1;
      }
    }

    return counts;
  }, [simulationResult]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSimulationMessage("");

    try {
      const response = await fetch("/api/local/transactions/simulate-vida", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildRequestBody(form)),
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setSimulationResult(null);
        setSimulationMessage(
          getApiErrorMessage(
            responseData,
            "Could not run the ViDA-readiness simulation."
          )
        );
        return;
      }

      const normalizedResult = normalizeVidaResult(responseData);

      if (!normalizedResult) {
        setSimulationResult(null);
        setSimulationMessage(
          "The ViDA simulator returned an unreadable response shape."
        );
        return;
      }

      setSimulationResult(normalizedResult);
    } catch {
      setSimulationResult(null);
      setSimulationMessage(
        "The local ViDA simulator API is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">ViDA simulator</p>
        <h2>Simulate EU cross-border readiness context.</h2>
        <p>
          This workspace tool runs Invoice Lantern&apos;s educational
          ViDA-readiness simulation. It checks whether a transaction appears
          relevant for readiness planning. It is not official software, not
          authority submission, not legal, tax, or accounting advice, and not a
          compliance guarantee.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Simulation</p>
          <strong>{simulationResult?.simulationVersion ?? "Ready"}</strong>
          <span>Versioned sandbox result from the local API.</span>
        </div>

        <div className="workspace-stat">
          <p>Relevance</p>
          <strong>
            {simulationResult
              ? formatStatus(simulationResult.vidaRelevance)
              : "Pending"}
          </strong>
          <span>Readiness signal only; not a legal conclusion.</span>
        </div>

        <div className="workspace-stat">
          <p>Findings</p>
          <strong>{simulationResult?.findings.length ?? 0}</strong>
          <span>
            {findingCounts.reviewRequired} review · {findingCounts.warning}{" "}
            warning · {findingCounts.info} info
          </span>
        </div>

        <div className="workspace-stat">
          <p>Boundary</p>
          <strong>SBX</strong>
          <span>Educational simulation with professional-review limits.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Safe use</p>
            <h3>Do not treat ViDA simulation as a filing decision.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              The simulator classifies readiness context from seller country,
              buyer country, buyer type, transaction type, and VAT-ID context.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Real-world VAT, e-invoicing, reporting, and filing decisions still
              require reviewed country rules and qualified professional advice
              where appropriate.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Simulation input</p>
            <h3>Transaction context</h3>
          </div>

          <div className="confidence-label">
            <Globe2 size={17} />
            EU context
          </div>
        </div>

        {simulationMessage ? (
          <div className="alert-item">
            <span />
            <p>{simulationMessage}</p>
          </div>
        ) : null}

        <form className="workspace-form-grid" onSubmit={handleSubmit}>
          <label>
            Seller country
            <input
              maxLength={8}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerCountry: event.target.value
                }));
              }}
              required
              value={form.sellerCountry}
            />
          </label>

          <label>
            Buyer country
            <input
              maxLength={8}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerCountry: event.target.value
                }));
              }}
              required
              value={form.buyerCountry}
            />
          </label>

          <label>
            Seller VAT ID
            <input
              maxLength={64}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sellerVatId: event.target.value
                }));
              }}
              value={form.sellerVatId}
            />
          </label>

          <label>
            Buyer VAT ID
            <input
              maxLength={64}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerVatId: event.target.value
                }));
              }}
              value={form.buyerVatId}
            />
          </label>

          <label>
            Buyer type
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  buyerType: event.target.value as VidaBuyerType
                }));
              }}
              value={form.buyerType}
            >
              <option value="business">Business</option>
              <option value="consumer">Consumer</option>
              <option value="public_authority">Public authority</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Transaction type
            <select
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  transactionType: event.target.value as VidaTransactionType
                }));
              }}
              value={form.transactionType}
            >
              <option value="services">Services</option>
              <option value="goods">Goods</option>
              <option value="digital_service">Digital service</option>
              <option value="mixed">Mixed</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Invoice date
            <input
              maxLength={32}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  invoiceDate: event.target.value
                }));
              }}
              placeholder="2026-05-01"
              value={form.invoiceDate}
            />
          </label>

          <label>
            Currency
            <input
              maxLength={8}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  currency: event.target.value
                }));
              }}
              value={form.currency}
            />
          </label>

          <label>
            Amount
            <input
              maxLength={40}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  amount: event.target.value
                }));
              }}
              value={form.amount}
            />
          </label>

          <button className="workspace-auth-action" disabled={isSubmitting} type="submit">
            <Play size={16} />
            {isSubmitting ? "Running simulation" : "Run simulation"}
          </button>
        </form>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Simulation result</p>
            <h3>
              {simulationResult
                ? formatStatus(simulationResult.transactionClass)
                : "No simulation run yet"}
            </h3>
          </div>

          <div className="confidence-label">
            <Layers3 size={17} />
            {simulationResult
              ? formatLegalConfidence(simulationResult.legalConfidence)
              : "not loaded"}
          </div>
        </div>

        <div className="finding-console-list">
          {simulationResult ? (
            <>
              <div className="finding-console-row">
                <BadgeCheck size={18} />

                <div>
                  <strong>VIDA_RELEVANCE_SIGNAL</strong>
                  <p>{simulationResult.reason}</p>
                  <p>
                    Relevance: {formatStatus(simulationResult.vidaRelevance)}.
                    Seller EU:{" "}
                    {simulationResult.countryContext.sellerInEu ? "yes" : "no"}.
                    Buyer EU:{" "}
                    {simulationResult.countryContext.buyerInEu ? "yes" : "no"}.
                    Cross-border EU:{" "}
                    {simulationResult.countryContext.crossBorderEu
                      ? "yes"
                      : "no"}
                    .
                  </p>
                </div>

                <span>{simulationResult.vidaRelevance}</span>
              </div>

              <div className="finding-console-row">
                <BookOpenCheck size={18} />

                <div>
                  <strong>VIDA_EFFECTIVE_DATE_CONTEXT</strong>
                  <p>{simulationResult.effectiveDateContext}</p>
                  <p>{simulationResult.disclaimer}</p>
                </div>

                <span>context</span>
              </div>

              {simulationResult.findings.map((finding) => (
                <div className="finding-console-row" key={finding.code}>
                  <AlertTriangle size={18} />

                  <div>
                    <strong>{finding.code}</strong>
                    <p>{finding.message}</p>
                    <p>
                      Legal confidence:{" "}
                      {formatLegalConfidence(finding.legalConfidence)}.
                      Sources:{" "}
                      {finding.sourceLabels.length > 0
                        ? finding.sourceLabels.join(", ")
                        : "No source label"}.
                    </p>
                    <p>Fix suggestion: {finding.fixSuggestion}</p>
                  </div>

                  <span>{finding.severity}</span>
                </div>
              ))}

              {simulationResult.recommendedNextActions.map((action) => (
                <div className="finding-console-row" key={action}>
                  <BookOpenCheck size={18} />

                  <div>
                    <strong>RECOMMENDED_NEXT_ACTION</strong>
                    <p>{action}</p>
                  </div>

                  <span>next</span>
                </div>
              ))}
            </>
          ) : (
            <div className="finding-console-row">
              <AlertTriangle size={18} />

              <div>
                <strong>VIDA_SIMULATION_NOT_RUN</strong>
                <p>
                  Submit transaction context to generate an educational
                  ViDA-readiness simulation result.
                </p>
              </div>

              <span>pending</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}