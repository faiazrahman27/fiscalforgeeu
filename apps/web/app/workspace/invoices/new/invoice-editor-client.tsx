"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Calculator,
  Code2,
  Download,
  FileCode2,
  FileText,
  Globe2,
  History,
  LockKeyhole,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
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
import {
  deleteEncryptedOfflineDraft,
  isEncryptedOfflineDraftStorageAvailable,
  loadEncryptedOfflineDraft,
  saveEncryptedOfflineDraft
} from "../../../../lib/pwa/offline-drafts";
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
  severity: "info" | "warning" | "fatal" | "blocked";
};

type LegalConfidence =
  | "technical"
  | "standard_based"
  | "official_source_derived"
  | "educational_simulation"
  | "professional_review_required"
  | "review_required";

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

type ApiValidationRequestPayload = {
  document: {
    type: "invoice" | "credit_note";
    number: string;
    currency: string;
    issueDate?: string;
    dueDate?: string;
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
    quantity: string;
    unitCode?: string;
    unitPrice: string;
    vatCategory: string;
    vatRate: string;
    netAmount?: string;
  }[];
  totals?: InvoiceTotalsDraft;
};

type ApiValidationTotals = {
  lineExtensionAmount: number | string;
  taxExclusiveAmount: number | string;
  taxAmount: number | string;
  taxInclusiveAmount: number | string;
  payableAmount: number | string;
};

type ApiValidationFinding = {
  code: string;
  severity: "info" | "warning" | "fatal" | "blocked";
  field?: string;
  fieldPath?: string;
  category?: string;
  message: string;
  fixSuggestion?: string;
  legalConfidence: LegalConfidence;
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

type ApiDraftSaveResponse = {
  record?: {
    id: string;
    createdAt: string;
    updatedAt: string;
  };
  summary?: {
    id: string;
    number: string;
    buyer: string;
    buyerCountry: string;
    issueDate: string;
    status: string;
    amount: string;
    currency: string;
    updatedAt: string;
  };
};

type ApiUblExportResponse = {
  xml?: string;
  metadata?: {
    exportId?: string;
    contentType?: string;
    filename?: string;
    suggestedFilename?: string;
    readinessLabel?: string;
    xmlSha256?: string;
    xmlSizeBytes?: number;
    createdAt?: string;
    status?: string;
    profile?: string;
  };
  exportId?: string;
  filename?: string;
  contentType?: string;
  xmlSha256?: string;
  xmlSizeBytes?: number;
  createdAt?: string;
  status?: string;
  profile?: string;
  readinessStatus?: "blocked" | "generated_with_warnings" | "generated";
  totals?: ApiValidationTotals;
  findings?: ApiValidationFinding[];
  disclaimer?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type UblExportResult = {
  xml: string;
  readinessStatus: "blocked" | "generated_with_warnings" | "generated" | "error";
  metadata: {
    contentType: string;
    suggestedFilename: string;
    readinessLabel: string;
  };
  exportId: string;
  filename: string;
  xmlSha256: string;
  xmlSizeBytes: number;
  status: string;
  profile: string;
  findings: FindingPreview[];
  disclaimer: string;
  generatedAt: string;
};

type UblExportHistoryItem = {
  id: string;
  invoiceDraftId: string | null;
  validationRunId: string | null;
  exportType: string;
  format: string;
  profile: string;
  filename: string;
  contentType: string;
  xmlSha256: string;
  xmlSizeBytes: number;
  status: string;
  createdAt: string;
};

type PartyType = "seller" | "buyer";

type SavedBusinessProfile = {
  id: string;
  profileType: "seller" | "buyer" | "both";
  displayName: string;
  legalName: string;
  countryCode: string;
  vatId: string;
  electronicAddress: string;
  addressLine1: string;
  city: string;
  postalCode: string;
};

type SavedContact = {
  id: string;
  businessProfileId: string;
  contactType: "business" | "person" | "department" | "other";
  displayName: string;
  legalName: string;
  countryCode: string;
  vatId: string;
  electronicAddress: string;
  addressLine1: string;
  city: string;
  postalCode: string;
};

type VatFormatResult = {
  input: string;
  normalized: string;
  countryCode?: string;
  formatValid: boolean;
  checkLevel: "local_format";
  source: "invoice_lantern_vat_format_rules";
  message: string;
  warnings: string[];
  disclaimer: string;
  persisted: boolean;
  checkRecordId?: string;
};

type VatFormatCheckState = {
  result: VatFormatResult | null;
  errorMessage: string;
  checkedAt: string;
};

function createBlankParty(): InvoicePartyDraft {
  return {
    name: "",
    country: "",
    vatId: "",
    city: "",
    postalCode: "",
    street: "",
    electronicAddress: ""
  };
}

function createEmptyTotals(): InvoiceTotalsDraft {
  return {
    lineExtensionAmount: "0.00",
    taxExclusiveAmount: "0.00",
    taxAmount: "0.00",
    taxInclusiveAmount: "0.00",
    payableAmount: "0.00"
  };
}

function createEmptyInvoiceDraft(): InvoiceEditorDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    document: {
      number: "",
      issueDate: today,
      dueDate: "",
      currency: "EUR",
      profile: "EN16931",
      invoiceType: "invoice",
      buyerReference: "",
      contractReference: ""
    },
    seller: createBlankParty(),
    buyer: createBlankParty(),
    lines: [
      {
        id: "1",
        description: "",
        quantity: "1",
        unitCode: "EA",
        unitPrice: "0.00",
        vatCategory: "S",
        vatRate: "0",
        netAmount: "0.00"
      }
    ],
    totals: createEmptyTotals()
  };
}

