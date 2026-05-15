"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ACCOUNT_LEGAL_DOCUMENT_KEYS } from "../lib/legal-documents";

type LegalDocumentSummary = {
  documentKey: string;
  version: string;
};

type LegalAcceptanceRecord = {
  documentKey: string;
  version: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      const version =
        typeof document.version === "string" ? document.version : "";

      return documentKey && version ? { documentKey, version } : null;
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

export function LegalAcceptanceGate() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname === "/workspace/legal-acceptance") {
      return;
    }

    let cancelled = false;

    async function checkLegalAcceptance() {
      try {
        const [documentsResponse, acceptancesResponse] = await Promise.all([
          fetch("/api/local/legal/documents", { cache: "no-store" }),
          fetch("/api/local/legal/acceptances/me", { cache: "no-store" })
        ]);

        if (!documentsResponse.ok || !acceptancesResponse.ok || cancelled) {
          return;
        }

        const documents = readDocuments(await documentsResponse.json());
        const records = readAcceptanceRecords(await acceptancesResponse.json());

        const missingRequiredDocuments = ACCOUNT_LEGAL_DOCUMENT_KEYS.filter(
          (documentKey) => {
            const document = documents.find(
              (candidate) => candidate.documentKey === documentKey
            );

            if (!document) {
              return true;
            }

            return !records.some(
              (record) =>
                record.documentKey === documentKey &&
                record.version === document.version
            );
          }
        );

        if (missingRequiredDocuments.length === 0 || cancelled) {
          return;
        }

        const query = searchParams.toString();
        const nextPath = `${pathname}${query ? `?${query}` : ""}`;

        router.replace(
          `/workspace/legal-acceptance?next=${encodeURIComponent(nextPath)}`
        );
      } catch {
        // Local development without the dedicated API keeps workspace UI usable.
      }
    }

    void checkLegalAcceptance();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams]);

  return null;
}
