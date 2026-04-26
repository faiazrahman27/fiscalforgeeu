"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FileInput,
  ReceiptText,
  Rows3,
  Send,
  UserRoundCheck
} from "lucide-react";
import { invoiceDrafts, invoiceStages } from "../../../lib/mock-data";
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

function normalizeInvoiceDraft(value: unknown): InvoiceListItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const id = readStringField(record, "id", crypto.randomUUID());

  const number =
    readStringField(record, "number", "") ||
    readStringField(record, "invoiceNumber", "") ||
    "Draft invoice";

  const buyer =
    readStringField(record, "buyer", "") ||
    readStringField(record, "buyerName", "") ||
    "Unknown buyer";

  return {
    id,
    number,
    buyer,
    buyerCountry: readStringField(record, "buyerCountry", "EU"),
    issueDate: readStringField(
      record,
      "issueDate",
      new Date().toISOString().slice(0, 10)
    ),
    status: readStringField(record, "status", "Draft"),
    amount: formatAmount(record.amount ?? record.payableAmount)
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

export default function WorkspaceInvoicesPage() {
  const [apiInvoices, setApiInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceLoadMessage, setInvoiceLoadMessage] = useState("");

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

        const responseData: unknown = await response.json();

        if (!response.ok) {
          setInvoiceLoadMessage(
            "Could not load API-owned invoice drafts. Showing demo drafts instead."
          );
          return;
        }

        const apiData = responseData as ApiInvoiceDraftListResponse;
        const records = Array.isArray(apiData.records) ? apiData.records : [];

        const normalizedInvoices = records
          .map((item) => normalizeInvoiceDraft(item))
          .filter((item): item is InvoiceListItem => item !== null);

        if (isMounted) {
          setApiInvoices(normalizedInvoices);
        }
      } catch {
        if (isMounted) {
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
    const mockInvoices: InvoiceListItem[] = invoiceDrafts.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      buyer: invoice.buyer,
      buyerCountry: invoice.buyerCountry,
      issueDate: invoice.issueDate,
      status: invoice.status,
      amount: formatAmount(invoice.amount)
    }));

    return uniqueInvoices([...apiInvoices, ...mockInvoices]);
  }, [apiInvoices]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Invoice Studio</p>
        <h2>Create structured invoice data before validation.</h2>
        <p>
          This screen now reads invoice draft summaries through the local Next.js
          proxy from the dedicated Invoice Lantern API service. Demo drafts remain as
          fallback records during local development.
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
              <Link
                href="/workspace/invoices/new"
                className="workspace-table-row invoice-click-row"
                key={invoice.id}
              >
                <div>
                  <strong>{invoice.number}</strong>
                  <span>
                    {invoice.buyer} - {invoice.buyerCountry}
                  </span>
                </div>

                <div>
                  <CalendarDays size={15} />
                  <span>{invoice.issueDate}</span>
                </div>

                <div>
                  <span className="status-pill">{invoice.status}</span>
                </div>

                <strong>{invoice.amount}</strong>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
