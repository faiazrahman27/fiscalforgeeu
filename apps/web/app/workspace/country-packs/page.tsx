"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Database,
  FileWarning,
  Globe2,
  Layers3,
  ShieldAlert
} from "lucide-react";

type CountryPackWarning = {
  code: string;
  severity: string;
  message: string;
  legalConfidence: string;
};

type CountryPackSourceReference = {
  id: string;
  title: string;
  jurisdiction: string;
  publisher: string;
  url: string;
  reviewedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  confidence: string;
  notes?: string;
};

type CountryPackRule = {
  code: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  legalConfidence: string;
  sourceRefIds: string[];
};

type CountryPackRegistry = {
  registrySource: string;
  packVersion: string;
  lifecycleStatus: string;
  legalConfidence: string;
  sourceCount: number;
  ruleCount: number;
  capabilities: {
    vatRules: boolean;
    invoiceRules: boolean;
    peppolRules: boolean;
    vidaReadiness: boolean;
  };
  summary: string;
  disclaimer: string;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CountryPack = {
  countryCode: string;
  countryName: string;
  euMemberState: boolean;
  defaultCurrency: string;
  status: string;
  version: string;
  lastReviewedAt: string | null;
  vatNumber: {
    prefix: string;
    pattern: string;
    localFormatCheck: boolean;
    checksumCheck: boolean;
    sourceRefIds: string[];
  };
  vatRates: {
    standard: string | null;
    reduced: string[];
    sourceRefIds: string[];
    lastReviewedAt: string | null;
  };
  eInvoicingStatus: {
    b2g: string;
    b2bDomestic: string;
    b2bCrossBorder: string;
    clearanceModel: string;
  };
  sourceReferences: CountryPackSourceReference[];
  rules: CountryPackRule[];
  warnings: CountryPackWarning[];
  legalConfidence: string;
  disclaimer: string;
  registry: CountryPackRegistry;
};

type CountryPacksResponse = {
  countryPacks?: unknown[];
  count?: unknown;
  disclaimer?: unknown;
  registrySource?: unknown;
};

const DEFAULT_REGISTRY: CountryPackRegistry = {
  registrySource: "bundled",
  packVersion: "unversioned",
  lifecycleStatus: "published",
  legalConfidence: "educational_simulation",
  sourceCount: 0,
  ruleCount: 0,
  capabilities: {
    vatRules: false,
    invoiceRules: false,
    peppolRules: false,
    vidaReadiness: false
  },
  summary:
    "Registry metadata was not returned. Bundled country-pack metadata is being displayed.",
  disclaimer:
    "Country packs are educational simulations and do not provide legal, tax, accounting, filing, or compliance advice.",
  publishedAt: null,
  deprecatedAt: null,
  createdAt: null,
  updatedAt: null
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  const value = record[key];

  return typeof value === "boolean" ? value : fallback;
}

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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
  fallback = "The country-pack request failed."
) {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatLegalConfidence(value: string) {
  const labels: Record<string, string> = {
    technical: "Technical",
    standard_based: "Standard-based",
    official_source_derived: "Source-derived",
    educational_simulation: "Educational simulation",
    professional_review_required: "Professional review required"
  };

  return labels[value] ?? formatStatus(value || "not labelled");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "not set";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function formatCapability(value: boolean) {
  return value ? "enabled" : "not enabled";
}

function normalizeSourceReference(
  value: unknown
): CountryPackSourceReference | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");

  if (!id) {
    return null;
  }

  return {
    id,
    title: readStringField(value, "title", id),
    jurisdiction: readStringField(value, "jurisdiction", "unknown"),
    publisher: readStringField(value, "publisher", "unknown"),
    url: readStringField(value, "url"),
    reviewedAt: readStringField(value, "reviewedAt", "not reviewed"),
    effectiveFrom: readStringField(value, "effectiveFrom"),
    effectiveUntil: readStringField(value, "effectiveUntil"),
    confidence: readStringField(value, "confidence", "draft"),
    notes: readStringField(value, "notes")
  };
}

function normalizeWarning(value: unknown): CountryPackWarning | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    severity: readStringField(value, "severity", "warning"),
    message: readStringField(value, "message"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    )
  };
}

