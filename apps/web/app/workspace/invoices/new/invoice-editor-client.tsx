"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Calculator,
  Code2,
  FileCode2,
  FileText,
  Globe2,
  Save,
  ShieldAlert,
  Sparkles,
  WandSparkles,
  X
} from "lucide-react";
import {
  countryOptions,
  currencyOptions,
  vatCategoryOptions
} from "../../../../lib/mock-data";
import type {
  InvoiceDocumentDraft,
  InvoiceEditorDraft,
  InvoiceLineEditorDraft,
  InvoicePartyDraft,
  InvoiceTotalsDraft
} from "../../../../lib/types";
import styles from "./invoice-editor.module.css";

type ValidationPreviewItem = {
  title: string;
  value: string;
  tone: "good" | "warn";
  icon: ReactNode;
};

type FindingPreview = {
  code: string;
  message: string;
  severity: "info" | "warning" | "fatal";
};

type LocalValidationReport = {
  id: string;
  createdAt: string;
  technicalStatus: "passed" | "failed";
  standardStatus: "ready" | "warning";
  countrySimulationStatus: "not_relevant" | "review_required";
  vidaReadinessStatus: "not_relevant" | "relevant_simulation";
  findings: FindingPreview[];
  totals: InvoiceTotalsDraft;
  disclaimer: string;
};

type SavedValidationRun = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  totals: InvoiceTotalsDraft;
  findings: FindingPreview[];
  disclaimer: string;
};

type ApiValidationRequestPayload = {
  document: {
    type: "invoice" | "credit_note";
    number: string;
    currency: string;
    issueDate?: string;
  };
  seller: {
    name: string;
    country: string;
    vatId: string;
  };
  buyer: {
    name: string;
    country: string;
    vatId: string;
  };
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    vatCategory: string;
    vatRate: number;
  }[];
};

type ApiValidationTotals = {
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
};

type ApiValidationFinding = {
  code: string;
  severity: "info" | "warning" | "fatal";
  field: string;
  message: string;
  legalConfidence: "technical" | "educational_simulation" | "review_required";
};

type ApiValidationResponse = {
  validationRunId: string;
  invoiceNumber: string;
  technicalStatus: "passed" | "failed";
  standardStatus: "ready" | "warning";
  countrySimulationStatus: "not_relevant" | "review_required";
  vidaReadinessStatus: "not_relevant" | "relevant_simulation";
  totals: ApiValidationTotals;
  findings: ApiValidationFinding[];
  disclaimer: string;
};

const LOCAL_DRAFT_KEY = "fiscalforge.eu.invoiceDraft.local";
const VALIDATION_RUN_STORAGE_KEY = "fiscalforge.eu.validationRuns.local";

