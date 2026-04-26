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

const INVOICE_DRAFTS_STORAGE_KEY = "Invoice Lantern:invoice-drafts:v1";

type InvoiceListItem = {
  id: string;
  number: string;
  buyer: string;
  buyerCountry: string;
  issueDate: string;
  status: string;
  amount: string;
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

function formatEuroAmount(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2
    }).format(value);
  }

  return "â‚¬0.00";
}

function normalizeStoredInvoice(value: unknown): InvoiceListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  const id =
    typeof record.id === "string" && record.id.trim().length > 0
      ? record.id
      : crypto.randomUUID();

  const number =
    typeof record.number === "string" && record.number.trim().length > 0
      ? record.number
      : typeof record.invoiceNumber === "string" && record.invoiceNumber.trim().length > 0
        ? record.invoiceNumber
        : "Draft invoice";

  const buyer =
    typeof record.buyer === "string" && record.buyer.trim().length > 0
      ? record.buyer
      : typeof record.buyerName === "string" && record.buyerName.trim().length > 0
        ? record.buyerName
        : "Unknown buyer";

  const buyerCountry =
    typeof record.buyerCountry === "string" && record.buyerCountry.trim().length > 0
      ? record.buyerCountry
      : "EU";

  const issueDate =
    typeof record.issueDate === "string" && record.issueDate.trim().length > 0
      ? record.issueDate
      : new Date().toISOString().slice(0, 10);

  const status =
    typeof record.status === "string" && record.status.trim().length > 0
      ? record.status
      : "Draft";

  const amount = formatEuroAmount(record.amount ?? record.payableAmount);

  return {
    id,
    number,
    buyer,
    buyerCountry,
    issueDate,
    status,
    amount
  };
}

function readStoredInvoices(): InvoiceListItem[] {
  try {
    const rawValue = window.localStorage.getItem(INVOICE_DRAFTS_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => normalizeStoredInvoice(item))
      .filter((item): item is InvoiceListItem => item !== null);
  } catch {
    return [];
  }
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
  const [storedInvoices, setStoredInvoices] = useState<InvoiceListItem[]>([]);

  useEffect(() => {
    setStoredInvoices(readStoredInvoices());

    function handleStorageChange(event: StorageEvent) {
      if (event.key === INVOICE_DRAFTS_STORAGE_KEY) {
        setStoredInvoices(readStoredInvoices());
      }
    }

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
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
      amount: invoice.amount
    }));

    return uniqueInvoices([...storedInvoices, ...mockInvoices]);
  }, [storedInvoices]);

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Invoice Studio</p>
        <h2>Create structured invoice data before validation.</h2>
        <p>
          This screen will later become the full invoice editor. For now it defines
          the interface logic: structured invoice entry, canonical model preparation,
          validation readiness, and XML export flow.
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

        <div className="workspace-table">
          {tableInvoices.map((invoice) => (
            <Link
              href="/workspace/invoices/new"
              className="workspace-table-row invoice-click-row"
              key={invoice.id}
            >
              <div>
                <strong>{invoice.number}</strong>
                <span>
                  {invoice.buyer} Â· {invoice.buyerCountry}
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
          ))}
        </div>
      </section>
    </div>
  );
}

