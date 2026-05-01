import type { ApiKeyScope } from "./api-key-service.js";

export const RATE_LIMIT_EXCEEDED_ERROR_CODE = "RATE_LIMIT_EXCEEDED";

export type ApiRateLimitAppliesTo = "api_key" | "organization";

export type ApiRateLimitPolicy = {
  policyKey: string;
  windowSeconds: number;
  maxRequests: number;
  scope: ApiKeyScope | "organization:developer_api";
  description: string;
  appliesTo: ApiRateLimitAppliesTo;
  requestPathPrefix: string | null;
};

export const API_RATE_LIMIT_POLICIES = {
  validation_rules_catalog: {
    policyKey: "validation_rules_catalog",
    windowSeconds: 15 * 60,
    maxRequests: 120,
    scope: "rules:read",
    description: "Sandbox validation rules catalog API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/validation/rules"
  },
  vat_validate_format: {
    policyKey: "vat_validate_format",
    windowSeconds: 15 * 60,
    maxRequests: 60,
    scope: "vat:validate_format",
    description: "Sandbox VAT format check API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/vat/validate-format"
  },
  invoices_validate: {
    policyKey: "invoices_validate",
    windowSeconds: 15 * 60,
    maxRequests: 30,
    scope: "invoices:validate",
    description: "Sandbox invoice validation API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/invoices/validate"
  },
  invoices_export_ubl: {
    policyKey: "invoices_export_ubl",
    windowSeconds: 15 * 60,
    maxRequests: 30,
    scope: "invoices:export_ubl",
    description: "Sandbox UBL export API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/invoices/export/ubl"
  },
  invoices_parse_ubl: {
    policyKey: "invoices_parse_ubl",
    windowSeconds: 15 * 60,
    maxRequests: 30,
    scope: "invoices:parse_ubl",
    description: "Sandbox UBL parse API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/invoices/parse/ubl"
  },
  xml_validation_jobs: {
    policyKey: "xml_validation_jobs",
    windowSeconds: 15 * 60,
    maxRequests: 15,
    scope: "xml:validation_jobs",
    description: "Sandbox XML validation job API limit.",
    appliesTo: "api_key",
    requestPathPrefix: "/api/v1/xml/validation-jobs"
  },
  organization_developer_api_total: {
    policyKey: "organization_developer_api_total",
    windowSeconds: 15 * 60,
    maxRequests: 300,
    scope: "organization:developer_api",
    description: "Sandbox organization developer API abuse-protection limit.",
    appliesTo: "organization",
    requestPathPrefix: null
  }
} as const satisfies Record<string, ApiRateLimitPolicy>;

export type ApiRateLimitPolicyKey = keyof typeof API_RATE_LIMIT_POLICIES;

export const API_KEY_RATE_LIMIT_POLICIES = Object.values(
  API_RATE_LIMIT_POLICIES
).filter((policy) => policy.appliesTo === "api_key");

export const ORGANIZATION_RATE_LIMIT_POLICY =
  API_RATE_LIMIT_POLICIES.organization_developer_api_total;

export const API_RATE_LIMIT_POLICY_LIST = Object.values(
  API_RATE_LIMIT_POLICIES
);

export function getApiRateLimitPolicy(policyKey: string) {
  return API_RATE_LIMIT_POLICIES[policyKey as ApiRateLimitPolicyKey] ?? null;
}

export function getApiKeyRateLimitPolicy(policyKey: ApiRateLimitPolicyKey) {
  const policy = API_RATE_LIMIT_POLICIES[policyKey];

  return policy.appliesTo === "api_key" ? policy : null;
}

export function isApiRateLimitPolicyKey(
  value: string
): value is ApiRateLimitPolicyKey {
  return value in API_RATE_LIMIT_POLICIES;
}

export function getSandboxRateLimitMessage(policy: ApiRateLimitPolicy) {
  if (policy.policyKey === "organization_developer_api_total") {
    return "This organization exceeded the sandbox developer API rate limit.";
  }

  if (policy.policyKey === "invoices_validate") {
    return "This API key exceeded the sandbox rate limit for invoice validation.";
  }

  if (policy.policyKey === "vat_validate_format") {
    return "This API key exceeded the sandbox rate limit for VAT format checks.";
  }

  if (policy.policyKey === "validation_rules_catalog") {
    return "This API key exceeded the sandbox rate limit for the validation rules catalog.";
  }

  if (policy.policyKey === "invoices_export_ubl") {
    return "This API key exceeded the sandbox rate limit for UBL export.";
  }

  if (policy.policyKey === "invoices_parse_ubl") {
    return "This API key exceeded the sandbox rate limit for UBL parsing.";
  }

  if (policy.policyKey === "xml_validation_jobs") {
    return "This API key exceeded the sandbox rate limit for XML validation jobs.";
  }

  return "This API key exceeded the sandbox developer API rate limit.";
}
