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
import { invoiceStages } from "../../../lib/mock-data";
import type { WorkspaceIconKey } from "../../../lib/types";

type InvoiceListItem = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: string;
  amount: string;
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

type ProductionInvoiceListItem = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: string;
  currency: string;
  payableAmount: string;
};

type ApiProductionInvoiceListResponse = {
  records?: unknown[];
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

  return "Not calculated";
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "";
}

function normalizeInvoiceDraft(value: unknown): InvoiceListItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const id = readStringField(record, "id");
  const number =
    readStringField(record, "number") || readStringField(record, "invoiceNumber");
  const buyer = readStringField(record, "buyer") || readStringField(record, "buyerName");
  const issueDate = readStringField(record, "issueDate");

  if (!id || !number || !buyer || !issueDate) {
    return null;
  }

  return {
    id,
    number,
    buyer,
    buyerCountry: readStringField(record, "buyerCountry") || "Not provided",
    issueDate,
    status: readStringField(record, "status") || "Draft",
    amount: formatAmount(record.amount ?? record.payableAmount)
  };
}

function normalizeProductionInvoice(value: unknown): ProductionInvoiceListItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readStringField(record, "id");
  const invoiceNumber = readStringField(record, "invoiceNumber");
  const issueDate = readStringField(record, "issueDate");
  const canonicalJson =
    typeof record.canonicalJson === "object" &&
    record.canonicalJson !== null &&
    !Array.isArray(record.canonicalJson)
      ? (record.canonicalJson as Record<string, unknown>)
      : {};
  const buyer =
    typeof canonicalJson.buyer === "object" &&
    canonicalJson.buyer !== null &&
    !Array.isArray(canonicalJson.buyer)
      ? (canonicalJson.buyer as Record<string, unknown>)
      : {};
  const calculationSummary =
    typeof record.calculationSummary === "object" &&
    record.calculationSummary !== null &&
    !Array.isArray(record.calculationSummary)
      ? (record.calculationSummary as Record<string, unknown>)
      : {};

  if (!id || !invoiceNumber || !issueDate) {
    return null;
  }

  return {
    id,
    invoiceNumber,
    buyer: readStringField(buyer, "name") || "Not recorded",
    buyerCountry: readStringField(buyer, "country") || "Not provided",
    issueDate,
    status: readStringField(record, "status") || "draft",
    currency: readStringField(record, "currency") || "EUR",
    payableAmount: formatAmount(
      calculationSummary.payableAmount ?? calculationSummary.payable_amount
    )
  };
}

function uniqueInvoices(invoices: InvoiceListItem[]) {
  const seen = new Set<string>();

  return invoices.filter((invoice) => {
    if (seen.has(invoice.id)) {
      return false;
    }

    seen.add(invoice.id);
    return true;
  });
}

function getInvoiceHref(invoice: InvoiceListItem) {
  return `/workspace/invoices/${encodeURIComponent(invoice.id)}`;
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
  status: number,
  fallbackAction = "complete invoice draft request"
) {
  if (typeof data === "string" && data.trim().length > 0) {
    return `Could not ${fallbackAction}. Status ${status}: ${data.slice(0, 220)}`;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return `Could not ${fallbackAction}. Status ${status}.`;
  }

  const payload = data as ApiErrorShape;
  const message = payload.error?.message;
  const code = payload.error?.code;

  if (typeof message === "string" && message.trim().length > 0) {
    return code ? `${message} (${code})` : message;
  }

  return `Could not ${fallbackAction}. Status ${status}.`;
}

