"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Code2,
  Copy,
  Eraser,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from "lucide-react";

type ApiKeyScope =
  | "invoices:validate"
  | "invoices:export_ubl"
  | "invoices:parse_ubl"
  | "invoices:import_ubl"
  | "xml:validation_jobs"
  | "vat:validate_format"
  | "transactions:simulate_vida"
  | "validation_runs:read"
  | "rules:read";

type ApiKeyEnvironment = "test" | "live";
type ApiKeyStatus = "active" | "revoked" | "expired";

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  status: ApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type ApiRequestRecord = {
  id: string;
  organizationId: string | null;
  apiKeyId: string | null;
  apiKeyName: string | null;
  apiKeyPrefix: string | null;
  requestMethod: string;
  requestPath: string;
  statusCode: number | null;
  durationMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  errorCode: string | null;
  createdAt: string;
};

type ApiUsageSummary = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  clientErrorCount: number;
  serverErrorCount: number;
  averageDurationMs: number;
  lastRequestAt: string | null;
  topPaths: {
    path: string;
    count: number;
  }[];
  statusBuckets: {
    "2xx": number;
    "3xx": number;
    "4xx": number;
    "5xx": number;
  };
};

type ApiRateLimitPolicy = {
  policyKey: string;
  scope: string;
  windowSeconds: number;
  maxRequests: number;
  description: string;
  appliesTo: "api_key" | "organization";
};

type ApiRateLimitUsageStatus = {
  apiKeyId: string | null;
  policyKey: string;
  windowSeconds: number;
  maxRequests: number;
  used: number;
  remaining: number;
  resetAt: string;
  status: "ok" | "limited";
};

type ApiKeyFormState = {
  name: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  expiresAt: string;
};

type ApiTestEndpointId =
  | "validation-rules"
  | "vat-format"
  | "vida-simulation"
  | "invoice-validation"
  | "ubl-parse"
  | "xml-validation-jobs";

type ApiTestEndpoint = {
  id: ApiTestEndpointId;
  label: string;
  method: "GET" | "POST";
  path: string;
  scope: ApiKeyScope;
  body: unknown | null;
};

type ApiTestResult = {
  status: number | null;
  ok: boolean;
  message: string;
  data: unknown;
  rateLimit: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
    retryAfter: string | null;
  } | null;
};

const scopeOptions: {
  value: ApiKeyScope;
  label: string;
  description: string;
}[] = [
  {
    value: "invoices:validate",
    label: "Validate invoices",
    description: "POST /api/v1/invoices/validate"
  },
  {
    value: "invoices:export_ubl",
    label: "Export UBL",
    description: "POST /api/v1/invoices/export/ubl"
  },
  {
    value: "invoices:parse_ubl",
    label: "Parse UBL",
    description: "POST /api/v1/invoices/parse/ubl"
  },
  {
    value: "invoices:import_ubl",
    label: "Import UBL",
    description: "Reserved until draft ownership is API-key safe"
  },
  {
    value: "xml:validation_jobs",
    label: "XML validation jobs",
    description: "POST /api/v1/xml/validation-jobs"
  },
  {
    value: "vat:validate_format",
    label: "VAT format",
    description: "POST /api/v1/vat/validate-format"
  },
  {
    value: "transactions:simulate_vida",
    label: "ViDA simulation",
    description: "POST /api/v1/transactions/simulate-vida"
  },
  {
    value: "validation_runs:read",
    label: "Read reports",
    description: "GET /api/v1/validation-runs/:id"
  },
  {
    value: "rules:read",
    label: "Read rules",
    description: "GET /api/v1/validation/rules"
  }
];

const defaultFormState: ApiKeyFormState = {
  name: "",
  environment: "test",
  scopes: ["invoices:validate", "vat:validate_format"],
  expiresAt: ""
};

const emptyUsageSummary: ApiUsageSummary = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  clientErrorCount: 0,
  serverErrorCount: 0,
  averageDurationMs: 0,
  lastRequestAt: null,
  topPaths: [],
  statusBuckets: {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0
  }
};

const invoiceValidationSample = {
  document: {
    type: "invoice",
    number: "INV-API-TEST-001",
    currency: "EUR",
    issueDate: "2026-04-30"
  },
  seller: {
    name: "Invoice Lantern Seller GmbH",
    country: "DE",
    vatId: "DE123456789"
  },
  buyer: {
    name: "Invoice Lantern Buyer Kft",
    country: "HU",
    vatId: "HU12345678"
  },
  lines: [
    {
      id: "1",
      description: "Sandbox validation service",
      quantity: "1",
      unitCode: "EA",
      unitPrice: "100.00",
      vatCategory: "S",
      vatRate: "27"
    }
  ]
};

const vidaSimulationSample = {
  sellerCountry: "DE",
  buyerCountry: "HU",
  sellerVatId: "DE123456789",
  buyerVatId: "HU12345678",
  buyerType: "business",
  transactionType: "services",
  invoiceDate: "2026-05-01",
  currency: "EUR",
  amount: "100.00",
  countryPackVersions: {
    DE: "2026.05.1",
    HU: "2026.05.1"
  }
};

