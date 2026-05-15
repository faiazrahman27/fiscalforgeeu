"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import type { InvoiceEditorDraft } from "../../../../lib/types";
import { InvoiceEditorClient } from "../new/invoice-editor-client";

type ApiInvoiceDraftDetailResponse = {
  record?: InvoiceEditorDraft;
};

type ProductionInvoiceDetail = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  currency: string;
  buyerName: string;
  buyerCountry: string;
  sellerName: string;
  sellerCountry: string;
  legalDisclaimer: string;
  legalConfidence: string;
};

type ProductionInvoiceExportMetadata = {
  filename: string;
  contentType: string;
  xmlSha256: string;
  xmlSizeBytes: number | null;
  readinessStatus: string;
  disclaimer: string;
};

type ProductionInvoiceVidaSimulation = {
  simulationRunId: string | null;
  transactionClass: string;
  vidaRelevance: string;
  readinessScore: number | null;
  readinessStatus: string;
  disclaimer: string;
};

type ProductionInvoiceLifecycleEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  actorLabel: string;
  reason: string | null;
  metadataSummary: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInvoiceEditorDraft(value: unknown): value is InvoiceEditorDraft {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isPlainObject(value.document) &&
    isPlainObject(value.seller) &&
    isPlainObject(value.buyer) &&
    Array.isArray(value.lines)
  );
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

function readNullableNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeProductionInvoice(value: unknown): ProductionInvoiceDetail | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const invoiceNumber = readStringField(value, "invoiceNumber");
  const issueDate = readStringField(value, "issueDate");
  const canonicalJson = isPlainObject(value.canonicalJson)
    ? value.canonicalJson
    : {};
  const seller = isPlainObject(canonicalJson.seller) ? canonicalJson.seller : {};
  const buyer = isPlainObject(canonicalJson.buyer) ? canonicalJson.buyer : {};

  if (!id || !invoiceNumber || !issueDate) {
    return null;
  }

  return {
    id,
    invoiceNumber,
    status: readStringField(value, "status", "draft"),
    issueDate,
    currency: readStringField(value, "currency", "EUR"),
    buyerName: readStringField(buyer, "name", "Not recorded"),
    buyerCountry: readStringField(buyer, "country", "Not provided"),
    sellerName: readStringField(seller, "name", "Not recorded"),
    sellerCountry: readStringField(seller, "country", "Not provided"),
    legalDisclaimer: readStringField(value, "legalDisclaimer"),
    legalConfidence: readStringField(value, "legalConfidence", "technical")
  };
}

function normalizeExportMetadata(
  value: unknown
): ProductionInvoiceExportMetadata | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const metadata = isPlainObject(value.metadata) ? value.metadata : value;
  const filename = readStringField(metadata, "filename");
  const contentType = readStringField(metadata, "contentType");
  const xmlSha256 = readStringField(metadata, "xmlSha256");

  if (!filename || !contentType || !xmlSha256) {
    return null;
  }

  return {
    filename,
    contentType,
    xmlSha256,
    xmlSizeBytes: readNullableNumberField(metadata, "xmlSizeBytes"),
    readinessStatus: readStringField(value, "readinessStatus", "generated"),
    disclaimer: readStringField(value, "disclaimer")
  };
}

function normalizeVidaSimulation(
  value: unknown
): ProductionInvoiceVidaSimulation | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const transactionClass = readStringField(value, "transactionClass");
  const vidaRelevance = readStringField(value, "vidaRelevance");
  const readinessStatus = readStringField(value, "readinessStatus");

  if (!transactionClass || !vidaRelevance || !readinessStatus) {
    return null;
  }

  return {
    simulationRunId: readStringField(value, "simulationRunId") || null,
    transactionClass,
    vidaRelevance,
    readinessScore: readNullableNumberField(value, "readinessScore"),
    readinessStatus,
    disclaimer: readStringField(value, "disclaimer")
  };
}