export function InvoiceEditorClient({
  initialDraft,
  loadStoredDraft = false,
  draftId
}: {
  initialDraft?: InvoiceEditorDraft;
  loadStoredDraft?: boolean;
  draftId?: string;
}) {
  const [draft, setDraft] = useState<InvoiceEditorDraft>(
    initialDraft ?? createEmptyInvoiceDraft()
  );
  const [persistedDraftId, setPersistedDraftId] = useState(draftId ?? "");
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [isExportingUbl, setIsExportingUbl] = useState(false);
  const [isExportingCii, setIsExportingCii] = useState(false);
  const [validationReport, setValidationReport] =
    useState<LocalValidationReport | null>(null);
  const [ublExportResult, setUblExportResult] =
    useState<UblExportResult | null>(null);
  const [ciiExportResult, setCiiExportResult] =
    useState<UblExportResult | null>(null);
  const [ublExportHistory, setUblExportHistory] = useState<
    UblExportHistoryItem[]
  >([]);
  const [isLoadingUblExportHistory, setIsLoadingUblExportHistory] =
    useState(false);
  const [ublExportHistoryMessage, setUblExportHistoryMessage] = useState("");
  const [vatFormatChecks, setVatFormatChecks] = useState<
    Record<PartyType, VatFormatCheckState | null>
  >({
    seller: null,
    buyer: null
  });
  const [isCheckingVatFormat, setIsCheckingVatFormat] = useState<
    Record<PartyType, boolean>
  >({
    seller: false,
    buyer: false
  });
  const [offlinePassphrase, setOfflinePassphrase] = useState("");
  const [offlineDraftMessage, setOfflineDraftMessage] = useState("");
  const [isSavingOfflineDraft, setIsSavingOfflineDraft] = useState(false);
  const [isLoadingOfflineDraft, setIsLoadingOfflineDraft] = useState(false);
  const [isDeletingOfflineDraft, setIsDeletingOfflineDraft] = useState(false);
  const [encryptedOfflineDraftAvailable, setEncryptedOfflineDraftAvailable] =
    useState(false);
  const [savedBusinessProfiles, setSavedBusinessProfiles] = useState<
    SavedBusinessProfile[]
  >([]);
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [savedRecordMessage, setSavedRecordMessage] = useState("");
  const [selectedSellerProfileId, setSelectedSellerProfileId] = useState("");
  const [selectedBuyerProfileId, setSelectedBuyerProfileId] = useState("");
  const [selectedBuyerContactId, setSelectedBuyerContactId] = useState("");

  useEffect(() => {
    setDraft(initialDraft ?? createEmptyInvoiceDraft());
    setHasLoadedDraft(true);
  }, [initialDraft, loadStoredDraft]);

  useEffect(() => {
    setEncryptedOfflineDraftAvailable(
      isEncryptedOfflineDraftStorageAvailable()
    );
  }, []);

  useEffect(() => {
    setPersistedDraftId(draftId ?? "");
  }, [draftId]);

  useEffect(() => {
    setUblExportResult(null);
    setCiiExportResult(null);
  }, [draft]);

  useEffect(() => {
    let isMounted = true;

    async function loadSavedBusinessRecords() {
      setSavedRecordMessage("");

      try {
        const [profileResponse, contactResponse] = await Promise.all([
          fetch("/api/local/workspace/business-profiles", {
            method: "GET",
            cache: "no-store"
          }),
          fetch("/api/local/workspace/contacts", {
            method: "GET",
            cache: "no-store"
          })
        ]);
        const [profileData, contactData] = await Promise.all([
          profileResponse.json().catch(() => null),
          contactResponse.json().catch(() => null)
        ]);

        if (!isMounted) {
          return;
        }

        if (profileResponse.ok) {
          setSavedBusinessProfiles(
            getRecordsFromResponse(profileData)
              .map((record) => normalizeSavedBusinessProfile(record))
              .filter(
                (record): record is SavedBusinessProfile => record !== null
              )
          );
        } else {
          setSavedBusinessProfiles([]);
        }

        if (contactResponse.ok) {
          setSavedContacts(
            getRecordsFromResponse(contactData)
              .map((record) => normalizeSavedContact(record))
              .filter((record): record is SavedContact => record !== null)
          );
        } else {
          setSavedContacts([]);
        }

        if (!profileResponse.ok || !contactResponse.ok) {
          setSavedRecordMessage(
            "Saved profiles and contacts could not be fully loaded. Manual draft fields remain editable."
          );
        }
      } catch {
        if (isMounted) {
          setSavedBusinessProfiles([]);
          setSavedContacts([]);
          setSavedRecordMessage(
            "Saved profiles and contacts are unavailable through the local API proxy. Manual draft fields remain editable."
          );
        }
      }
    }

    loadSavedBusinessRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadUblExportHistory() {
      setIsLoadingUblExportHistory(true);
      setUblExportHistoryMessage("");

      try {
        const response = await fetch(buildUblExportHistoryUrl(draftId), {
          method: "GET",
          cache: "no-store"
        });

        const responseData: unknown = await response.json();

        if (!response.ok) {
          if (isMounted) {
            setUblExportHistory([]);
            setUblExportHistoryMessage("Export records could not be loaded.");
          }

          return;
        }

        const records = getUblExportHistoryRecords(responseData)
          .map((record) => normalizeUblExportHistoryItem(record))
          .filter((record): record is UblExportHistoryItem => record !== null);

        if (isMounted) {
          setUblExportHistory(records);
        }
      } catch {
        if (isMounted) {
          setUblExportHistory([]);
          setUblExportHistoryMessage(
            "The local invoice export API is unavailable."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingUblExportHistory(false);
        }
      }
    }

    loadUblExportHistory();

    return () => {
      isMounted = false;
    };
  }, [draftId]);

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

  const offlineDraftId = useMemo(
    () => persistedDraftId || draftId || "current-editor-draft",
    [draftId, persistedDraftId]
  );

  const sellerProfileOptions = useMemo(
    () =>
      savedBusinessProfiles.filter(
        (profile) =>
          profile.profileType === "seller" || profile.profileType === "both"
      ),
    [savedBusinessProfiles]
  );

  const buyerProfileOptions = useMemo(
    () =>
      savedBusinessProfiles.filter(
        (profile) =>
          profile.profileType === "buyer" || profile.profileType === "both"
      ),
    [savedBusinessProfiles]
  );

  const selectedSellerProfile = useMemo(
    () =>
      sellerProfileOptions.find(
        (profile) => profile.id === selectedSellerProfileId
      ) ?? null,
    [selectedSellerProfileId, sellerProfileOptions]
  );

  const selectedBuyerProfile = useMemo(
    () =>
      buyerProfileOptions.find(
        (profile) => profile.id === selectedBuyerProfileId
      ) ?? null,
    [selectedBuyerProfileId, buyerProfileOptions]
  );

  const selectedBuyerContact = useMemo(
    () =>
      savedContacts.find((contact) => contact.id === selectedBuyerContactId) ??
      null,
    [selectedBuyerContactId, savedContacts]
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
    partyType: PartyType,
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

    if (key === "country" || key === "vatId") {
      setVatFormatChecks((current) => ({
        ...current,
        [partyType]: null
      }));
    }
  }

  function copySavedBusinessProfileToDraft(
    partyType: PartyType,
    profile: SavedBusinessProfile | null
  ) {
    if (!profile) {
      return;
    }

    copySavedPartyFieldsToDraft(partyType, {
      name: profile.displayName || profile.legalName,
      country: profile.countryCode,
      vatId: profile.vatId,
      city: profile.city,
      postalCode: profile.postalCode,
      street: profile.addressLine1,
      electronicAddress: profile.electronicAddress
    });
    setSavedRecordMessage(
      `${partyType === "seller" ? "Seller" : "Buyer"} profile copied into draft. Manual draft fields remain editable.`
    );
  }

  function copySavedContactToDraft(contact: SavedContact | null) {
    if (!contact) {
      return;
    }

    copySavedPartyFieldsToDraft("buyer", {
      name: contact.displayName || contact.legalName,
      country: contact.countryCode,
      vatId: contact.vatId,
      city: contact.city,
      postalCode: contact.postalCode,
      street: contact.addressLine1,
      electronicAddress: contact.electronicAddress
    });
    setSavedRecordMessage(
      "Buyer contact copied into draft. Manual draft fields remain editable."
    );
  }

  function copySavedPartyFieldsToDraft(
    partyType: PartyType,
    fields: Partial<InvoicePartyDraft>
  ) {
    setDraft((current) => ({
      ...current,
      [partyType]: {
        ...current[partyType],
        ...Object.fromEntries(
          Object.entries(fields).filter(([, value]) => {
            return typeof value === "string" && value.trim().length > 0;
          })
        )
      }
    }));

    setVatFormatChecks((current) => ({
      ...current,
      [partyType]: null
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
      return {
        ...current,
        lines: [
          ...current.lines,
          {
            id: `line_${Date.now()}`,
            description: "",
            quantity: "1",
            unitCode: "EA",
            unitPrice: "0.00",
            vatCategory: "S",
            vatRate: "0",
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

  async function saveDraftLocally() {
    setIsSavingDraft(true);

    try {
      const saveUrl = draftId
        ? `/api/local/invoices/drafts/${encodeURIComponent(draftId)}`
        : "/api/local/invoices/drafts";

      const saveMethod = draftId ? "PUT" : "POST";

      const response = await fetch(saveUrl, {
        method: saveMethod,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildDraftSavePayload(draft, recalculatedTotals))
      });

      const responseData: unknown = await response.json();

      if (!response.ok) {
        const apiError = extractApiError(responseData);
        setSaveMessage(`Draft save failed: ${apiError.message}`);
        return;
      }

      const savedDraft = responseData as ApiDraftSaveResponse;
      const nextPersistedDraftId =
        savedDraft.summary?.id ?? savedDraft.record?.id ?? "";

      if (nextPersistedDraftId) {
        setPersistedDraftId(nextPersistedDraftId);
      }

      setSaveMessage(
        savedDraft.summary?.id
          ? draftId
            ? `Draft updated through API as ${savedDraft.summary.id}.`
            : `Draft saved through API as ${savedDraft.summary.id}.`
          : `Draft saved through API at ${new Date().toLocaleTimeString()}.`
      );
    } catch {
      setSaveMessage(
        "Draft save failed. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsSavingDraft(false);

      window.setTimeout(() => {
        setSaveMessage("");
      }, 3500);
    }
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

  async function runVatFormatCheck(partyType: PartyType) {
    const party = draft[partyType];
    const payload: {
      vatId: string;
      countryHint?: string;
      persist: boolean;
      invoiceDraftId?: string;
      validationRunId?: string;
      partyRole: PartyType;
    } = {
      vatId: party.vatId,
      persist: true,
      partyRole: partyType
    };
    const countryHint = party.country.trim().toUpperCase();
    const currentDraftId = (persistedDraftId || draftId || "").trim();
    const currentValidationRunId = getPersistedValidationRunId(validationReport);

    if (countryHint) {
      payload.countryHint = countryHint;
    }

    if (currentDraftId) {
      payload.invoiceDraftId = currentDraftId;
    }

    if (currentValidationRunId) {
      payload.validationRunId = currentValidationRunId;
    }

    setIsCheckingVatFormat((current) => ({
      ...current,
      [partyType]: true
    }));

    try {
      const response = await fetch("/api/local/vat/validate-format", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseData: unknown = await response.json();

      if (!response.ok) {
        const apiError = extractApiError(responseData);

        setVatFormatChecks((current) => ({
          ...current,
          [partyType]: {
            result: null,
            errorMessage: apiError.message,
            checkedAt: new Date().toISOString()
          }
        }));

        return;
      }

      const vatResult = normalizeVatFormatResult(responseData);

      setVatFormatChecks((current) => ({
        ...current,
        [partyType]: {
          result: vatResult,
          errorMessage: vatResult
            ? ""
            : "The local VAT format API returned an unexpected response.",
          checkedAt: new Date().toISOString()
        }
      }));
    } catch {
      setVatFormatChecks((current) => ({
        ...current,
        [partyType]: {
          result: null,
          errorMessage:
            "The local VAT format API could not be reached. Make sure apps/api and apps/web are both running.",
          checkedAt: new Date().toISOString()
        }
      }));
    } finally {
      setIsCheckingVatFormat((current) => ({
        ...current,
        [partyType]: false
      }));
    }
  }

  async function runUblExport() {
    setIsExportingUbl(true);

    try {
      const exportPayload = buildUblExportRequestPayload({
        draft,
        totals: recalculatedTotals,
        draftId,
        validationReport
      });

      const response = await fetch("/api/local/invoices/export/ubl", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(exportPayload)
      });

      const responseData: unknown = await response.json();
      const exportData = responseData as ApiUblExportResponse;

      if (!response.ok && !Array.isArray(exportData.findings)) {
        const apiError = extractApiError(responseData);

        setUblExportResult(
          buildUblErrorResult({
            code: apiError.code,
            message: apiError.message
          })
        );

        return;
      }

      setUblExportResult(mapUblExportResponse(exportData));

      const exportHistoryRecord = mapUblExportResponseToHistoryItem(exportData);

      if (exportHistoryRecord) {
        setUblExportHistory((currentRecords) => [
          exportHistoryRecord,
          ...currentRecords.filter((record) => record.id !== exportHistoryRecord.id)
        ].slice(0, 5));
      }
    } catch {
      setUblExportResult(
        buildUblErrorResult({
          code: "API_UNAVAILABLE",
          message:
            "The local API could not be reached for UBL export readiness. Make sure apps/api and apps/web are both running."
        })
      );
    } finally {
      setIsExportingUbl(false);
    }
  }

  async function runCiiExport() {
    setIsExportingCii(true);

    try {
      const exportPayload = buildUblExportRequestPayload({
        draft,
        totals: recalculatedTotals,
        draftId,
        validationReport
      });

      const response = await fetch("/api/local/invoices/export/cii", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(exportPayload)
      });

      const responseData: unknown = await response.json();
      const exportData = responseData as ApiUblExportResponse;

      if (!response.ok && !Array.isArray(exportData.findings)) {
        const apiError = extractApiError(responseData);

        setCiiExportResult(
          buildCiiErrorResult({
            code: apiError.code,
            message: apiError.message
          })
        );

        return;
      }

      setCiiExportResult(mapCiiExportResponse(exportData));

      const exportHistoryRecord = mapCiiExportResponseToHistoryItem(exportData);

      if (exportHistoryRecord) {
        setUblExportHistory((currentRecords) => [
          exportHistoryRecord,
          ...currentRecords.filter((record) => record.id !== exportHistoryRecord.id)
        ].slice(0, 5));
      }
    } catch {
      setCiiExportResult(
        buildCiiErrorResult({
          code: "API_UNAVAILABLE",
          message:
            "The local API could not be reached for CII export readiness. Make sure apps/api and apps/web are both running."
        })
      );
    } finally {
      setIsExportingCii(false);
    }
  }

  function downloadGeneratedUblXml() {
    if (!ublExportResult?.xml) {
      return;
    }

    const blob = new Blob([ublExportResult.xml], {
      type: ublExportResult.metadata.contentType
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = ublExportResult.metadata.suggestedFilename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function downloadGeneratedCiiXml() {
    if (!ciiExportResult?.xml) {
      return;
    }

    const blob = new Blob([ciiExportResult.xml], {
      type: ciiExportResult.metadata.contentType
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = ciiExportResult.metadata.suggestedFilename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function saveEncryptedBrowserDraft() {
    if (!encryptedOfflineDraftAvailable) {
      setOfflineDraftMessage(
        "Encrypted local draft storage is unavailable in this browser."
      );
      return;
    }

    setIsSavingOfflineDraft(true);
    setOfflineDraftMessage("");

    try {
      const result = await saveEncryptedOfflineDraft({
        id: offlineDraftId,
        draft,
        passphrase: offlinePassphrase
      });

      setOfflineDraftMessage(
        `Encrypted local-only draft saved at ${new Date(result.savedAt).toLocaleTimeString()}. Save through the API when you are online.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Encrypted local draft could not be saved.";

      setOfflineDraftMessage(message);
    } finally {
      setIsSavingOfflineDraft(false);
    }
  }

  async function restoreEncryptedBrowserDraft() {
    if (!encryptedOfflineDraftAvailable) {
      setOfflineDraftMessage(
        "Encrypted local draft storage is unavailable in this browser."
      );
      return;
    }

    setIsLoadingOfflineDraft(true);
    setOfflineDraftMessage("");

    try {
      const envelope = await loadEncryptedOfflineDraft<InvoiceEditorDraft>({
        id: offlineDraftId,
        passphrase: offlinePassphrase
      });

      if (!envelope) {
        setOfflineDraftMessage("No encrypted local draft is stored for this editor.");
        return;
      }

      if (!isInvoiceEditorDraft(envelope.draft)) {
        setOfflineDraftMessage(
          "Encrypted local draft shape was not recognized and was not loaded."
        );
        return;
      }

      setDraft(envelope.draft);
      setOfflineDraftMessage(
        `Encrypted local-only draft restored from ${new Date(envelope.savedAt).toLocaleString()}.`
      );
    } catch {
      setOfflineDraftMessage(
        "Encrypted local draft could not be restored. Check the passphrase."
      );
    } finally {
      setIsLoadingOfflineDraft(false);
    }
  }

  async function deleteEncryptedBrowserDraft() {
    setIsDeletingOfflineDraft(true);
    setOfflineDraftMessage("");

    try {
      await deleteEncryptedOfflineDraft(offlineDraftId);
      setOfflineDraftMessage("Encrypted local-only draft deleted from this browser.");
    } catch {
      setOfflineDraftMessage("Encrypted local draft could not be deleted.");
    } finally {
      setIsDeletingOfflineDraft(false);
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
            disabled={isSavingDraft}
          >
            <Save size={16} />
            {isSavingDraft ? "Saving..." : "Save draft"}
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
            This editor saves drafts through the local Next.js API proxy into the
            dedicated Invoice Lantern API service. Validation and generated UBL XML
            now run through that API boundary; browser totals are draft assistance only.
          </p>
        </div>

        <div className={styles.heroStatus}>
          <div>
            <BadgeCheck size={24} />
            <span>{findings.length === 0 ? "Ready draft" : "Review draft"}</span>
          </div>

          <strong>
            {hasLoadedDraft ? draft.document.number || "Unsaved invoice" : "Loading"}
          </strong>
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

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p>Saved records</p>
                <h3>Use saved profile</h3>
              </div>

              <FileCode2 size={22} />
            </div>

            <p className={styles.savedRecordNote}>
              Copy into draft from workspace profiles or contacts. Manual draft
              fields remain editable.
            </p>

            {savedRecordMessage ? (
              <p className={styles.savedRecordMessage}>{savedRecordMessage}</p>
            ) : null}

            <div className={styles.savedRecordGrid}>
              <label className={styles.field}>
                <span>Seller saved profile</span>
                <select
                  value={selectedSellerProfileId}
                  onChange={(event) =>
                    setSelectedSellerProfileId(event.target.value)
                  }
                >
                  <option value="">Choose a saved seller profile</option>
                  {sellerProfileOptions.map((profile) => (
                    <option value={profile.id} key={profile.id}>
                      {profile.displayName} ({profile.countryCode})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  copySavedBusinessProfileToDraft("seller", selectedSellerProfile)
                }
                disabled={!selectedSellerProfile}
              >
                Copy into draft
              </button>

              <label className={styles.field}>
                <span>Buyer saved profile</span>
                <select
                  value={selectedBuyerProfileId}
                  onChange={(event) =>
                    setSelectedBuyerProfileId(event.target.value)
                  }
                >
                  <option value="">Choose a saved buyer profile</option>
                  {buyerProfileOptions.map((profile) => (
                    <option value={profile.id} key={profile.id}>
                      {profile.displayName} ({profile.countryCode})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  copySavedBusinessProfileToDraft("buyer", selectedBuyerProfile)
                }
                disabled={!selectedBuyerProfile}
              >
                Copy into draft
              </button>

              <label className={styles.field}>
                <span>Buyer saved contact</span>
                <select
                  value={selectedBuyerContactId}
                  onChange={(event) =>
                    setSelectedBuyerContactId(event.target.value)
                  }
                >
                  <option value="">Choose a saved buyer contact</option>
                  {savedContacts.map((contact) => (
                    <option value={contact.id} key={contact.id}>
                      {contact.displayName}
                      {contact.countryCode ? ` (${contact.countryCode})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => copySavedContactToDraft(selectedBuyerContact)}
                disabled={!selectedBuyerContact}
              >
                Copy into draft
              </button>
            </div>
          </div>

          <div className={styles.partyGrid}>
            <PartyPanel
              title="Seller profile"
              party={draft.seller}
              vatFormatCheck={vatFormatChecks.seller}
              isCheckingVatFormat={isCheckingVatFormat.seller}
              onCheckVatFormat={() => runVatFormatCheck("seller")}
              onChange={(key, value) => updateParty("seller", key, value)}
            />

            <PartyPanel
              title="Buyer profile"
              party={draft.buyer}
              vatFormatCheck={vatFormatChecks.buyer}
              isCheckingVatFormat={isCheckingVatFormat.buyer}
              onCheckVatFormat={() => runVatFormatCheck("buyer")}
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
                <h3>Draft calculation aid</h3>
              </div>
            </div>

            <TotalRow
              currency={draft.document.currency}
              label="Line extension"
              value={recalculatedTotals.lineExtensionAmount}
            />
            <TotalRow
              currency={draft.document.currency}
              label="Tax exclusive"
              value={recalculatedTotals.taxExclusiveAmount}
            />
            <TotalRow
              currency={draft.document.currency}
              label="VAT amount"
              value={recalculatedTotals.taxAmount}
            />
            <TotalRow
              currency={draft.document.currency}
              label="Tax inclusive"
              value={recalculatedTotals.taxInclusiveAmount}
            />
            <TotalRow
              currency={draft.document.currency}
              label="Payable amount"
              value={recalculatedTotals.payableAmount}
              strong
            />
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <LockKeyhole size={20} />

              <div>
                <p>Offline draft</p>
                <h3>Encrypted local-only copy</h3>
              </div>
            </div>

            <p className={styles.offlineDraftCopy}>
              Stores this draft in IndexedDB only after browser-side AES-GCM
              encryption. The passphrase is not saved. API validation, VIES,
              XML/XSD/Schematron, UBL export persistence, and server saving stay
              online-only.
            </p>

            <label className={styles.offlineDraftField}>
              <span>Local passphrase</span>
              <input
                type="password"
                value={offlinePassphrase}
                minLength={12}
                autoComplete="new-password"
                onChange={(event) => setOfflinePassphrase(event.target.value)}
                placeholder="12+ characters"
              />
            </label>

            <div className={styles.offlineDraftActions}>
              <button
                type="button"
                className={styles.fullWidthButton}
                onClick={saveEncryptedBrowserDraft}
                disabled={
                  isSavingOfflineDraft || !encryptedOfflineDraftAvailable
                }
              >
                <Save size={16} />
                {isSavingOfflineDraft ? "Encrypting..." : "Save local copy"}
              </button>

              <button
                type="button"
                className={styles.fullWidthButton}
                onClick={restoreEncryptedBrowserDraft}
                disabled={
                  isLoadingOfflineDraft || !encryptedOfflineDraftAvailable
                }
              >
                <History size={16} />
                {isLoadingOfflineDraft ? "Restoring..." : "Restore local copy"}
              </button>

              <button
                type="button"
                className={styles.fullWidthButton}
                onClick={deleteEncryptedBrowserDraft}
                disabled={isDeletingOfflineDraft}
              >
                <Trash2 size={16} />
                {isDeletingOfflineDraft ? "Deleting..." : "Delete local copy"}
              </button>
            </div>

            <p className={styles.offlineDraftStatus}>
              {encryptedOfflineDraftAvailable
                ? offlineDraftMessage || "Encrypted local draft support is available."
                : "Encrypted local draft support is unavailable until Web Crypto and IndexedDB are available."}
            </p>
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <ShieldAlert size={20} />

              <div>
                <p>Findings</p>
                <h3>Local draft hints</h3>
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
                <p>XML export readiness</p>
                <h3>Generated UBL and CII XML</h3>
              </div>
            </div>

            <pre className={styles.xmlPreview}>
              {ublExportResult?.xml || buildUblExportPlaceholder(ublExportResult)}
            </pre>

            <button
              type="button"
              className={styles.fullWidthButton}
              onClick={runUblExport}
              disabled={isExportingUbl}
            >
              <Code2 size={16} />
              {isExportingUbl ? "Generating..." : "Generate UBL XML"}
            </button>

            <button
              type="button"
              className={styles.fullWidthButton}
              onClick={runCiiExport}
              disabled={isExportingCii}
            >
              <Code2 size={16} />
              {isExportingCii ? "Generating..." : "Export CII XML"}
            </button>

            {ublExportResult?.xml ? (
              <button
                type="button"
                className={styles.fullWidthButton}
                onClick={downloadGeneratedUblXml}
              >
                <Download size={16} />
                Download XML
              </button>
            ) : null}

            {ciiExportResult?.xml ? (
              <>
                <pre className={styles.xmlPreview}>
                  {ciiExportResult.xml}
                </pre>

                <button
                  type="button"
                  className={styles.fullWidthButton}
                  onClick={downloadGeneratedCiiXml}
                >
                  <Download size={16} />
                  Download CII XML
                </button>
              </>
            ) : null}

            {ublExportResult ? (
              <div className={styles.ublExportMeta}>
                <span>{ublExportResult.readinessStatus.replaceAll("_", " ")}</span>
                {ublExportResult.exportId ? (
                  <div className={styles.ublExportRecordMeta}>
                    <p>Export record</p>
                    <strong>{ublExportResult.filename}</strong>
                    <span>{formatBytes(ublExportResult.xmlSizeBytes)}</span>
                    <code>{shortHash(ublExportResult.xmlSha256)}</code>
                  </div>
                ) : null}
                <p>{ublExportResult.disclaimer}</p>
                {ublExportResult.findings.length > 0 ? (
                  <div className={styles.findingList}>
                    {ublExportResult.findings.map((finding, index) => (
                      <div
                        className={styles.findingItem}
                        key={`${finding.code}-${index}`}
                      >
                        <span>{finding.severity}</span>
                        <strong>{finding.code}</strong>
                        <p>{finding.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {ciiExportResult ? (
              <div className={styles.ublExportMeta}>
                <span>{ciiExportResult.readinessStatus.replaceAll("_", " ")}</span>
                {ciiExportResult.exportId ? (
                  <div className={styles.ublExportRecordMeta}>
                    <p>CII export record</p>
                    <strong>{ciiExportResult.filename}</strong>
                    <span>{formatBytes(ciiExportResult.xmlSizeBytes)}</span>
                    <code>{shortHash(ciiExportResult.xmlSha256)}</code>
                  </div>
                ) : null}
                <p>{ciiExportResult.disclaimer}</p>
                {ciiExportResult.findings.length > 0 ? (
                  <div className={styles.findingList}>
                    {ciiExportResult.findings.map((finding, index) => (
                      <div
                        className={styles.findingItem}
                        key={`${finding.code}-${index}`}
                      >
                        <span>{finding.severity}</span>
                        <strong>{finding.code}</strong>
                        <p>{finding.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sidePanelHead}>
              <History size={20} />

              <div>
                <p>Export records</p>
                <h3>XML export history</h3>
              </div>
            </div>

            <p className={styles.exportHistoryNote}>
              Generated UBL and CII XML metadata only. Not official validation,
              filing, authority acceptance, or certification.
            </p>

            <div className={styles.exportHistoryList}>
              {isLoadingUblExportHistory ? (
                <div className={styles.exportHistoryItem}>
                  <strong>Loading export records</strong>
                  <span>Reading recent generated XML metadata.</span>
                </div>
              ) : ublExportHistoryMessage ? (
                <div className={styles.exportHistoryItem}>
                  <strong>Export history unavailable</strong>
                  <span>{ublExportHistoryMessage}</span>
                </div>
              ) : ublExportHistory.length === 0 ? (
                <div className={styles.exportHistoryItem}>
                  <strong>No export records yet</strong>
                  <span>Generate UBL or CII XML to create the first metadata record.</span>
                </div>
              ) : (
                ublExportHistory.map((record) => (
                  <div className={styles.exportHistoryItem} key={record.id}>
                    <div>
                      <strong>{record.filename}</strong>
                      <span>{formatDateTime(record.createdAt)}</span>
                    </div>

                    <dl className={styles.exportHistoryMeta}>
                      <div>
                        <dt>Type</dt>
                        <dd>
                          {record.exportType === "cii_invoice"
                            ? "CII XML"
                            : "UBL XML"}
                        </dd>
                      </div>
                      <div>
                        <dt>Size</dt>
                        <dd>{formatBytes(record.xmlSizeBytes)}</dd>
                      </div>
                      <div>
                        <dt>SHA-256</dt>
                        <dd>{shortHash(record.xmlSha256)}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{record.status}</dd>
                      </div>
                      <div>
                        <dt>Profile</dt>
                        <dd>{record.profile}</dd>
                      </div>
                    </dl>
                  </div>
                ))
              )}
            </div>
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
          <option value={option.value} key={`${label}-${option.value}`}>
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
  vatFormatCheck,
  isCheckingVatFormat,
  onCheckVatFormat,
  onChange
}: {
  title: string;
  party: InvoicePartyDraft;
  vatFormatCheck: VatFormatCheckState | null;
  isCheckingVatFormat: boolean;
  onCheckVatFormat: () => void;
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

        <div className={styles.vatCheckBlock}>
          <button
            type="button"
            className={styles.vatCheckButton}
            onClick={onCheckVatFormat}
            disabled={isCheckingVatFormat}
          >
            <BadgeCheck size={16} />
            {isCheckingVatFormat ? "Checking..." : "Check local VAT format"}
          </button>

          {vatFormatCheck ? (
            <VatFormatCheckResult check={vatFormatCheck} />
          ) : (
            <p className={styles.vatCheckNote}>
              Local format check only. Not VIES. Not proof of VAT registration.
            </p>
          )}
        </div>

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

function VatFormatCheckResult({ check }: { check: VatFormatCheckState }) {
  const result = check.result;

  if (!result) {
    return (
      <div className={styles.vatCheckResult}>
        <span className={styles.warn}>Local format check only</span>
        <strong>Format check unavailable</strong>
        <p>{check.errorMessage}</p>
        <div className={styles.vatCheckTags}>
          <span>Not VIES</span>
          <span>Not proof of VAT registration</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vatCheckResult}>
      <span className={result.formatValid ? styles.good : styles.warn}>
        {result.formatValid ? "Format appears valid" : "Format does not match"}
      </span>
      <strong>Local format check only</strong>
      <p>{result.message}</p>

      {result.countryCode ? (
        <p>
          Country pattern: {result.countryCode}. Normalized: {result.normalized}
        </p>
      ) : null}

      {result.warnings.length > 0 ? (
        <ul>
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <p>
        {result.persisted && result.checkRecordId
          ? `Evidence record saved: ${shortHash(result.checkRecordId)}`
          : "No evidence record was saved for this local format check."}
      </p>
      <p>{result.disclaimer}</p>
      <div className={styles.vatCheckTags}>
        <span>Not VIES</span>
        <span>Not proof of VAT registration</span>
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
  currency,
  strong = false
}: {
  label: string;
  value: string;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? styles.totalRowStrong : styles.totalRow}>
      <span>{label}</span>
      <strong>
        {currency || "EUR"} {value}
      </strong>
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
  const hasSellerCountry = Boolean(draft.seller.country);
  const hasBuyerCountry = Boolean(draft.buyer.country);
  const hasCrossBorderContext =
    hasSellerCountry && hasBuyerCountry && draft.seller.country !== draft.buyer.country;

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
      value:
        !hasSellerCountry || !hasBuyerCountry
          ? "Not set"
          : hasCrossBorderContext
            ? "Review"
            : "Local",
      tone: !hasSellerCountry || !hasBuyerCountry || hasCrossBorderContext ? "warn" : "good"
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
  const hasSellerCountry = Boolean(draft.seller.country);
  const hasBuyerCountry = Boolean(draft.buyer.country);
  const isCrossBorder =
    hasSellerCountry &&
    hasBuyerCountry &&
    draft.seller.country !== draft.buyer.country;

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

  if (!draft.seller.country.trim()) {
    findings.push({
      code: "SELLER_COUNTRY_REQUIRED",
      severity: "fatal",
      message: "Seller country is required in the canonical invoice model."
    });
  }

  if (!draft.buyer.name.trim()) {
    findings.push({
      code: "BUYER_NAME_REQUIRED",
      severity: "fatal",
      message: "Buyer name is required in the canonical invoice model."
    });
  }

  if (!draft.buyer.country.trim()) {
    findings.push({
      code: "BUYER_COUNTRY_REQUIRED",
      severity: "fatal",
      message: "Buyer country is required in the canonical invoice model."
    });
  }

  if (isCrossBorder && !draft.buyer.vatId.trim()) {
    findings.push({
      code: "BUYER_VAT_ID_REQUIRED_FOR_CROSS_BORDER_SIMULATION",
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

  if (isCrossBorder) {
    findings.push({
      code: "CROSS_BORDER_REVIEW_REQUIRED",
      severity: "warning",
      message:
        "Seller and buyer are in different countries. This is only an educational simulation and requires professional review."
    });
  }

  return findings;
}

function buildDraftSavePayload(
  draft: InvoiceEditorDraft,
  totals: InvoiceTotalsDraft
) {
  const draftRecord = draft as InvoiceEditorDraft & {
    id?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };

  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...draftPayload
  } = draftRecord;

  return {
    ...draftPayload,
    totals
  };
}

function getPersistedValidationRunId(report: LocalValidationReport | null) {
  const id = report?.id.trim() ?? "";

  return id && !id.startsWith("api_error_") ? id : "";
}

function buildUblExportRequestPayload({
  draft,
  totals,
  draftId,
  validationReport
}: {
  draft: InvoiceEditorDraft;
  totals: InvoiceTotalsDraft;
  draftId?: string;
  validationReport: LocalValidationReport | null;
}) {
  const payload: {
    invoice: ReturnType<typeof buildDraftSavePayload>;
    invoiceDraftId?: string;
    validationRunId?: string;
  } = {
    invoice: buildDraftSavePayload(draft, totals)
  };

  const safeDraftId = draftId?.trim();
  const validationRunId = getPersistedValidationRunId(validationReport);

  if (safeDraftId) {
    payload.invoiceDraftId = safeDraftId;
  }

  if (validationRunId) {
    payload.validationRunId = validationRunId;
  }

  return payload;
}

function buildUblExportHistoryUrl(draftId?: string) {
  const searchParams = new URLSearchParams({
    limit: "5"
  });

  const safeDraftId = draftId?.trim();

  if (safeDraftId) {
    searchParams.set("invoiceDraftId", safeDraftId);
  }

  return `/api/local/invoices/exports?${searchParams.toString()}`;
}

function buildApiValidationPayload(
  draft: InvoiceEditorDraft
): ApiValidationRequestPayload {
  return {
    document: {
      type: draft.document.invoiceType,
      number: draft.document.number,
      currency: draft.document.currency,
      issueDate: draft.document.issueDate,
      dueDate: draft.document.dueDate
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
      quantity: normalizeDecimalForApi(line.quantity),
      unitCode: line.unitCode,
      unitPrice: normalizeDecimalForApi(line.unitPrice),
      vatCategory: line.vatCategory,
      vatRate: normalizeDecimalForApi(line.vatRate),
      netAmount: normalizeDecimalForApi(line.netAmount)
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
    lineExtensionAmount: toMoneyString(totals.lineExtensionAmount),
    taxExclusiveAmount: toMoneyString(totals.taxExclusiveAmount),
    taxAmount: toMoneyString(totals.taxAmount),
    taxInclusiveAmount: toMoneyString(totals.taxInclusiveAmount),
    payableAmount: toMoneyString(totals.payableAmount)
  };
}

function toMoneyString(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  return value.trim().length > 0 ? value.trim() : "0.00";
}

function normalizeDecimalForApi(value: string) {
  const normalized = value.trim().replace(",", ".");

  return normalized || "0";
}

function cleanDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [first, ...rest] = cleaned.split(".");

  return rest.length === 0 ? first : `${first}.${rest.join("")}`;
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
  const isCrossBorder =
    Boolean(draft.seller.country) &&
    Boolean(draft.buyer.country) &&
    draft.seller.country !== draft.buyer.country;

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

function mapApiFinding(finding: ApiValidationFinding): FindingPreview {
  return {
    code: finding.code,
    severity: finding.severity,
    message: finding.message
  };
}

function getNullableStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getNumberField(
  source: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = source[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getUblExportHistoryRecords(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

function normalizeUblExportHistoryItem(
  value: unknown
): UblExportHistoryItem | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = getStringField(value, "id");
  const filename = getStringField(value, "filename");
  const xmlSha256 = getStringField(value, "xmlSha256");
  const createdAt = getStringField(value, "createdAt");

  if (!id || !filename || !xmlSha256 || !createdAt) {
    return null;
  }

  return {
    id,
    invoiceDraftId: getNullableStringField(value, "invoiceDraftId"),
    validationRunId: getNullableStringField(value, "validationRunId"),
    exportType: getStringField(value, "exportType") || "ubl_invoice",
    format: getStringField(value, "format") || "xml",
    profile: getStringField(value, "profile") || "UBL export readiness",
    filename,
    contentType:
      getStringField(value, "contentType") || "application/xml; charset=utf-8",
    xmlSha256,
    xmlSizeBytes: getNumberField(value, "xmlSizeBytes"),
    status: getStringField(value, "status") || "generated",
    createdAt
  };
}

function mapUblExportResponseToHistoryItem(
  response: ApiUblExportResponse
): UblExportHistoryItem | null {
  const metadata = response.metadata ?? {};
  const exportId = response.exportId ?? metadata.exportId ?? "";

  if (!exportId) {
    return null;
  }

  return normalizeUblExportHistoryItem({
    id: exportId,
    invoiceDraftId: null,
    validationRunId: null,
    exportType: "ubl_invoice",
    format: "xml",
    profile: response.profile ?? metadata.profile ?? "UBL export readiness",
    filename:
      response.filename ??
      metadata.filename ??
      metadata.suggestedFilename ??
      "invoice-lantern-ubl.xml",
    contentType:
      response.contentType ??
      metadata.contentType ??
      "application/xml; charset=utf-8",
    xmlSha256: response.xmlSha256 ?? metadata.xmlSha256 ?? "",
    xmlSizeBytes: response.xmlSizeBytes ?? metadata.xmlSizeBytes ?? 0,
    status: response.status ?? metadata.status ?? "generated",
    createdAt: response.createdAt ?? metadata.createdAt ?? new Date().toISOString()
  });
}

function mapCiiExportResponseToHistoryItem(
  response: ApiUblExportResponse
): UblExportHistoryItem | null {
  const metadata = response.metadata ?? {};
  const exportId = response.exportId ?? metadata.exportId ?? "";

  if (!exportId) {
    return null;
  }

  return normalizeUblExportHistoryItem({
    id: exportId,
    invoiceDraftId: null,
    validationRunId: null,
    exportType: "cii_invoice",
    format: "xml",
    profile: response.profile ?? metadata.profile ?? "CII export readiness",
    filename:
      response.filename ??
      metadata.filename ??
      metadata.suggestedFilename ??
      "invoice-lantern-cii.xml",
    contentType:
      response.contentType ??
      metadata.contentType ??
      "application/xml; charset=utf-8",
    xmlSha256: response.xmlSha256 ?? metadata.xmlSha256 ?? "",
    xmlSizeBytes: response.xmlSizeBytes ?? metadata.xmlSizeBytes ?? 0,
    status: response.status ?? metadata.status ?? "generated",
    createdAt: response.createdAt ?? metadata.createdAt ?? new Date().toISOString()
  });
}

function mapUblExportResponse(response: ApiUblExportResponse): UblExportResult {
  const metadata = response.metadata ?? {};
  const filename =
    response.filename ??
    metadata.filename ??
    metadata.suggestedFilename ??
    "invoice-lantern-ubl.xml";

  return {
    xml: response.xml ?? "",
    readinessStatus: response.readinessStatus ?? "error",
    metadata: {
      contentType:
        response.contentType ??
        metadata.contentType ??
        "application/xml; charset=utf-8",
      suggestedFilename: metadata.suggestedFilename ?? filename,
      readinessLabel: metadata.readinessLabel ?? "UBL export readiness"
    },
    exportId: response.exportId ?? metadata.exportId ?? "",
    filename,
    xmlSha256: response.xmlSha256 ?? metadata.xmlSha256 ?? "",
    xmlSizeBytes: response.xmlSizeBytes ?? metadata.xmlSizeBytes ?? 0,
    status: response.status ?? metadata.status ?? "",
    profile: response.profile ?? metadata.profile ?? "",
    findings: Array.isArray(response.findings)
      ? response.findings.map(mapApiFinding)
      : [],
    disclaimer:
      response.disclaimer ??
      "This generated UBL XML is not official validation, legal, tax, or accounting advice.",
    generatedAt: response.createdAt ?? metadata.createdAt ?? new Date().toISOString()
  };
}

function mapCiiExportResponse(response: ApiUblExportResponse): UblExportResult {
  const metadata = response.metadata ?? {};
  const filename =
    response.filename ??
    metadata.filename ??
    metadata.suggestedFilename ??
    "invoice-lantern-cii.xml";

  return {
    xml: response.xml ?? "",
    readinessStatus: response.readinessStatus ?? "error",
    metadata: {
      contentType:
        response.contentType ??
        metadata.contentType ??
        "application/xml; charset=utf-8",
      suggestedFilename: metadata.suggestedFilename ?? filename,
      readinessLabel: metadata.readinessLabel ?? "CII export readiness"
    },
    exportId: response.exportId ?? metadata.exportId ?? "",
    filename,
    xmlSha256: response.xmlSha256 ?? metadata.xmlSha256 ?? "",
    xmlSizeBytes: response.xmlSizeBytes ?? metadata.xmlSizeBytes ?? 0,
    status: response.status ?? metadata.status ?? "",
    profile: response.profile ?? metadata.profile ?? "",
    findings: Array.isArray(response.findings)
      ? response.findings.map(mapApiFinding)
      : [],
    disclaimer:
      response.disclaimer ??
      "This generated CII XML is technical sandbox output only and is not official validation, legal, tax, accounting, filing, authority acceptance, or certification.",
    generatedAt: response.createdAt ?? metadata.createdAt ?? new Date().toISOString()
  };
}

function buildUblErrorResult({
  code,
  message
}: {
  code: string;
  message: string;
}): UblExportResult {
  return {
    xml: "",
    readinessStatus: "error",
    metadata: {
      contentType: "application/xml; charset=utf-8",
      suggestedFilename: "invoice-lantern-ubl.xml",
      readinessLabel: "UBL export readiness"
    },
    exportId: "",
    filename: "invoice-lantern-ubl.xml",
    xmlSha256: "",
    xmlSizeBytes: 0,
    status: "failed",
    profile: "UBL export readiness",
    findings: [
      {
        code,
        severity: "fatal",
        message
      }
    ],
    disclaimer:
      "UBL export readiness did not complete. This is not official validation, legal, tax, or accounting advice.",
    generatedAt: new Date().toISOString()
  };
}

function buildCiiErrorResult({
  code,
  message
}: {
  code: string;
  message: string;
}): UblExportResult {
  return {
    xml: "",
    readinessStatus: "error",
    metadata: {
      contentType: "application/xml; charset=utf-8",
      suggestedFilename: "invoice-lantern-cii.xml",
      readinessLabel: "CII export readiness"
    },
    exportId: "",
    filename: "invoice-lantern-cii.xml",
    xmlSha256: "",
    xmlSizeBytes: 0,
    status: "failed",
    profile: "CII export readiness",
    findings: [
      {
        code,
        severity: "fatal",
        message
      }
    ],
    disclaimer:
      "CII export readiness did not complete. This is not official validation, legal, tax, accounting, filing, authority acceptance, or certification.",
    generatedAt: new Date().toISOString()
  };
}

function buildUblExportPlaceholder(result: UblExportResult | null) {
  if (result?.readinessStatus === "blocked") {
    return [
      "UBL export readiness is blocked by canonical invoice findings.",
      "No XML was generated.",
      "Run API validation or review the findings below."
    ].join("\n");
  }

  if (result?.readinessStatus === "error") {
    return [
      "Generated UBL XML is unavailable because the export request failed.",
      "Review the API finding below."
    ].join("\n");
  }

  return [
    "Generated UBL XML will appear here after the API export endpoint runs.",
    "Client-side totals are only a draft aid.",
    "This is not official validation, legal, tax, or accounting advice."
  ].join("\n");
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

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value: string) {
  return value.trim().length >= 12 ? value.trim().slice(0, 12) : value || "n/a";
}

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
    Array.isArray(value.lines) &&
    isPlainObject(value.totals)
  );
}

function getStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getRecordsFromResponse(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

function normalizeSavedProfileType(
  value: unknown
): SavedBusinessProfile["profileType"] {
  if (value === "buyer" || value === "both") {
    return value;
  }

  return "seller";
}

function normalizeSavedContactType(value: unknown): SavedContact["contactType"] {
  if (value === "person" || value === "department" || value === "other") {
    return value;
  }

  return "business";
}

function normalizeSavedBusinessProfile(
  value: unknown
): SavedBusinessProfile | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = getStringField(value, "id").trim();
  const displayName = getStringField(value, "displayName").trim();

  if (!id || !displayName) {
    return null;
  }

  return {
    id,
    profileType: normalizeSavedProfileType(value.profileType),
    displayName,
    legalName: getStringField(value, "legalName").trim(),
    countryCode: getStringField(value, "countryCode").trim(),
    vatId: getStringField(value, "vatId").trim(),
    electronicAddress: getStringField(value, "electronicAddress").trim(),
    addressLine1: getStringField(value, "addressLine1").trim(),
    city: getStringField(value, "city").trim(),
    postalCode: getStringField(value, "postalCode").trim()
  };
}

function normalizeSavedContact(value: unknown): SavedContact | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = getStringField(value, "id").trim();
  const displayName = getStringField(value, "displayName").trim();

  if (!id || !displayName) {
    return null;
  }

  return {
    id,
    businessProfileId: getStringField(value, "businessProfileId").trim(),
    contactType: normalizeSavedContactType(value.contactType),
    displayName,
    legalName: getStringField(value, "legalName").trim(),
    countryCode: getStringField(value, "countryCode").trim(),
    vatId: getStringField(value, "vatId").trim(),
    electronicAddress: getStringField(value, "electronicAddress").trim(),
    addressLine1: getStringField(value, "addressLine1").trim(),
    city: getStringField(value, "city").trim(),
    postalCode: getStringField(value, "postalCode").trim()
  };
}

function normalizeVatFormatResult(data: unknown): VatFormatResult | null {
  if (!isPlainObject(data) || typeof data.formatValid !== "boolean") {
    return null;
  }

  const input = getStringField(data, "input");
  const normalized = getStringField(data, "normalized");
  const checkLevel = getStringField(data, "checkLevel");
  const source = getStringField(data, "source");
  const message = getStringField(data, "message");
  const disclaimer = getStringField(data, "disclaimer");

  if (
    checkLevel !== "local_format" ||
    source !== "invoice_lantern_vat_format_rules" ||
    !message ||
    !disclaimer
  ) {
    return null;
  }

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  const result: VatFormatResult = {
    input,
    normalized,
    formatValid: data.formatValid,
    checkLevel,
    source,
    message,
    warnings,
    disclaimer,
    persisted: data.persisted === true
  };

  const countryCode = getStringField(data, "countryCode");
  const checkRecordId = getStringField(data, "checkRecordId");

  if (countryCode) {
    result.countryCode = countryCode;
  }

  if (checkRecordId) {
    result.checkRecordId = checkRecordId;
  }

  return result;
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