const tinyUblXmlSample = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:invoice-lantern:test:1</cbc:CustomizationID>
  <cbc:ProfileID>Invoice Lantern parser test</cbc:ProfileID>
  <cbc:ID>INV-UBL-TEST-001</cbc:ID>
  <cbc:IssueDate>2026-04-30</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Parser Seller GmbH</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Parser Buyer Kft</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>HU</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>HU12345678</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>Sandbox parse service</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const apiTestEndpoints: ApiTestEndpoint[] = [
  {
    id: "validation-rules",
    label: "Validation rules catalog",
    method: "GET",
    path: "/api/v1/validation/rules",
    scope: "rules:read",
    body: null
  },
  {
    id: "vat-format",
    label: "VAT format check",
    method: "POST",
    path: "/api/v1/vat/validate-format",
    scope: "vat:validate_format",
    body: {
      vatId: "HU12345678",
      countryHint: "HU"
    }
  },
  {
    id: "vida-simulation",
    label: "ViDA readiness simulation",
    method: "POST",
    path: "/api/v1/transactions/simulate-vida",
    scope: "transactions:simulate_vida",
    body: vidaSimulationSample
  },
  {
    id: "invoice-validation",
    label: "Invoice validation",
    method: "POST",
    path: "/api/v1/invoices/validate",
    scope: "invoices:validate",
    body: invoiceValidationSample
  },
  {
    id: "ubl-parse",
    label: "UBL parse",
    method: "POST",
    path: "/api/v1/invoices/parse/ubl",
    scope: "invoices:parse_ubl",
    body: {
      xml: tinyUblXmlSample
    }
  },
  {
    id: "xml-validation-jobs",
    label: "XML validation job",
    method: "POST",
    path: "/api/v1/xml/validation-jobs",
    scope: "xml:validation_jobs",
    body: {
      xml: tinyUblXmlSample,
      filename: "api-worker-readiness.xml",
      sourceType: "api_payload",
      requestedChecks: [
        "worker_readiness",
        "xsd_ubl",
        "schematron_peppol_placeholder"
      ]
    }
  }
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function readNumberField(
  record: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readNullableNumberField(
  record: Record<string, unknown>,
  key: string
) {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isApiKeyScope(value: unknown): value is ApiKeyScope {
  return (
    value === "invoices:validate" ||
    value === "invoices:export_ubl" ||
    value === "invoices:parse_ubl" ||
    value === "invoices:import_ubl" ||
    value === "xml:validation_jobs" ||
    value === "vat:validate_format" ||
    value === "transactions:simulate_vida" ||
    value === "validation_runs:read" ||
    value === "rules:read"
  );
}

function normalizeApiKey(value: unknown): ApiKeyRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const name = readStringField(value, "name");
  const keyPrefix = readStringField(value, "keyPrefix");
  const createdAt = readStringField(value, "createdAt");
  const environment = value.environment === "live" ? "live" : "test";
  const status =
    value.status === "revoked" || value.status === "expired"
      ? value.status
      : "active";

  if (!id || !name || !keyPrefix || !createdAt) {
    return null;
  }

  const scopes = Array.isArray(value.scopes)
    ? value.scopes.filter(isApiKeyScope)
    : [];

  return {
    id,
    name,
    keyPrefix,
    environment,
    scopes,
    status,
    expiresAt: readNullableStringField(value, "expiresAt"),
    lastUsedAt: readNullableStringField(value, "lastUsedAt"),
    lastUsedIp: readNullableStringField(value, "lastUsedIp"),
    createdAt,
    revokedAt: readNullableStringField(value, "revokedAt")
  };
}

function normalizeApiRequest(value: unknown): ApiRequestRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const requestMethod = readStringField(value, "requestMethod");
  const requestPath = readStringField(value, "requestPath");
  const createdAt = readStringField(value, "createdAt");

  if (!id || !requestMethod || !requestPath || !createdAt) {
    return null;
  }

  return {
    id,
    organizationId: readNullableStringField(value, "organizationId"),
    apiKeyId: readNullableStringField(value, "apiKeyId"),
    apiKeyName: readNullableStringField(value, "apiKeyName"),
    apiKeyPrefix: readNullableStringField(value, "apiKeyPrefix"),
    requestMethod,
    requestPath,
    statusCode: readNullableNumberField(value, "statusCode"),
    durationMs: readNullableNumberField(value, "durationMs"),
    ipAddress: readNullableStringField(value, "ipAddress"),
    userAgent: readNullableStringField(value, "userAgent"),
    errorCode: readNullableStringField(value, "errorCode"),
    createdAt
  };
}

function normalizeUsageSummary(value: unknown): ApiUsageSummary {
  if (!isPlainObject(value)) {
    return emptyUsageSummary;
  }

  const statusBuckets = isPlainObject(value.statusBuckets)
    ? value.statusBuckets
    : {};
  const topPaths = Array.isArray(value.topPaths)
    ? value.topPaths
        .filter(isPlainObject)
        .map((pathRecord) => ({
          path: readStringField(pathRecord, "path"),
          count: readNumberField(pathRecord, "count")
        }))
        .filter((pathRecord) => pathRecord.path)
    : [];

  return {
    totalRequests: readNumberField(value, "totalRequests"),
    successfulRequests: readNumberField(value, "successfulRequests"),
    failedRequests: readNumberField(value, "failedRequests"),
    clientErrorCount: readNumberField(value, "clientErrorCount"),
    serverErrorCount: readNumberField(value, "serverErrorCount"),
    averageDurationMs: readNumberField(value, "averageDurationMs"),
    lastRequestAt: readNullableStringField(value, "lastRequestAt"),
    topPaths,
    statusBuckets: {
      "2xx": readNumberField(statusBuckets, "2xx"),
      "3xx": readNumberField(statusBuckets, "3xx"),
      "4xx": readNumberField(statusBuckets, "4xx"),
      "5xx": readNumberField(statusBuckets, "5xx")
    }
  };
}

function normalizeRateLimitPolicy(value: unknown): ApiRateLimitPolicy | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const policyKey = readStringField(value, "policyKey");
  const scope = readStringField(value, "scope");
  const description = readStringField(value, "description");
  const appliesTo =
    value.appliesTo === "organization" ? "organization" : "api_key";
  const windowSeconds = readNumberField(value, "windowSeconds");
  const maxRequests = readNumberField(value, "maxRequests");

  if (!policyKey || !scope || !description || windowSeconds <= 0 || maxRequests <= 0) {
    return null;
  }

  return {
    policyKey,
    scope,
    windowSeconds,
    maxRequests,
    description,
    appliesTo
  };
}

