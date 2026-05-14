import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import {
  validateVatFormat,
  type VatFormatResult
} from "@invoice-lantern/tax-engine";
import { env } from "../config/env.js";
import {
  countViesEvidenceRecords,
  getLatestViesEvidenceRecord,
  saveViesEvidenceRecord,
  type ViesEvidenceRecord,
  type ViesEvidenceStatus,
  type ViesEvidencePartyRole
} from "../repositories/vies-evidence-repository.js";
import { VIES_SOURCE_LABEL, VIES_SOURCE_URL } from "./validation-finding-enrichment.js";

export const VIES_SERVICE_URL_DEFAULT =
  "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

export const VIES_EVIDENCE_DISCLAIMER =
  "VIES evidence is time-of-check evidence retrieved through VIES when available. VIES availability depends on EU and national VAT database systems. VAT format valid does not mean VIES valid, VIES unavailable does not mean invalid, and VIES valid does not prove full transaction treatment or replace legal, tax, accounting, filing, or professional advice.";

export type ViesTransportRequest = {
  url: string;
  body: string;
  timeoutMs: number;
};

export type ViesTransportResponse = {
  statusCode: number;
  body: string;
  responseTimeMs: number;
};

export type ViesTransport = (
  request: ViesTransportRequest
) => Promise<ViesTransportResponse>;

export type ViesCheckInput = {
  organizationId: string;
  countryCode: string;
  vatNumber: string;
  invoiceDraftId?: string | null;
  validationRunId?: string | null;
  partyRole?: ViesEvidencePartyRole | null;
  createdBy?: string | null;
  useCacheOnly?: boolean;
};

export type ViesCheckResult = {
  formatCheck: VatFormatResult;
  status: ViesEvidenceStatus;
  viesValid: boolean | null;
  checkedAt: string;
  source: {
    label: string;
    url: string;
  };
  evidence: ViesEvidenceRecord | null;
  disclaimer: string;
};

type ViesServiceConfig = {
  enabled: boolean;
  serviceUrl: string;
  timeoutMs: number;
  rateLimitPerOrgPerDay: number;
  rateLimitPerVatPerDay: number;
};

type ParsedViesResponse = {
  status: "valid" | "invalid";
  viesValid: boolean;
  viesName: string | null;
  viesAddress: string | null;
  requestIdentifier: string | null;
};

type ParsedViesFault = {
  code: string;
  message: string;
};

let testingTransport: ViesTransport | null = null;
let testingConfigOverride: Partial<ViesServiceConfig> | null = null;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true
});

function getViesServiceConfig(): ViesServiceConfig {
  const serviceUrl = env.VIES_SERVICE_URL.trim() || VIES_SERVICE_URL_DEFAULT;

  return {
    enabled: env.VIES_CHECK_ENABLED,
    serviceUrl,
    timeoutMs: env.VIES_TIMEOUT_MS,
    rateLimitPerOrgPerDay: env.VIES_RATE_LIMIT_PER_ORG_PER_DAY,
    rateLimitPerVatPerDay: env.VIES_RATE_LIMIT_PER_VAT_PER_DAY,
    ...testingConfigOverride
  };
}

export function setViesTransportForTesting(transport: ViesTransport | null) {
  testingTransport = transport;
}

export function setViesServiceConfigForTesting(
  override: Partial<ViesServiceConfig> | null
) {
  testingConfigOverride = override;
}

export function resetViesServiceTestingOverrides() {
  testingTransport = null;
  testingConfigOverride = null;
}

function normalizeCountryCode(value: string) {
  const normalized = value.trim().toUpperCase();

  return normalized === "GR" ? "EL" : normalized;
}

function stripCountryPrefix(normalizedVatNumber: string, countryCode: string) {
  return normalizedVatNumber.startsWith(countryCode)
    ? normalizedVatNumber.slice(countryCode.length)
    : normalizedVatNumber;
}

function escapeXmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildViesSoapEnvelope(input: {
  countryCode: string;
  vatNumberWithoutPrefix: string;
}) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">',
    "<soapenv:Header/>",
    "<soapenv:Body>",
    "<urn:checkVat>",
    `<urn:countryCode>${escapeXmlText(input.countryCode)}</urn:countryCode>`,
    `<urn:vatNumber>${escapeXmlText(input.vatNumberWithoutPrefix)}</urn:vatNumber>`,
    "</urn:checkVat>",
    "</soapenv:Body>",
    "</soapenv:Envelope>"
  ].join("");
}

