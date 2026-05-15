"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import {
  ACCOUNT_LEGAL_DOCUMENT_KEYS,
  ACCOUNT_LEGAL_DOCUMENT_LABELS,
  type AccountLegalDocumentKey,
  getLegalDocumentHref
} from "../../../lib/legal-documents";

type LegalDocumentSummary = {
  documentKey: string;
  title: string;
  version: string;
};

type LegalAcceptanceRecord = {
  documentKey: string;
  version: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSafeNextPath() {
  if (typeof window === "undefined") {
    return "/workspace";
  }

  const nextPath = new URLSearchParams(window.location.search).get("next");

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/workspace";
  }

  if (nextPath.startsWith("/auth/")) {
    return "/workspace";
  }

  return nextPath;
}

function readDocuments(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.documents)) {
    return [];
  }

  return value.documents
    .map((document): LegalDocumentSummary | null => {
      if (!isRecord(document)) {
        return null;
      }

      const documentKey =
        typeof document.documentKey === "string" ? document.documentKey : "";
      const title = typeof document.title === "string" ? document.title : "";
      const version =
        typeof document.version === "string" ? document.version : "";

      return documentKey && title && version
        ? { documentKey, title, version }
        : null;
    })
    .filter((document): document is LegalDocumentSummary => document !== null);
}

function readAcceptanceRecords(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    return [];
  }

  return value.records
    .map((record): LegalAcceptanceRecord | null => {
      if (!isRecord(record)) {
        return null;
      }

      const documentKey =
        typeof record.documentKey === "string" ? record.documentKey : "";
      const version = typeof record.version === "string" ? record.version : "";

      return documentKey && version ? { documentKey, version } : null;
    })
    .filter((record): record is LegalAcceptanceRecord => record !== null);
}

function createInitialCheckedState() {
  return ACCOUNT_LEGAL_DOCUMENT_KEYS.reduce(
    (state, documentKey) => ({
      ...state,
      [documentKey]: false
    }),
    {} as Record<AccountLegalDocumentKey, boolean>
  );
}

