"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import {
  CalendarDays,
  FileInput,
  ReceiptText,
  Rows3,
  Send,
  Trash2,
  UserRoundCheck
} from "lucide-react";
import { invoiceDrafts, invoiceStages } from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

type InvoiceListSource = "api" | "demo";

type InvoiceListItem = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: string;
  amount: string;
  source: InvoiceListSource;
};

type ApiInvoiceDraftSummary = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: string;
  amount: string;
  currency?: string;
  updatedAt?: string;
};

type ApiInvoiceDraftListResponse = {
  records?: ApiInvoiceDraftSummary[];
};

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

function getInvoiceIcon(iconKey: WorkspaceIconKey) {
  const icons: Record<string, ReactNode> = {
    sellerBuyer: <UserRoundCheck size={22} />,
    lineItems: <Rows3 size={22} />,
    totals: <ReceiptText size={22} />,
    export: <Send size={22} />
  };

  return icons[iconKey] ?? <FileInput size={22} />;
}

function formatCurrencyAmount(value: number) {
  const formatted = new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  return `EUR ${formatted}`;
}

function formatAmount(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().replaceAll(String.fromCharCode(8364), "EUR ");
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return formatCurrencyAmount(value);
  }

  return "EUR 0.00";
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function buildFallbackInvoiceId(record: Record<string, unknown>) {
  const number = readStringField(record, "number", "draft");
  const buyer = readStringField(record, "buyer", "buyer");
  const issueDate = readStringField(record, "issueDate", "date");

  return `${number}-${buyer}-${issueDate}`.replaceAll(/\s+/g, "-").toLowerCase();
}

function normalizeInvoiceDraft(value: unknown): InvoiceListItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const number =
    readStringField(record, "number", "") ||
    readStringField(record, "invoiceNumber", "") ||
    "Draft invoice";

  const buyer =
    readStringField(record, "buyer", "") ||
    readStringField(record, "buyerName", "") ||
    "Unknown buyer";

  const issueDate = readStringField(
    record,
    "issueDate",
    new Date().toISOString().slice(0, 10)
  );

  return {
    id: readStringField(record, "id", buildFallbackInvoiceId(record)),
    number,
    buyer,
    buyerCountry: readStringField(record, "buyerCountry", "EU"),
    issueDate,
    status: readStringField(record, "status", "Draft"),
    amount: formatAmount(record.amount ?? record.payableAmount),
    source: "api"
  };
}

function getDemoInvoices(): InvoiceListItem[] {
  return invoiceDrafts.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    buyer: invoice.buyer,
    buyerCountry: invoice.buyerCountry,
    issueDate: invoice.issueDate,
    status: invoice.status,
    amount: formatAmount(invoice.amount),
    source: "demo"
  }));
}