export default function WorkspaceInvoicesPage() {
  const router = useRouter();

  const [apiInvoices, setApiInvoices] = useState<InvoiceListItem[]>([]);
  const [productionInvoices, setProductionInvoices] = useState<
    ProductionInvoiceListItem[]
  >([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [isLoadingProductionInvoices, setIsLoadingProductionInvoices] =
    useState(true);
  const [invoiceLoadMessage, setInvoiceLoadMessage] = useState("");
  const [productionInvoiceMessage, setProductionInvoiceMessage] = useState("");
  const [deletingDraftId, setDeletingDraftId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceDrafts() {
      setIsLoadingInvoices(true);
      setInvoiceLoadMessage("");

      try {
        const response = await fetch("/api/local/invoices/drafts", {
          method: "GET",
          cache: "no-store"
        });

        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setApiInvoices([]);
            setInvoiceLoadMessage(
              getApiErrorMessage(
                responseData,
                response.status,
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
        }
      } catch {
        if (isMounted) {
          setApiInvoices([]);
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

  useEffect(() => {
    let isMounted = true;

    async function loadProductionInvoices() {
      setIsLoadingProductionInvoices(true);
      setProductionInvoiceMessage("");

      try {
        const response = await fetch("/api/local/invoices", {
          method: "GET",
          cache: "no-store"
        });
        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setProductionInvoices([]);
            setProductionInvoiceMessage(
              getApiErrorMessage(
                responseData,
                response.status,
                "load production invoices"
              )
            );
          }

          return;
        }

        const apiData = responseData as ApiProductionInvoiceListResponse;
        const records = Array.isArray(apiData?.records) ? apiData.records : [];
        const normalizedInvoices = records
          .map((item) => normalizeProductionInvoice(item))
          .filter(
            (item): item is ProductionInvoiceListItem => item !== null
          );

        if (isMounted) {
          setProductionInvoices(normalizedInvoices);
        }
      } catch {
        if (isMounted) {
          setProductionInvoices([]);
          setProductionInvoiceMessage(
            "Production invoices are unavailable through the local API proxy. Signed-in workspace access may be required."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingProductionInvoices(false);
        }
      }
    }

    loadProductionInvoices();

    return () => {
      isMounted = false;
    };
  }, []);

  const tableInvoices = useMemo(() => {
    return uniqueInvoices(apiInvoices);
  }, [apiInvoices]);

  async function deleteInvoiceDraft(
    event: MouseEvent<HTMLButtonElement>,
    invoice: InvoiceListItem
  ) {
    event.preventDefault();
    event.stopPropagation();

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
        setInvoiceLoadMessage(
          getApiErrorMessage(responseData, response.status, "delete invoice draft")
        );
        return;
      }

      setApiInvoices((currentInvoices) => {
        return currentInvoices.filter((item) => item.id !== invoice.id);
      });

      setInvoiceLoadMessage("Invoice draft deleted.");
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
          This screen reads API-owned invoice draft summaries through the local
          Next.js proxy from the dedicated Invoice Lantern API service. No demo
          invoice drafts are shown.
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
          ) : tableInvoices.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No invoice drafts yet</strong>
                <span>
                  Create a new invoice draft to populate this API-owned queue.
                </span>
              </div>

              <div>
                <CalendarDays size={15} />
                <span>waiting</span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <strong>0</strong>
            </div>
          ) : (
            tableInvoices.map((invoice) => (
              <div
                className="workspace-table-row invoice-click-row"
                key={invoice.id}
                role="button"
                tabIndex={0}
                onClick={() => openInvoice(invoice)}
                onKeyDown={(event) => handleRowKeyDown(event, invoice)}
                style={{ cursor: "pointer" }}
              >
                <div>
                  <strong>{invoice.number}</strong>
                  <span>
                    {invoice.buyer} - {invoice.buyerCountry}
                  </span>

                  <button
                    type="button"
                    className="text-link-button"
                    onClick={(event) => deleteInvoiceDraft(event, invoice)}
                    disabled={deletingDraftId === invoice.id}
                    style={{
                      marginTop: "10px",
                      width: "fit-content",
                      padding: "8px 12px",
                      cursor:
                        deletingDraftId === invoice.id ? "not-allowed" : "pointer"
                    }}
                  >
                    <Trash2 size={16} />
                    {deletingDraftId === invoice.id ? "Deleting..." : "Delete draft"}
                  </button>
                </div>

                <div>
                  <CalendarDays size={15} />
                  <span>{invoice.issueDate}</span>
                </div>

                <div>
                  <span className="status-pill">{invoice.status}</span>
                </div>

                <strong>{invoice.amount}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Production invoices</p>
            <h3>Lifecycle records</h3>
          </div>

          <div className="confidence-label">internal lifecycle only</div>
        </div>

        {productionInvoiceMessage ? (
          <div className="alert-item">
            <span />
            <p>{productionInvoiceMessage}</p>
          </div>
        ) : null}

        <div className="workspace-table">
          {isLoadingProductionInvoices ? (
            <div className="workspace-table-row">
              <div>
                <strong>Loading production invoices</strong>
                <span>Reading lifecycle records from the local API proxy.</span>
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
          ) : productionInvoices.length === 0 ? (
            <div className="workspace-table-row">
              <div>
                <strong>No production invoices</strong>
                <span>
                  Drafts can be promoted to production lifecycle records when
                  the signed-in workspace API is available.
                </span>
              </div>

              <div>
                <CalendarDays size={15} />
                <span>waiting</span>
              </div>

              <div>
                <span className="status-pill">empty</span>
              </div>

              <strong>0</strong>
            </div>
          ) : (
            productionInvoices.map((invoice) => (
              <Link
                className="workspace-table-row invoice-click-row"
                href={`/workspace/invoices/${encodeURIComponent(invoice.id)}`}
                key={invoice.id}
              >
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>
                    {invoice.buyer} - {invoice.buyerCountry}
                  </span>
                  <span>
                    State {invoice.status}. Issued is an internal lifecycle
                    state only, not authority acceptance or filing.
                  </span>
                </div>

                <div>
                  <CalendarDays size={15} />
                  <span>{invoice.issueDate}</span>
                </div>

                <div>
                  <span className="status-pill">{invoice.status}</span>
                </div>

                <strong>{invoice.payableAmount}</strong>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