function normalizeLifecycleEvent(
  value: unknown
): ProductionInvoiceLifecycleEvent | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const createdAt = readStringField(value, "createdAt");
  const toStatus = readStringField(value, "toStatus");
  const fromStatus = readStringField(value, "fromStatus");

  if (!id || !createdAt || !toStatus) {
    return null;
  }

  return {
    id,
    eventType: fromStatus ? `${fromStatus} to ${toStatus}` : `created as ${toStatus}`,
    createdAt,
    actorLabel: buildLifecycleActorLabel(value),
    reason: readNullableStringField(value, "reason"),
    metadataSummary: summarizeLifecycleMetadata(value.metadata)
  };
}

function buildLifecycleActorLabel(record: Record<string, unknown>) {
  const actorUserId = readNullableStringField(record, "actorUserId");
  const actorApiKeyId = readNullableStringField(record, "actorApiKeyId");

  if (actorUserId) {
    return `Signed user ${actorUserId.slice(0, 8)}`;
  }

  if (actorApiKeyId) {
    return "API key event";
  }

  return "System event";
}

function summarizeLifecycleMetadata(value: unknown) {
  if (!isPlainObject(value)) {
    return null;
  }

  const safeParts = [
    readNullableStringField(value, "source")
      ? `Source: ${readNullableStringField(value, "source")}`
      : "",
    readNullableStringField(value, "note"),
    readNullableStringField(value, "legalBoundary")
  ].filter((part): part is string => Boolean(part));

  return safeParts.length > 0 ? safeParts.join(". ").slice(0, 360) : null;
}

function getRecordsFromResponse(value: unknown) {
  if (!isPlainObject(value) || !Array.isArray(value.records)) {
    return [];
  }

  return value.records;
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

function getApiErrorMessage(data: unknown) {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return "Could not load this invoice draft.";
  }

  const error = data.error;

  if (!isPlainObject(error)) {
    return "Could not load this invoice draft.";
  }

  const message = error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : "Could not load this invoice draft.";
}

export default function ExistingInvoiceDraftPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [draftId, setDraftId] = useState("");
  const [draft, setDraft] = useState<InvoiceEditorDraft | null>(null);
  const [productionInvoice, setProductionInvoice] =
    useState<ProductionInvoiceDetail | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [isExportingUbl, setIsExportingUbl] = useState(false);
  const [exportMetadata, setExportMetadata] =
    useState<ProductionInvoiceExportMetadata | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [isRunningVidaSimulation, setIsRunningVidaSimulation] = useState(false);
  const [vidaSimulation, setVidaSimulation] =
    useState<ProductionInvoiceVidaSimulation | null>(null);
  const [vidaSimulationMessage, setVidaSimulationMessage] = useState("");
  const [lifecycleEvents, setLifecycleEvents] = useState<
    ProductionInvoiceLifecycleEvent[]
  >([]);
  const [lifecycleEventsMessage, setLifecycleEventsMessage] = useState("");
  const [isLoadingLifecycleEvents, setIsLoadingLifecycleEvents] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState("ready_for_review");
  const [transitionReason, setTransitionReason] = useState("");
  const [isTransitioningStatus, setIsTransitioningStatus] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadParamsAndDraft() {
      setIsLoadingDraft(true);
      setLoadMessage("");

      try {
        const resolvedParams = await params;
        const resolvedDraftId = resolvedParams.id;

        if (!isMounted) {
          return;
        }

        setDraftId(resolvedDraftId);

        const response = await fetch(
          `/api/local/invoices/drafts/${encodeURIComponent(resolvedDraftId)}`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          const productionResponse = await fetch(
            `/api/local/invoices/${encodeURIComponent(resolvedDraftId)}`,
            {
              method: "GET",
              cache: "no-store"
            }
          );
          const productionData = await readResponseBody(productionResponse);

          if (productionResponse.ok) {
            const productionPayload = isPlainObject(productionData)
              ? productionData.record
              : null;
            const normalizedProductionInvoice =
              normalizeProductionInvoice(productionPayload);

            if (normalizedProductionInvoice && isMounted) {
              setDraft(null);
              setProductionInvoice(normalizedProductionInvoice);
              return;
            }
          }

          if (isMounted) {
            setDraft(null);
            setProductionInvoice(null);
            setLoadMessage(
              getApiErrorMessage(productionResponse.ok ? productionData : responseData)
            );
          }

          return;
        }

        const payload = responseData as ApiInvoiceDraftDetailResponse;

        if (!isInvoiceEditorDraft(payload.record)) {
          if (isMounted) {
            setDraft(null);
            setLoadMessage(
              "The API returned an unreadable invoice draft record."
            );
          }

          return;
        }

        if (isMounted) {
          setDraft(payload.record);
          setProductionInvoice(null);
        }
      } catch {
        if (isMounted) {
          setDraft(null);
          setProductionInvoice(null);
          setLoadMessage(
            "The local invoice draft API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingDraft(false);
        }
      }
    }

    loadParamsAndDraft();

    return () => {
      isMounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!productionInvoice) {
      setLifecycleEvents([]);
      setLifecycleEventsMessage("");
      return;
    }

    setTransitionTarget(productionInvoice.status);
    void loadLifecycleEvents(productionInvoice.id);
  }, [productionInvoice?.id, productionInvoice?.status]);

  async function loadLifecycleEvents(invoiceId: string) {
    setIsLoadingLifecycleEvents(true);
    setLifecycleEventsMessage("");

    try {
      const response = await fetch(
        `/api/local/invoices/${encodeURIComponent(invoiceId)}/lifecycle-events`,
        {
          method: "GET",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setLifecycleEvents([]);
        setLifecycleEventsMessage(getApiErrorMessage(responseData));
        return;
      }

      setLifecycleEvents(
        getRecordsFromResponse(responseData)
          .map((record) => normalizeLifecycleEvent(record))
          .filter(
            (record): record is ProductionInvoiceLifecycleEvent =>
              record !== null
          )
      );
    } catch {
      setLifecycleEvents([]);
      setLifecycleEventsMessage(
        "Could not load lifecycle events through the local API proxy."
      );
    } finally {
      setIsLoadingLifecycleEvents(false);
    }
  }

  async function exportProductionUbl() {
    if (!productionInvoice) {
      return;
    }

    setIsExportingUbl(true);
    setExportMessage("");
    setExportMetadata(null);

    try {
      const response = await fetch(
        `/api/local/invoices/${encodeURIComponent(productionInvoice.id)}/export/ubl`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({}),
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setExportMessage(getApiErrorMessage(responseData));
        return;
      }

      const metadata = normalizeExportMetadata(responseData);

      if (!metadata) {
        setExportMessage("The UBL export metadata could not be read safely.");
        return;
      }

      setExportMetadata(metadata);
      setExportMessage("Technical UBL export generated.");
    } catch {
      setExportMessage(
        "Could not export production invoice UBL through the local API proxy."
      );
    } finally {
      setIsExportingUbl(false);
    }
  }

  async function runProductionInvoiceVidaSimulation() {
    if (!productionInvoice) {
      return;
    }

    setIsRunningVidaSimulation(true);
    setVidaSimulationMessage("");
    setVidaSimulation(null);

    try {
      const response = await fetch(
        `/api/local/invoices/${encodeURIComponent(
          productionInvoice.id
        )}/simulate-vida`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            buyerType: "business",
            transactionType: "unknown",
            structuredInvoiceSignals: {
              hasCanonicalInvoice: true,
              hasUblXml: false,
              xsdStatus: "not_checked",
              schematronPeppolStatus: "not_checked",
              schematronEn16931Status: "not_checked"
            }
          }),
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setVidaSimulationMessage(getApiErrorMessage(responseData));
        return;
      }

      const normalizedSimulation = normalizeVidaSimulation(responseData);

      if (!normalizedSimulation) {
        setVidaSimulationMessage(
          "The ViDA-readiness simulation result could not be read safely."
        );
        return;
      }

      setVidaSimulation(normalizedSimulation);
      setVidaSimulationMessage(
        "ViDA-readiness simulation saved without changing invoice lifecycle status."
      );
    } catch {
      setVidaSimulationMessage(
        "Could not run production invoice ViDA-readiness simulation through the local API proxy."
      );
    } finally {
      setIsRunningVidaSimulation(false);
    }
  }

  async function transitionProductionInvoiceStatus() {
    if (!productionInvoice || transitionTarget === productionInvoice.status) {
      return;
    }

    setIsTransitioningStatus(true);
    setTransitionMessage("");

    try {
      const response = await fetch(
        `/api/local/invoices/${encodeURIComponent(productionInvoice.id)}/transition`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            toStatus: transitionTarget,
            reason:
              transitionReason.trim() ||
              "Manual internal lifecycle transition from workspace detail page."
          }),
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setTransitionMessage(getApiErrorMessage(responseData));
        return;
      }

      const record = isPlainObject(responseData)
        ? normalizeProductionInvoice(responseData.record)
        : null;

      if (!record) {
        setTransitionMessage("The transition response could not be read safely.");
        return;
      }

      setProductionInvoice(record);
      setTransitionReason("");
      setTransitionMessage(
        "Internal invoice lifecycle status updated. This is not official filing or authority acceptance."
      );
      await loadLifecycleEvents(record.id);
    } catch {
      setTransitionMessage(
        "Could not transition invoice status through the local API proxy."
      );
    } finally {
      setIsTransitioningStatus(false);
    }
  }

  if (isLoadingDraft) {
    return (
      <div className="workspace-page">
        <section className="workspace-page-head">
          <Link href="/workspace/invoices" className="back-link">
            <ArrowLeft size={17} />
            Invoices
          </Link>

          <p className="workspace-kicker">Invoice Editor</p>
          <h2>Loading saved invoice draft.</h2>
          <p>Reading the draft through the local Next.js API proxy.</p>
        </section>

        <section className="workspace-table-shell">
          <div className="workspace-table">
            <div className="workspace-table-row">
              <div>
                <strong>Loading draft</strong>
                <span>{draftId || "Resolving draft ID..."}</span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <div>
                <span>API</span>
              </div>

              <strong>pending</strong>

              <FileText size={17} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (productionInvoice) {
    return (
      <div className="workspace-page">
        <section className="workspace-page-head">
          <Link href="/workspace/invoices" className="back-link">
            <ArrowLeft size={17} />
            Invoices
          </Link>

          <p className="workspace-kicker">Production Invoice</p>
          <h2>{productionInvoice.invoiceNumber}</h2>
          <p>
            This is a production invoice lifecycle record. Status values,
            including issued, are internal Invoice Lantern workflow states only
            and do not mean authority acceptance, official filing, or legal/tax
            compliance.
          </p>
        </section>

        <section className="workspace-alerts">
          <div className="alerts-head">
            <ShieldAlert size={22} />

            <div>
              <p>Lifecycle boundary</p>
              <h3>Internal invoice state only.</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>
                Production invoice records preserve canonical invoice data and
                validation/export metadata. They are not official filing records
                and do not replace professional review.
              </p>
            </div>
          </div>
        </section>

        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Invoice detail</p>
              <h3>Lifecycle summary</h3>
            </div>

            <div className="workspace-row-actions">
              <button
                className="text-link-button"
                disabled={isRunningVidaSimulation}
                onClick={runProductionInvoiceVidaSimulation}
                type="button"
              >
                <ShieldAlert size={16} />
                {isRunningVidaSimulation
                  ? "Running simulation"
                  : "Run ViDA readiness simulation"}
              </button>

              <button
                className="text-link-button"
                disabled={isExportingUbl}
                onClick={exportProductionUbl}
                type="button"
              >
                <FileText size={16} />
                {isExportingUbl ? "Exporting" : "Export UBL"}
              </button>
            </div>
          </div>

          {exportMessage ? (
            <div className="alert-item">
              <span />
              <p>{exportMessage}</p>
            </div>
          ) : null}

          {vidaSimulationMessage ? (
            <div className="alert-item">
              <span />
              <p>{vidaSimulationMessage}</p>
            </div>
          ) : null}

          <div className="workspace-table">
            <div className="workspace-table-row">
              <div>
                <strong>{productionInvoice.invoiceNumber}</strong>
                <span>
                  Seller: {productionInvoice.sellerName} -{" "}
                  {productionInvoice.sellerCountry}
                </span>
                <span>
                  Buyer: {productionInvoice.buyerName} -{" "}
                  {productionInvoice.buyerCountry}
                </span>
              </div>

              <div>
                <span className="status-pill">{productionInvoice.status}</span>
              </div>

              <div>
                <span>{productionInvoice.issueDate}</span>
              </div>

              <strong>{productionInvoice.currency}</strong>

              <FileText size={17} />
            </div>
          </div>

          <form
            className="workspace-form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void transitionProductionInvoiceStatus();
            }}
            style={{ marginTop: "1rem" }}
          >
            <label>
              <span>Internal lifecycle status</span>
              <select
                value={transitionTarget}
                onChange={(event) => setTransitionTarget(event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="ready_for_review">Ready for review</option>
                <option value="validated">Validated</option>
                <option value="issued">Issued internal state</option>
                <option value="archived">Archived</option>
                <option value="voided">Voided</option>
              </select>
            </label>

            <label>
              <span>Reason</span>
              <input
                value={transitionReason}
                onChange={(event) => setTransitionReason(event.target.value)}
                placeholder="Internal workflow reason"
              />
            </label>

            <button
              type="submit"
              className="workspace-auth-action"
              disabled={
                isTransitioningStatus ||
                transitionTarget === productionInvoice.status
              }
            >
              {isTransitioningStatus ? "Updating" : "Update internal status"}
            </button>
          </form>

          {transitionMessage ? (
            <div className="alert-item">
              <span />
              <p>{transitionMessage}</p>
            </div>
          ) : null}
        </section>

        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Lifecycle events</p>
              <h3>Internal workflow history</h3>
            </div>

            <span className="status-pill">not official filing</span>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Lifecycle events are internal Invoice Lantern workflow states only.
              They do not mean official submission, authority acceptance, Peppol
              delivery, legal validity, tax compliance, or accounting compliance.
            </p>
          </div>

          {lifecycleEventsMessage ? (
            <div className="alert-item">
              <span />
              <p>{lifecycleEventsMessage}</p>
            </div>
          ) : null}

          <div className="workspace-table">
            {isLoadingLifecycleEvents ? (
              <div className="workspace-table-row">
                <div>
                  <strong>Loading lifecycle events</strong>
                  <span>Reading event records through the local proxy.</span>
                </div>
                <div>
                  <span className="status-pill">loading</span>
                </div>
                <div>
                  <span>events</span>
                </div>
                <strong>pending</strong>
                <FileText size={17} />
              </div>
            ) : lifecycleEvents.length === 0 ? (
              <div className="workspace-table-row">
                <div>
                  <strong>No lifecycle events returned</strong>
                  <span>
                    Event history may be unavailable until production invoice
                    lifecycle logging is configured.
                  </span>
                </div>
                <div>
                  <span className="status-pill">empty</span>
                </div>
                <div>
                  <span>events</span>
                </div>
                <strong>0</strong>
                <FileText size={17} />
              </div>
            ) : (
              lifecycleEvents.map((event) => (
                <div className="workspace-table-row" key={event.id}>
                  <div>
                    <strong>{event.eventType}</strong>
                    <span>{event.actorLabel}</span>
                    {event.reason ? <span>Reason: {event.reason}</span> : null}
                    {event.metadataSummary ? (
                      <span>{event.metadataSummary}</span>
                    ) : null}
                  </div>
                  <div>
                    <span className="status-pill">internal</span>
                  </div>
                  <div>
                    <span>{formatDateTime(event.createdAt)}</span>
                  </div>
                  <strong>event</strong>
                  <FileText size={17} />
                </div>
              ))
            )}
          </div>
        </section>

        {vidaSimulation ? (
          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>ViDA readiness simulation</p>
                <h3>Saved technical readiness result</h3>
              </div>

              {vidaSimulation.simulationRunId ? (
                <Link
                  className="text-link-button"
                  href={`/workspace/vida-simulator/${encodeURIComponent(
                    vidaSimulation.simulationRunId
                  )}`}
                >
                  <FileText size={16} />
                  Open result
                </Link>
              ) : null}
            </div>

            <div className="workspace-data-grid">
              <article className="workspace-data-card">
                <span>Transaction class</span>
                <strong>{vidaSimulation.transactionClass}</strong>
                <p>Readiness context only.</p>
              </article>

              <article className="workspace-data-card">
                <span>Readiness</span>
                <strong>{vidaSimulation.readinessStatus}</strong>
                <p>Score: {vidaSimulation.readinessScore ?? "not available"}</p>
              </article>

              <article className="workspace-data-card">
                <span>ViDA relevance</span>
                <strong>{vidaSimulation.vidaRelevance}</strong>
                <p>Not official filing or a legal conclusion.</p>
              </article>
            </div>

            <div className="alert-item">
              <span />
              <p>
                {vidaSimulation.disclaimer ||
                  "This ViDA-readiness simulation is educational and technical only. It is not legal, tax, or accounting advice and not official filing."}
              </p>
            </div>
          </section>
        ) : null}

        {exportMetadata ? (
          <section className="workspace-table-shell">
            <div className="workspace-table-head">
              <div>
                <p>Export metadata</p>
                <h3>Technical UBL output</h3>
              </div>
            </div>

            <div className="workspace-data-grid">
              <article className="workspace-data-card">
                <span>Filename</span>
                <strong>{exportMetadata.filename}</strong>
                <p>{exportMetadata.contentType}</p>
              </article>

              <article className="workspace-data-card">
                <span>XML SHA-256</span>
                <strong>{exportMetadata.xmlSha256.slice(0, 16)}...</strong>
                <p>
                  Size:{" "}
                  {exportMetadata.xmlSizeBytes === null
                    ? "not recorded"
                    : `${exportMetadata.xmlSizeBytes} bytes`}
                </p>
              </article>

              <article className="workspace-data-card">
                <span>Readiness</span>
                <strong>{exportMetadata.readinessStatus}</strong>
                <p>
                  XSD, Schematron, UBL export, and lifecycle status remain
                  technical only and are not certification or authority
                  acceptance.
                </p>
              </article>
            </div>

            {exportMetadata.disclaimer ? (
              <div className="alert-item">
                <span />
                <p>{exportMetadata.disclaimer}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="workspace-page">
        <section className="workspace-page-head">
          <Link href="/workspace/invoices" className="back-link">
            <ArrowLeft size={17} />
            Invoices
          </Link>

          <p className="workspace-kicker">Invoice Editor</p>
          <h2>Could not open this invoice draft.</h2>
          <p>
            The requested API-owned draft could not be loaded from the local
            Invoice Lantern API service. No demo draft is shown here.
          </p>
        </section>

        <section className="workspace-alerts">
          <div className="alerts-head">
            <ShieldAlert size={22} />

            <div>
              <p>Draft loading issue</p>
              <h3>Saved draft unavailable.</h3>
            </div>
          </div>

          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>{loadMessage || "Invoice draft was not found."}</p>
            </div>

            <div className="alert-item">
              <span />
              <p>
                You can go back to the invoice queue or create a new API-owned
                invoice draft.
              </p>
            </div>
          </div>
        </section>

        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Recovery actions</p>
              <h3>Continue editing</h3>
            </div>
          </div>

          <div className="workspace-table">
            <Link
              href="/workspace/invoices/new"
              className="workspace-table-row invoice-click-row"
            >
              <div>
                <strong>Create a new invoice</strong>
                <span>Open the editor and save a new API-owned draft.</span>
              </div>

              <div>
                <span className="status-pill">new</span>
              </div>

              <div>
                <span>editor</span>
              </div>

              <strong>open</strong>

              <FileText size={17} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <InvoiceEditorClient
      initialDraft={draft}
      loadStoredDraft={false}
      draftId={draftId}
    />
  );
}