export function InvoiceEditorClient({
  initialDraft
}: {
  initialDraft: InvoiceEditorDraft;
}) {
  const [draft, setDraft] = useState<InvoiceEditorDraft>(() => {
    if (typeof window === "undefined") {
      return initialDraft;
    }

    const storedDraft = window.localStorage.getItem(LOCAL_DRAFT_KEY);

    if (!storedDraft) {
      return initialDraft;
    }

    try {
      return JSON.parse(storedDraft) as InvoiceEditorDraft;
    } catch {
      return initialDraft;
    }
  });

  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [validationReport, setValidationReport] =
    useState<LocalValidationReport | null>(null);

  const recalculatedTotals = useMemo(
    () => calculateTotals(draft.lines),
    [draft.lines]
  );

  const findings = useMemo(
    () => buildFindings(draft, recalculatedTotals),
    [draft, recalculatedTotals]
  );

  const validationPreview = useMemo(
    () => buildValidationPreview(draft, findings),
    [draft, findings]
  );

  function updateDocument<K extends keyof InvoiceDocumentDraft>(
    key: K,
    value: InvoiceDocumentDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      document: {
        ...current.document,
        [key]: value
      }
    }));
  }

  function updateParty<K extends keyof InvoicePartyDraft>(
    partyType: "seller" | "buyer",
    key: K,
    value: InvoicePartyDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      [partyType]: {
        ...current[partyType],
        [key]: value
      }
    }));
  }

  function updateLine<K extends keyof InvoiceLineEditorDraft>(
    lineId: string,
    key: K,
    value: InvoiceLineEditorDraft[K]
  ) {
    setDraft((current) => {
      const nextLines = current.lines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const nextLine = {
          ...line,
          [key]: value
        };

        if (key === "quantity" || key === "unitPrice") {
          return {
            ...nextLine,
            netAmount: calculateLineNetAmount(
              nextLine.quantity,
              nextLine.unitPrice
            )
          };
        }

        return nextLine;
      });

      return {
        ...current,
        lines: nextLines
      };
    });
  }

  function addLine() {
    setDraft((current) => {
      const nextIndex = current.lines.length + 1;

      return {
        ...current,
        lines: [
          ...current.lines,
          {
            id: String(nextIndex),
            description: "New invoice line",
            quantity: "1",
            unitCode: "EA",
            unitPrice: "0.00",
            vatCategory: "S",
            vatRate: "27",
            netAmount: "0.00"
          }
        ]
      };
    });
  }

  function removeLine(lineId: string) {
    setDraft((current) => {
      if (current.lines.length === 1) {
        return current;
      }

      return {
        ...current,
        lines: current.lines.filter((line) => line.id !== lineId)
      };
    });
  }

  function saveDraftLocally() {
    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
    setSaveMessage(`Draft saved locally at ${new Date().toLocaleTimeString()}.`);

    window.setTimeout(() => {
      setSaveMessage("");
    }, 3500);
  }

  async function runApiValidation() {
    setIsRunningValidation(true);

    try {
      const apiPayload = buildApiValidationPayload(draft);

      const response = await fetch("/api/local/invoices/validate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(apiPayload)
      });

      const responseData: unknown = await response.json();

      if (!response.ok) {
        const apiError = extractApiError(responseData);

        setValidationReport(
          buildApiErrorReport({
            draft,
            totals: recalculatedTotals,
            code: apiError.code,
            message: apiError.message
          })
        );

        return;
      }

      const apiReport = responseData as ApiValidationResponse;

      const nextReport: LocalValidationReport = {
        id: apiReport.validationRunId,
        createdAt: new Date().toISOString(),
        technicalStatus: apiReport.technicalStatus,
        standardStatus: apiReport.standardStatus,
        countrySimulationStatus: apiReport.countrySimulationStatus,
        vidaReadinessStatus: apiReport.vidaReadinessStatus,
        findings: apiReport.findings.map((finding) => ({
          code: finding.code,
          severity: finding.severity,
          message: finding.message
        })),
        totals: mapApiTotals(apiReport.totals, recalculatedTotals),
        disclaimer: apiReport.disclaimer
      };

      setValidationReport(nextReport);
      saveValidationRunToHistory(buildSavedValidationRun(draft, nextReport));
    } catch {
      setValidationReport(
        buildApiErrorReport({
          draft,
          totals: recalculatedTotals,
          code: "API_UNAVAILABLE",
          message:
            "The local API could not be reached. Make sure apps/api and apps/web are both running."
        })
      );
    } finally {
      setIsRunningValidation(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.editorTop}>
        <Link href="/workspace/invoices" className={styles.backLink}>
          <ArrowLeft size={17} />
          Invoices
        </Link>

        <div className={styles.editorActions}>
          {saveMessage ? <p className={styles.saveMessage}>{saveMessage}</p> : null}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={saveDraftLocally}
          >
            <Save size={16} />
            Save draft
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={runApiValidation}
            disabled={isRunningValidation}
          >
            <WandSparkles size={16} />
            {isRunningValidation ? "Running..." : "Run validation"}
          </button>
        </div>
      </div>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Invoice Editor</p>
          <h2>Build a structured invoice from canonical data, not pixels.</h2>
          <p>
            This editor now sends validation requests through the local Next.js API
            proxy into the dedicated FiscalForge EU API service. Successful API reports
            are saved into local validation history for the Validation Runs page.
          </p>
        </div>

        <div className={styles.heroStatus}>
          <div>
            <BadgeCheck size={24} />
            <span>{findings.length === 0 ? "Ready draft" : "Review draft"}</span>
          </div>

          <strong>{draft.document.number}</strong>
          <p>Profile: {draft.document.profile}</p>
        </div>
      </section>

      {validationReport ? (
        <section className={styles.validationReportPanel}>
          <div className={styles.validationReportTop}>
            <div>
              <p className={styles.kicker}>API validation report</p>
              <h3>{validationReport.id}</h3>
              <span>
                Created {new Date(validationReport.createdAt).toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              className={styles.closeReportButton}
              onClick={() => setValidationReport(null)}
              aria-label="Close validation report"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.reportStatusGrid}>
            <ReportStatus
              label="Technical"
              value={validationReport.technicalStatus}
            />
            <ReportStatus
              label="Standard"
              value={validationReport.standardStatus}
            />
            <ReportStatus
              label="Country simulation"
              value={validationReport.countrySimulationStatus}
            />
            <ReportStatus
              label="ViDA readiness"
              value={validationReport.vidaReadinessStatus}
            />
          </div>

          <div className={styles.reportFindings}>
            {validationReport.findings.length === 0 ? (
              <div className={styles.emptyFinding}>
                <BadgeCheck size={18} />
                <p>No API findings returned for this draft.</p>
              </div>
            ) : (
              validationReport.findings.map((finding) => (
                <div className={styles.findingItem} key={finding.code}>
                  <span>{finding.severity}</span>
                  <strong>{finding.code}</strong>
                  <p>{finding.message}</p>
                </div>
              ))
            )}
          </div>

          <p className={styles.reportDisclaimer}>{validationReport.disclaimer}</p>
        </section>
      ) : null}

      <section className={styles.editorGrid}>
        <div className={styles.editorMain}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p>Document</p>
                <h3>Invoice metadata</h3>
              </div>

              <FileText size={22} />
            </div>

            <div className={styles.formGrid}>
              <Field
                label="Invoice number"
                value={draft.document.number}
                onChange={(value) => updateDocument("number", value)}
              />

              <Field
                label="Issue date"
                type="date"
                value={draft.document.issueDate}
                onChange={(value) => updateDocument("issueDate", value)}
              />

              <Field
                label="Due date"
                type="date"
                value={draft.document.dueDate}
                onChange={(value) => updateDocument("dueDate", value)}
              />

              <SelectField
                label="Currency"
                value={draft.document.currency}
                options={currencyOptions}
                onChange={(value) => updateDocument("currency", value)}
              />

              <SelectField
                label="Profile"
                value={draft.document.profile}
                options={[
                  { label: "EN 16931", value: "EN16931" },
                  { label: "Peppol BIS Billing 3.0", value: "PEPPOL_BIS_3" },
                  { label: "Country pack simulation", value: "COUNTRY_PACK" }
                ]}
                onChange={(value) =>
                  updateDocument(
                    "profile",
                    value as InvoiceDocumentDraft["profile"]
                  )
                }
              />

              <SelectField
                label="Document type"
                value={draft.document.invoiceType}
                options={[
                  { label: "Invoice", value: "invoice" },
                  { label: "Credit note", value: "credit_note" }
                ]}
                onChange={(value) =>
                  updateDocument(
                    "invoiceType",
                    value as InvoiceDocumentDraft["invoiceType"]
                  )
                }
              />

              <Field
                label="Buyer reference"
                value={draft.document.buyerReference}
                onChange={(value) => updateDocument("buyerReference", value)}
              />

              <Field
                label="Contract reference"
                value={draft.document.contractReference}
                onChange={(value) => updateDocument("contractReference", value)}
              />
            </div>
          </div>

          <div className={styles.partyGrid}>
            <PartyPanel
              title="Seller profile"
              party={draft.seller}
              onChange={(key, value) => updateParty("seller", key, value)}
            />

            <PartyPanel
              title="Buyer profile"
              party={draft.buyer}
              onChange={(key, value) => updateParty("buyer", key, value)}
            />
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p>Line items</p>
                <h3>Invoice lines</h3>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addLine}
              >
                Add line
              </button>
            </div>

            <div className={styles.lineTable}>
              <div className={styles.lineHeader}>
                <span>Description</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Price</span>
                <span>VAT</span>
                <span>Rate</span>
                <span>Net</span>
                <span />
              </div>

              {draft.lines.map((line) => (
                <div className={styles.lineRow} key={line.id}>
                  <input
                    value={line.description}
                    aria-label="Line description"
                    onChange={(event) =>
                      updateLine(line.id, "description", event.target.value)
                    }
                  />

                  <input
                    value={line.quantity}
                    aria-label="Quantity"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(
                        line.id,
                        "quantity",
                        cleanDecimalInput(event.target.value)
                      )
                    }
                  />

                  <input
                    value={line.unitCode}
                    aria-label="Unit code"
                    onChange={(event) =>
                      updateLine(
                        line.id,
                        "unitCode",
                        event.target.value.toUpperCase()
                      )
                    }
                  />

                  <input
                    value={line.unitPrice}
                    aria-label="Unit price"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(
                        line.id,
                        "unitPrice",
                        cleanDecimalInput(event.target.value)
                      )
                    }
                  />

                  <select
                    value={line.vatCategory}
                    aria-label="VAT category"
                    onChange={(event) =>
                      updateLine(line.id, "vatCategory", event.target.value)
                    }
                  >
                    {vatCategoryOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <input
                    value={line.vatRate}
                    aria-label="VAT rate"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(
                        line.id,
                        "vatRate",
                        cleanDecimalInput(event.target.value)
                      )
                    }
                  />

                  <input value={line.netAmount} aria-label="Net amount" readOnly />

                  <button
                    type="button"
                    className={styles.removeLineButton}
                    onClick={() => removeLine(line.id)}
                    disabled={draft.lines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.editorSide}>
          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <Sparkles size={20} />

              <div>
                <p>Readiness</p>
                <h3>Validation preview</h3>
              </div>
            </div>

            {validationPreview.map((item) => (
              <StatusItem
                key={item.title}
                icon={item.icon}
                title={item.title}
                value={item.value}
                tone={item.tone}
              />
            ))}
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <Calculator size={20} />

              <div>
                <p>Totals</p>
                <h3>Calculated summary</h3>
              </div>
            </div>

            <TotalRow
              label="Line extension"
              value={recalculatedTotals.lineExtensionAmount}
            />
            <TotalRow
              label="Tax exclusive"
              value={recalculatedTotals.taxExclusiveAmount}
            />
            <TotalRow label="VAT amount" value={recalculatedTotals.taxAmount} />
            <TotalRow
              label="Tax inclusive"
              value={recalculatedTotals.taxInclusiveAmount}
            />
            <TotalRow
              label="Payable amount"
              value={recalculatedTotals.payableAmount}
              strong
            />
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <ShieldAlert size={20} />

              <div>
                <p>Findings</p>
                <h3>Local checks</h3>
              </div>
            </div>

            {findings.length === 0 ? (
              <div className={styles.emptyFinding}>
                <BadgeCheck size={18} />
                <p>No local blocking findings in this draft.</p>
              </div>
            ) : (
              <div className={styles.findingList}>
                {findings.map((finding) => (
                  <div className={styles.findingItem} key={finding.code}>
                    <span>{finding.severity}</span>
                    <strong>{finding.code}</strong>
                    <p>{finding.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <FileCode2 size={20} />

              <div>
                <p>UBL preview</p>
                <h3>Export shape</h3>
              </div>
            </div>

            <pre className={styles.xmlPreview}>
              {buildUblPreview(draft, recalculatedTotals)}
            </pre>

            <button type="button" className={styles.fullWidthButton}>
              <Code2 size={16} />
              Prepare UBL export
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
      >
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PartyPanel({
  title,
  party,
  onChange
}: {
  title: string;
  party: InvoicePartyDraft;
  onChange: <K extends keyof InvoicePartyDraft>(
    key: K,
    value: InvoicePartyDraft[K]
  ) => void;
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <p>Party</p>
          <h3>{title}</h3>
        </div>

        <Globe2 size={22} />
      </div>

      <div className={styles.formGridSingle}>
        <Field
          label="Name"
          value={party.name}
          onChange={(value) => onChange("name", value)}
        />

        <SelectField
          label="Country"
          value={party.country}
          options={countryOptions}
          onChange={(value) => onChange("country", value)}
        />

        <Field
          label="VAT ID"
          value={party.vatId}
          onChange={(value) => onChange("vatId", value.toUpperCase())}
        />

        <Field
          label="City"
          value={party.city}
          onChange={(value) => onChange("city", value)}
        />

        <Field
          label="Postal code"
          value={party.postalCode}
          onChange={(value) => onChange("postalCode", value)}
        />

        <Field
          label="Street"
          value={party.street}
          onChange={(value) => onChange("street", value)}
        />

        <Field
          label="Electronic address"
          value={party.electronicAddress}
          onChange={(value) => onChange("electronicAddress", value)}
        />
      </div>
    </div>
  );
}

function StatusItem({
  icon,
  title,
  value,
  tone
}: {
  icon: ReactNode;
  title: string;
  value: string;
  tone: "good" | "warn";
}) {
  return (
    <div className={styles.statusItem}>
      <div>{icon}</div>
      <p>{title}</p>
      <span className={tone === "good" ? styles.good : styles.warn}>
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? styles.totalRowStrong : styles.totalRow}>
      <span>{label}</span>
      <strong>€{value}</strong>
    </div>
  );
}

function ReportStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.reportStatus}>
      <span>{label}</span>
      <strong>{value.replaceAll("_", " ")}</strong>
    </div>
  );
}

function buildValidationPreview(
  draft: InvoiceEditorDraft,
  findings: FindingPreview[]
): ValidationPreviewItem[] {
  const hasCrossBorderContext = draft.seller.country !== draft.buyer.country;

  return [
    {
      icon: <BadgeCheck size={18} />,
      title: "Input schema",
      value: draft.document.number.trim() ? "Ready" : "Review",
      tone: draft.document.number.trim() ? "good" : "warn"
    },
    {
      icon: <Globe2 size={18} />,
      title: "Cross-border context",
      value: hasCrossBorderContext ? "Review" : "Local",
      tone: hasCrossBorderContext ? "warn" : "good"
    },
    {
      icon: <ShieldAlert size={18} />,
      title: "Legal confidence",
      value: findings.length > 0 ? "Simulation" : "Technical",
      tone: findings.length > 0 ? "warn" : "good"
    }
  ];
}

function buildFindings(
  draft: InvoiceEditorDraft,
  totals: InvoiceTotalsDraft
): FindingPreview[] {
  const findings: FindingPreview[] = [];

  if (!draft.document.number.trim()) {
    findings.push({
      code: "DOCUMENT_NUMBER_REQUIRED",
      severity: "fatal",
      message: "Invoice number is required before validation can run."
    });
  }

  if (!draft.seller.name.trim()) {
    findings.push({
      code: "SELLER_NAME_REQUIRED",
      severity: "fatal",
      message: "Seller name is required in the canonical invoice model."
    });
  }

  if (!draft.buyer.name.trim()) {
    findings.push({
      code: "BUYER_NAME_REQUIRED",
      severity: "fatal",
      message: "Buyer name is required in the canonical invoice model."
    });
  }

  if (draft.seller.country !== draft.buyer.country && !draft.buyer.vatId.trim()) {
    findings.push({
      code: "BUYER_VAT_ID_REQUIRED",
      severity: "fatal",
      message: "Buyer VAT ID is required for this cross-border B2B simulation."
    });
  }

  if (draft.lines.length === 0) {
    findings.push({
      code: "INVOICE_LINE_REQUIRED",
      severity: "fatal",
      message: "At least one invoice line is required."
    });
  }

  draft.lines.forEach((line) => {
    if (!line.description.trim()) {
      findings.push({
        code: `LINE_${line.id}_DESCRIPTION_REQUIRED`,
        severity: "warning",
        message: `Line ${line.id} should contain a meaningful description.`
      });
    }

    if (toDecimalNumber(line.quantity) <= 0) {
      findings.push({
        code: `LINE_${line.id}_QUANTITY_INVALID`,
        severity: "fatal",
        message: `Line ${line.id} quantity must be greater than zero.`
      });
    }
  });

  if (toDecimalNumber(totals.payableAmount) <= 0) {
    findings.push({
      code: "PAYABLE_AMOUNT_NOT_POSITIVE",
      severity: "warning",
      message: "Payable amount should be greater than zero for a normal invoice."
    });
  }

  if (draft.seller.country !== draft.buyer.country) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      message:
        "Seller and buyer are in different countries. This is only an educational simulation and requires professional review."
    });
  }

  return findings;
}