export default function WorkspaceLegalAcceptancePage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<LegalDocumentSummary[]>([]);
  const [records, setRecords] = useState<LegalAcceptanceRecord[]>([]);
  const [checkedDocuments, setCheckedDocuments] = useState(
    createInitialCheckedState
  );
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLegalState() {
      setIsLoading(true);
      setMessage("");

      try {
        const [documentsResponse, acceptancesResponse] = await Promise.all([
          fetch("/api/local/legal/documents", { cache: "no-store" }),
          fetch("/api/local/legal/acceptances/me", { cache: "no-store" })
        ]);

        if (!documentsResponse.ok || !acceptancesResponse.ok) {
          throw new Error("Legal acceptance state could not be loaded.");
        }

        const nextDocuments = readDocuments(await documentsResponse.json());
        const nextRecords = readAcceptanceRecords(
          await acceptancesResponse.json()
        );

        if (!cancelled) {
          setDocuments(nextDocuments);
          setRecords(nextRecords);
        }
      } catch {
        if (!cancelled) {
          setMessage(
            "Could not load required legal acceptance state. Check API availability and sign in again if the session expired."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLegalState();

    return () => {
      cancelled = true;
    };
  }, []);

  const requiredDocuments = useMemo(
    () =>
      ACCOUNT_LEGAL_DOCUMENT_KEYS.map((documentKey) => {
        const document = documents.find(
          (candidate) => candidate.documentKey === documentKey
        );

        return {
          documentKey,
          title:
            document?.title ?? ACCOUNT_LEGAL_DOCUMENT_LABELS[documentKey],
          version: document?.version ?? "current"
        };
      }),
    [documents]
  );

  const missingDocuments = requiredDocuments.filter(
    (document) =>
      !records.some(
        (record) =>
          record.documentKey === document.documentKey &&
          record.version === document.version
      )
  );

  const allMissingChecked =
    missingDocuments.length > 0 &&
    missingDocuments.every(
      (document) => checkedDocuments[document.documentKey]
    );

  const canSubmit = !isLoading && allMissingChecked;

  function handleSelectAllMissing() {
    setCheckedDocuments((current) => {
      const nextState = { ...current };

      for (const document of missingDocuments) {
        nextState[document.documentKey] = true;
      }

      return nextState;
    });

    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!canSubmit) {
      setMessage("Accept each required current document before continuing.");
      return;
    }

    setIsSubmitting(true);

    try {
      for (const document of missingDocuments) {
        const response = await fetch(
          `/api/local/legal/documents/${encodeURIComponent(
            document.documentKey
          )}/accept`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              acceptanceContext: "workspace",
              metadata: {
                source: "workspace_legal_acceptance_gate",
                requiredAccountAccess: true
              }
            }),
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("Acceptance failed.");
        }
      }

      router.push(getSafeNextPath());
      router.refresh();
    } catch {
      setMessage(
        "Could not record every required acceptance. Retry after confirming your session and API connection."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="legal-acceptance-page workspace-legal-fit-page">
      <div className="legal-acceptance-panel workspace-legal-fit-panel">
        <div className="legal-acceptance-heading workspace-legal-fit-heading">
          <div className="legal-acceptance-icon">
            <ShieldCheck size={24} />
          </div>

          <div>
            <p>Required platform acknowledgement</p>
            <h2>Accept current terms before using the workspace.</h2>
          </div>
        </div>

        <p className="legal-acceptance-lead workspace-legal-fit-lead">
          Invoice Lantern records version-aware acknowledgement for required
          platform documents. Acceptance does not create legal, tax, accounting,
          privacy, security, filing, official, or compliance certainty.
        </p>

        <div className="workspace-legal-required-summary">
          <p>Required documents</p>
          <span>
            {missingDocuments.length
              ? `${missingDocuments.length} current document${
                  missingDocuments.length === 1 ? "" : "s"
                } must be accepted.`
              : "All current required documents are already accepted."}
          </span>
        </div>

        <form
          id="workspace-legal-acceptance-form"
          className="legal-acceptance-form workspace-legal-fit-form"
          onSubmit={handleSubmit}
        >
          {requiredDocuments.map((document) => {
            const isAccepted = records.some(
              (record) =>
                record.documentKey === document.documentKey &&
                record.version === document.version
            );

            return (
              <label
                className={
                  isAccepted
                    ? "legal-acceptance-row legal-acceptance-row-accepted workspace-legal-fit-row"
                    : "legal-acceptance-row workspace-legal-fit-row"
                }
                key={document.documentKey}
              >
                <input
                  type="checkbox"
                  checked={isAccepted || checkedDocuments[document.documentKey]}
                  disabled={isAccepted}
                  onChange={(event) =>
                    setCheckedDocuments((current) => ({
                      ...current,
                      [document.documentKey]: event.target.checked
                    }))
                  }
                />

                <span>
                  <strong>
                    {isAccepted ? "Accepted" : "Required"}: {document.title}
                  </strong>
                  <small>Version {document.version}</small>
                  <Link href={getLegalDocumentHref(document.documentKey)}>
                    <FileText size={15} />
                    Read document
                  </Link>
                </span>
              </label>
            );
          })}

          <div className="workspace-legal-select-under">
            <button
              type="button"
              className="workspace-legal-select-all"
              onClick={handleSelectAllMissing}
              disabled={isLoading || missingDocuments.length === 0 || allMissingChecked}
            >
              <CheckCircle2 size={16} />
              {allMissingChecked ? "All selected" : "Select all required documents"}
            </button>
          </div>

          {message ? <p className="legal-acceptance-message">{message}</p> : null}
        </form>

        <div className="legal-acceptance-actions workspace-legal-fit-actions">
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-link-button">
              Sign out
            </button>
          </form>

          <button
            type="submit"
            form="workspace-legal-acceptance-form"
            className="text-link-button legal-acceptance-submit"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Recording..." : "Accept and continue"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