function normalizeRule(value: unknown): CountryPackRule | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const code = readStringField(value, "code");

  if (!code) {
    return null;
  }

  return {
    code,
    title: readStringField(value, "title", code),
    description: readStringField(value, "description"),
    category: readStringField(value, "category", "COUNTRY_PACK"),
    severity: readStringField(value, "severity", "info"),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    sourceRefIds: readStringArrayField(value, "sourceRefIds")
  };
}

function normalizeRegistry(value: unknown): CountryPackRegistry {
  if (!isPlainObject(value)) {
    return DEFAULT_REGISTRY;
  }

  const capabilities = isPlainObject(value.capabilities)
    ? value.capabilities
    : {};

  return {
    registrySource: readStringField(
      value,
      "registrySource",
      DEFAULT_REGISTRY.registrySource
    ),
    packVersion: readStringField(
      value,
      "packVersion",
      DEFAULT_REGISTRY.packVersion
    ),
    lifecycleStatus: readStringField(
      value,
      "lifecycleStatus",
      DEFAULT_REGISTRY.lifecycleStatus
    ),
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      DEFAULT_REGISTRY.legalConfidence
    ),
    sourceCount: readNumberField(value, "sourceCount"),
    ruleCount: readNumberField(value, "ruleCount"),
    capabilities: {
      vatRules: readBooleanField(capabilities, "vatRules"),
      invoiceRules: readBooleanField(capabilities, "invoiceRules"),
      peppolRules: readBooleanField(capabilities, "peppolRules"),
      vidaReadiness: readBooleanField(capabilities, "vidaReadiness")
    },
    summary: readStringField(value, "summary", DEFAULT_REGISTRY.summary),
    disclaimer: readStringField(
      value,
      "disclaimer",
      DEFAULT_REGISTRY.disclaimer
    ),
    publishedAt: readNullableStringField(value, "publishedAt"),
    deprecatedAt: readNullableStringField(value, "deprecatedAt"),
    createdAt: readNullableStringField(value, "createdAt"),
    updatedAt: readNullableStringField(value, "updatedAt")
  };
}

function normalizeCountryPack(value: unknown): CountryPack | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const countryCode = readStringField(value, "countryCode");

  if (!countryCode) {
    return null;
  }

  const vatNumber = isPlainObject(value.vatNumber) ? value.vatNumber : {};
  const vatRates = isPlainObject(value.vatRates) ? value.vatRates : {};
  const eInvoicingStatus = isPlainObject(value.eInvoicingStatus)
    ? value.eInvoicingStatus
    : {};

  return {
    countryCode,
    countryName: readStringField(value, "countryName", countryCode),
    euMemberState: readBooleanField(value, "euMemberState"),
    defaultCurrency: readStringField(value, "defaultCurrency", "EUR"),
    status: readStringField(value, "status", "draft"),
    version: readStringField(value, "version", "unversioned"),
    lastReviewedAt: readNullableStringField(value, "lastReviewedAt"),
    vatNumber: {
      prefix: readStringField(vatNumber, "prefix", countryCode),
      pattern: readStringField(vatNumber, "pattern"),
      localFormatCheck: readBooleanField(vatNumber, "localFormatCheck"),
      checksumCheck: readBooleanField(vatNumber, "checksumCheck"),
      sourceRefIds: readStringArrayField(vatNumber, "sourceRefIds")
    },
    vatRates: {
      standard: readNullableStringField(vatRates, "standard"),
      reduced: readStringArrayField(vatRates, "reduced"),
      sourceRefIds: readStringArrayField(vatRates, "sourceRefIds"),
      lastReviewedAt: readNullableStringField(vatRates, "lastReviewedAt")
    },
    eInvoicingStatus: {
      b2g: readStringField(eInvoicingStatus, "b2g", "unknown"),
      b2bDomestic: readStringField(eInvoicingStatus, "b2bDomestic", "unknown"),
      b2bCrossBorder: readStringField(
        eInvoicingStatus,
        "b2bCrossBorder",
        "unknown"
      ),
      clearanceModel: readStringField(
        eInvoicingStatus,
        "clearanceModel",
        "unknown"
      )
    },
    sourceReferences: Array.isArray(value.sourceReferences)
      ? value.sourceReferences
          .map((source) => normalizeSourceReference(source))
          .filter((source): source is CountryPackSourceReference => source !== null)
      : [],
    rules: Array.isArray(value.rules)
      ? value.rules
          .map((rule) => normalizeRule(rule))
          .filter((rule): rule is CountryPackRule => rule !== null)
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings
          .map((warning) => normalizeWarning(warning))
          .filter((warning): warning is CountryPackWarning => warning !== null)
      : [],
    legalConfidence: readStringField(
      value,
      "legalConfidence",
      "educational_simulation"
    ),
    disclaimer: readStringField(value, "disclaimer"),
    registry: normalizeRegistry(value.registry)
  };
}