function buildApiValidationPayload(
  draft: InvoiceEditorDraft
): ApiValidationRequestPayload {
  return {
    document: {
      type: draft.document.invoiceType,
      number: draft.document.number,
      currency: draft.document.currency,
      issueDate: draft.document.issueDate
    },
    seller: {
      name: draft.seller.name,
      country: draft.seller.country,
      vatId: draft.seller.vatId
    },
    buyer: {
      name: draft.buyer.name,
      country: draft.buyer.country,
      vatId: draft.buyer.vatId
    },
    lines: draft.lines.map((line) => ({
      description: line.description,
      quantity: toDecimalNumber(line.quantity),
      unitPrice: toDecimalNumber(line.unitPrice),
      vatCategory: line.vatCategory,
      vatRate: toDecimalNumber(line.vatRate)
    }))
  };
}

function calculateTotals(lines: InvoiceLineEditorDraft[]): InvoiceTotalsDraft {
  const lineExtensionCents = lines.reduce((sum, line) => {
    return sum + decimalToCents(line.netAmount);
  }, 0);

  const taxCents = lines.reduce((sum, line) => {
    const netCents = decimalToCents(line.netAmount);
    const vatRate = toDecimalNumber(line.vatRate || "0");
    const lineTaxCents = Math.round((netCents * vatRate) / 100);

    return sum + lineTaxCents;
  }, 0);

  const taxInclusiveCents = lineExtensionCents + taxCents;

  return {
    lineExtensionAmount: centsToDecimal(lineExtensionCents),
    taxExclusiveAmount: centsToDecimal(lineExtensionCents),
    taxAmount: centsToDecimal(taxCents),
    taxInclusiveAmount: centsToDecimal(taxInclusiveCents),
    payableAmount: centsToDecimal(taxInclusiveCents)
  };
}

