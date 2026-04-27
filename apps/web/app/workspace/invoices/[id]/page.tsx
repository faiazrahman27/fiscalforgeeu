"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import type { InvoiceEditorDraft } from "../../../../lib/types";
import { InvoiceEditorClient } from "../new/invoice-editor-client";

type ApiInvoiceDraftDetailResponse = {
  record?: InvoiceEditorDraft;
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
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");

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
          if (isMounted) {
            setDraft(null);
            setLoadMessage(getApiErrorMessage(responseData));
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
        }
      } catch {
        if (isMounted) {
          setDraft(null);
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