export default function WorkspaceCountryPacksPage() {
  const [countryPacks, setCountryPacks] = useState<CountryPack[]>([]);
  const [isLoadingCountryPacks, setIsLoadingCountryPacks] = useState(true);
  const [countryPacksMessage, setCountryPacksMessage] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("HU");
  const [catalogRegistrySource, setCatalogRegistrySource] = useState("unknown");

  useEffect(() => {
    let isMounted = true;

    async function loadCountryPacks() {
      setIsLoadingCountryPacks(true);
      setCountryPacksMessage("");

      try {
        const response = await fetch("/api/local/country-packs", {
          method: "GET",
          cache: "no-store"
        });
        const responseData = await readResponseBody(response);

        if (!response.ok) {
          if (isMounted) {
            setCountryPacks([]);
            setCatalogRegistrySource("unknown");
            setCountryPacksMessage(
              getApiErrorMessage(
                responseData,
                "Could not load country packs from the local API."
              )
            );
          }

          return;
        }

        const apiData = responseData as CountryPacksResponse;
        const normalizedCountryPacks = Array.isArray(apiData.countryPacks)
          ? apiData.countryPacks
              .map((countryPack) => normalizeCountryPack(countryPack))
              .filter(
                (countryPack): countryPack is CountryPack =>
                  countryPack !== null
              )
          : [];

        if (isMounted) {
          setCountryPacks(normalizedCountryPacks);
          setCatalogRegistrySource(
            typeof apiData.registrySource === "string"
              ? apiData.registrySource
              : "unknown"
          );
        }
      } catch {
        if (isMounted) {
          setCountryPacks([]);
          setCatalogRegistrySource("unknown");
          setCountryPacksMessage(
            "The local country-pack API is unavailable. Make sure apps/api and apps/web are both running."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCountryPacks(false);
        }
      }
    }

    loadCountryPacks();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCountryPack = useMemo(
    () =>
      countryPacks.find(
        (countryPack) => countryPack.countryCode === selectedCountryCode
      ) ??
      countryPacks.find((countryPack) => countryPack.countryCode === "EU") ??
      null,
    [countryPacks, selectedCountryCode]
  );

  const euMemberStateCount = useMemo(
    () => countryPacks.filter((countryPack) => countryPack.euMemberState).length,
    [countryPacks]
  );

  const sourceReferenceCount = useMemo(
    () =>
      new Set(
        countryPacks.flatMap((countryPack) =>
          countryPack.sourceReferences.map((source) => source.id)
        )
      ).size,
    [countryPacks]
  );

  const databaseBackedCount = useMemo(
    () =>
      countryPacks.filter(
        (countryPack) => countryPack.registry.registrySource === "database"
      ).length,
    [countryPacks]
  );

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Country packs</p>
        <h2>Review source-linked country simulations.</h2>
        <p>
          Country packs are Invoice Lantern educational simulations for VAT ID
          patterns, e-invoicing context, source references, rule boundaries, and
          professional-review warnings. They do not certify legal, tax, accounting,
          filing, Peppol, EN 16931, or ViDA compliance.
        </p>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Total packs</p>
          <strong>{countryPacks.length}</strong>
          <span>EU core plus supported country-pack shells.</span>
        </div>

        <div className="workspace-stat">
          <p>EU member states</p>
          <strong>{euMemberStateCount}</strong>
          <span>Country packs marked as EU Member State simulations.</span>
        </div>

        <div className="workspace-stat">
          <p>Registry</p>
          <strong>{databaseBackedCount}</strong>
          <span>
            Database-backed packs. Catalog source:{" "}
            {formatStatus(catalogRegistrySource)}.
          </span>
        </div>

        <div className="workspace-stat">
          <p>Source refs</p>
          <strong>{sourceReferenceCount}</strong>
          <span>Unique public-source references attached to the packs.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />

          <div>
            <p>Legal boundary</p>
            <h3>No country pack is a compliance guarantee.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Country packs must remain source-linked, versioned, and cautious.
              “EU-core only” means country-specific legal/tax rules are not yet
              reviewed enough for stronger simulation output.
            </p>
          </div>

          <div className="alert-item">
            <span />
            <p>
              Use these packs for technical readiness, educational context, and
              structured warnings only. Real-world invoices still require a
              qualified accountant, tax adviser, or competent authority where
              appropriate.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Country catalogue</p>
            <h3>Available packs</h3>
          </div>

          <div className="confidence-label">
            <Globe2 size={17} />
            read only
          </div>
        </div>

        {countryPacksMessage ? (
          <div className="alert-item">
            <span />
            <p>{countryPacksMessage}</p>
          </div>
        ) : null}

        <div className="workspace-data-grid">
          {isLoadingCountryPacks ? (
            <div className="workspace-data-card is-full">
              <p>Loading</p>
              <strong>Reading country packs from the local API proxy.</strong>
              <span>Only API-owned country-pack data is displayed here.</span>
            </div>
          ) : countryPacks.length === 0 ? (
            <div className="workspace-data-card is-full">
              <p>No country packs</p>
              <strong>No country packs were returned.</strong>
              <span>
                The API may be unavailable or the country-pack package is not
                wired into the API yet.
              </span>
            </div>
          ) : (
            countryPacks.map((countryPack) => (
              <button
                className="workspace-data-card is-wide"
                key={countryPack.countryCode}
                onClick={() => {
                  setSelectedCountryCode(countryPack.countryCode);
                }}
                type="button"
              >
                <p>
                  {countryPack.countryCode} ·{" "}
                  {formatStatus(countryPack.registry.registrySource)}
                </p>
                <strong>{countryPack.countryName}</strong>
                <span>
                  Lifecycle: {formatStatus(countryPack.registry.lifecycleStatus)}.
                  Version: {countryPack.registry.packVersion}. Currency:{" "}
                  {countryPack.defaultCurrency}.
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="findings-console">
        <div className="findings-console-head">
          <div>
            <p>Selected pack</p>
            <h3>{selectedCountryPack?.countryName ?? "No pack selected"}</h3>
          </div>

          <div className="confidence-label">
            <Layers3 size={17} />
            {selectedCountryPack
              ? formatLegalConfidence(selectedCountryPack.registry.legalConfidence)
              : "not loaded"}
          </div>
        </div>

        {selectedCountryPack ? (
          <div className="finding-console-list">
            <div className="finding-console-row">
              <Database size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_REGISTRY</strong>
                <p>
                  Source:{" "}
                  {formatStatus(selectedCountryPack.registry.registrySource)}.
                  Lifecycle:{" "}
                  {formatStatus(selectedCountryPack.registry.lifecycleStatus)}.
                  Pack version: {selectedCountryPack.registry.packVersion}.
                </p>
                <p>
                  Published:{" "}
                  {formatDateTime(selectedCountryPack.registry.publishedAt)}.
                  Deprecated:{" "}
                  {formatDateTime(selectedCountryPack.registry.deprecatedAt)}.
                  Updated: {formatDateTime(selectedCountryPack.registry.updatedAt)}.
                </p>
                <p>{selectedCountryPack.registry.summary}</p>
              </div>

              <span>{selectedCountryPack.registry.lifecycleStatus}</span>
            </div>

            <div className="finding-console-row">
              <ShieldAlert size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_CAPABILITIES</strong>
                <p>
                  VAT rules:{" "}
                  {formatCapability(
                    selectedCountryPack.registry.capabilities.vatRules
                  )}.
                  Invoice rules:{" "}
                  {formatCapability(
                    selectedCountryPack.registry.capabilities.invoiceRules
                  )}.
                </p>
                <p>
                  Peppol-style rules:{" "}
                  {formatCapability(
                    selectedCountryPack.registry.capabilities.peppolRules
                  )}.
                  ViDA readiness:{" "}
                  {formatCapability(
                    selectedCountryPack.registry.capabilities.vidaReadiness
                  )}.
                </p>
                <p>
                  Registry source count: {selectedCountryPack.registry.sourceCount}.
                  Registry rule count: {selectedCountryPack.registry.ruleCount}.
                </p>
              </div>

              <span>capability</span>
            </div>

            <div className="finding-console-row">
              <Database size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_PACK_STATUS</strong>
                <p>
                  Status: {formatStatus(selectedCountryPack.status)}. Version:{" "}
                  {selectedCountryPack.version}. Last reviewed:{" "}
                  {selectedCountryPack.lastReviewedAt ??
                    "country-specific review pending"}.
                </p>
                <p>
                  B2G: {formatStatus(selectedCountryPack.eInvoicingStatus.b2g)}.
                  B2B domestic:{" "}
                  {formatStatus(selectedCountryPack.eInvoicingStatus.b2bDomestic)}.
                  Cross-border B2B:{" "}
                  {formatStatus(selectedCountryPack.eInvoicingStatus.b2bCrossBorder)}.
                </p>
              </div>

              <span>{selectedCountryPack.status}</span>
            </div>

            <div className="finding-console-row">
              <BookOpenCheck size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_VAT_FORMAT</strong>
                <p>
                  Prefix: {selectedCountryPack.vatNumber.prefix}. Pattern:{" "}
                  {selectedCountryPack.vatNumber.pattern || "not configured"}.
                </p>
                <p>
                  Local format check:{" "}
                  {selectedCountryPack.vatNumber.localFormatCheck
                    ? "enabled"
                    : "disabled"}.
                  Checksum check:{" "}
                  {selectedCountryPack.vatNumber.checksumCheck
                    ? "enabled"
                    : "not enabled"}.
                </p>
              </div>

              <span>technical</span>
            </div>

            <div className="finding-console-row">
              <FileWarning size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_VAT_RATES</strong>
                <p>
                  Standard VAT rate:{" "}
                  {selectedCountryPack.vatRates.standard ?? "not stored yet"}.
                  Reduced rates:{" "}
                  {selectedCountryPack.vatRates.reduced.length > 0
                    ? selectedCountryPack.vatRates.reduced.join(", ")
                    : "not stored yet"}.
                </p>
                <p>
                  VAT-rate review date:{" "}
                  {selectedCountryPack.vatRates.lastReviewedAt ??
                    "country-specific source review pending"}.
                </p>
              </div>

              <span>review</span>
            </div>

            <div className="finding-console-row">
              <ShieldAlert size={18} />

              <div>
                <strong>{selectedCountryPack.countryCode}_REGISTRY_DISCLAIMER</strong>
                <p>{selectedCountryPack.registry.disclaimer}</p>
                <p>Pack disclaimer: {selectedCountryPack.disclaimer}</p>
              </div>

              <span>boundary</span>
            </div>

            {selectedCountryPack.warnings.map((warning) => (
              <div className="finding-console-row" key={warning.code}>
                <AlertTriangle size={18} />

                <div>
                  <strong>{warning.code}</strong>
                  <p>{warning.message}</p>
                  <p>
                    Legal confidence:{" "}
                    {formatLegalConfidence(warning.legalConfidence)}.
                  </p>
                </div>

                <span>{warning.severity}</span>
              </div>
            ))}

            {selectedCountryPack.rules.map((rule) => (
              <div className="finding-console-row" key={rule.code}>
                <BookOpenCheck size={18} />

                <div>
                  <strong>{rule.code}</strong>
                  <p>{rule.title}</p>
                  <p>{rule.description}</p>
                  <p>
                    Category: {rule.category}. Legal confidence:{" "}
                    {formatLegalConfidence(rule.legalConfidence)}. Sources:{" "}
                    {rule.sourceRefIds.length > 0
                      ? rule.sourceRefIds.join(", ")
                      : "No source reference"}.
                  </p>
                </div>

                <span>{rule.severity}</span>
              </div>
            ))}

            {selectedCountryPack.sourceReferences.map((sourceReference) => (
              <div className="finding-console-row" key={sourceReference.id}>
                <Globe2 size={18} />

                <div>
                  <strong>{sourceReference.title}</strong>
                  <p>
                    Publisher: {sourceReference.publisher}. Jurisdiction:{" "}
                    {sourceReference.jurisdiction}. Reviewed:{" "}
                    {sourceReference.reviewedAt}. Confidence:{" "}
                    {formatStatus(sourceReference.confidence)}.
                  </p>
                  <p>{sourceReference.notes || "No additional source notes."}</p>
                </div>

                <span>source</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="finding-console-list">
            <div className="finding-console-row">
              <AlertTriangle size={18} />

              <div>
                <strong>NO_COUNTRY_PACK_SELECTED</strong>
                <p>No country-pack detail is available yet.</p>
              </div>

              <span>warning</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