function calculateLineNetAmount(quantity: string, unitPrice: string) {
  const quantityNumber = toDecimalNumber(quantity || "0");
  const unitPriceCents = decimalToCents(unitPrice || "0");
  const netCents = Math.round(quantityNumber * unitPriceCents);

  return centsToDecimal(netCents);
}

function toDecimalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (!/^-?\d*(\.\d*)?$/.test(normalized) || normalized === "" || normalized === ".") {
    return 0;
  }

  return Number(normalized);
}

function decimalToCents(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (!/^-?\d*(\.\d*)?$/.test(normalized) || normalized === "" || normalized === ".") {
    return 0;
  }

  return Math.round(Number(normalized) * 100);
}

function centsToDecimal(value: number) {
  return (value / 100).toFixed(2);
}

function mapApiTotals(
  totals: ApiValidationTotals | undefined,
  fallback: InvoiceTotalsDraft
): InvoiceTotalsDraft {
  if (!totals) {
    return fallback;
  }

  return {
    lineExtensionAmount: toMoney(totals.lineExtensionAmount),
    taxExclusiveAmount: toMoney(totals.taxExclusiveAmount),
    taxAmount: toMoney(totals.taxAmount),
    taxInclusiveAmount: toMoney(totals.taxInclusiveAmount),
    payableAmount: toMoney(totals.payableAmount)
  };
}

