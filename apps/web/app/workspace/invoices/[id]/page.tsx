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

          {exportMessage ? (
            <div className="alert-item">
              <span />
              <p>{exportMessage}</p>
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
        </section>

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