function uniqueInvoices(invoices: InvoiceListItem[]) {
  const seen = new Set<string>();

  return invoices.filter((invoice) => {
    const key = `${invoice.source}:${invoice.id}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getInvoiceHref(invoice: InvoiceListItem) {
  if (invoice.source === "api") {
    return `/workspace/invoices/${encodeURIComponent(invoice.id)}`;
  }

  return "/workspace/invoices/new";
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

function getApiErrorMessage(data: unknown, status: number) {
  if (typeof data === "string" && data.trim().length > 0) {
    return `Could not delete invoice draft. Status ${status}: ${data.slice(0, 220)}`;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return `Could not delete invoice draft. Status ${status}.`;
  }

  const payload = data as ApiErrorShape;
  const message = payload.error?.message;
  const code = payload.error?.code;

  if (typeof message === "string" && message.trim().length > 0) {
    return code ? `${message} (${code})` : message;
  }

  return `Could not delete invoice draft. Status ${status}.`;
}

export default function WorkspaceInvoicesPage() {
  const router = useRouter();

  const [apiInvoices, setApiInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceLoadMessage, setInvoiceLoadMessage] = useState("");
  const [useDemoFallback, setUseDemoFallback] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceDrafts() {
      setIsLoadingInvoices(true);
      setInvoiceLoadMessage("");
      setUseDemoFallback(false);

      try {
        const response = await fetch("/api/local/invoices/drafts", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setApiInvoices([]);
            setUseDemoFallback(true);
            setInvoiceLoadMessage(
              getApiErrorMessage(responseData, response.status).replace(
                "delete invoice draft",
                "load invoice drafts"
              )
            );
          }

          return;
        }

        const apiData = responseData as ApiInvoiceDraftListResponse;
        const records = Array.isArray(apiData?.records) ? apiData.records : [];

        const normalizedInvoices = records
          .map((item) => normalizeInvoiceDraft(item))
          .filter((item): item is InvoiceListItem => item !== null);

        if (isMounted) {
          setApiInvoices(normalizedInvoices);
          setUseDemoFallback(normalizedInvoices.length === 0);

          if (normalizedInvoices.length === 0) {
            setInvoiceLoadMessage(
              "No API-owned invoice drafts are saved yet. Showing demo drafts for local development."
            );
          }
        }
      } catch {
        if (isMounted) {
          setApiInvoices([]);
          setUseDemoFallback(true);
          setInvoiceLoadMessage(
            "The local invoice draft API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingInvoices(false);
        }
      }
    }

    loadInvoiceDrafts();

    return () => {
      isMounted = false;
    };
  }, []);

  const tableInvoices = useMemo(() => {
    return uniqueInvoices(useDemoFallback ? getDemoInvoices() : apiInvoices);
  }, [apiInvoices, useDemoFallback]);

  async function deleteInvoiceDraft(
    event: MouseEvent<HTMLButtonElement>,
    invoice: InvoiceListItem
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (invoice.source !== "api") {
      return;
    }

    setDeletingDraftId(invoice.id);
    setInvoiceLoadMessage("");

    try {
      const response = await fetch(
        `/api/local/invoices/drafts/${encodeURIComponent(invoice.id)}`,
        {
          method: "DELETE",
          cache: "no-store"
        }
      );

      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setInvoiceLoadMessage(getApiErrorMessage(responseData, response.status));
        return;
      }

      setApiInvoices((currentInvoices) => {
        const nextInvoices = currentInvoices.filter((item) => item.id !== invoice.id);

        if (nextInvoices.length === 0) {
          setUseDemoFallback(true);
          setInvoiceLoadMessage(
            "No API-owned invoice drafts are saved now. Showing demo drafts for local development."
          );
        }

        return nextInvoices;
      });
    } catch {
      setInvoiceLoadMessage(
        "Could not delete invoice draft. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setDeletingDraftId("");
    }
  }

  function openInvoice(invoice: InvoiceListItem) {
    router.push(getInvoiceHref(invoice));
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    invoice: InvoiceListItem
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openInvoice(invoice);
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Invoice Studio</p>
        <h2>Create structured invoice data before validation.</h2>
        <p>
          This screen reads invoice draft summaries through the local Next.js
          proxy from the dedicated Invoice Lantern API service. Demo drafts only
          appear when the API is unavailable or no saved API drafts exist.
        </p>
      </section>

      <section className="workspace-step-grid">
        {invoiceStages.map((item) => (
          <div className="workspace-step" key={item.title}>
            <div>{getInvoiceIcon(item.iconKey)}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Recent invoice drafts</p>
            <h3>Structured invoice queue</h3>
          </div>

          <Link href="/workspace/invoices/new" className="text-link-button">
            <FileInput size={16} />
            New invoice
          </Link>
        </div>

        {invoiceLoadMessage ? (
          <div className="alert-item">
            <span />
            <p>{invoiceLoadMessage}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoadingInvoices ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading invoice drafts</strong>
                <span>Reading records from the local API proxy.</span>
              </div>

              <div>
                <CalendarDays size={15} />
                <span>pending</span>
              </div>

              <div>
                <span className="status-pill">loading</span>
              </div>

              <strong>API</strong>
            </div>
          ) : (
            tableInvoices.map((invoice) => (
              <div
                className="workspace-table-row invoice-click-row"
                key={`${invoice.source}-${invoice.id}`}
                role="button"
                tabIndex={0}
                onClick={() => openInvoice(invoice)}
                onKeyDown={(event) => handleRowKeyDown(event, invoice)}
              >
                <div>
                  <strong>{invoice.number}</strong>
                  <span>
                    {invoice.buyer} - {invoice.buyerCountry}
                  </span>

                  {invoice.source === "api" ? (
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={(event) => deleteInvoiceDraft(event, invoice)}
                      disabled={deletingDraftId === invoice.id}
                      style={{
                        marginTop: "10px",
                        width: "fit-content",
                        padding: "8px 12px"
                      }}
                    >
                      <Trash2 size={16} />
                      {deletingDraftId === invoice.id ? "Deleting..." : "Delete draft"}
                    </button>
                  ) : (
                    <span style={{ marginTop: "8px" }}>Demo row opens a new draft.</span>
                  )}
                </div>

                <div>
                  <CalendarDays size={15} />
                  <span>{invoice.issueDate}</span>
                </div>

                <div>
                  <span className="status-pill">
                    {invoice.source === "api" ? invoice.status : "demo"}
                  </span>
                </div>

                <strong>{invoice.amount}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