function normalizeRateLimitUsage(
  value: unknown
): ApiRateLimitUsageStatus | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const policyKey = readStringField(value, "policyKey");
  const resetAt = readStringField(value, "resetAt");
  const status = value.status === "limited" ? "limited" : "ok";
  const windowSeconds = readNumberField(value, "windowSeconds");
  const maxRequests = readNumberField(value, "maxRequests");

  if (!policyKey || !resetAt || windowSeconds <= 0 || maxRequests <= 0) {
    return null;
  }

  return {
    apiKeyId: readNullableStringField(value, "apiKeyId"),
    policyKey,
    windowSeconds,
    maxRequests,
    used: readNumberField(value, "used"),
    remaining: readNumberField(value, "remaining"),
    resetAt,
    status
  };
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatPolicyLabel(value: string) {
  return value
    .replace(/^invoices_/, "invoice ")
    .replace(/^vat_/, "VAT ")
    .replace(/^transactions_/, "transaction ")
    .replace(/^validation_/, "validation ")
    .replace(/^organization_/, "organization ")
    .replaceAll("_", " ");
}

function formatWindowSeconds(value: number) {
  if (value % 60 === 0) {
    const minutes = value / 60;

    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${value} seconds`;
}

function formatDuration(value: number | null) {
  return typeof value === "number" ? `${value} ms` : "Not recorded";
}

function formatStatusCode(value: number | null) {
  return typeof value === "number" ? String(value) : "pending";
}

function getStatusTone(statusCode: number | null) {
  if (typeof statusCode !== "number") {
    return "is-neutral";
  }

  if (statusCode >= 200 && statusCode < 300) {
    return "is-good";
  }

  if (statusCode >= 400 && statusCode < 500) {
    return "is-warn";
  }

  if (statusCode >= 500) {
    return "is-danger";
  }

  return "is-neutral";
}

function buildExpiryIso(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function maskApiKeyForDisplay(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "il_test_your_key_here";
  }

  const separatorIndex = trimmedValue.indexOf(".");

  if (separatorIndex > 0) {
    return `${trimmedValue.slice(0, separatorIndex)}.********`;
  }

  if (trimmedValue.length <= 12) {
    return "********";
  }

  return `${trimmedValue.slice(0, 8)}...********`;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function readResponseRateLimitHeaders(response: Response) {
  const limit = response.headers.get("x-ratelimit-limit");
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  const retryAfter = response.headers.get("retry-after");

  if (!limit && !remaining && !reset && !retryAfter) {
    return null;
  }

  return {
    limit,
    remaining,
    reset,
    retryAfter
  };
}

export default function WorkspaceApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [formState, setFormState] = useState<ApiKeyFormState>(defaultFormState);
  const [createdSecret, setCreatedSecret] = useState("");
  const [createdWarning, setCreatedWarning] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [selectedApiKeyFilter, setSelectedApiKeyFilter] = useState("all");
  const [requestLogs, setRequestLogs] = useState<ApiRequestRecord[]>([]);
  const [usageSummary, setUsageSummary] =
    useState<ApiUsageSummary>(emptyUsageSummary);
  const [rateLimitPolicies, setRateLimitPolicies] = useState<
    ApiRateLimitPolicy[]
  >([]);
  const [currentRateLimits, setCurrentRateLimits] = useState<
    ApiRateLimitUsageStatus[]
  >([]);
  const [usageMessage, setUsageMessage] = useState("");
  const [isUsageLoading, setIsUsageLoading] = useState(true);
  const [apiTestKey, setApiTestKey] = useState("");
  const [apiTestBaseUrl, setApiTestBaseUrl] = useState("http://localhost:4000");
  const [apiTestEndpointId, setApiTestEndpointId] =
    useState<ApiTestEndpointId>("validation-rules");
  const [apiTestResult, setApiTestResult] = useState<ApiTestResult | null>(
    null
  );
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);

  const counts = useMemo(
    () => ({
      total: apiKeys.length,
      active: apiKeys.filter((apiKey) => apiKey.status === "active").length,
      revoked: apiKeys.filter((apiKey) => apiKey.status === "revoked").length,
      expired: apiKeys.filter((apiKey) => apiKey.status === "expired").length
    }),
    [apiKeys]
  );

  const selectedApiKeyId =
    selectedApiKeyFilter === "all" ? "" : selectedApiKeyFilter;

  const selectedEndpoint =
    apiTestEndpoints.find((endpoint) => endpoint.id === apiTestEndpointId) ??
    apiTestEndpoints[0]!;

  const apiTestPreview = useMemo(() => {
    const preview: Record<string, unknown> = {
      method: selectedEndpoint.method,
      url: `${normalizeBaseUrl(apiTestBaseUrl)}${selectedEndpoint.path}`,
      headers: {
        "X-API-Key": maskApiKeyForDisplay(apiTestKey),
        ...(selectedEndpoint.body ? { "content-type": "application/json" } : {})
      }
    };

    if (selectedEndpoint.body) {
      preview.body = selectedEndpoint.body;
    }

    return preview;
  }, [apiTestBaseUrl, apiTestKey, selectedEndpoint]);

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/local/api-keys", {
        method: "GET",
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);

      if (!response.ok) {
        setApiKeys([]);
        setMessage(
          getApiErrorMessage(
            responseData,
            "API keys could not be loaded. Owner, admin, or developer role may be required."
          )
        );
        return;
      }

      const records =
        isPlainObject(responseData) && Array.isArray(responseData.apiKeys)
          ? responseData.apiKeys
          : [];

      setApiKeys(
        records
          .map((record) => normalizeApiKey(record))
          .filter((record): record is ApiKeyRecord => record !== null)
      );
    } catch {
      setApiKeys([]);
      setMessage(
        "API key management is unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadApiUsage = useCallback(async () => {
    setIsUsageLoading(true);
    setUsageMessage("");

    const requestParams = new URLSearchParams({
      limit: "25"
    });
    const summaryParams = new URLSearchParams({
      sinceDays: "30"
    });
    const currentUsageParams = new URLSearchParams();

    if (selectedApiKeyId) {
      requestParams.set("apiKeyId", selectedApiKeyId);
      summaryParams.set("apiKeyId", selectedApiKeyId);
      currentUsageParams.set("apiKeyId", selectedApiKeyId);
    }

    try {
      const currentUsageQuery = currentUsageParams.toString();
      const currentUsageUrl = currentUsageQuery
        ? `/api/local/api-usage/current?${currentUsageQuery}`
        : "/api/local/api-usage/current";
      const [
        requestsResponse,
        summaryResponse,
        policiesResponse,
        currentUsageResponse
      ] = await Promise.all([
        fetch(`/api/local/api-requests?${requestParams.toString()}`, {
          method: "GET",
          cache: "no-store"
        }),
        fetch(`/api/local/api-requests/summary?${summaryParams.toString()}`, {
          method: "GET",
          cache: "no-store"
        }),
        fetch("/api/local/api-usage/policies", {
          method: "GET",
          cache: "no-store"
        }),
        fetch(currentUsageUrl, {
          method: "GET",
          cache: "no-store"
        })
      ]);
      const [requestsData, summaryData, policiesData, currentUsageData] =
        await Promise.all([
          readResponseBody(requestsResponse),
          readResponseBody(summaryResponse),
          readResponseBody(policiesResponse),
          readResponseBody(currentUsageResponse)
        ]);

      if (!requestsResponse.ok) {
        setRequestLogs([]);
        setUsageSummary(emptyUsageSummary);
        setRateLimitPolicies([]);
        setCurrentRateLimits([]);
        setUsageMessage(
          getApiErrorMessage(
            requestsData,
            "API request logs could not be loaded. Owner, admin, or developer role may be required."
          )
        );
        return;
      }

      if (!summaryResponse.ok) {
        setRequestLogs([]);
        setUsageSummary(emptyUsageSummary);
        setRateLimitPolicies([]);
        setCurrentRateLimits([]);
        setUsageMessage(
          getApiErrorMessage(
            summaryData,
            "API usage summary could not be loaded. Owner, admin, or developer role may be required."
          )
        );
        return;
      }

      if (!policiesResponse.ok) {
        setRateLimitPolicies([]);
        setCurrentRateLimits([]);
        setUsageMessage(
          getApiErrorMessage(
            policiesData,
            "API usage policies could not be loaded for this workspace."
          )
        );
        return;
      }

      if (!currentUsageResponse.ok) {
        setCurrentRateLimits([]);
        setUsageMessage(
          getApiErrorMessage(
            currentUsageData,
            "Current API usage limits could not be loaded for this workspace."
          )
        );
        return;
      }

      const requestRecords =
        isPlainObject(requestsData) && Array.isArray(requestsData.apiRequests)
          ? requestsData.apiRequests
          : [];
      const policies =
        isPlainObject(policiesData) && Array.isArray(policiesData.policies)
          ? policiesData.policies
          : [];
      const currentUsage =
        isPlainObject(currentUsageData) && Array.isArray(currentUsageData.usage)
          ? currentUsageData.usage
          : [];

      setRequestLogs(
        requestRecords
          .map((record) => normalizeApiRequest(record))
          .filter((record): record is ApiRequestRecord => record !== null)
      );
      setUsageSummary(
        isPlainObject(summaryData)
          ? normalizeUsageSummary(summaryData.summary)
          : emptyUsageSummary
      );
      setRateLimitPolicies(
        policies
          .map((record) => normalizeRateLimitPolicy(record))
          .filter((record): record is ApiRateLimitPolicy => record !== null)
      );
      setCurrentRateLimits(
        currentUsage
          .map((record) => normalizeRateLimitUsage(record))
          .filter(
            (record): record is ApiRateLimitUsageStatus => record !== null
          )
      );
    } catch {
      setRequestLogs([]);
      setUsageSummary(emptyUsageSummary);
      setRateLimitPolicies([]);
      setCurrentRateLimits([]);
      setUsageMessage(
        "API usage logs are unavailable. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsUsageLoading(false);
    }
  }, [selectedApiKeyId]);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    void loadApiUsage();
  }, [loadApiUsage]);

  function updateScope(scope: ApiKeyScope, checked: boolean) {
    setFormState((current) => {
      if (checked) {
        return {
          ...current,
          scopes: current.scopes.includes(scope)
            ? current.scopes
            : [...current.scopes, scope]
        };
      }

      return {
        ...current,
        scopes: current.scopes.filter((item) => item !== scope)
      };
    });
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setMessage("");
    setCopyMessage("");
    setCreatedSecret("");
    setCreatedWarning("");

    try {
      const response = await fetch("/api/local/api-keys", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: formState.name,
          environment: formState.environment,
          scopes: formState.scopes,
          expiresAt: buildExpiryIso(formState.expiresAt)
        })
      });
      const responseData = await readResponseBody(response);

      if (!response.ok || !isPlainObject(responseData)) {
        setMessage(
          getApiErrorMessage(
            responseData,
            "API key could not be created. Owner, admin, or developer role may be required."
          )
        );
        return;
      }

      const createdApiKey = normalizeApiKey(responseData.apiKey);
      const secret =
        typeof responseData.secret === "string" ? responseData.secret : "";
      const warning =
        typeof responseData.warning === "string" ? responseData.warning : "";

      if (createdApiKey) {
        setApiKeys((current) => [createdApiKey, ...current]);
      }

      setCreatedSecret(secret);
      setCreatedWarning(warning);
      setFormState(defaultFormState);
    } catch {
      setMessage(
        "API key could not be created. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function revokeKey(apiKey: ApiKeyRecord) {
    if (
      !window.confirm(
        `Revoke ${apiKey.name}? Requests using this key will stop working.`
      )
    ) {
      return;
    }

    setRevokingId(apiKey.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/api-keys/${encodeURIComponent(apiKey.id)}/revoke`,
        {
          method: "POST",
          cache: "no-store"
        }
      );
      const responseData = await readResponseBody(response);

      if (!response.ok || !isPlainObject(responseData)) {
        setMessage(
          getApiErrorMessage(
            responseData,
            "API key could not be revoked. Owner, admin, or developer role may be required."
          )
        );
        return;
      }

      const revokedApiKey = normalizeApiKey(responseData.apiKey);

      if (!revokedApiKey) {
        void loadApiKeys();
        return;
      }

      setApiKeys((current) =>
        current.map((item) =>
          item.id === revokedApiKey.id ? revokedApiKey : item
        )
      );
      void loadApiUsage();
    } catch {
      setMessage(
        "API key could not be revoked. Make sure apps/api and apps/web are both running."
      );
    } finally {
      setRevokingId("");
    }
  }

  async function copyCreatedSecret() {
    if (!createdSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopyMessage("Copied. Store it now; it will not be shown again.");
    } catch {
      setCopyMessage("Copy failed. Select and copy the key manually.");
    }
  }

  async function runApiTest() {
    const trimmedKey = apiTestKey.trim();
    const baseUrl = normalizeBaseUrl(apiTestBaseUrl);

    setApiTestResult(null);

    if (!trimmedKey) {
      setApiTestResult({
        status: null,
        ok: false,
        message: "Paste an API key before running a sandbox API test.",
        data: null,
        rateLimit: null
      });
      return;
    }

    if (!isValidUrl(baseUrl)) {
      setApiTestResult({
        status: null,
        ok: false,
        message: "Enter a valid API base URL, such as http://localhost:4000.",
        data: null,
        rateLimit: null
      });
      return;
    }

    setIsTestingEndpoint(true);

    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        "x-api-key": trimmedKey
      };
      const body = selectedEndpoint.body
        ? JSON.stringify(selectedEndpoint.body)
        : undefined;

      if (body) {
        headers["content-type"] = "application/json";
      }

      const response = await fetch(`${baseUrl}${selectedEndpoint.path}`, {
        method: selectedEndpoint.method,
        headers,
        body,
        cache: "no-store"
      });
      const responseData = await readResponseBody(response);
      const rateLimit = readResponseRateLimitHeaders(response);

      setApiTestResult({
        status: response.status,
        ok: response.ok,
        message: response.ok
          ? "Request completed."
          : response.status === 429 && rateLimit?.retryAfter
            ? `${getApiErrorMessage(
                responseData,
                "Sandbox API request failed."
              )} Retry after ${rateLimit.retryAfter} seconds.`
            : getApiErrorMessage(responseData, "Sandbox API request failed."),
        data: responseData,
        rateLimit
      });

      void loadApiUsage();
    } catch {
      setApiTestResult({
        status: null,
        ok: false,
        message:
          "Request could not be sent. Check the API base URL and local CORS settings.",
        data: null,
        rateLimit: null
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  }

  const canCreate =
    formState.name.trim().length > 0 &&
    formState.scopes.length > 0 &&
    !isCreating;

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Sandbox developer API</p>
        <h2>Organization API keys.</h2>
        <p>
          Create scoped keys for Invoice Lantern technical validation endpoints.
          API key management and API request logs are available to owner, admin,
          and developer workspace roles. This is not an official filing API, not
          authority submission, and not a compliance guarantee.
        </p>
        <div className="workspace-row-actions">
          <Link href="/developer-api/reference" className="text-link-button">
            <BookOpen size={16} />
            API reference
          </Link>
          <Link href="/developer-api" className="text-link-button">
            <Code2 size={16} />
            Public API overview
          </Link>
        </div>
      </section>

      <section className="workspace-stat-strip">
        <div className="workspace-stat">
          <p>Total keys</p>
          <strong>{isLoading ? "Loading" : counts.total}</strong>
          <span>Metadata only. Plaintext keys are never listed.</span>
        </div>

        <div className="workspace-stat">
          <p>Active</p>
          <strong>{isLoading ? "Loading" : counts.active}</strong>
          <span>Keys that can authenticate scoped developer API requests.</span>
        </div>

        <div className="workspace-stat">
          <p>Revoked</p>
          <strong>{isLoading ? "Loading" : counts.revoked}</strong>
          <span>Keys disabled by an owner, admin, or developer.</span>
        </div>

        <div className="workspace-stat">
          <p>Expired</p>
          <strong>{isLoading ? "Loading" : counts.expired}</strong>
          <span>Keys past their configured expiry date.</span>
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldAlert size={22} />
          <div>
            <p>Boundary</p>
            <h3>Technical validation only.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              API key management and API request logs are available to owner,
              admin, and developer workspace roles. Accountants, reviewers, and
              viewers should not manage developer secrets.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Invoice Lantern API keys provide access to sandbox technical
              validation and readiness-simulation tools only. They are not
              official filing credentials and do not provide tax authority
              submission capability.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Do not use Invoice Lantern API responses as the sole basis for
              legal, tax, or accounting decisions.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Send organization API keys with the X-API-Key header, for example
              X-API-Key: il_test_your_key_here. Full keys are visible once at
              creation and are never listed again.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Scoped developer endpoints can return Retry-After,
              X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset
              headers. Sandbox limits protect shared resources and are not an
              SLA.
            </p>
          </div>
        </div>
      </section>

      {createdSecret ? (
        <section className="developer-console">
          <div className="developer-console-head">
            <div>
              <p>New key</p>
              <h3>Copy this key now. It will not be shown again.</h3>
            </div>

            <button type="button" onClick={() => setCreatedSecret("")}>
              Hide key
            </button>
          </div>

          <pre>{createdSecret}</pre>

          <div className="workspace-row-actions">
            <button
              type="button"
              className="text-link-button"
              onClick={copyCreatedSecret}
            >
              <Copy size={16} />
              Copy key
            </button>
          </div>

          <p className="workspace-muted-copy">
            {copyMessage || createdWarning}
          </p>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Create key</p>
            <h3>Scoped API access</h3>
          </div>
        </div>

        <form className="api-key-form" onSubmit={createKey}>
          <label>
            <span>Name</span>
            <input
              value={formState.name}
              maxLength={120}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFormState((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Local test key"
            />
          </label>

          <label>
            <span>Environment</span>
            <select
              value={formState.environment}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setFormState((current) => ({
                  ...current,
                  environment: event.target.value === "live" ? "live" : "test"
                }))
              }
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>

          <label>
            <span>Expiry</span>
            <input
              type="datetime-local"
              value={formState.expiresAt}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFormState((current) => ({
                  ...current,
                  expiresAt: event.target.value
                }))
              }
            />
          </label>

          <fieldset>
            <legend>Scopes</legend>
            <div className="api-key-scope-grid">
              {scopeOptions.map((scope) => (
                <label key={scope.value}>
                  <input
                    type="checkbox"
                    checked={formState.scopes.includes(scope.value)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateScope(scope.value, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{scope.label}</strong>
                    {scope.value}
                    <em>{scope.description}</em>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="workspace-row-actions">
            <button type="submit" disabled={!canCreate}>
              <Plus size={16} />
              {isCreating ? "Creating..." : "Create key"}
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Keys</p>
            <h3>API key metadata</h3>
          </div>

          <button
            type="button"
            onClick={() => void loadApiKeys()}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {message ? (
          <div className="alert-item">
            <span />
            <p>{message}</p>
          </div>
        ) : null}

        <div className="api-key-card-list">
          {isLoading ? (
            <article className="api-key-card">
              <header>
                <div>
                  <strong>Loading API keys</strong>
                  <span>Reading key metadata from the API service.</span>
                </div>
                <span className="status-pill">loading</span>
              </header>
            </article>
          ) : apiKeys.length === 0 ? (
            <article className="api-key-card">
              <header>
                <div>
                  <strong>No API keys</strong>
                  <span>
                    Create an organization-owned key to use the sandbox
                    developer API.
                  </span>
                </div>
                <span className="status-pill">empty</span>
              </header>
              <p className="workspace-muted-copy">
                Full API keys are shown once at creation only. Invoice Lantern
                stores hashed key material and safe metadata.
              </p>
            </article>
          ) : (
            apiKeys.map((apiKey) => (
              <article className="api-key-card" key={apiKey.id}>
                <header>
                  <div>
                    <strong>{apiKey.name}</strong>
                    <span>{apiKey.keyPrefix}...</span>
                  </div>
                  <span className="status-pill">{formatStatus(apiKey.status)}</span>
                </header>

                <div className="api-key-meta-grid">
                  <div>
                    <span>Environment</span>
                    <strong>{formatStatus(apiKey.environment)}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDateTime(apiKey.createdAt)}</strong>
                  </div>
                  <div>
                    <span>Last used</span>
                    <strong>{formatDateTime(apiKey.lastUsedAt)}</strong>
                  </div>
                  <div>
                    <span>Expires</span>
                    <strong>
                      {apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : "Never"}
                    </strong>
                  </div>
                  <div>
                    <span>Last IP</span>
                    <strong>{apiKey.lastUsedIp || "Not recorded"}</strong>
                  </div>
                  <div>
                    <span>Prefix</span>
                    <strong>{apiKey.keyPrefix}</strong>
                  </div>
                </div>

                <div className="api-key-scope-list">
                  {apiKey.scopes.length > 0 ? (
                    apiKey.scopes.map((scope) => <span key={scope}>{scope}</span>)
                  ) : (
                    <span>No scopes</span>
                  )}
                </div>

                <div className="workspace-row-actions">
                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => setSelectedApiKeyFilter(apiKey.id)}
                  >
                    <BarChart3 size={16} />
                    View logs
                  </button>

                  {apiKey.status === "active" ? (
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={() => revokeKey(apiKey)}
                      disabled={revokingId === apiKey.id}
                    >
                      <Trash2 size={16} />
                      {revokingId === apiKey.id ? "Revoking..." : "Revoke"}
                    </button>
                  ) : (
                    <span className="api-key-safe-label">
                      <BadgeCheck size={16} />
                      No active secret
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Usage</p>
            <h3>API usage summary</h3>
          </div>

          <button
            type="button"
            onClick={() => void loadApiUsage()}
            disabled={isUsageLoading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {usageMessage ? (
          <div className="alert-item">
            <span />
            <p>{usageMessage}</p>
          </div>
        ) : null}

        <div className="workspace-data-grid">
          <div className="workspace-data-card">
            <p>Total requests</p>
            <strong>
              {isUsageLoading ? "Loading" : usageSummary.totalRequests}
            </strong>
            <span>Last 30 days from stored API usage logs.</span>
          </div>
          <div className="workspace-data-card is-good">
            <p>Successful</p>
            <strong>
              {isUsageLoading ? "Loading" : usageSummary.successfulRequests}
            </strong>
            <span>2xx responses recorded for organization API keys.</span>
          </div>
          <div className="workspace-data-card is-warn">
            <p>Client errors</p>
            <strong>
              {isUsageLoading ? "Loading" : usageSummary.clientErrorCount}
            </strong>
            <span>4xx responses from sandbox API requests.</span>
          </div>
          <div className="workspace-data-card is-danger">
            <p>Server errors</p>
            <strong>
              {isUsageLoading ? "Loading" : usageSummary.serverErrorCount}
            </strong>
            <span>5xx responses from sandbox API requests.</span>
          </div>
          <div className="workspace-data-card">
            <p>Average duration</p>
            <strong>
              {isUsageLoading
                ? "Loading"
                : formatDuration(usageSummary.averageDurationMs)}
            </strong>
            <span>Calculated from request metadata with durations.</span>
          </div>
          <div className="workspace-data-card">
            <p>Last request</p>
            <strong>
              {isUsageLoading
                ? "Loading"
                : formatDateTime(usageSummary.lastRequestAt)}
            </strong>
            <span>
              Request bodies, XML payloads, full API keys, and full VAT IDs are
              not stored here.
            </span>
          </div>
        </div>

        <div className="api-status-buckets">
          <span>2xx: {usageSummary.statusBuckets["2xx"]}</span>
          <span>3xx: {usageSummary.statusBuckets["3xx"]}</span>
          <span>4xx: {usageSummary.statusBuckets["4xx"]}</span>
          <span>5xx: {usageSummary.statusBuckets["5xx"]}</span>
        </div>

        <div className="workspace-line-grid">
          {usageSummary.topPaths.length === 0 ? (
            <div className="workspace-line-row api-usage-path-row">
              <strong>No top paths yet</strong>
              <span>Run a sandbox API request to populate usage metadata.</span>
            </div>
          ) : (
            usageSummary.topPaths.map((path) => (
              <div className="workspace-line-row api-usage-path-row" key={path.path}>
                <strong>{path.path}</strong>
                <span>{path.count} requests</span>
              </div>
            ))
          )}
        </div>

        <div className="api-rate-limit-section">
          <div className="workspace-table-head api-rate-limit-head">
            <div>
              <p>Rate limits</p>
              <h3>Current sandbox usage window</h3>
            </div>
          </div>

          <p className="workspace-muted-copy">
            Rate limits protect the sandbox API from abuse and unrestricted
            resource consumption. They are not an SLA.
          </p>

          <div className="workspace-data-grid api-current-rate-grid">
            {currentRateLimits.length === 0 ? (
              <div className="workspace-data-card is-full">
                <p>Current window</p>
                <strong>{isUsageLoading ? "Loading" : "No usage yet"}</strong>
                <span>
                  Select an API key to inspect key-level limits or view the
                  organization sandbox developer API total here.
                </span>
              </div>
            ) : (
              currentRateLimits.map((usage) => (
                <div
                  className={`workspace-data-card ${
                    usage.status === "limited" ? "is-danger" : "is-good"
                  }`}
                  key={`${usage.policyKey}-${usage.apiKeyId ?? "org"}`}
                >
                  <p>{usage.apiKeyId ? "API key limit" : "Organization limit"}</p>
                  <strong>
                    {usage.remaining} / {usage.maxRequests} remaining
                  </strong>
                  <span>
                    {formatPolicyLabel(usage.policyKey)} uses {usage.used} in{" "}
                    {formatWindowSeconds(usage.windowSeconds)}. Resets{" "}
                    {formatDateTime(usage.resetAt)}.
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="api-rate-policy-grid">
            {rateLimitPolicies.map((policy) => (
              <article className="api-rate-policy-card" key={policy.policyKey}>
                <header>
                  <strong>{formatPolicyLabel(policy.policyKey)}</strong>
                  <span>{policy.appliesTo === "api_key" ? "per key" : "per organization"}</span>
                </header>
                <p>{policy.description}</p>
                <div className="api-key-scope-list">
                  <span>{policy.maxRequests} requests</span>
                  <span>{formatWindowSeconds(policy.windowSeconds)}</span>
                  <span>{policy.scope}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace-table-shell" id="api-request-logs">
        <div className="workspace-table-head">
          <div>
            <p>API usage logs</p>
            <h3>Recent request metadata</h3>
          </div>
        </div>

        <div className="workspace-history-filters api-log-filters">
          <label>
            <span>API key filter</span>
            <select
              value={selectedApiKeyFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setSelectedApiKeyFilter(event.target.value)
              }
            >
              <option value="all">All keys</option>
              {apiKeys.map((apiKey) => (
                <option key={apiKey.id} value={apiKey.id}>
                  {apiKey.name} ({apiKey.keyPrefix})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void loadApiUsage()}
            disabled={isUsageLoading}
          >
            <RefreshCw size={16} />
            Refresh logs
          </button>
        </div>

        <p className="workspace-muted-copy">
          Request logs show metadata only. Request bodies, XML payloads, full
          API keys, and full VAT IDs are not stored here. Logs are available to
          owner, admin, and developer workspace roles.
        </p>

        <div className="api-request-log-list">
          {isUsageLoading ? (
            <article className="api-request-log-row">
              <div>
                <strong>Loading request logs</strong>
                <span>Reading safe API request metadata.</span>
              </div>
              <span className="status-pill">loading</span>
            </article>
          ) : requestLogs.length === 0 ? (
            <article className="api-request-log-row">
              <div>
                <strong>No request logs</strong>
                <span>
                  No API-key-authenticated requests have been recorded for this
                  filter yet.
                </span>
              </div>
              <span className="status-pill">empty</span>
            </article>
          ) : (
            requestLogs.map((requestLog) => (
              <article
                className={`api-request-log-row ${
                  requestLog.statusCode === 429 ? "is-rate-limited" : ""
                }`}
                key={requestLog.id}
              >
                <div>
                  <strong>
                    {requestLog.requestMethod} {requestLog.requestPath}
                  </strong>
                  <span>
                    {requestLog.apiKeyName || "API key"}{" "}
                    {requestLog.apiKeyPrefix
                      ? `(${requestLog.apiKeyPrefix})`
                      : ""}
                  </span>
                  <span>{formatDateTime(requestLog.createdAt)}</span>
                </div>

                <span
                  className={`api-status-code ${getStatusTone(
                    requestLog.statusCode
                  )} ${
                    requestLog.statusCode === 429 ? "is-rate-limited" : ""
                  }`}
                >
                  {requestLog.statusCode === 429
                    ? "429 rate limit"
                    : formatStatusCode(requestLog.statusCode)}
                </span>

                <span>{formatDuration(requestLog.durationMs)}</span>
                <span>{requestLog.ipAddress || "IP not recorded"}</span>
                <span>{requestLog.userAgent || "User agent not recorded"}</span>
                <span>{requestLog.errorCode || "No error code"}</span>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>API testing panel</p>
            <h3>Send a sandbox API request</h3>
          </div>
        </div>

        <p className="workspace-muted-copy">
          This testing panel sends sandbox API requests only. It is not an
          official filing, tax, legal, accounting, or authority-submission tool.
        </p>

        <div className="api-test-grid">
          <form
            className="api-key-form api-test-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runApiTest();
            }}
          >
            <label>
              <span>API base URL</span>
              <input
                value={apiTestBaseUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setApiTestBaseUrl(event.target.value)
                }
                placeholder="http://localhost:4000"
              />
            </label>

            <label>
              <span>X-API-Key</span>
              <input
                type="password"
                value={apiTestKey}
                autoComplete="off"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setApiTestKey(event.target.value)
                }
                placeholder="Paste il_test_... key"
              />
            </label>

            <label>
              <span>Endpoint</span>
              <select
                value={apiTestEndpointId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setApiTestEndpointId(event.target.value as ApiTestEndpointId)
                }
              >
                {apiTestEndpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="api-test-endpoint-meta">
              <span>{selectedEndpoint.method}</span>
              <strong>{selectedEndpoint.path}</strong>
              <em>Required scope: {selectedEndpoint.scope}</em>
            </div>

            <div className="workspace-row-actions">
              <button type="submit" disabled={isTestingEndpoint}>
                <Play size={16} />
                {isTestingEndpoint ? "Sending..." : "Send request"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiTestKey("");
                  setApiTestResult(null);
                }}
              >
                <Eraser size={16} />
                Clear key
              </button>
            </div>
          </form>

          <div className="developer-console api-test-preview">
            <div className="developer-console-head">
              <div>
                <p>Request preview</p>
                <h3>Secret is masked</h3>
              </div>
              <Code2 size={18} />
            </div>

            <pre>{formatJson(apiTestPreview)}</pre>
          </div>
        </div>

        {apiTestResult ? (
          <div className="developer-console api-test-result">
            <div className="developer-console-head">
              <div>
                <p>Response</p>
                <h3>
                  {apiTestResult.status === null
                    ? "Not sent"
                    : `HTTP ${apiTestResult.status}`}
                </h3>
              </div>
              <span
                className={`api-status-code ${
                  apiTestResult.ok ? "is-good" : "is-warn"
                }`}
              >
                {apiTestResult.ok ? "ok" : "check"}
              </span>
            </div>

            <p className="workspace-muted-copy">{apiTestResult.message}</p>
            {apiTestResult.rateLimit ? (
              <div className="api-rate-limit-detail-grid">
                <span>Limit: {apiTestResult.rateLimit.limit ?? "n/a"}</span>
                <span>
                  Remaining: {apiTestResult.rateLimit.remaining ?? "n/a"}
                </span>
                <span>Reset: {apiTestResult.rateLimit.reset ?? "n/a"}</span>
                <span>
                  Retry-After: {apiTestResult.rateLimit.retryAfter ?? "n/a"}
                </span>
              </div>
            ) : null}
            {apiTestResult.data !== null ? (
              <pre>{formatJson(apiTestResult.data)}</pre>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="developer-console">
        <div className="developer-console-head">
          <div>
            <p>Examples</p>
            <h3>Copyable API key usage</h3>
          </div>
          <KeyRound size={18} />
        </div>

        <pre>{`# Header
X-API-Key: il_test_your_key_here

# Validation rules catalog
curl http://localhost:4000/api/v1/validation/rules \\
  -H "X-API-Key: il_test_your_key_here"

# VAT format check
curl -X POST http://localhost:4000/api/v1/vat/validate-format \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{"vatId":"HU12345678","countryHint":"HU"}'

# ViDA-readiness simulation
curl -X POST http://localhost:4000/api/v1/transactions/simulate-vida \\
  -H "content-type: application/json" \\
  -H "X-API-Key: il_test_your_key_here" \\
  -d '{"sellerCountry":"DE","buyerCountry":"HU","buyerType":"business","transactionType":"services"}'

# Full keys are shown once only during creation.
# Request bodies, XML payloads, full API keys, and full VAT IDs are not stored in API usage logs.`}</pre>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <ShieldCheck size={22} />
          <div>
            <p>Privacy</p>
            <h3>Logs are metadata only.</h3>
          </div>
        </div>

        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              API usage logs are for organization-owned sandbox developer API
              diagnostics. They do not store request bodies, XML payloads, full
              API keys, full VAT IDs, or API key hashes.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              The API testing panel keeps the pasted key in this browser field
              only and sends it only as the X-API-Key header for the selected
              sandbox request.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}