function toMoney(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value.toFixed(2);
}

function cleanDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [first, ...rest] = cleaned.split(".");

  return rest.length === 0 ? first : `${first}.${rest.join("")}`;
}

function buildSavedValidationRun(
  draft: InvoiceEditorDraft,
  report: LocalValidationReport
): SavedValidationRun {
  const confidence =
    report.countrySimulationStatus === "review_required" ||
    report.vidaReadinessStatus === "relevant_simulation"
      ? "educational_simulation"
      : "technical_preview";

  return {
    id: report.id,
    invoiceNumber: draft.document.number || "Untitled invoice",
    buyer: draft.buyer.name || "Unknown buyer",
    seller: draft.seller.name || "Unknown seller",
    createdAt: formatDateTime(new Date(report.createdAt)),
    technicalStatus: report.technicalStatus,
    standardStatus: report.standardStatus,
    countrySimulationStatus: report.countrySimulationStatus,
    vidaReadinessStatus: report.vidaReadinessStatus,
    confidence,
    profile: draft.document.profile,
    currency: draft.document.currency,
    totals: report.totals,
    findings: report.findings,
    disclaimer: report.disclaimer
  };
}

function readStoredValidationRuns() {
  if (typeof window === "undefined") {
    return [] as SavedValidationRun[];
  }

  const storedValue = window.localStorage.getItem(VALIDATION_RUN_STORAGE_KEY);

  if (!storedValue) {
    return [] as SavedValidationRun[];
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return [] as SavedValidationRun[];
    }

    return parsed as SavedValidationRun[];
  } catch {
    return [] as SavedValidationRun[];
  }
}