async function defaultViesTransport(
  request: ViesTransportRequest
): Promise<ViesTransportResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: {
        "content-type": "text/xml; charset=utf-8",
        soapAction: ""
      },
      body: request.body,
      signal: controller.signal
    });
    const body = await response.text();

    return {
      statusCode: response.status,
      body,
      responseTimeMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getTransport() {
  return testingTransport ?? defaultViesTransport;
}

function hashRawResponse(body: string) {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function findNode(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findNode(item, key);

      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }

  for (const childValue of Object.values(record)) {
    const result = findNode(childValue, key);

    if (result !== undefined) {
      return result;
    }
  }

  return undefined;
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed && trimmed !== "---" ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function readObjectField(record: unknown, key: string) {
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return undefined;
  }

  return (record as Record<string, unknown>)[key];
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1"].includes(value.trim().toLowerCase());
  }

  return false;
}

function parseViesFault(parsed: unknown): ParsedViesFault | null {
  const fault = findNode(parsed, "Fault");

  if (!fault) {
    return null;
  }

  const code =
    readString(readObjectField(fault, "faultcode")) ??
    readString(findNode(fault, "Value")) ??
    "VIES_SOAP_FAULT";
  const message =
    readString(readObjectField(fault, "faultstring")) ??
    readString(findNode(fault, "Text")) ??
    "VIES returned a SOAP fault.";

  return {
    code: safeErrorCode(code),
    message: safeErrorMessage(message)
  };
}

function parseViesResponse(body: string): ParsedViesResponse | ParsedViesFault {
  const parsed = xmlParser.parse(body);
  const fault = parseViesFault(parsed);

  if (fault) {
    return fault;
  }

  const response = findNode(parsed, "checkVatResponse");

  if (!response) {
    throw new Error("VIES_PARSE_ERROR");
  }

  const viesValid = readBoolean(readObjectField(response, "valid"));

  return {
    status: viesValid ? "valid" : "invalid",
    viesValid,
    viesName: readString(readObjectField(response, "name")),
    viesAddress: readString(readObjectField(response, "address")),
    requestIdentifier: readString(readObjectField(response, "requestIdentifier"))
  };
}

function isParsedFault(
  value: ParsedViesResponse | ParsedViesFault
): value is ParsedViesFault {
  return "code" in value;
}

function safeErrorCode(value: string) {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_:-]+/g, "_")
    .slice(0, 120);

  return cleaned || "VIES_ERROR";
}