function saveValidationRunToHistory(run: SavedValidationRun) {
  if (typeof window === "undefined") {
    return;
  }

  const currentRuns = readStoredValidationRuns();
  const nextRuns = [
    run,
    ...currentRuns.filter((existingRun) => existingRun.id !== run.id)
  ].slice(0, 25);

  window.localStorage.setItem(
    VALIDATION_RUN_STORAGE_KEY,
    JSON.stringify(nextRuns)
  );
}

function formatDateTime(date: Date) {
  return date
    .toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace("T", " ");
}

function buildApiErrorReport({
  draft,
  totals,
  code,
  message
}: {
  draft: InvoiceEditorDraft;
  totals: InvoiceTotalsDraft;
  code: string;
  message: string;
}): LocalValidationReport {
  const isCrossBorder = draft.seller.country !== draft.buyer.country;

  return {
    id: `api_error_${Date.now()}`,
    createdAt: new Date().toISOString(),
    technicalStatus: "failed",
    standardStatus: "warning",
    countrySimulationStatus: isCrossBorder ? "review_required" : "not_relevant",
    vidaReadinessStatus: isCrossBorder ? "relevant_simulation" : "not_relevant",
    totals,
    findings: [
      {
        code,
        severity: "fatal",
        message
      }
    ],
    disclaimer:
      "The local API validation request did not complete successfully. This is not legal, tax, accounting, Peppol, EN 16931, ViDA, government, or authority validation."
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function extractApiError(data: unknown) {
  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return {
      code: "API_ERROR",
      message: "The API returned an unexpected error response."
    };
  }

  const code = getStringField(data.error, "code") || "API_ERROR";
  const message =
    getStringField(data.error, "message") ||
    "The API returned an error response.";

  const details = data.error.details;

  if (!Array.isArray(details)) {
    return { code, message };
  }

  const detailText = details
    .map((item) => {
      if (!isPlainObject(item)) {
        return "";
      }

      const path = getStringField(item, "path");
      const detailMessage = getStringField(item, "message");

      if (!path && !detailMessage) {
        return "";
      }

      return path ? `${path}: ${detailMessage}` : detailMessage;
    })
    .filter(Boolean)
    .join(" ");

  return {
    code,
    message: detailText ? `${message} ${detailText}` : message
  };
}

function buildUblPreview(draft: InvoiceEditorDraft, totals: InvoiceTotalsDraft) {
  return `<Invoice>
  <ID>${escapeXml(draft.document.number)}</ID>
  <IssueDate>${escapeXml(draft.document.issueDate)}</IssueDate>
  <DueDate>${escapeXml(draft.document.dueDate)}</DueDate>
  <DocumentCurrencyCode>${escapeXml(draft.document.currency)}</DocumentCurrencyCode>
  <BuyerReference>${escapeXml(draft.document.buyerReference)}</BuyerReference>

  <AccountingSupplierParty>
    <PartyName>${escapeXml(draft.seller.name)}</PartyName>
    <CompanyID>${escapeXml(draft.seller.vatId)}</CompanyID>
    <Country>${escapeXml(draft.seller.country)}</Country>
  </AccountingSupplierParty>

  <AccountingCustomerParty>
    <PartyName>${escapeXml(draft.buyer.name)}</PartyName>
    <CompanyID>${escapeXml(draft.buyer.vatId)}</CompanyID>
    <Country>${escapeXml(draft.buyer.country)}</Country>
  </AccountingCustomerParty>

  <LegalMonetaryTotal>
    <LineExtensionAmount>${totals.lineExtensionAmount}</LineExtensionAmount>
    <TaxExclusiveAmount>${totals.taxExclusiveAmount}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${totals.taxInclusiveAmount}</TaxInclusiveAmount>
    <PayableAmount>${totals.payableAmount}</PayableAmount>
  </LegalMonetaryTotal>
</Invoice>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