function safeErrorMessage(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();

  return compact.slice(0, 300) || "VIES evidence could not be retrieved safely.";
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function startOfUtcDayIso(now = new Date()) {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

async function persistViesRecord(input: {
  checkInput: ViesCheckInput;
  countryCode: string;
  vatNumberNormalized: string;
  vatNumberDisplay: string;
  status: ViesEvidenceStatus;
  viesValid?: boolean | null;
  viesName?: string | null;
  viesAddress?: string | null;
  requestIdentifier?: string | null;
  responseTimeMs?: number | null;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  rawResponseHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return saveViesEvidenceRecord({
    organizationId: input.checkInput.organizationId,
    invoiceDraftId: input.checkInput.invoiceDraftId ?? null,
    validationRunId: input.checkInput.validationRunId ?? null,
    partyRole: input.checkInput.partyRole ?? null,
    countryCode: input.countryCode,
    vatNumberNormalized: input.vatNumberNormalized,
    vatNumberDisplay: input.vatNumberDisplay,
    requestSource: "vies",
    status: input.status,
    viesValid: input.viesValid ?? null,
    viesName: input.viesName ?? null,
    viesAddress: input.viesAddress ?? null,
    requestIdentifier: input.requestIdentifier ?? null,
    checkedAt: new Date().toISOString(),
    sourceLabel: VIES_SOURCE_LABEL,
    sourceUrl: VIES_SOURCE_URL,
    responseTimeMs: input.responseTimeMs ?? null,
    errorCode: input.errorCode ?? null,
    errorMessageSafe: input.errorMessageSafe ?? null,
    rawResponseHash: input.rawResponseHash ?? null,
    metadata: input.metadata ?? {},
    createdBy: input.checkInput.createdBy ?? null
  });
}

function buildResult(input: {
  formatCheck: VatFormatResult;
  status: ViesEvidenceStatus;
  evidence: ViesEvidenceRecord | null;
  checkedAt?: string;
}) {
  return {
    formatCheck: input.formatCheck,
    status: input.status,
    viesValid: input.evidence?.viesValid ?? null,
    checkedAt: input.evidence?.checkedAt ?? input.checkedAt ?? new Date().toISOString(),
    source: {
      label: VIES_SOURCE_LABEL,
      url: VIES_SOURCE_URL
    },
    evidence: input.evidence,
    disclaimer: VIES_EVIDENCE_DISCLAIMER
  };
}

export async function checkViesEvidence(
  input: ViesCheckInput
): Promise<ViesCheckResult> {
  const countryCode = normalizeCountryCode(input.countryCode);
  const formatCheck = validateVatFormat(input.vatNumber, countryCode);
  const checkedAt = new Date().toISOString();

  if (!/^[A-Z]{2}$/.test(countryCode) || !formatCheck.countryCode) {
    return buildResult({
      formatCheck,
      status: "unsupported",
      evidence: null,
      checkedAt
    });
  }

  if (!formatCheck.formatValid) {
    return buildResult({
      formatCheck,
      status: "not_checked",
      evidence: null,
      checkedAt
    });
  }

  const vatNumberNormalized = formatCheck.normalized.trim().toUpperCase();
  const vatNumberWithoutPrefix = stripCountryPrefix(
    vatNumberNormalized,
    formatCheck.countryCode ?? countryCode
  );

  if (input.useCacheOnly) {
    const cachedRecord = await getLatestViesEvidenceRecord({
      organizationId: input.organizationId,
      countryCode,
      vatNumberNormalized
    });

    if (cachedRecord) {
      return buildResult({
        formatCheck,
        status: cachedRecord.status,
        evidence: cachedRecord
      });
    }

    return buildResult({
      formatCheck,
      status: "not_checked",
      evidence: null,
      checkedAt
    });
  }

  const config = getViesServiceConfig();

  if (!config.enabled) {
    return buildResult({
      formatCheck,
      status: "not_checked",
      evidence: null,
      checkedAt
    });
  }

  const sinceIso = startOfUtcDayIso();
  const [orgCheckCount, vatCheckCount] = await Promise.all([
    countViesEvidenceRecords({
      organizationId: input.organizationId,
      sinceIso
    }),
    countViesEvidenceRecords({
      organizationId: input.organizationId,
      vatNumberNormalized,
      sinceIso
    })
  ]);

  if (
    orgCheckCount >= config.rateLimitPerOrgPerDay ||
    vatCheckCount >= config.rateLimitPerVatPerDay
  ) {
    const evidence = await persistViesRecord({
      checkInput: input,
      countryCode,
      vatNumberNormalized,
      vatNumberDisplay: vatNumberWithoutPrefix,
      status: "rate_limited",
      viesValid: null,
      metadata: {
        rateLimitPerOrgPerDay: config.rateLimitPerOrgPerDay,
        rateLimitPerVatPerDay: config.rateLimitPerVatPerDay
      }
    });

    return buildResult({
      formatCheck,
      status: "rate_limited",
      evidence
    });
  }

  const envelope = buildViesSoapEnvelope({
    countryCode,
    vatNumberWithoutPrefix
  });
  const transport = getTransport();

  try {
    const response = await transport({
      url: config.serviceUrl,
      body: envelope,
      timeoutMs: config.timeoutMs
    });
    const rawResponseHash = hashRawResponse(response.body);

    let parsed: ParsedViesResponse | ParsedViesFault;

    try {
      parsed = parseViesResponse(response.body);
    } catch {
      const evidence = await persistViesRecord({
        checkInput: input,
        countryCode,
        vatNumberNormalized,
        vatNumberDisplay: vatNumberWithoutPrefix,
        status: response.statusCode >= 500 ? "unavailable" : "error",
        responseTimeMs: response.responseTimeMs,
        errorCode: `HTTP_${response.statusCode}`,
        errorMessageSafe:
          "VIES evidence response could not be parsed safely.",
        rawResponseHash
      });

      return buildResult({
        formatCheck,
        status: evidence.status,
        evidence
      });
    }

    if (isParsedFault(parsed)) {
      const evidence = await persistViesRecord({
        checkInput: input,
        countryCode,
        vatNumberNormalized,
        vatNumberDisplay: vatNumberWithoutPrefix,
        status: "unavailable",
        responseTimeMs: response.responseTimeMs,
        errorCode: parsed.code,
        errorMessageSafe: parsed.message,
        rawResponseHash
      });

      return buildResult({
        formatCheck,
        status: evidence.status,
        evidence
      });
    }

    const evidence = await persistViesRecord({
      checkInput: input,
      countryCode,
      vatNumberNormalized,
      vatNumberDisplay: vatNumberWithoutPrefix,
      status: parsed.status,
      viesValid: parsed.viesValid,
      viesName: parsed.viesName,
      viesAddress: parsed.viesAddress,
      requestIdentifier: parsed.requestIdentifier,
      responseTimeMs: response.responseTimeMs,
      rawResponseHash,
      metadata: {
        transportStatusCode: response.statusCode
      }
    });

    return buildResult({
      formatCheck,
      status: evidence.status,
      evidence
    });
  } catch (error) {
    const evidence = await persistViesRecord({
      checkInput: input,
      countryCode,
      vatNumberNormalized,
      vatNumberDisplay: vatNumberWithoutPrefix,
      status: isTimeoutError(error) ? "unavailable" : "error",
      errorCode: isTimeoutError(error)
        ? "VIES_TIMEOUT"
        : "VIES_TRANSPORT_ERROR",
      errorMessageSafe: safeErrorMessage(
        isTimeoutError(error)
          ? "VIES evidence timed out."
          : "VIES evidence transport failed safely."
      )
    });

    return buildResult({
      formatCheck,
      status: evidence.status,
      evidence
    });
  }
}
