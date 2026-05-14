const SANDBOX_DISCLAIMER =
  "Invoice Lantern is an independent, non-official EU e-invoice validation and ViDA-readiness sandbox. The Developer API provides technical validation and readiness tooling only. It is not official filing, not authority submission, not tax advice, not legal advice, not accounting advice, and not a compliance guarantee.";

const CORE_VALIDATION_RULE_VERSION = "2026.05.1";

const tinyUblXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-API-DOCS-001</cbc:ID>
  <cbc:IssueDate>2026-04-30</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>Sandbox service</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

const exampleCanonicalInvoice = {
  profile: "EN16931",
  document: {
    type: "invoice",
    number: "INV-API-DOCS-001",
    currency: "EUR",
    issueDate: "2026-04-30",
    dueDate: "2026-05-30",
    profile: "EN16931"
  },
  seller: {
    name: "Invoice Lantern Seller GmbH",
    legalName: "Invoice Lantern Seller GmbH",
    country: "DE",
    vatId: "DE123456789",
    address: {
      street: "Example Street 1",
      city: "Berlin",
      postalCode: "10115",
      country: "DE"
    },
    city: "Berlin",
    postalCode: "10115",
    street: "Example Street 1",
    electronicAddress: "seller@example.test"
  },
  buyer: {
    name: "Invoice Lantern Buyer Kft",
    country: "HU",
    vatId: "HU12345678",
    address: {
      street: "Example Utca 2",
      city: "Budapest",
      postalCode: "1051",
      country: "HU"
    },
    city: "Budapest",
    postalCode: "1051",
    street: "Example Utca 2",
    electronicAddress: "buyer@example.test"
  },
  lines: [
    {
      id: "1",
      description: "Sandbox validation service",
      quantity: "1",
      unitCode: "EA",
      unitPrice: "100.00",
      netAmount: "100.00",
      vatCategory: "S",
      vatRate: "27"
    }
  ],
  allowances: [],
  charges: [],
  taxBreakdown: [
    {
      taxCategory: "S",
      taxScheme: "VAT",
      vatRate: "27",
      taxableAmount: "100.00",
      taxAmount: "27.00"
    }
  ],
  taxSubtotals: [
    {
      vatCategory: "S",
      vatRate: "27",
      taxableAmount: "100.00",
      taxAmount: "27.00"
    }
  ],
  totals: {
    lineExtensionAmount: "100.00",
    taxExclusiveAmount: "100.00",
    taxAmount: "27.00",
    taxTotalAmount: "27.00",
    taxInclusiveAmount: "127.00",
    payableAmount: "127.00"
  },
  legal: {
    legalConfidence: "technical",
    disclaimer:
      "Invoice Lantern stores canonical invoice data as an independent technical validation and readiness sandbox record. Results are informational only and are not legal, tax, accounting, financial, professional, official filing, authority acceptance, Peppol certification, EN 16931 certification, or compliance advice."
  }
};

const exampleVidaSimulationRequest = {
  sellerCountry: "DE",
  buyerCountry: "HU",
  sellerVatId: "DE123456789",
  buyerVatId: "HU12345678",
  buyerType: "business",
  sellerType: "business",
  transactionType: "services",
  supplyScenario: "intra_eu",
  invoiceDate: "2030-07-01",
  issueDate: "2030-07-01",
  currency: "EUR",
  amount: "100.00",
  invoiceProfile: "EN16931",
  structuredInvoiceSignals: {
    hasCanonicalInvoice: true,
    hasUblXml: true,
    hasCiiXml: false,
    xsdStatus: "passed",
    schematronPeppolStatus: "not_configured",
    schematronEn16931Status: "not_configured"
  },
  vatEvidence: {
    sellerViesStatus: "not_checked",
    buyerViesStatus: "not_checked",
    sourceLabel: "caller-supplied evidence context"
  },
  countryPackVersions: {
    DE: "2026.05.1",
    HU: "2026.05.1"
  },
  sourceRefs: ["eu-vida-package-context"],
  sourceLabels: ["European Commission ViDA package context"]
};

const rateLimitHeaders = {
  "X-RateLimit-Limit": {
    description: "Maximum requests allowed for the active sandbox window.",
    schema: {
      type: "integer",
      example: 30
    }
  },
  "X-RateLimit-Remaining": {
    description: "Remaining requests in the active sandbox window.",
    schema: {
      type: "integer",
      example: 29
    }
  },
  "X-RateLimit-Reset": {
    description: "ISO timestamp when the active sandbox rate-limit window resets.",
    schema: {
      type: "string",
      format: "date-time",
      example: "2026-05-01T12:15:00.000Z"
    }
  }
};

const retryAfterHeader = {
  "Retry-After": {
    description: "Seconds to wait before retrying after a 429 response.",
    schema: {
      type: "integer",
      example: 123
    }
  }
};

function jsonContent(
  schema: Record<string, unknown>,
  examples?: Record<string, unknown>
) {
  return {
    "application/json": {
      schema,
      ...(examples ? { examples } : {})
    }
  };
}

function response(description: string, schema: Record<string, unknown>) {
  return {
    description,
    content: jsonContent(schema)
  };
}

function ref(name: string) {
  return {
    $ref: `#/components/schemas/${name}`
  };
}

function errorResponse(description: string, exampleCode: string) {
  return {
    description,
    content: jsonContent(ref("ErrorEnvelope"), {
      default: {
        value: {
          error: {
            code: exampleCode,
            message: description,
            details: null
          }
        }
      }
    })
  };
}

const commonErrorResponses = {
  "400": errorResponse("Request validation failed.", "VALIDATION_ERROR"),
  "401": errorResponse(
    "Authentication is required or the supplied API key is invalid.",
    "AUTHENTICATION_REQUIRED"
  ),
  "403": errorResponse(
    "The caller does not have the required role or API key scope.",
    "INSUFFICIENT_SCOPE"
  ),
  "404": errorResponse("The requested resource was not found.", "NOT_FOUND"),
  "500": errorResponse("Unexpected internal API error.", "INTERNAL_ERROR")
};

const rateLimitResponse = {
  description: "The sandbox developer API rate limit was exceeded.",
  headers: {
    ...rateLimitHeaders,
    ...retryAfterHeader
  },
  content: jsonContent(ref("RateLimitErrorEnvelope"), {
    rateLimitExceeded: {
      value: {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message:
            "This API key exceeded the sandbox rate limit for invoice validation.",
          limit: 30,
          windowSeconds: 900,
          retryAfterSeconds: 123
        }
      }
    }
  })
};

function apiKeyResponses(success: Record<string, unknown>) {
  return {
    ...success,
    ...commonErrorResponses,
    "429": rateLimitResponse
  };
}

function workspaceResponses(success: Record<string, unknown>) {
  return {
    ...success,
    ...commonErrorResponses
  };
}

function scopedApiKeyOperation(input: {
  tags: string[];
  summary: string;
  description: string;
  scope: string;
  requestBody?: Record<string, unknown>;
  parameters?: Record<string, unknown>[];
  responses: Record<string, unknown>;
}) {
  return {
    tags: input.tags,
    summary: input.summary,
    description: `${input.description}\n\nRequired API key scope: \`${input.scope}\`.`,
    security: [
      {
        ApiKeyAuth: []
      }
    ],
    "x-required-scope": input.scope,
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.requestBody ? { requestBody: input.requestBody } : {}),
    responses: apiKeyResponses(input.responses)
  };
}

function bearerOperation(input: {
  tags: string[];
  summary: string;
  description: string;
  requestBody?: Record<string, unknown>;
  parameters?: Record<string, unknown>[];
  responses: Record<string, unknown>;
}) {
  return {
    tags: input.tags,
    summary: input.summary,
    description: input.description,
    security: [
      {
        SupabaseBearerAuth: []
      }
    ],
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.requestBody ? { requestBody: input.requestBody } : {}),
    responses: workspaceResponses(input.responses)
  };
}

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Invoice Lantern Developer API",
    version: "0.1.0",
    description: SANDBOX_DISCLAIMER
  },
  servers: [
    {
      url: "http://localhost:4000/api/v1",
      description: "Local development server"
    },
    {
      url: "https://api.invoice-lantern.example/api/v1",
      description: "Production server placeholder"
    }
  ],
  tags: [
    {
      name: "Authentication / API Keys",
      description:
        "Signed-in workspace endpoints for organization API key creation, listing, and revocation."
    },
    {
      name: "Invoices",
      description:
        "Sandbox technical invoice validation endpoints using scoped organization API keys."
    },
    {
      name: "UBL",
      description:
        "Technical UBL XML export and parse endpoints. These are not official XML validation or authority submission."
    },
    {
      name: "XML Validation Jobs",
      description:
        "XML validation job endpoints for worker readiness, configuration-gated local UBL XSD validation, and guarded local Schematron execution. schematron_peppol and schematron_en16931 execute only when explicit policy, xpath_engine, reviewed local artefacts, safe XML, and supported Schematron/XPath gates pass. schematron_peppol_placeholder remains a deprecated preflight metadata alias. These endpoints return sanitized technical summaries and findings only; they do not provide official validation, certification, filing, authority acceptance, legal/tax/accounting advice, or compliance guarantees."
    },
    {
      name: "VAT",
      description:
        "Local VAT format checks and optional explicit VIES time-of-check evidence. Format-valid is not VIES-valid, VIES unavailable is not invalid, and neither result is legal, tax, accounting, filing, or authority advice."
    },
    {
      name: "Validation Runs",
      description:
        "Read stored technical validation run details generated by the sandbox."
    },
    {
      name: "Validation Rules",
      description:
        "Published Invoice Lantern technical sandbox rule catalog."
    },
    {
      name: "Country Packs",
      description:
        "Read-only country-pack catalogue endpoints for educational VAT, e-invoicing, source-reference, capability, lifecycle, and registry metadata. Country packs are not legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority compliance guarantees."
    },
    {
      name: "Transactions",
      description:
        "ViDA-readiness transaction simulation endpoints for educational and technical readiness planning. These simulations are not official ViDA determinations, not legal advice, not tax advice, not accounting advice, not authority submission, not filing software, and not compliance guarantees."
    },
    {
      name: "Usage and Rate Limits",
      description:
        "Signed-in workspace usage metadata, summaries, policies, and current request-window counts."
    },
    {
      name: "Reports",
      description:
        "Signed-in workspace report downloads. Reports are non-official technical sandbox outputs."
    }
  ],
  paths: {
    "/openapi.json": {
      get: {
        tags: ["Usage and Rate Limits"],
        summary: "Fetch the OpenAPI document",
        description:
          "Returns this public OpenAPI document. It contains no secrets and documents active Developer API endpoints only.",
        responses: {
          "200": response("OpenAPI document.", {
            type: "object"
          }),
          "500": commonErrorResponses["500"]
        }
      }
    },
    "/api-keys": {
      get: bearerOperation({
        tags: ["Authentication / API Keys"],
        summary: "List organization API keys",
        description:
          "Lists safe API key metadata for the signed-in workspace. Requires an organization owner, admin, or developer role. Full API keys and key hashes are never returned.",
        responses: {
          "200": response("Safe API key metadata.", {
            type: "object",
            required: ["apiKeys"],
            properties: {
              apiKeys: {
                type: "array",
                items: ref("ApiKeyMetadata")
              }
            }
          })
        }
      }),
      post: bearerOperation({
        tags: ["Authentication / API Keys"],
        summary: "Create an organization API key",
        description:
          "Creates a scoped organization API key for sandbox developer endpoints. Requires an organization owner, admin, or developer role. The secret is returned once only; Invoice Lantern stores only hashed key material.",
        requestBody: {
          required: true,
          content: jsonContent(ref("CreateApiKeyRequest"), {
            createTestKey: {
              value: {
                name: "Local sandbox key",
                environment: "test",
                scopes: ["invoices:validate", "vat:validate_format"],
                expiresAt: null
              }
            }
          })
        },
        responses: {
          "201": response("API key created. Copy the secret immediately.", {
            type: "object",
            required: ["apiKey", "secret", "warning"],
            properties: {
              apiKey: ref("ApiKeyMetadata"),
              secret: {
                type: "string",
                description:
                  "One-time API key secret. It is only returned on creation.",
                example: "il_test_your_key_here"
              },
              warning: {
                type: "string",
                example:
                  "Copy this API key now. Invoice Lantern stores only a hash and cannot show it again."
              }
            }
          })
        }
      })
    },
    "/api-keys/{id}/revoke": {
      post: bearerOperation({
        tags: ["Authentication / API Keys"],
        summary: "Revoke an organization API key",
        description:
          "Revokes an organization API key for the signed-in workspace. Requires an organization owner, admin, or developer role.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": response("Revoked API key metadata.", {
            type: "object",
            required: ["apiKey"],
            properties: {
              apiKey: ref("ApiKeyMetadata")
            }
          })
        }
      })
    },
    "/api-requests": {
      get: bearerOperation({
        tags: ["Usage and Rate Limits"],
        summary: "List API request metadata",
        description:
          "Lists safe API request log metadata for the signed-in workspace. Requires an organization owner, admin, or developer role. Request bodies, XML payloads, full API keys, full VAT IDs, and key hashes are not returned.",
        parameters: [
          {
            name: "apiKeyId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 200,
              default: 50
            }
          },
          {
            name: "statusCode",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 100,
              maximum: 599
            }
          },
          {
            name: "pathPrefix",
            in: "query",
            required: false,
            schema: {
              type: "string",
              example: "/api/v1/invoices"
            }
          }
        ],
        responses: {
          "200": response("API request metadata.", {
            type: "object",
            required: ["apiRequests"],
            properties: {
              apiRequests: {
                type: "array",
                items: ref("ApiRequestMetadata")
              }
            }
          })
        }
      })
    },
    "/api-requests/summary": {
      get: bearerOperation({
        tags: ["Usage and Rate Limits"],
        summary: "Get API usage summary",
        description:
          "Returns a safe usage summary for the signed-in workspace over a recent day window. Requires an organization owner, admin, or developer role.",
        parameters: [
          {
            name: "apiKeyId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          },
          {
            name: "sinceDays",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 365,
              default: 30
            }
          }
        ],
        responses: {
          "200": response("API usage summary.", {
            type: "object",
            required: ["summary"],
            properties: {
              summary: ref("ApiUsageSummary")
            }
          })
        }
      })
    },
    "/api-usage/policies": {
      get: bearerOperation({
        tags: ["Usage and Rate Limits"],
        summary: "List sandbox rate-limit policies",
        description:
          "Lists current sandbox developer API rate-limit policies for the signed-in workspace. These limits protect the sandbox and are not a service-level agreement.",
        responses: {
          "200": response("Rate-limit policies.", {
            type: "object",
            required: ["policies", "disclaimer"],
            properties: {
              policies: {
                type: "array",
                items: ref("ApiRateLimitPolicy")
              },
              disclaimer: {
                type: "string"
              }
            }
          })
        }
      })
    },
    "/api-usage/current": {
      get: bearerOperation({
        tags: ["Usage and Rate Limits"],
        summary: "Get current sandbox usage windows",
        description:
          "Returns current request-window usage for an organization and, when supplied, an API key. These limits protect the sandbox and are not a service-level agreement.",
        parameters: [
          {
            name: "apiKeyId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "uuid"
            }
          },
          {
            name: "policyKey",
            in: "query",
            required: false,
            schema: {
              type: "string",
              example: "invoices_validate"
            }
          }
        ],
        responses: {
          "200": response("Current usage windows.", {
            type: "object",
            required: ["usage", "disclaimer"],
            properties: {
              usage: {
                type: "array",
                items: ref("ApiRateLimitUsage")
              },
              disclaimer: {
                type: "string"
              }
            }
          })
        }
      })
    },
    "/invoices": {
      get: bearerOperation({
        tags: ["Invoices"],
        summary: "List production invoices",
        description:
          "Lists production invoice lifecycle records for the signed-in workspace. This signed-user endpoint is tenant-scoped and returns internal invoice lifecycle state only; it is not official filing, authority submission, legal advice, tax advice, or accounting advice.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: ref("InvoiceLifecycleStatus")
          },
          {
            name: "invoiceNumber",
            in: "query",
            required: false,
            schema: {
              type: "string",
              maxLength: 120
            }
          }
        ],
        responses: {
          "200": response("Tenant-scoped production invoices.", ref("ProductionInvoiceListResponse"))
        }
      }),
      post: bearerOperation({
        tags: ["Invoices"],
        summary: "Create a production invoice",
        description:
          "Creates a production invoice from a strict canonical invoice payload for the signed-in workspace. Owner, admin, accountant, or reviewer roles may create records. Organization API keys are not accepted for this Step 5 lifecycle endpoint.",
        requestBody: {
          required: true,
          content: jsonContent(ref("ProductionInvoiceCreateRequest"), {
            createProductionInvoice: {
              value: {
                canonicalInvoice: exampleCanonicalInvoice,
                source: "manual"
              }
            }
          })
        },
        responses: {
          "201": response("Created production invoice.", ref("ProductionInvoiceResponse")),
          "422": response("Canonical invoice has blocked technical findings.", ref("ProductionInvoiceErrorResponse"))
        }
      })
    },
    "/invoices/from-draft": {
      post: bearerOperation({
        tags: ["Invoices"],
        summary: "Create a production invoice from an invoice draft",
        description:
          "Converts an existing invoice draft into a production invoice without deleting the draft. The conversion uses the canonical invoice model and returns technical findings instead of persisting incomplete data.",
        requestBody: {
          required: true,
          content: jsonContent(ref("ProductionInvoiceFromDraftRequest"), {
            fromDraft: {
              value: {
                draftId: "00000000-0000-4000-8000-000000000001",
                source: "manual"
              }
            }
          })
        },
        responses: {
          "201": response("Created production invoice linked to the draft.", ref("ProductionInvoiceResponse")),
          "422": response("Draft canonical conversion has blocked findings.", ref("ProductionInvoiceErrorResponse"))
        }
      })
    },
    "/invoices/{id}": {
      get: bearerOperation({
        tags: ["Invoices"],
        summary: "Get a production invoice",
        description:
          "Reads one production invoice by id for the signed-in workspace. Reads are filtered by both invoice id and organization id.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": response("Production invoice.", ref("ProductionInvoiceResponse"))
        }
      }),
      patch: bearerOperation({
        tags: ["Invoices"],
        summary: "Update a production invoice canonical payload",
        description:
          "Updates an editable production invoice and replaces normalized child rows from the canonical invoice. Issued, archived, and voided invoices are locked in Step 5 until a future correction flow exists.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: true,
          content: jsonContent(ref("ProductionInvoiceUpdateRequest"), {
            updateProductionInvoice: {
              value: {
                canonicalInvoice: exampleCanonicalInvoice
              }
            }
          })
        },
        responses: {
          "200": response("Updated production invoice.", ref("ProductionInvoiceResponse")),
          "409": errorResponse(
            "Invoice lifecycle status does not allow this update.",
            "PRODUCTION_INVOICE_STATUS_LOCKED"
          ),
          "422": response("Canonical invoice has blocked technical findings.", ref("ProductionInvoiceErrorResponse"))
        }
      })
    },
    "/invoices/{id}/export/ubl": {
      post: bearerOperation({
        tags: ["UBL"],
        summary: "Export a production invoice as technical UBL 2.1 XML",
        description:
          "Generates a technical UBL 2.1 export from the tenant-scoped production invoice canonical record and stores safe invoice_exports metadata. This is structured invoice interoperability output only; it is not official validation, not Peppol-certified, not legal/tax/accounting advice, not official filing, and not authority acceptance.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": response(
            "Generated technical UBL 2.1 XML and safe export metadata.",
            ref("UblExportResponse")
          ),
          "404": errorResponse(
            "Production invoice was not found in this workspace.",
            "PRODUCTION_INVOICE_NOT_FOUND"
          )
        }
      })
    },
    "/invoices/{id}/simulate-vida": {
      post: bearerOperation({
        tags: ["Invoices", "Transactions"],
        summary: "Run a production invoice ViDA-readiness simulation",
        description:
          "Runs and stores a ViDA-readiness simulation from the tenant-scoped production invoice canonical payload. The route requires a signed-in workspace user, does not allow organization API keys, does not change invoice lifecycle status, and does not call live VIES by default. The result is educational technical readiness context only; it is not official filing, not legal advice, not tax advice, not accounting advice, not authority acceptance, and not a compliance guarantee.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: false,
          content: jsonContent(ref("ProductionInvoiceVidaSimulationRequest"), {
            invoiceSimulationContext: {
              value: {
                buyerType: "business",
                transactionType: "services",
                structuredInvoiceSignals: {
                  hasUblXml: true,
                  xsdStatus: "passed",
                  schematronPeppolStatus: "not_configured",
                  schematronEn16931Status: "not_configured"
                }
              }
            }
          })
        },
        responses: {
          "201": response(
            "Persisted production invoice ViDA-readiness simulation.",
            ref("VidaSimulationResponse")
          ),
          "404": errorResponse(
            "Production invoice was not found in this workspace.",
            "PRODUCTION_INVOICE_NOT_FOUND"
          )
        }
      })
    },
    "/invoices/{id}/transition": {
      post: bearerOperation({
        tags: ["Invoices"],
        summary: "Transition a production invoice lifecycle status",
        description:
          "Applies a safe internal lifecycle status transition. The issued status is an internal workspace state only and is not official filing, authority acceptance, Peppol delivery, legal validity, tax compliance, or accounting compliance.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        requestBody: {
          required: true,
          content: jsonContent(ref("ProductionInvoiceTransitionRequest"), {
            transitionProductionInvoice: {
              value: {
                toStatus: "ready_for_review",
                reason: "Ready for technical review."
              }
            }
          })
        },
        responses: {
          "200": response("Transitioned production invoice.", ref("ProductionInvoiceResponse")),
          "409": errorResponse(
            "Requested lifecycle transition is not allowed.",
            "INVOICE_LIFECYCLE_TRANSITION_INVALID"
          )
        }
      })
    },
    "/invoices/{id}/lifecycle-events": {
      get: bearerOperation({
        tags: ["Invoices"],
        summary: "List production invoice lifecycle events",
        description:
          "Lists tenant-scoped lifecycle history for a production invoice. Events record internal workspace state changes and do not represent official filing or authority acceptance.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid"
            }
          }
        ],
        responses: {
          "200": response("Production invoice lifecycle events.", ref("ProductionInvoiceLifecycleEventsResponse"))
        }
      })
    },
    "/invoices/validate": {
      post: scopedApiKeyOperation({
        tags: ["Invoices"],
        summary: "Validate a canonical invoice payload",
        description:
          "Runs Invoice Lantern technical validation against a canonical invoice payload and stores a validation run. This is a sandbox technical validation result only.",
        scope: "invoices:validate",
        requestBody: {
          required: true,
          content: jsonContent(ref("InvoiceValidationRequest"), {
            invoiceValidation: {
              value: exampleCanonicalInvoice
            },
            invoiceValidationWithViesSkipped: {
              value: {
                invoice: exampleCanonicalInvoice,
                viesMode: "skip"
              }
            }
          })
        },
        responses: {
          "200": {
            description: "Validation run result.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("InvoiceValidationResponse"))
          }
        }
      })
    },
    "/invoices/export/ubl": {
      post: scopedApiKeyOperation({
        tags: ["UBL"],
        summary: "Export a canonical invoice as technical UBL 2.1 XML",
        description:
          "Generates a technical UBL 2.1 export from a canonical invoice payload and stores safe export metadata. Draft-only lookup is not available to organization API keys. This endpoint supports structured invoice interoperability only; it is not official validation, not Peppol-certified, not legal/tax/accounting advice, not official filing, and not authority acceptance.",
        scope: "invoices:export_ubl",
        requestBody: {
          required: true,
          content: jsonContent(ref("UblExportRequest"), {
            ublExport: {
              value: {
                invoice: exampleCanonicalInvoice,
                validationRunId: "val_example"
              }
            }
          })
        },
        responses: {
          "200": {
            description: "Generated technical UBL 2.1 XML and safe export metadata.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("UblExportResponse"))
          },
          "422": response("UBL export blocked by fatal findings.", {
            type: "object",
            properties: {
              xml: {
                type: "string",
                example: ""
              },
              metadata: ref("UblExportMetadata"),
              readinessStatus: {
                type: "string",
                example: "blocked"
              },
              totals: ref("InvoiceTotals"),
              findings: {
                type: "array",
                items: ref("ValidationFinding")
              },
              disclaimer: {
                type: "string"
              }
            }
          })
        }
      })
    },
    "/invoices/parse/ubl": {
      post: scopedApiKeyOperation({
        tags: ["UBL"],
        summary: "Parse UBL XML into the Invoice Lantern canonical model",
        description:
          "Parses UBL XML into the Invoice Lantern canonical invoice model and returns technical parser findings and warnings. The endpoint accepts raw XML with an XML content type or JSON with an xml string. Parsing is not official validation, not Peppol certification, not legal/tax/accounting advice, not official filing, and not authority acceptance.",
        scope: "invoices:parse_ubl",
        requestBody: {
          required: true,
          content: {
            ...jsonContent(ref("UblParseJsonRequest"), {
              jsonXml: {
                value: {
                  xml: tinyUblXml
                }
              }
            }),
            "application/xml": {
              schema: {
                type: "string"
              },
              example: tinyUblXml
            },
            "text/xml": {
              schema: {
                type: "string"
              },
              example: tinyUblXml
            }
          }
        },
        responses: {
          "200": {
            description: "Parsed UBL XML.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("UblParseResponse"))
          },
          "413": errorResponse("XML body is too large.", "XML_BODY_TOO_LARGE"),
          "415": errorResponse(
            "Use raw XML or JSON with an xml string for UBL parsing.",
            "UNSUPPORTED_MEDIA_TYPE"
          ),
          "422": response(
            "UBL XML parsed but could not produce a valid canonical invoice.",
            ref("UblParseResponse")
          )
        }
      })
    },
    "/xml/validation-jobs": {
      get: scopedApiKeyOperation({
        tags: ["XML Validation Jobs"],
        summary: "List XML validation jobs",
        description:
          "Lists XML validation jobs for the caller's organization. Raw XML is never returned. UBL XSD checks use the configured local XSD adapter. schematron_peppol and schematron_en16931 can run guarded local Schematron execution only when reviewed local artifacts are configured, SCHEMATRON_EXECUTION_MODE=execute, SCHEMATRON_ENGINE=xpath_engine, SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION is true-like, XML safety checks pass, and the artifact uses supported constructs. Blank/default configuration remains disabled or preflight-only with validationExecuted=false and markedValid=false. Unsupported, unsafe, missing, unreadable, out-of-root, timeout, and error cases fail safely and are not marked valid. schematron_peppol_placeholder remains a deprecated safe preflight alias. Responses include sanitized summaries/findings only and never raw XML, Schematron file contents, full absolute local paths, certification, compliance or legal/tax/accounting guarantees, or authority acceptance.",
        scope: "xml:validation_jobs",
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25
            }
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["queued", "running", "completed", "failed", "cancelled"]
            }
          }
        ],
        responses: {
          "200": {
            description: "XML validation job metadata.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("XmlValidationJobListResponse"))
          }
        }
      }),
      post: scopedApiKeyOperation({
        tags: ["XML Validation Jobs"],
        summary: "Create an XML validation job",
        description:
          "Creates an XML validation job. The request may ask for worker readiness, configuration-gated local UBL XSD, the deprecated schematron_peppol_placeholder preflight alias, and guarded local Schematron execution checks schematron_peppol or schematron_en16931. UBL XSD returns not_configured when local XSD artifacts are unavailable and passed or failed only after real local XSD validation executes. Schematron execution is disabled unless PEPPOL_SCHEMATRON_ROOT_DIR, PEPPOL_BIS_SCHEMATRON_PATH or EN16931_SCHEMATRON_PATH, SCHEMATRON_ARTIFACT_VERSION, SCHEMATRON_EXECUTION_MODE=execute, SCHEMATRON_ENGINE=xpath_engine, and SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION=true/1/yes are configured safely. The executor uses reviewed local artifacts only, performs no remote fetching, rejects unsafe XML and unsupported Schematron/XPath constructs, and maps supported failed assertions and successful reports to sanitized findings. markedValid=true means only the configured technical Schematron check executed fully and produced no failed assertions or fatal/error findings. Public responses do not include raw XML, Schematron contents, file contents, full absolute Schematron paths, certification, compliance or legal/tax/accounting guarantees, filing, or authority acceptance.",
        scope: "xml:validation_jobs",
        requestBody: {
          required: true,
          content: jsonContent(ref("XmlValidationJobCreateRequest"), {
            workerReadinessAndXsdBoundary: {
              value: {
                xml: tinyUblXml,
                filename: "invoice-lantern-worker-readiness.xml",
                sourceType: "api_payload",
                requestedChecks: [
                  "worker_readiness",
                  "xsd_ubl",
                  "schematron_peppol_placeholder",
                  "schematron_peppol",
                  "schematron_en16931"
                ]
              }
            }
          })
        },
        responses: {
          "200": {
            description: "Completed XML validation job metadata.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("XmlValidationJobResponse"))
          },
          "413": errorResponse("XML body is too large.", "XML_BODY_TOO_LARGE")
        }
      })
    },
    "/xml/validation-jobs/{id}": {
      get: scopedApiKeyOperation({
        tags: ["XML Validation Jobs"],
        summary: "Get XML validation job detail",
        description:
          "Returns metadata, requested/completed/failed check names, result summary, findings, and the non-official disclaimer for one XML validation job. Raw XML is never returned.",
        scope: "xml:validation_jobs",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          }
        ],
        responses: {
          "200": {
            description: "XML validation job detail.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("XmlValidationJobResponse"))
          }
        }
      })
    },
    "/vat/validate-format": {
      post: scopedApiKeyOperation({
        tags: ["VAT"],
        summary: "Run a local VAT ID format check",
        description:
          "Checks VAT ID format against local country patterns only. This does not call VIES and does not confirm VAT registration, existence, ownership, activity, or authority acceptance.",
        scope: "vat:validate_format",
        requestBody: {
          required: true,
          content: jsonContent(ref("VatFormatRequest"), {
            vatFormat: {
              value: {
                vatId: "HU12345678",
                countryHint: "HU"
              }
            }
          })
        },
        responses: {
          "200": {
            description: "Local VAT format result.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("VatFormatResponse"))
          }
        }
      })
    },
    "/vat/check-vies": {
      post: scopedApiKeyOperation({
        tags: ["VAT"],
        summary: "Run an explicit VIES evidence check",
        description:
          "Runs a local VAT format check first, then optionally retrieves VIES time-of-check evidence only when live VIES is enabled server-side. If local format is invalid, VIES is not called. VIES unavailable is not invalid, VIES valid does not prove full transaction treatment, and this endpoint is not legal, tax, accounting, filing, or authority advice.",
        scope: "vat:check_vies",
        requestBody: {
          required: true,
          content: jsonContent(ref("ViesCheckRequest"), {
            viesCheck: {
              value: {
                countryCode: "DE",
                vatNumber: "DE123456789",
                partyRole: "seller"
              }
            }
          })
        },
        responses: {
          "200": {
            description: "VIES evidence result or safe not-checked status.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("ViesCheckResponse"))
          }
        }
      })
    },
    "/country-packs": {
      get: {
        tags: ["Country Packs"],
        summary: "List country packs",
        description:
          "Returns the Invoice Lantern country-pack catalogue with bundled pack data and registry metadata when the database registry is configured. Country packs are educational simulations only. They do not certify legal, tax, accounting, filing, Peppol, EN 16931, ViDA, or authority compliance.",
        responses: {
          "200": response("Country-pack catalogue.", ref("CountryPackCatalogResponse")),
          "500": commonErrorResponses["500"]
        }
      }
    },
    "/country-packs/{countryCode}": {
      get: {
        tags: ["Country Packs"],
        summary: "Get country-pack detail",
        description:
          "Returns one Invoice Lantern country pack by two-letter country code, including VAT-format metadata, e-invoicing status, warnings, source references, rules, disclaimer text, and registry lifecycle metadata when available. This is a sandbox educational endpoint only.",
        parameters: [
          {
            name: "countryCode",
            in: "path",
            required: true,
            schema: {
              type: "string",
              minLength: 2,
              maxLength: 2,
              pattern: "^[A-Za-z]{2}$",
              example: "HU"
            }
          }
        ],
        responses: {
          "200": response("Country-pack detail.", ref("CountryPackDetailResponse")),
          "400": errorResponse(
            "Country code must be a two-letter ISO-style code.",
            "INVALID_COUNTRY_CODE"
          ),
          "404": errorResponse(
            "Country pack is not currently supported by Invoice Lantern.",
            "COUNTRY_PACK_NOT_FOUND"
          ),
          "500": commonErrorResponses["500"]
        }
      }
    },
    "/transactions/simulate-vida": {
      post: scopedApiKeyOperation({
        tags: ["Transactions"],
        summary: "Run a ViDA-readiness transaction simulation",
        description:
          "Runs an educational and technical ViDA-readiness simulation for a transaction scenario. The result classifies the scenario for readiness planning only, such as cross-border EU B2B relevance, missing VAT ID context, domestic review needs, or insufficient data. It is not official software, not an official ViDA determination, not authority submission, not filing software, not legal advice, not tax advice, not accounting advice, and not a compliance guarantee. Optional workspace persistence is available only for signed-in workspace flows; organization API-key requests can run the simulation but do not create workspace audit records.",
        scope: "transactions:simulate_vida",
        requestBody: {
          required: true,
          content: jsonContent(ref("VidaSimulationRequest"), {
            crossBorderEuB2B: {
              value: exampleVidaSimulationRequest
            },
            workspacePersistedRun: {
              value: {
                ...exampleVidaSimulationRequest,
                persist: true
              }
            }
          })
        },
        responses: {
          "200": {
            description: "ViDA-readiness simulation result.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("VidaSimulationResponse"))
          }
        }
      })
    },
    "/transactions/vida-simulations": {
      get: bearerOperation({
        tags: ["Transactions"],
        summary: "List saved ViDA simulation runs",
        description:
          "Lists workspace-owned ViDA-readiness simulation run summaries for the signed-in workspace. These are audit/history records for educational technical readiness simulation only. They are not official ViDA determinations, not authority submissions, not filing records, not legal advice, not tax advice, not accounting advice, and not compliance guarantees.",
        parameters: [
          {
            name: "invoiceDraftId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          },
          {
            name: "validationRunId",
            in: "query",
            required: false,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          },
          {
            name: "vidaRelevance",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["high", "medium", "low", "not_relevant", "review_required"]
            }
          },
          {
            name: "transactionClass",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: [
                "intra_eu_b2b_goods",
                "intra_eu_b2b_service",
                "intra_eu_b2b_digital_service",
                "intra_eu_b2b_mixed",
                "intra_eu_b2b_unknown",
                "intra_eu_b2c",
                "intra_eu_public_authority",
                "domestic_eu_business",
                "domestic_eu_consumer",
                "domestic_eu_unknown",
                "non_eu_or_unsupported",
                "insufficient_data"
              ]
            }
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25
            }
          }
        ],
        responses: {
          "200": response(
            "Saved ViDA simulation run summaries.",
            ref("VidaSimulationHistoryResponse")
          )
        }
      })
    },
    "/transactions/vida-simulations/{id}": {
      get: bearerOperation({
        tags: ["Transactions"],
        summary: "Get saved ViDA simulation run detail",
        description:
          "Returns one workspace-owned ViDA-readiness simulation run with the saved sanitized input snapshot, normalized input, result payload, findings, source labels, recommendation text, request metadata, and legal-safe disclaimer. This is an audit/history record for educational technical readiness simulation only. It is not official ViDA software, not authority submission, not filing software, not legal advice, not tax advice, not accounting advice, and not a compliance guarantee.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 160
            }
          }
        ],
        responses: {
          "200": response(
            "Saved ViDA simulation run detail.",
            ref("VidaSimulationDetailResponse")
          )
        }
      })
    },
    "/validation/rules": {
      get: scopedApiKeyOperation({
        tags: ["Validation Rules"],
        summary: "List published validation rules",
        description:
          "Returns the published Invoice Lantern technical sandbox validation rule catalog with versions, severities, categories, source labels, and legal-confidence labels.",
        scope: "rules:read",
        responses: {
          "200": {
            description: "Published validation rule sets.",
            headers: rateLimitHeaders,
            content: jsonContent(ref("ValidationRuleCatalogResponse"), {
              catalog: {
                value: {
                  ruleSets: [
                    {
                      code: "INVOICE_LANTERN_CORE",
                      name: "Invoice Lantern Core Technical Rules",
                      version: CORE_VALIDATION_RULE_VERSION,
                      status: "published",
                      legalConfidence: "technical",
                      rules: []
                    }
                  ],
                  disclaimer:
                    "Published rules are technical sandbox rules and are not legal, tax, accounting, or authority conclusions."
                }
              }
            })
          }
        }
      })
    },
    "/validation-runs/{id}": {
      get: {
        tags: ["Validation Runs"],
        summary: "Get validation run detail",
        description:
          "Returns the stored validation run record and structured report summary. Organization API keys require the `validation_runs:read` scope and can only read runs owned by their organization. Signed-in workspace users may also read runs permitted by workspace authorization.",
        security: [
          {
            ApiKeyAuth: []
          },
          {
            SupabaseBearerAuth: []
          }
        ],
        "x-required-scope": "validation_runs:read",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          }
        ],
        responses: apiKeyResponses({
          "200": response("Validation run detail.", {
            type: "object",
            required: ["record", "reportSummary"],
            properties: {
              record: ref("ValidationRunRecord"),
              reportSummary: ref("ValidationReportSummary")
            }
          })
        })
      }
    },
    "/validation-runs/{id}/report.pdf": {
      get: {
        tags: ["Reports"],
        summary: "Download a validation report PDF",
        description:
          "Downloads a non-official technical sandbox validation report PDF. Organization API keys require the `validation_runs:read` scope and can only download reports for validation runs owned by their organization. Signed-in workspace users may download reports permitted by workspace authorization.",
        security: [
          {
            ApiKeyAuth: []
          },
          {
            SupabaseBearerAuth: []
          }
        ],
        "x-required-scope": "validation_runs:read",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 120
            }
          }
        ],
        responses: apiKeyResponses({
          "200": {
            description: "PDF validation report.",
            headers: {
              "Content-Disposition": {
                description: "Attachment filename for the generated report.",
                schema: {
                  type: "string"
                }
              },
              "Content-Length": {
                description: "PDF byte length.",
                schema: {
                  type: "integer"
                }
              }
            },
            content: {
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary"
                }
              }
            }
          }
        })
      }
    }
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description:
          "Organization API key shown once at creation. Use placeholders such as il_test_your_key_here in examples."
      },
      SupabaseBearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Supabase access token",
        description:
          "Signed-in workspace user session token. Used by API key management, usage logs, rate-limit dashboard endpoints, and report downloads."
      }
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "details"],
            properties: {
              code: {
                type: "string",
                enum: [
                  "VALIDATION_ERROR",
                  "AUTHENTICATION_REQUIRED",
                  "API_KEY_REQUIRED",
                  "INVALID_API_KEY",
                  "API_KEY_INVALID",
                  "AUTH_TOKEN_REQUIRED",
                  "INSUFFICIENT_SCOPE",
                  "API_KEY_SCOPE_INSUFFICIENT",
                  "NOT_FOUND",
                  "INTERNAL_ERROR"
                ]
              },
              message: {
                type: "string"
              },
              details: {
                oneOf: [
                  {
                    type: "object"
                  },
                  {
                    type: "array"
                  },
                  {
                    type: "string"
                  },
                  {
                    type: "null"
                  }
                ]
              }
            }
          }
        }
      },
      RateLimitErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: [
              "code",
              "message",
              "limit",
              "windowSeconds",
              "retryAfterSeconds"
            ],
            properties: {
              code: {
                type: "string",
                const: "RATE_LIMIT_EXCEEDED"
              },
              message: {
                type: "string"
              },
              limit: {
                type: "integer"
              },
              windowSeconds: {
                type: "integer"
              },
              retryAfterSeconds: {
                type: "integer"
              }
            }
          }
        }
      },
      ApiKeyMetadata: {
        type: "object",
        required: [
          "id",
          "name",
          "keyPrefix",
          "environment",
          "scopes",
          "status",
          "expiresAt",
          "lastUsedAt",
          "lastUsedIp",
          "createdBy",
          "revokedBy",
          "revokedAt",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          name: {
            type: "string",
            example: "Local sandbox key"
          },
          keyPrefix: {
            type: "string",
            example: "il_test_abc123"
          },
          environment: {
            type: "string",
            enum: ["test", "live"]
          },
          scopes: {
            type: "array",
            items: ref("ApiKeyScope")
          },
          status: {
            type: "string",
            enum: ["active", "revoked", "expired"]
          },
          expiresAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          lastUsedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          lastUsedIp: {
            type: ["string", "null"]
          },
          createdBy: {
            type: ["string", "null"],
            format: "uuid"
          },
          revokedBy: {
            type: ["string", "null"],
            format: "uuid"
          },
          revokedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      ApiKeyScope: {
        type: "string",
        enum: [
          "invoices:validate",
          "invoices:export_ubl",
          "invoices:parse_ubl",
          "invoices:import_ubl",
          "xml:validation_jobs",
          "vat:validate_format",
          "vat:check_vies",
          "transactions:simulate_vida",
          "validation_runs:read",
          "rules:read"
        ]
      },
      CreateApiKeyRequest: {
        type: "object",
        required: ["name", "scopes"],
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 120
          },
          environment: {
            type: "string",
            enum: ["test", "live"],
            default: "test"
          },
          scopes: {
            type: "array",
            minItems: 1,
            items: ref("ApiKeyScope")
          },
          expiresAt: {
            type: ["string", "null"],
            format: "date-time"
          }
        }
      },
      ApiRequestMetadata: {
        type: "object",
        required: [
          "id",
          "organizationId",
          "apiKeyId",
          "apiKeyName",
          "apiKeyPrefix",
          "requestMethod",
          "requestPath",
          "statusCode",
          "durationMs",
          "ipAddress",
          "userAgent",
          "errorCode",
          "createdAt"
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          organizationId: {
            type: ["string", "null"],
            format: "uuid"
          },
          apiKeyId: {
            type: ["string", "null"],
            format: "uuid"
          },
          apiKeyName: {
            type: ["string", "null"]
          },
          apiKeyPrefix: {
            type: ["string", "null"]
          },
          requestMethod: {
            type: "string",
            example: "POST"
          },
          requestPath: {
            type: "string",
            example: "/api/v1/invoices/validate"
          },
          statusCode: {
            type: ["integer", "null"]
          },
          durationMs: {
            type: ["integer", "null"]
          },
          ipAddress: {
            type: ["string", "null"]
          },
          userAgent: {
            type: ["string", "null"]
          },
          errorCode: {
            type: ["string", "null"],
            example: "RATE_LIMIT_EXCEEDED"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      ApiUsageSummary: {
        type: "object",
        required: [
          "totalRequests",
          "successfulRequests",
          "failedRequests",
          "clientErrorCount",
          "serverErrorCount",
          "averageDurationMs",
          "lastRequestAt",
          "topPaths",
          "statusBuckets"
        ],
        properties: {
          totalRequests: {
            type: "integer"
          },
          successfulRequests: {
            type: "integer"
          },
          failedRequests: {
            type: "integer"
          },
          clientErrorCount: {
            type: "integer"
          },
          serverErrorCount: {
            type: "integer"
          },
          averageDurationMs: {
            type: "integer"
          },
          lastRequestAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          topPaths: {
            type: "array",
            items: {
              type: "object",
              required: ["path", "count"],
              properties: {
                path: {
                  type: "string"
                },
                count: {
                  type: "integer"
                }
              }
            }
          },
          statusBuckets: {
            type: "object",
            required: ["2xx", "3xx", "4xx", "5xx"],
            properties: {
              "2xx": {
                type: "integer"
              },
              "3xx": {
                type: "integer"
              },
              "4xx": {
                type: "integer"
              },
              "5xx": {
                type: "integer"
              }
            }
          }
        }
      },
      ApiRateLimitPolicy: {
        type: "object",
        required: [
          "policyKey",
          "scope",
          "windowSeconds",
          "maxRequests",
          "description",
          "appliesTo"
        ],
        properties: {
          policyKey: {
            type: "string",
            example: "invoices_validate"
          },
          scope: {
            type: "string",
            example: "invoices:validate"
          },
          windowSeconds: {
            type: "integer",
            example: 900
          },
          maxRequests: {
            type: "integer",
            example: 30
          },
          description: {
            type: "string"
          },
          appliesTo: {
            type: "string",
            enum: ["api_key", "organization"]
          }
        }
      },
      ApiRateLimitUsage: {
        type: "object",
        required: [
          "apiKeyId",
          "policyKey",
          "windowSeconds",
          "maxRequests",
          "used",
          "remaining",
          "resetAt",
          "status"
        ],
        properties: {
          apiKeyId: {
            type: ["string", "null"],
            format: "uuid"
          },
          policyKey: {
            type: "string"
          },
          windowSeconds: {
            type: "integer"
          },
          maxRequests: {
            type: "integer"
          },
          used: {
            type: "integer"
          },
          remaining: {
            type: "integer"
          },
          resetAt: {
            type: "string",
            format: "date-time"
          },
          status: {
            type: "string",
            enum: ["ok", "limited"]
          }
        }
      },
      CanonicalInvoice: {
        type: "object",
        additionalProperties: false,
        required: ["profile", "document", "seller", "buyer", "lines"],
        properties: {
          profile: ref("CanonicalInvoiceProfile"),
          document: {
            type: "object",
            additionalProperties: false,
            required: ["type", "number", "issueDate", "currency"],
            properties: {
              type: {
                type: "string",
                enum: ["invoice", "credit_note"],
                default: "invoice"
              },
              number: {
                type: "string",
                maxLength: 80
              },
              currency: {
                type: "string",
                maxLength: 3,
                example: "EUR"
              },
              issueDate: {
                type: "string",
                maxLength: 32,
                example: "2026-04-30"
              },
              dueDate: {
                type: "string",
                maxLength: 32,
                example: "2026-05-30"
              },
              profile: {
                $ref: "#/components/schemas/CanonicalInvoiceProfile"
              },
              buyerReference: {
                type: "string",
                maxLength: 120
              },
              contractReference: {
                type: "string",
                maxLength: 120
              },
              orderReference: {
                type: "string",
                maxLength: 120
              },
              projectReference: {
                type: "string",
                maxLength: 120
              },
              accountingCost: {
                type: "string",
                maxLength: 120
              }
            }
          },
          seller: ref("CanonicalParty"),
          buyer: ref("CanonicalParty"),
          delivery: ref("CanonicalDelivery"),
          payment: ref("CanonicalPayment"),
          lines: {
            type: "array",
            minItems: 1,
            maxItems: 500,
            items: ref("CanonicalInvoiceLine")
          },
          allowances: {
            type: "array",
            maxItems: 500,
            items: ref("CanonicalInvoiceAdjustment")
          },
          charges: {
            type: "array",
            maxItems: 500,
            items: ref("CanonicalInvoiceAdjustment")
          },
          taxBreakdown: {
            type: "array",
            maxItems: 500,
            items: ref("InvoiceTaxBreakdown")
          },
          taxSubtotals: {
            type: "array",
            maxItems: 500,
            items: ref("InvoiceTaxBreakdown")
          },
          totals: ref("InvoiceTotals"),
          metadata: {
            type: "object",
            additionalProperties: true
          },
          legal: ref("CanonicalLegal")
        }
      },
      CanonicalInvoiceProfile: {
        type: "string",
        enum: ["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"]
      },
      CanonicalParty: {
        type: "object",
        additionalProperties: false,
        required: ["name", "country", "address"],
        properties: {
          name: {
            type: "string",
            maxLength: 160
          },
          legalName: {
            type: "string",
            maxLength: 240
          },
          country: {
            type: "string",
            maxLength: 2,
            example: "DE"
          },
          vatId: {
            type: "string",
            maxLength: 32
          },
          taxRegistrationNumber: {
            type: "string",
            maxLength: 120
          },
          city: {
            type: "string",
            maxLength: 120
          },
          postalCode: {
            type: "string",
            maxLength: 32
          },
          street: {
            type: "string",
            maxLength: 180
          },
          region: {
            type: "string",
            maxLength: 120
          },
          electronicAddress: {
            type: "string",
            maxLength: 160
          },
          electronicAddressScheme: {
            type: "string",
            maxLength: 40
          },
          email: {
            type: "string",
            maxLength: 320
          },
          phone: {
            type: "string",
            maxLength: 80
          },
          address: ref("CanonicalAddress")
        }
      },
      CanonicalAddress: {
        type: "object",
        additionalProperties: false,
        required: ["city", "country"],
        properties: {
          street: {
            type: "string",
            maxLength: 180
          },
          additionalStreet: {
            type: "string",
            maxLength: 180
          },
          city: {
            type: "string",
            maxLength: 120
          },
          postalCode: {
            type: "string",
            maxLength: 32
          },
          region: {
            type: "string",
            maxLength: 120
          },
          country: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            example: "DE"
          }
        }
      },
      CanonicalDelivery: {
        type: "object",
        additionalProperties: false,
        properties: {
          deliveryDate: {
            type: "string",
            example: "2026-04-30"
          },
          locationId: {
            type: "string",
            maxLength: 120
          },
          country: {
            type: "string",
            maxLength: 2
          },
          address: ref("CanonicalAddress")
        }
      },
      CanonicalPayment: {
        type: "object",
        additionalProperties: false,
        properties: {
          paymentMeansCode: {
            type: "string",
            maxLength: 40
          },
          paymentReference: {
            type: "string",
            maxLength: 120
          },
          terms: {
            type: "string",
            maxLength: 2000
          },
          dueDate: {
            type: "string",
            example: "2026-05-30"
          },
          accountLabel: {
            type: "string",
            maxLength: 120
          },
          accountLast4: {
            type: "string",
            maxLength: 4,
            description:
              "Optional account label suffix only. Full bank account data is not required."
          }
        }
      },
      CanonicalInvoiceLine: {
        type: "object",
        additionalProperties: false,
        required: [
          "description",
          "quantity",
          "unitCode",
          "unitPrice",
          "vatCategory",
          "vatRate"
        ],
        properties: {
          id: {
            type: "string",
            maxLength: 80
          },
          description: {
            type: "string",
            maxLength: 1000
          },
          itemName: {
            type: "string",
            maxLength: 240
          },
          quantity: {
            type: "string",
            example: "1"
          },
          unitCode: {
            type: "string",
            maxLength: 12,
            example: "EA"
          },
          unitPrice: {
            type: "string",
            example: "100.00"
          },
          discountAmount: {
            type: "string",
            example: "0.00"
          },
          chargeAmount: {
            type: "string",
            example: "0.00"
          },
          vatCategory: {
            type: "string",
            maxLength: 40,
            example: "S"
          },
          vatRate: {
            type: "string",
            example: "27"
          },
          netAmount: {
            type: "string",
            example: "100.00"
          },
          taxAmount: {
            type: "string",
            example: "27.00"
          },
          accountingCost: {
            type: "string",
            maxLength: 120
          },
          orderLineReference: {
            type: "string",
            maxLength: 120
          }
        }
      },
      CanonicalInvoiceAdjustment: {
        type: "object",
        additionalProperties: false,
        required: ["scope", "amount"],
        properties: {
          id: {
            type: "string",
            maxLength: 80
          },
          scope: {
            type: "string",
            enum: ["document", "line"]
          },
          lineId: {
            type: "string",
            maxLength: 80
          },
          reason: {
            type: "string",
            maxLength: 500
          },
          reasonCode: {
            type: "string",
            maxLength: 80
          },
          amount: {
            type: "string",
            example: "10.00"
          },
          baseAmount: {
            type: "string",
            example: "100.00"
          },
          percentage: {
            type: "string",
            example: "10"
          },
          taxCategory: {
            type: "string",
            example: "S"
          },
          vatRate: {
            type: "string",
            example: "27"
          }
        }
      },
      InvoiceTaxBreakdown: {
        type: "object",
        additionalProperties: false,
        properties: {
          taxCategory: {
            type: "string",
            example: "S"
          },
          taxScheme: {
            type: "string",
            example: "VAT"
          },
          taxableAmount: {
            type: "string",
            example: "100.00"
          },
          taxAmount: {
            type: "string",
            example: "27.00"
          },
          vatCategory: {
            type: "string",
            example: "S"
          },
          vatRate: {
            type: "string",
            example: "27"
          },
          exemptionReason: {
            type: "string"
          },
          exemptionReasonCode: {
            type: "string"
          }
        }
      },
      InvoiceTaxSubtotal: {
        $ref: "#/components/schemas/InvoiceTaxBreakdown"
      },
      InvoiceTotals: {
        type: "object",
        additionalProperties: false,
        properties: {
          lineExtensionAmount: {
            type: "string",
            example: "100.00"
          },
          taxExclusiveAmount: {
            type: "string",
            example: "100.00"
          },
          taxAmount: {
            type: "string",
            example: "27.00"
          },
          taxTotalAmount: {
            type: "string",
            example: "27.00"
          },
          taxInclusiveAmount: {
            type: "string",
            example: "127.00"
          },
          allowanceTotalAmount: {
            type: "string",
            example: "10.00"
          },
          chargeTotalAmount: {
            type: "string",
            example: "5.00"
          },
          prepaidAmount: {
            type: "string",
            example: "20.00"
          },
          payableRoundingAmount: {
            type: "string",
            example: "0.01"
          },
          payableAmount: {
            type: "string",
            example: "127.00"
          }
        }
      },
      CanonicalLegal: {
        type: "object",
        additionalProperties: false,
        required: ["legalConfidence", "disclaimer"],
        properties: {
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          disclaimer: {
            type: "string",
            description:
              "Informational-only legal boundary. Results are not legal, tax, accounting, financial, professional, official filing, authority acceptance, or certification advice."
          }
        }
      },
      ValidationFinding: {
        type: "object",
        required: [
          "code",
          "severity",
          "category",
          "fieldPath",
          "message",
          "legalConfidence"
        ],
        properties: {
          code: {
            type: "string",
            example: "DOCUMENT_NUMBER_REQUIRED"
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "fatal", "blocked"]
          },
          category: {
            type: "string",
            enum: [
              "SCHEMA",
              "CANONICAL",
              "CALCULATION",
              "VAT_ID",
              "VIES",
              "EN16931",
              "PEPPOL",
              "UBL",
              "CII",
              "COUNTRY_PACK",
              "VIDA_SIMULATION",
              "SECURITY",
              "LEGAL_LABEL"
            ],
            example: "CANONICAL"
          },
          field: {
            type: "string",
            example: "document.number"
          },
          fieldPath: {
            type: "string",
            example: "document.number"
          },
          message: {
            type: "string"
          },
          fixSuggestion: {
            type: "string"
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          ruleSetCode: {
            type: "string",
            example: "INVOICE_LANTERN_CORE"
          },
          ruleVersion: {
            type: "string",
            example: CORE_VALIDATION_RULE_VERSION
          },
          ruleId: {
            type: "string",
            example: "DOCUMENT_NUMBER_REQUIRED"
          },
          checkType: {
            type: "string",
            example: "canonical"
          },
          layer: {
            type: "string",
            example: "canonical"
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceReferences: {
            type: "array",
            items: ref("ValidationSourceReference")
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          evidenceId: {
            type: "string"
          },
          countryPackVersion: {
            type: "string",
            description:
              "Country-pack version attached to source-linked country simulation findings when present."
          },
          countryPackStatus: {
            type: "string",
            description:
              "Country-pack review status attached to country simulation findings when present."
          },
          countryPackCountryCode: {
            type: "string",
            description:
              "Country-pack country code attached to country simulation findings when present."
          }
        }
      },
      ValidationSourceReference: {
        type: "object",
        properties: {
          id: {
            type: "string"
          },
          sourceName: {
            type: "string"
          },
          sourceLabel: {
            type: "string"
          },
          sourceType: {
            type: "string",
            enum: [
              "internal_technical_policy",
              "standard_documentation",
              "official_eu_source",
              "official_national_source",
              "public_reference",
              "professional_review"
            ]
          },
          sourceUrl: {
            type: "string",
            format: "uri"
          },
          jurisdiction: {
            type: "string"
          },
          reviewedAt: {
            type: "string"
          },
          effectiveFrom: {
            type: "string"
          },
          effectiveUntil: {
            type: "string"
          },
          notes: {
            type: "string"
          }
        }
      },
      InvoiceLifecycleStatus: {
        type: "string",
        enum: [
          "draft",
          "ready_for_review",
          "validated",
          "issued",
          "archived",
          "voided"
        ],
        description:
          "Internal Invoice Lantern workspace lifecycle state. The issued value is internal only and is not official filing, authority acceptance, Peppol delivery, legal advice, tax advice, or accounting advice."
      },
      ProductionInvoiceCreateRequest: {
        type: "object",
        additionalProperties: false,
        required: ["canonicalInvoice"],
        properties: {
          canonicalInvoice: ref("CanonicalInvoice"),
          source: {
            type: "string",
            enum: ["manual", "api", "ubl_import"],
            default: "manual"
          },
          draftId: {
            type: ["string", "null"],
            format: "uuid"
          }
        }
      },
      ProductionInvoiceUpdateRequest: {
        type: "object",
        additionalProperties: false,
        required: ["canonicalInvoice"],
        properties: {
          canonicalInvoice: ref("CanonicalInvoice")
        }
      },
      ProductionInvoiceFromDraftRequest: {
        type: "object",
        additionalProperties: false,
        required: ["draftId"],
        properties: {
          draftId: {
            type: "string",
            minLength: 1,
            maxLength: 120
          },
          source: {
            type: "string",
            enum: ["manual", "api", "ubl_import"],
            default: "manual"
          }
        }
      },
      ProductionInvoiceTransitionRequest: {
        type: "object",
        additionalProperties: false,
        required: ["toStatus"],
        properties: {
          toStatus: ref("InvoiceLifecycleStatus"),
          reason: {
            type: "string",
            maxLength: 1000
          }
        }
      },
      ProductionInvoiceValidationSummary: {
        type: "object",
        required: [
          "status",
          "infoCount",
          "warningCount",
          "fatalCount",
          "blockedCount",
          "findings",
          "disclaimer"
        ],
        properties: {
          status: {
            type: "string",
            enum: ["ready", "blocked"]
          },
          infoCount: {
            type: "integer",
            minimum: 0
          },
          warningCount: {
            type: "integer",
            minimum: 0
          },
          fatalCount: {
            type: "integer",
            minimum: 0
          },
          blockedCount: {
            type: "integer",
            minimum: 0
          },
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          disclaimer: {
            type: "string",
            description:
              "Preserved informational-only disclaimer. Not legal, tax, accounting, professional, official filing, or authority advice."
          }
        }
      },
      ProductionInvoiceCalculationSummary: {
        type: "object",
        required: ["lines", "taxSubtotals", "taxBreakdown", "totals"],
        properties: {
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true
            }
          },
          taxSubtotals: {
            type: "array",
            items: ref("InvoiceTaxBreakdown")
          },
          taxBreakdown: {
            type: "array",
            items: ref("InvoiceTaxBreakdown")
          },
          totals: ref("InvoiceTotals")
        }
      },
      ProductionInvoice: {
        type: "object",
        required: [
          "id",
          "organizationId",
          "draftId",
          "invoiceNumber",
          "invoiceType",
          "profile",
          "issueDate",
          "dueDate",
          "currency",
          "status",
          "legalConfidence",
          "source",
          "canonicalInvoice",
          "calculationSummary",
          "validationSummary",
          "createdAt",
          "updatedAt",
          "finalizedAt",
          "issuedAt",
          "archivedAt"
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          organizationId: {
            type: "string",
            format: "uuid",
            description:
              "Tenant organization id from the authenticated workspace context."
          },
          draftId: {
            type: ["string", "null"],
            format: "uuid"
          },
          invoiceNumber: {
            type: "string"
          },
          invoiceType: {
            type: "string",
            enum: ["invoice", "credit_note"]
          },
          profile: ref("CanonicalInvoiceProfile"),
          issueDate: {
            type: "string",
            format: "date"
          },
          dueDate: {
            type: ["string", "null"],
            format: "date"
          },
          currency: {
            type: "string",
            example: "EUR"
          },
          status: ref("InvoiceLifecycleStatus"),
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          source: {
            type: "string"
          },
          canonicalInvoice: ref("CanonicalInvoice"),
          calculationSummary: ref("ProductionInvoiceCalculationSummary"),
          validationSummary: ref("ProductionInvoiceValidationSummary"),
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          },
          finalizedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          issuedAt: {
            type: ["string", "null"],
            format: "date-time",
            description:
              "Timestamp for internal workspace issued state only; not official filing or authority acceptance."
          },
          archivedAt: {
            type: ["string", "null"],
            format: "date-time"
          }
        }
      },
      ProductionInvoiceResponse: {
        type: "object",
        required: ["record"],
        properties: {
          record: ref("ProductionInvoice")
        }
      },
      ProductionInvoiceListResponse: {
        type: "object",
        required: ["records"],
        properties: {
          records: {
            type: "array",
            items: ref("ProductionInvoice")
          }
        }
      },
      ProductionInvoiceLifecycleEvent: {
        type: "object",
        required: [
          "id",
          "organizationId",
          "invoiceId",
          "fromStatus",
          "toStatus",
          "reason",
          "actorUserId",
          "actorApiKeyId",
          "metadata",
          "createdAt"
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          organizationId: {
            type: "string",
            format: "uuid"
          },
          invoiceId: {
            type: "string",
            format: "uuid"
          },
          fromStatus: {
            oneOf: [ref("InvoiceLifecycleStatus"), { type: "null" }]
          },
          toStatus: ref("InvoiceLifecycleStatus"),
          reason: {
            type: ["string", "null"]
          },
          actorUserId: {
            type: ["string", "null"],
            format: "uuid"
          },
          actorApiKeyId: {
            type: ["string", "null"],
            format: "uuid"
          },
          metadata: {
            type: "object",
            additionalProperties: true,
            description:
              "Safe lifecycle metadata. It must not include raw XML, full invoice bodies, secrets, or API keys."
          },
          createdAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      ProductionInvoiceLifecycleEventsResponse: {
        type: "object",
        required: ["records"],
        properties: {
          records: {
            type: "array",
            items: ref("ProductionInvoiceLifecycleEvent")
          }
        }
      },
      ProductionInvoiceErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: {
                type: "string"
              },
              message: {
                type: "string"
              },
              details: {}
            }
          },
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          calculationSummary: {
            oneOf: [ref("ProductionInvoiceCalculationSummary"), { type: "null" }]
          },
          validationSummary: {
            oneOf: [ref("ProductionInvoiceValidationSummary"), { type: "null" }]
          }
        }
      },
      InvoiceValidationRequest: {
        oneOf: [
          ref("CanonicalInvoice"),
          {
            type: "object",
            additionalProperties: false,
            properties: {
              invoice: ref("CanonicalInvoice"),
              payload: ref("CanonicalInvoice"),
              viesMode: {
                type: "string",
                enum: ["skip", "use_cached", "live"],
                default: "skip",
                description:
                  "Optional VIES evidence behavior. Live checks are explicit and still require VIES_CHECK_ENABLED server-side."
              },
              xmlFindings: {
                type: "array",
                description:
                  "Optional sanitized XML/XSD/Schematron findings to map into the unified validation summary.",
                items: ref("XmlValidationJobFinding")
              }
            },
            description:
              "Wrapped validation request. Provide exactly one of invoice or payload. Direct canonical invoice payloads are also accepted for backwards compatibility."
          }
        ]
      },
      ValidationDimensionCounts: {
        type: "object",
        additionalProperties: {
          type: "integer",
          minimum: 0
        }
      },
      ValidationEngineSummary: {
        type: "object",
        required: [
          "totalFindings",
          "bySeverity",
          "byCategory",
          "byLayer",
          "byCheckType",
          "byLegalConfidence",
          "ruleVersions",
          "sourceLabels",
          "disclaimer"
        ],
        properties: {
          totalFindings: {
            type: "integer",
            minimum: 0
          },
          bySeverity: ref("ValidationDimensionCounts"),
          byCategory: ref("ValidationDimensionCounts"),
          byLayer: ref("ValidationDimensionCounts"),
          byCheckType: ref("ValidationDimensionCounts"),
          byLegalConfidence: ref("ValidationDimensionCounts"),
          ruleVersions: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      InvoiceValidationResponse: {
        type: "object",
        required: [
          "validationRunId",
          "invoiceNumber",
          "technicalStatus",
          "standardStatus",
          "countrySimulationStatus",
          "vidaReadinessStatus",
          "totals",
          "findings",
          "validationSummary",
          "viesMode",
          "viesChecks",
          "disclaimer"
        ],
        properties: {
          validationRunId: {
            type: "string"
          },
          invoiceNumber: {
            type: "string"
          },
          technicalStatus: {
            type: "string",
            enum: ["passed", "failed"]
          },
          standardStatus: {
            type: "string",
            enum: ["ready", "warning"]
          },
          countrySimulationStatus: {
            type: "string",
            enum: ["not_relevant", "review_required"]
          },
          vidaReadinessStatus: {
            type: "string",
            enum: ["not_relevant", "relevant_simulation"]
          },
          totals: ref("InvoiceTotals"),
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          validationSummary: ref("ValidationEngineSummary"),
          viesMode: {
            type: "string",
            enum: ["skip", "use_cached", "live"]
          },
          viesChecks: {
            type: "array",
            items: ref("ViesCheckSummary")
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      UblExportRequest: {
        oneOf: [
          ref("CanonicalInvoice"),
          {
            type: "object",
            properties: {
              invoice: ref("CanonicalInvoice"),
              payload: ref("CanonicalInvoice"),
              validationRunId: {
                type: "string"
              }
            }
          }
        ]
      },
      UblExportMetadata: {
        type: "object",
        properties: {
          contentType: {
            type: "string",
            example: "application/xml; charset=utf-8"
          },
          suggestedFilename: {
            type: "string",
            example: "invoice-lantern-ubl-INV-API-DOCS-001.xml"
          },
          readinessLabel: {
            type: "string",
            example: "technical UBL 2.1 export"
          },
          exportId: {
            type: "string"
          },
          productionInvoiceId: {
            type: "string",
            format: "uuid"
          },
          invoiceNumber: {
            type: "string"
          },
          invoiceType: {
            type: "string",
            enum: ["invoice", "credit_note"]
          },
          filename: {
            type: "string"
          },
          xmlSha256: {
            type: "string"
          },
          xmlSizeBytes: {
            type: "integer"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          status: {
            type: "string",
            example: "generated"
          },
          profile: {
            type: "string"
          }
        }
      },
      UblExportResponse: {
        type: "object",
        required: [
          "xml",
          "metadata",
          "readinessStatus",
          "totals",
          "findings",
          "disclaimer"
        ],
        properties: {
          xml: {
            type: "string",
            description: "Generated UBL XML. Request logs do not store this payload."
          },
          metadata: ref("UblExportMetadata"),
          exportId: {
            type: "string"
          },
          productionInvoiceId: {
            type: "string",
            format: "uuid"
          },
          filename: {
            type: "string"
          },
          contentType: {
            type: "string"
          },
          xmlSha256: {
            type: "string"
          },
          xmlSizeBytes: {
            type: "integer"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          status: {
            type: "string"
          },
          profile: {
            type: "string"
          },
          readinessStatus: {
            type: "string",
            enum: ["generated", "generated_with_warnings", "blocked"]
          },
          totals: ref("InvoiceTotals"),
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      UblParseJsonRequest: {
        type: "object",
        required: ["xml"],
        additionalProperties: false,
        properties: {
          xml: {
            type: "string",
            minLength: 1,
            description: "UBL XML string. Request logs do not store this payload."
          }
        }
      },
      UblParseResponse: {
        type: "object",
        required: ["parsed", "detected", "findings", "totals", "disclaimer"],
        properties: {
          parsed: {
            type: "boolean"
          },
          canonicalInvoice: {
            oneOf: [ref("CanonicalInvoice"), { type: "null" }]
          },
          detected: {
            type: "object",
            additionalProperties: true
          },
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          totals: {
            oneOf: [ref("InvoiceTotals"), { type: "null" }]
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      XmlValidationJobCreateRequest: {
        type: "object",
        required: ["xml"],
        additionalProperties: false,
        properties: {
          xml: {
            type: "string",
            minLength: 1,
            description:
              "XML string used to create a validation job. The raw XML is not stored in xml_validation_jobs or API request logs."
          },
          filename: {
            type: "string",
            maxLength: 180
          },
          sourceType: {
            type: "string",
            enum: ["uploaded_xml", "pasted_xml", "generated_ubl", "api_payload"],
            default: "uploaded_xml"
          },
          requestedChecks: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "worker_readiness",
                "xsd_ubl",
                "schematron_peppol_placeholder",
                "schematron_peppol",
                "schematron_en16931"
              ]
            },
            default: ["worker_readiness"]
          },
          xmlReadinessReportId: {
            type: ["string", "null"],
            format: "uuid"
          },
          invoiceDraftId: {
            type: ["string", "null"],
            format: "uuid"
          },
          validationRunId: {
            type: ["string", "null"],
            format: "uuid"
          }
        }
      },
      XmlValidationJobSchemaArtifact: {
        type: "object",
        required: ["configured", "readable", "usable", "path", "sha256", "status"],
        properties: {
          configured: {
            type: "boolean",
            description:
              "True when a local schema path is configured for this artefact slot."
          },
          readable: {
            type: "boolean"
          },
          usable: {
            type: "boolean",
            description:
              "True only when the configured schema path is readable and within the configured root when a root is set."
          },
          path: {
            type: ["string", "null"],
            description:
              "Server-side local schema path, returned for auditability. This is never XML payload content."
          },
          sha256: {
            type: ["string", "null"],
            description: "SHA-256 hash of the readable schema file when available."
          },
          status: {
            type: "string",
            enum: [
              "available",
              "missing",
              "unreadable",
              "out_of_root",
              "not_configured"
            ]
          },
          reason: {
            type: "string"
          }
        }
      },
      XmlValidationJobDependencyGraph: {
        type: "object",
        required: [
          "inspected",
          "dependencyCount",
          "status",
          "schemaResolutionRoot"
        ],
        properties: {
          inspected: {
            type: "boolean"
          },
          dependencyCount: {
            type: "integer",
            minimum: 0
          },
          status: {
            type: "string",
            enum: [
              "not_inspected",
              "ready",
              "missing_dependency",
              "unreadable_dependency",
              "external_reference_blocked",
              "error"
            ]
          },
          schemaResolutionRoot: {
            type: ["string", "null"]
          },
          reason: {
            type: "string"
          }
        }
      },
      XmlValidationJobSchematronArtifactProvenance: {
        type: "object",
        description:
          "Metadata-only schematron_artifact_source_register_v1 provenance for a local Schematron artifact slot. This source register layer records safe source labels, public HTTPS documentation links, configured environment variable names, review status, local hash metadata when already inspected, and safety flags. It does not enable public API or worker Schematron execution, does not fetch remote resources, does not expose Schematron file contents, does not expose full absolute local filesystem paths, and does not certify Peppol, EN 16931, legal, tax, accounting, filing, or authority outcomes.",
        required: [
          "registerVersion",
          "layer",
          "artifactSlotId",
          "displayName",
          "sourceLabels",
          "sourceUrls",
          "documentationUrls",
          "configuredEnvVars",
          "artifactVersion",
          "defaultArtifactVersionLabel",
          "expectedHashAlgorithm",
          "expectedSha256",
          "reviewStatus",
          "legalConfidence",
          "configured",
          "readable",
          "usable",
          "sha256",
          "safeLabel",
          "basename",
          "relativePathUnderRoot",
          "safety",
          "disclaimer"
        ],
        properties: {
          registerVersion: {
            type: "string",
            const: "schematron_artifact_source_register_v1"
          },
          layer: {
            type: "string",
            enum: ["peppol_bis_billing", "en16931_tc434"]
          },
          artifactSlotId: {
            type: "string",
            enum: [
              "schematron_slot_peppol_bis_billing_v1",
              "schematron_slot_en16931_tc434_v1"
            ]
          },
          displayName: {
            type: "string"
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceUrls: {
            type: "array",
            description:
              "Public HTTPS source metadata links only. The API does not fetch these URLs.",
            items: {
              type: "string",
              format: "uri"
            }
          },
          documentationUrls: {
            type: "array",
            description:
              "Public HTTPS documentation links only. The API does not fetch these URLs.",
            items: {
              type: "string",
              format: "uri"
            }
          },
          configuredEnvVars: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "PEPPOL_SCHEMATRON_ROOT_DIR",
                "PEPPOL_BIS_SCHEMATRON_PATH",
                "EN16931_SCHEMATRON_PATH",
                "SCHEMATRON_ARTIFACT_VERSION"
              ]
            }
          },
          artifactVersion: {
            type: ["string", "null"]
          },
          defaultArtifactVersionLabel: {
            type: "string"
          },
          expectedHashAlgorithm: {
            type: ["string", "null"],
            enum: ["sha256", null]
          },
          expectedSha256: {
            type: ["string", "null"]
          },
          reviewStatus: {
            type: "string",
            enum: [
              "not_configured",
              "review_pending",
              "source_metadata_recorded",
              "locally_configured",
              "hash_recorded",
              "reviewed",
              "deprecated",
              "blocked"
            ]
          },
          legalConfidence: {
            type: "string",
            enum: ["technical", "standard_based", "educational_simulation"]
          },
          configured: {
            type: "boolean"
          },
          readable: {
            type: "boolean"
          },
          usable: {
            type: "boolean"
          },
          sha256: {
            type: ["string", "null"],
            description:
              "Actual SHA-256 value only when safe local diagnostics already inspected a readable configured artifact file."
          },
          safeLabel: {
            type: ["string", "null"],
            description:
              "Safe basename or relative path label. Never a full absolute local filesystem path."
          },
          basename: {
            type: ["string", "null"]
          },
          relativePathUnderRoot: {
            type: ["string", "null"]
          },
          safety: {
            type: "object",
            required: [
              "rawXmlReturned",
              "schematronFileContentsReturned",
              "fullAbsoluteLocalPathsReturned",
              "remoteFetching",
              "certificationClaimed",
              "officialValidationClaimed",
              "complianceGuaranteeClaimed",
              "authorityAcceptanceClaimed"
            ],
            properties: {
              rawXmlReturned: {
                type: "boolean",
                const: false
              },
              schematronFileContentsReturned: {
                type: "boolean",
                const: false
              },
              fullAbsoluteLocalPathsReturned: {
                type: "boolean",
                const: false
              },
              remoteFetching: {
                type: "boolean",
                const: false
              },
              certificationClaimed: {
                type: "boolean",
                const: false
              },
              officialValidationClaimed: {
                type: "boolean",
                const: false
              },
              complianceGuaranteeClaimed: {
                type: "boolean",
                const: false
              },
              authorityAcceptanceClaimed: {
                type: "boolean",
                const: false
              }
            }
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      XmlValidationJobSchematronArtifactManifestVerification: {
        type: "object",
        description:
          "Metadata-only schematron_artifact_manifest_v1 verification for a local Schematron artifact slot. It compares a recorded expected SHA-256 value with an already-inspected safe local SHA-256 value when both exist. A hash match is not validation success and does not enable public API or worker Schematron execution.",
        required: [
          "manifestVersion",
          "sourceRegisterVersion",
          "layer",
          "artifactSlotId",
          "displayName",
          "expectedArtifactVersion",
          "actualArtifactVersion",
          "expectedSha256",
          "actualSha256",
          "hashAlgorithm",
          "hashStatus",
          "configured",
          "readable",
          "usable",
          "artifactStatus",
          "reviewStatus",
          "safeLabel",
          "basename",
          "relativePathUnderRoot",
          "sourceLabels",
          "legalConfidence",
          "safety",
          "disclaimer"
        ],
        properties: {
          manifestVersion: {
            type: "string",
            const: "schematron_artifact_manifest_v1"
          },
          sourceRegisterVersion: {
            type: "string",
            const: "schematron_artifact_source_register_v1"
          },
          layer: {
            type: "string",
            enum: ["peppol_bis_billing", "en16931_tc434"]
          },
          artifactSlotId: {
            type: "string",
            enum: [
              "schematron_slot_peppol_bis_billing_v1",
              "schematron_slot_en16931_tc434_v1"
            ]
          },
          displayName: {
            type: "string"
          },
          expectedArtifactVersion: {
            type: ["string", "null"]
          },
          actualArtifactVersion: {
            type: ["string", "null"]
          },
          expectedSha256: {
            type: ["string", "null"],
            description:
              "Reviewed expected SHA-256 when deliberately recorded for a local artifact slot."
          },
          actualSha256: {
            type: ["string", "null"],
            description:
              "Safe local SHA-256 from existing artifact diagnostics when available."
          },
          hashAlgorithm: {
            type: "string",
            const: "sha256"
          },
          hashStatus: {
            type: "string",
            enum: [
              "not_applicable",
              "expected_hash_missing",
              "actual_hash_missing",
              "matched",
              "mismatched"
            ]
          },
          configured: {
            type: "boolean"
          },
          readable: {
            type: "boolean"
          },
          usable: {
            type: "boolean"
          },
          artifactStatus: {
            type: "string",
            enum: [
              "not_configured",
              "missing",
              "unreadable",
              "out_of_root",
              "available",
              "error"
            ]
          },
          reviewStatus: {
            type: "string",
            enum: [
              "not_configured",
              "review_pending",
              "source_metadata_recorded",
              "expected_hash_missing",
              "expected_hash_recorded",
              "local_hash_matched",
              "local_hash_mismatched",
              "local_artifact_unreadable",
              "local_artifact_out_of_root",
              "local_artifact_missing",
              "reviewed",
              "deprecated",
              "blocked"
            ]
          },
          safeLabel: {
            type: ["string", "null"],
            description:
              "Safe basename or relative path label. Never a full absolute local filesystem path."
          },
          basename: {
            type: ["string", "null"]
          },
          relativePathUnderRoot: {
            type: ["string", "null"]
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          legalConfidence: {
            type: "string",
            enum: ["technical", "standard_based", "educational_simulation"]
          },
          safety: {
            type: "object",
            required: [
              "rawXmlReturned",
              "schematronFileContentsReturned",
              "fullAbsoluteLocalPathsReturned",
              "remoteFetching",
              "artifactDownloaded",
              "artifactExecuted",
              "certificationClaimed",
              "officialValidationClaimed",
              "complianceGuaranteeClaimed",
              "authorityAcceptanceClaimed"
            ],
            properties: {
              rawXmlReturned: {
                type: "boolean",
                const: false
              },
              schematronFileContentsReturned: {
                type: "boolean",
                const: false
              },
              fullAbsoluteLocalPathsReturned: {
                type: "boolean",
                const: false
              },
              remoteFetching: {
                type: "boolean",
                const: false
              },
              artifactDownloaded: {
                type: "boolean",
                const: false
              },
              artifactExecuted: {
                type: "boolean",
                const: false
              },
              certificationClaimed: {
                type: "boolean",
                const: false
              },
              officialValidationClaimed: {
                type: "boolean",
                const: false
              },
              complianceGuaranteeClaimed: {
                type: "boolean",
                const: false
              },
              authorityAcceptanceClaimed: {
                type: "boolean",
                const: false
              }
            }
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      XmlValidationJobSchematronArtifactFileDiagnostics: {
        type: "object",
        description:
          "Safe metadata-only Schematron artifact diagnostics for one configured file slot. This object can include schematron_artifact_source_register_v1 provenance metadata and schematron_artifact_manifest_v1 hash verification metadata. It never includes raw XML, Schematron file contents, or full absolute local filesystem paths.",
        required: [
          "artifactKind",
          "configured",
          "status",
          "readable",
          "usable",
          "sha256",
          "label",
          "basename"
        ],
        properties: {
          artifactKind: {
            type: "string",
            enum: ["peppol_bis_billing", "en16931_tc434"]
          },
          configured: {
            type: "boolean"
          },
          status: {
            type: "string",
            enum: [
              "available",
              "missing",
              "unreadable",
              "out_of_root",
              "not_configured"
            ]
          },
          readable: {
            type: "boolean"
          },
          usable: {
            type: "boolean"
          },
          sha256: {
            type: ["string", "null"],
            description:
              "SHA-256 hash of the readable Schematron artifact file when available."
          },
          label: {
            type: ["string", "null"],
            description:
              "Safe display label: a basename or path relative under PEPPOL_SCHEMATRON_ROOT_DIR."
          },
          basename: {
            type: ["string", "null"]
          },
          relativePathUnderRoot: {
            type: "string",
            description:
              "Safe relative path under PEPPOL_SCHEMATRON_ROOT_DIR when the configured file is inside that root."
          },
          reason: {
            type: "string"
          },
          sourceRegisterVersion: {
            type: "string",
            const: "schematron_artifact_source_register_v1"
          },
          artifactSlotId: {
            type: "string",
            enum: [
              "schematron_slot_peppol_bis_billing_v1",
              "schematron_slot_en16931_tc434_v1"
            ]
          },
          reviewStatus: {
            type: "string",
            enum: [
              "not_configured",
              "review_pending",
              "source_metadata_recorded",
              "locally_configured",
              "hash_recorded",
              "reviewed",
              "deprecated",
              "blocked"
            ]
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceUrls: {
            type: "array",
            items: {
              type: "string",
              format: "uri"
            }
          },
          documentationUrls: {
            type: "array",
            items: {
              type: "string",
              format: "uri"
            }
          },
          legalConfidence: {
            type: "string",
            enum: ["technical", "standard_based", "educational_simulation"]
          },
          provenanceDisclaimer: {
            type: "string"
          },
          artifactProvenance: {
            allOf: [ref("XmlValidationJobSchematronArtifactProvenance")]
          },
          artifactManifestVersion: {
            type: "string",
            const: "schematron_artifact_manifest_v1"
          },
          manifestVerification: {
            allOf: [
              ref("XmlValidationJobSchematronArtifactManifestVerification")
            ]
          },
          manifestHashStatus: {
            type: "string",
            enum: [
              "not_applicable",
              "expected_hash_missing",
              "actual_hash_missing",
              "matched",
              "mismatched"
            ]
          },
          expectedSha256Recorded: {
            type: "boolean"
          },
          actualSha256Recorded: {
            type: "boolean"
          },
          manifestReviewStatus: {
            type: "string"
          },
          manifestDisclaimer: {
            type: "string"
          }
        }
      },
      XmlValidationJobSchematronArtifactDiagnostics: {
        type: "object",
        description:
          "Safe Schematron artifact diagnostics for configured Peppol BIS Billing-style and EN 16931 / TC434-style local artifact slots. Diagnostics alone do not execute validation or mark XML valid; guarded execution requires explicit execute policy, xpath_engine, experimental allow, local reviewed artifacts, and safe XML. A hash match is not validation success. These diagnostics do not certify Peppol or EN 16931 status and do not provide legal, tax, accounting, filing, or authority conclusions.",
        required: [
          "diagnosticKind",
          "configured",
          "usable",
          "readyArtifactCount",
          "requiredArtifactCount",
          "allRequiredArtifactsReadable",
          "validatorName",
          "validatorAvailable",
          "validationExecutionEnabled",
          "artifactVersion",
          "checkedAt",
          "peppolBisArtifact",
          "en16931Artifact",
          "disclaimer"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "schematron_artifacts"
          },
          configured: {
            type: "boolean"
          },
          usable: {
            type: "boolean"
          },
          readyArtifactCount: {
            type: "integer",
            minimum: 0,
            maximum: 2
          },
          requiredArtifactCount: {
            type: "integer",
            const: 2
          },
          allRequiredArtifactsReadable: {
            type: "boolean"
          },
          validatorName: {
            type: "string",
            example: "schematron-placeholder"
          },
          validatorAvailable: {
            type: "boolean",
            description:
              "Artifact diagnostics availability. Real execution also requires the explicit Schematron execution policy and xpath_engine gate."
          },
          validationExecutionEnabled: {
            type: "boolean"
          },
          artifactVersion: {
            type: ["string", "null"]
          },
          checkedAt: {
            type: "string",
            format: "date-time"
          },
          peppolBisArtifact: ref(
            "XmlValidationJobSchematronArtifactFileDiagnostics"
          ),
          en16931Artifact: ref(
            "XmlValidationJobSchematronArtifactFileDiagnostics"
          ),
          sourceRegisterVersion: {
            type: "string",
            const: "schematron_artifact_source_register_v1"
          },
          sourceRegisterSummary: {
            type: "object",
            additionalProperties: true,
            description:
              "Safe summary of the source register records represented in these diagnostics. This is metadata only and does not enable execution.",
            properties: {
              registerVersion: {
                type: "string",
                const: "schematron_artifact_source_register_v1"
              },
              selectedLayers: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["peppol_bis_billing", "en16931_tc434"]
                }
              },
              configuredEnvVars: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              remoteFetchingPermitted: {
                type: "boolean",
                const: false
              },
              rawFileContentsReturned: {
                type: "boolean",
                const: false
              },
              fullAbsolutePathsReturned: {
                type: "boolean",
                const: false
              }
            }
          },
          artifactManifestVersion: {
            type: "string",
            const: "schematron_artifact_manifest_v1"
          },
          artifactManifestSummary: {
            type: "object",
            additionalProperties: true,
            description:
              "Safe summary of expected local artifact slots and expected SHA-256 recording status. This is metadata only and does not enable execution.",
            properties: {
              manifestVersion: {
                type: "string",
                const: "schematron_artifact_manifest_v1"
              },
              sourceRegisterVersion: {
                type: "string",
                const: "schematron_artifact_source_register_v1"
              },
              selectedLayers: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["peppol_bis_billing", "en16931_tc434"]
                }
              },
              configuredEnvVars: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              expectedSha256RecordedCount: {
                type: "integer"
              },
              expectedSha256MissingCount: {
                type: "integer"
              },
              remoteFetchingPermitted: {
                type: "boolean",
                const: false
              },
              rawFileContentsReturned: {
                type: "boolean",
                const: false
              },
              fullAbsolutePathsReturned: {
                type: "boolean",
                const: false
              }
            }
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      XmlValidationJobSchematronExecutionPreflight: {
        type: "object",
        description:
          "Metadata-only schematron_adapter_preflight_v1 result for the future Schematron execution adapter boundary. This preflight layer reports disabled, not_configured, artifact_unreadable, ready_for_future_execution, or unsupported status without parsing Schematron rules, evaluating XPath assertions, executing Schematron validation, certifying Peppol/EN 16931, proving compliance, returning raw XML, returning Schematron file contents, or returning full absolute local filesystem paths.",
        required: [
          "diagnosticKind",
          "adapterVersion",
          "mode",
          "status",
          "selectedLayer",
          "validationExecutionEnabled",
          "validationExecuted",
          "markedValid",
          "configured",
          "usable",
          "readyArtifactCount",
          "requiredArtifactCount",
          "reason"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "schematron_execution_preflight"
          },
          adapterVersion: {
            type: "string",
            const: "schematron_adapter_preflight_v1"
          },
          mode: {
            type: "string",
            enum: ["disabled", "preflight_only", "enabled"],
            description:
              "Step 50 XML validation jobs use preflight_only. enabled remains unsupported and does not execute validation."
          },
          status: {
            type: "string",
            enum: [
              "disabled",
              "not_configured",
              "artifact_unreadable",
              "ready_for_future_execution",
              "unsupported",
              "error"
            ]
          },
          selectedLayer: {
            type: "string",
            enum: ["peppol_bis_billing", "en16931_tc434", "unknown"]
          },
          validationExecutionEnabled: {
            type: "boolean",
            const: false
          },
          validationExecuted: {
            type: "boolean",
            const: false
          },
          markedValid: {
            type: "boolean",
            const: false
          },
          configured: {
            type: "boolean"
          },
          usable: {
            type: "boolean"
          },
          readyArtifactCount: {
            type: "integer",
            minimum: 0,
            maximum: 2
          },
          requiredArtifactCount: {
            type: "integer",
            const: 2
          },
          reason: {
            type: "string",
            enum: [
              "schematron_execution_disabled",
              "schematron_artifacts_not_configured",
              "schematron_artifacts_not_usable",
              "schematron_artifacts_ready_but_execution_not_enabled",
              "schematron_execution_engine_not_implemented"
            ]
          }
        }
      },
      XmlValidationJobSchematronEngineCandidate: {
        type: "object",
        description:
          "schematron_engine_candidate_v1 result for selected local Schematron engine readiness. Engine candidate metadata reports availability only; execution still requires explicit execute policy, xpath_engine, reviewed local artifacts, safe XML, and supported Schematron/XPath constructs. The xpath_engine candidate represents the guarded package-level schematron_xpath_engine_v1 foundation backed by fontoxpath and slimdom. This metadata does not certify Peppol/EN 16931, prove compliance, return raw XML, return Schematron file contents, or return full absolute local filesystem paths.",
        required: [
          "diagnosticKind",
          "engineCandidateVersion",
          "engineId",
          "availabilityStatus",
          "executionSupported",
          "executionEnabledByDefault",
          "capabilities",
          "packageName",
          "packageVersion",
          "detectedPackages",
          "reason"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "schematron_engine_candidate"
          },
          engineCandidateVersion: {
            type: "string",
            const: "schematron_engine_candidate_v1"
          },
          engineId: {
            type: "string",
            enum: [
              "none",
              "placeholder",
              "future_xslt2",
              "future_schxslt",
              "xpath_engine",
              "internal_test_candidate"
            ]
          },
          availabilityStatus: {
            type: "string",
            enum: [
              "not_selected",
              "placeholder_only",
              "available",
              "unavailable",
              "unsupported",
              "error"
            ],
            description:
              "Availability of the selected candidate. This status does not mean Schematron validation ran."
          },
          executionSupported: {
            type: "boolean",
            description:
              "Candidate capability metadata only. Normal XML validation jobs still keep validationExecutionEnabled false and validationExecuted false."
          },
          executionEnabledByDefault: {
            type: "boolean",
            const: false
          },
          capabilities: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "metadata_only",
                "local_execution_candidate",
                "no_remote_fetch",
                "windows_compatible",
                "esm_compatible",
                "test_only",
                "xml_dom_execution",
                "xpath_assertion_execution"
              ]
            }
          },
          packageName: {
            type: ["string", "null"],
            description:
              "Local package name only when a candidate dependency is detected. This field never contains local filesystem paths."
          },
          packageVersion: {
            type: ["string", "null"]
          },
          detectedPackages: {
            type: "array",
            description:
              "Safe candidate dependency metadata with package names and versions only. This never returns full absolute local filesystem paths.",
            items: {
              type: "object",
              required: [
                "packageName",
                "packageVersion",
                "available",
                "reason"
              ],
              properties: {
                packageName: {
                  type: "string",
                  enum: ["fontoxpath", "slimdom", "saxon-js", "schxslt"]
                },
                packageVersion: {
                  type: ["string", "null"]
                },
                available: {
                  type: "boolean"
                },
                reason: {
                  type: "string",
                  enum: [
                    "schematron_xslt2_engine_not_installed",
                    "schematron_xslt2_engine_installed_but_execution_disabled",
                    "schematron_schxslt_engine_not_installed",
                    "schematron_schxslt_engine_installed_but_execution_disabled",
                    "schematron_xpath_fontoxpath_not_installed",
                    "schematron_xpath_slimdom_not_installed",
                    "schematron_xpath_engine_candidate_available_execution_disabled_by_default"
                  ]
                }
              }
            }
          },
          reason: {
            type: "string",
            enum: [
              "schematron_engine_not_selected",
              "schematron_placeholder_engine_selected",
              "schematron_xslt2_engine_not_installed",
              "schematron_xslt2_engine_installed_but_execution_disabled",
              "schematron_schxslt_engine_not_installed",
              "schematron_schxslt_engine_installed_but_execution_disabled",
              "schematron_xpath_fontoxpath_not_installed",
              "schematron_xpath_slimdom_not_installed",
              "schematron_xpath_engine_candidate_available_execution_disabled_by_default",
              "schematron_internal_test_candidate_available"
            ]
          }
        }
      },
      XmlValidationJobSchematronExecutionPolicy: {
        type: "object",
        description:
          "schematron_policy_v1 result for guarded local Schematron execution. Blank or missing configuration stays disabled/preflight-only. Execution is permitted only for SCHEMATRON_EXECUTION_MODE=execute with SCHEMATRON_ENGINE=xpath_engine and SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION set to a true-like value. Policy permission alone is not validation success; local reviewed artifacts, safe XML, and supported Schematron/XPath are still required. This policy does not certify Peppol/EN 16931, prove compliance, return raw XML, return Schematron file contents, or return full absolute local filesystem paths.",
        required: [
          "diagnosticKind",
          "policyVersion",
          "mode",
          "engineId",
          "executionPermitted",
          "validationExecutionEnabled",
          "reason",
          "requestedMode",
          "requestedEngine",
          "allowExperimentalExecution"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "schematron_execution_policy"
          },
          policyVersion: {
            type: "string",
            const: "schematron_policy_v1"
          },
          mode: {
            type: "string",
            enum: [
              "disabled",
              "preflight_only",
              "execute",
              "blocked_requested_execution"
            ]
          },
          engineId: {
            type: "string",
            enum: [
              "none",
              "placeholder",
              "future_xslt2",
              "future_schxslt",
              "xpath_engine",
              "internal_test_candidate",
              "unknown"
            ]
          },
          executionPermitted: {
            type: "boolean"
          },
          validationExecutionEnabled: {
            type: "boolean"
          },
          reason: {
            type: "string",
            enum: [
              "schematron_execution_disabled_by_policy",
              "schematron_execution_preflight_only",
              "schematron_execution_requested_but_blocked",
              "schematron_experimental_execution_not_available",
              "schematron_execution_requires_xpath_engine",
              "schematron_execution_requires_explicit_experimental_allow",
              "schematron_execution_explicitly_permitted"
            ]
          },
          requestedMode: {
            type: ["string", "null"],
            description:
              "Sanitized requested policy mode echo. Unknown or unsafe values are classified without returning raw XML, Schematron file contents, local file URLs, or full absolute local paths."
          },
          requestedEngine: {
            type: ["string", "null"],
            description:
              "Sanitized requested engine echo. Unknown or unsafe values are classified without returning raw XML, Schematron file contents, local file URLs, or full absolute local paths."
          },
          allowExperimentalExecution: {
            type: "boolean",
            description:
              "True only when SCHEMATRON_ALLOW_EXPERIMENTAL_EXECUTION is true-like. Execution still requires execute mode, xpath_engine, reviewed local artifacts, safe XML, and supported constructs."
          }
        }
      },
      XmlValidationJobSchematronXPathEngineFoundation: {
        type: "object",
        description:
          "schematron_xpath_engine_v1 foundation for the guarded xpath_engine package candidate in @invoice-lantern/ubl. Step 8 uses this engine through the local artifact executor only when explicit policy, reviewed local artifacts, safe XML, and supported XPath gates pass. It never fetches remote resources, never loads arbitrary local files, never returns raw XML, never returns Schematron file contents, never returns full absolute local filesystem paths, and never returns remote fetch output. It is independent technical validation infrastructure only: no official validation, no Peppol certification, no EN 16931 compliance guarantee, no legal/tax/accounting compliance guarantee, and no authority acceptance.",
        required: [
          "diagnosticKind",
          "engineVersion",
          "engineId",
          "internalPackageLevelOnly",
          "normalPublicApiExecutionEnabled",
          "normalWorkerExecutionEnabled",
          "validationExecutionEnabled",
          "validationExecuted",
          "markedValid",
          "assertionInputFields",
          "supportedFindingCodes",
          "safetyMetadata",
          "disclaimer"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "schematron_xpath_engine"
          },
          engineVersion: {
            type: "string",
            const: "schematron_xpath_engine_v1"
          },
          engineId: {
            type: "string",
            const: "xpath_engine"
          },
          internalPackageLevelOnly: {
            type: "boolean",
            description:
              "False when represented through the guarded API/worker artifact executor; legacy package-only diagnostics may keep this true."
          },
          normalPublicApiExecutionEnabled: {
            type: "boolean"
          },
          normalWorkerExecutionEnabled: {
            type: "boolean"
          },
          validationExecutionEnabled: {
            type: "boolean",
            description:
              "True only when guarded local Schematron execution is explicitly enabled and the selected check is executable."
          },
          validationExecuted: {
            type: "boolean",
            description:
              "True only after guarded local Schematron execution actually evaluates supported XPath assertions."
          },
          markedValid: {
            type: "boolean"
          },
          assertionInputFields: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "ruleId",
                "businessRuleId",
                "schematronLayer",
                "contextXPath",
                "context",
                "testExpression",
                "assertionText",
                "severity",
                "diagnosticReference"
              ]
            },
            example: [
              "ruleId",
              "businessRuleId",
              "schematronLayer",
              "contextXPath",
              "testExpression",
              "assertionText",
              "severity",
              "diagnosticReference"
            ]
          },
          supportedFindingCodes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "SCHEMATRON_ASSERTION_FAILED",
                "SCHEMATRON_REPORT_WARNING",
                "PEPPOL_SCHEMATRON_RULE_FAILED",
                "EN16931_SCHEMATRON_RULE_FAILED",
                "SCHEMATRON_EXECUTION_ERROR"
              ]
            }
          },
          safetyMetadata: {
            type: "object",
            required: [
              "rawXmlReturned",
              "schematronFileContentsReturned",
              "fullAbsoluteLocalPathsReturned",
              "remoteFetching",
              "localFileLoading",
              "externalDocumentLoading",
              "extensionFunctions",
              "certificationOrAuthorityAcceptanceClaimed",
              "legalTaxAccountingComplianceClaimed",
              "normalPublicApiExecutionEnabled",
              "normalWorkerExecutionEnabled"
            ],
            properties: {
              rawXmlReturned: {
                type: "boolean",
                const: false
              },
              schematronFileContentsReturned: {
                type: "boolean",
                const: false
              },
              fullAbsoluteLocalPathsReturned: {
                type: "boolean",
                const: false
              },
              remoteFetching: {
                type: "boolean",
                const: false
              },
              localFileLoading: {
                type: "boolean",
                const: false
              },
              externalDocumentLoading: {
                type: "boolean",
                const: false
              },
              extensionFunctions: {
                type: "boolean",
                const: false
              },
              certificationOrAuthorityAcceptanceClaimed: {
                type: "boolean",
                const: false
              },
              legalTaxAccountingComplianceClaimed: {
                type: "boolean",
                const: false
              },
              normalPublicApiExecutionEnabled: {
                type: "boolean"
              },
              normalWorkerExecutionEnabled: {
                type: "boolean"
              }
            }
          },
          disclaimer: {
            type: "string",
            example:
              "schematron_xpath_engine_v1 is a guarded local technical execution foundation. It is not official validation, not Peppol certification, not an EN 16931 compliance guarantee, not legal/tax/accounting advice, and not authority acceptance."
          }
        }
      },
      XmlValidationJobSchematronResultMappingContract: {
        type: "object",
        description:
          "Schematron result mapping contract for schematron_result_mapper_v1. The mapper lives in @invoice-lantern/ubl and converts sanitized SVRL-style failed assertions and successful reports into schematron_contract_v1 findings during guarded local Schematron execution. It does not claim Peppol certification, EN 16931 certification, legal validity, compliance, or authority acceptance and does not return raw XML, Schematron file contents, file contents, or full absolute local filesystem paths.",
        required: [
          "mapperVersion",
          "diagnosticKind",
          "normalJobExecutionEnabled",
          "validationExecuted",
          "supportedMappedFindingCodes",
          "optionalSanitizedFindingFields"
        ],
        properties: {
          mapperVersion: {
            type: "string",
            const: "schematron_result_mapper_v1"
          },
          diagnosticKind: {
            type: "string",
            const: "schematron_result_mapping"
          },
          normalJobExecutionEnabled: {
            type: "boolean"
          },
          validationExecuted: {
            type: "boolean"
          },
          supportedMappedFindingCodes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "SCHEMATRON_ASSERTION_FAILED",
                "SCHEMATRON_REPORT_WARNING",
                "PEPPOL_SCHEMATRON_RULE_FAILED",
                "EN16931_SCHEMATRON_RULE_FAILED"
              ]
            }
          },
          optionalSanitizedFindingFields: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "ruleId",
                "businessRuleId",
                "schematronLayer",
                "ruleLocation",
                "testExpression",
                "assertionText",
                "diagnosticReference"
              ]
            }
          },
          safety: {
            type: "object",
            additionalProperties: true,
            example: {
              rawXmlReturned: false,
              schematronFileContentsReturned: false,
              fileContentsReturned: false,
              fullAbsoluteLocalPathsReturned: false,
              remoteFetching: false,
              certificationOrAuthorityAcceptanceClaimed: false
            }
          }
        }
      },
      XmlValidationJobPeppolBisExecutionPathFoundation: {
        type: "object",
        description:
          "Peppol BIS Billing-style execution path foundation for peppol_bis_execution_path_v1. The path lives in @invoice-lantern/ubl and can run through the guarded local artifact executor for schematron_peppol when explicit policy, xpath_engine, reviewed local artifact, safe XML, and supported Schematron/XPath gates pass. It does not claim certification, compliance, authority acceptance, legal validity, Peppol certification, or EN 16931 certification.",
        required: [
          "executionPathVersion",
          "schematronLayer",
          "normalJobExecutionEnabled",
          "normalJobValidationExecuted",
          "internalTestOnlyModes",
          "futureMappedFindingCodes",
          "safety"
        ],
        properties: {
          executionPathVersion: {
            type: "string",
            const: "peppol_bis_execution_path_v1"
          },
          schematronLayer: {
            type: "string",
            const: "peppol_bis_billing"
          },
          normalJobExecutionEnabled: {
            type: "boolean"
          },
          normalJobValidationExecuted: {
            type: "boolean"
          },
          internalTestOnlyModes: {
            type: "array",
            items: {
              type: "string",
              enum: ["disabled", "preflight_only", "execute", "internal_test_only"]
            }
          },
          packageLevelStatuses: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "disabled",
                "blocked_by_policy",
                "not_configured",
                "artifact_unreadable",
                "engine_unavailable",
                "ready_for_future_execution",
                "executed",
                "failed",
                "partial",
                "unsafe_input",
                "unsupported",
                "error"
              ]
            }
          },
          futureMappedFindingCodes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "PEPPOL_SCHEMATRON_RULE_FAILED",
                "SCHEMATRON_REPORT_WARNING"
              ]
            }
          },
          safety: {
            type: "object",
            additionalProperties: true,
            example: {
              rawXmlReturned: false,
              schematronFileContentsReturned: false,
              fileContentsReturned: false,
              fullAbsoluteLocalPathsReturned: false,
              remoteFetching: false,
              javaOrSystemDependencyRequired: false,
              certificationOrAuthorityAcceptanceClaimed: false,
              normalApiWorkerExecutionEnabled: false
            }
          }
        }
      },
      XmlValidationJobEn16931ExecutionPathFoundation: {
        type: "object",
        description:
          "EN 16931 / TC434-style execution path foundation for en16931_execution_path_v1. The path lives in @invoice-lantern/ubl and can run through the guarded local artifact executor for schematron_en16931 when explicit policy, xpath_engine, reviewed local artifact, safe XML, and supported Schematron/XPath gates pass. It does not claim certification, compliance, authority acceptance, legal validity, Peppol certification, or EN 16931 certification.",
        required: [
          "executionPathVersion",
          "schematronLayer",
          "normalJobExecutionEnabled",
          "normalJobValidationExecuted",
          "internalTestOnlyModes",
          "futureMappedFindingCodes",
          "safety"
        ],
        properties: {
          executionPathVersion: {
            type: "string",
            const: "en16931_execution_path_v1"
          },
          schematronLayer: {
            type: "string",
            const: "en16931_tc434"
          },
          normalJobExecutionEnabled: {
            type: "boolean"
          },
          normalJobValidationExecuted: {
            type: "boolean"
          },
          internalTestOnlyModes: {
            type: "array",
            items: {
              type: "string",
              enum: ["disabled", "preflight_only", "execute", "internal_test_only"]
            }
          },
          packageLevelStatuses: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "disabled",
                "blocked_by_policy",
                "not_configured",
                "artifact_unreadable",
                "engine_unavailable",
                "ready_for_future_execution",
                "executed",
                "failed",
                "partial",
                "unsafe_input",
                "unsupported",
                "error"
              ]
            }
          },
          futureMappedFindingCodes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "EN16931_SCHEMATRON_RULE_FAILED",
                "SCHEMATRON_REPORT_WARNING"
              ]
            }
          },
          safety: {
            type: "object",
            additionalProperties: true,
            example: {
              rawXmlReturned: false,
              schematronFileContentsReturned: false,
              fileContentsReturned: false,
              fullAbsoluteLocalPathsReturned: false,
              remoteFetching: false,
              javaOrSystemDependencyRequired: false,
              certificationOrAuthorityAcceptanceClaimed: false,
              normalApiWorkerExecutionEnabled: false
            }
          }
        }
      },
      XmlValidationJobSchematronExecutionOrchestratorFoundation: {
        type: "object",
        description:
          "Unified Schematron execution orchestration foundation for schematron_execution_orchestrator_v1. The orchestrator lives in @invoice-lantern/ubl and coordinates Peppol BIS Billing-style and EN 16931 / TC434-style layer summaries, aggregate statuses, safe counts, and merged schematron_contract_v1 findings. API and worker jobs can call it for guarded local execution only when explicit policy, engine, artifact, and XML safety gates pass. It does not claim certification, compliance, authority acceptance, legal validity, Peppol certification, or EN 16931 certification.",
        required: [
          "orchestratorVersion",
          "diagnosticKind",
          "layers",
          "normalJobExecutionEnabled",
          "normalJobValidationExecuted",
          "internalTestOnlyModes",
          "packageLevelStatuses",
          "futureMappedFindingCodes",
          "safety"
        ],
        properties: {
          orchestratorVersion: {
            type: "string",
            const: "schematron_execution_orchestrator_v1"
          },
          diagnosticKind: {
            type: "string",
            const: "schematron_execution_orchestrator"
          },
          layers: {
            type: "array",
            items: {
              type: "string",
              enum: ["peppol_bis_billing", "en16931_tc434"]
            }
          },
          normalJobExecutionEnabled: {
            type: "boolean"
          },
          normalJobValidationExecuted: {
            type: "boolean"
          },
          internalTestOnlyModes: {
            type: "array",
            items: {
              type: "string",
              enum: ["disabled", "preflight_only", "execute", "internal_test_only"]
            }
          },
          packageLevelStatuses: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "disabled",
                "blocked_by_policy",
                "not_configured",
                "artifact_unreadable",
                "engine_unavailable",
                "ready_for_future_execution",
                "executed",
                "failed",
                "partial",
                "unsafe_input",
                "unsupported",
                "error"
              ]
            }
          },
          layerSummaryFields: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "layer",
                "status",
                "validationExecutionEnabled",
                "validationExecuted",
                "markedValid",
                "findingCount",
                "fatalCount",
                "warningCount",
                "infoCount",
                "reason"
              ]
            }
          },
          futureMappedFindingCodes: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "PEPPOL_SCHEMATRON_RULE_FAILED",
                "EN16931_SCHEMATRON_RULE_FAILED",
                "SCHEMATRON_REPORT_WARNING"
              ]
            }
          },
          safety: {
            type: "object",
            additionalProperties: true,
            example: {
              rawXmlReturned: false,
              schematronFileContentsReturned: false,
              fileContentsReturned: false,
              fullAbsoluteLocalPathsReturned: false,
              remoteFetching: false,
              javaOrSystemDependencyRequired: false,
              certificationOrAuthorityAcceptanceClaimed: false,
              normalApiWorkerExecutionEnabled: false
            }
          }
        }
      },
      XmlValidationJobXmlWorkerSchematronOrchestration: {
        type: "object",
        description:
          "XML worker Schematron orchestration summary for xml_worker_schematron_orchestrator_v1. The worker can build disabled/preflight metadata for the deprecated placeholder alias and can run guarded local execution for schematron_peppol and schematron_en16931 only when explicit policy, engine, artifact, and XML safety gates pass. This summary never returns raw XML, Schematron file contents, full absolute local filesystem paths, remote fetch results, Java/system dependency output, certification, compliance guarantees, authority acceptance, legal validity, Peppol certification, or EN 16931 certification.",
        required: [
          "diagnosticKind",
          "workerSchematronOrchestratorVersion",
          "status",
          "mode",
          "requested",
          "validationExecutionEnabled",
          "validationExecuted",
          "markedValid",
          "findingCount",
          "fatalCount",
          "warningCount",
          "infoCount",
          "reason"
        ],
        properties: {
          diagnosticKind: {
            type: "string",
            const: "xml_worker_schematron_orchestration"
          },
          workerSchematronOrchestratorVersion: {
            type: "string",
            const: "xml_worker_schematron_orchestrator_v1"
          },
          status: {
            type: "string",
            enum: [
              "disabled",
              "not_requested",
              "not_configured",
              "artifact_unreadable",
              "engine_unavailable",
              "ready_for_future_execution",
              "executed",
              "failed",
              "partial",
              "unsafe_input",
              "unsupported",
              "error"
            ]
          },
          mode: {
            type: "string",
            enum: ["disabled", "preflight_only", "execute", "internal_test_only"]
          },
          requested: {
            type: "boolean"
          },
          validationExecutionEnabled: {
            type: "boolean",
            description:
              "True only when guarded local Schematron execution is explicitly enabled for a real Schematron check and the worker selected an executable layer."
          },
          validationExecuted: {
            type: "boolean",
            description:
              "True only after guarded local Schematron execution actually starts and selected layers are fully evaluated."
          },
          markedValid: {
            type: "boolean"
          },
          findingCount: {
            type: "integer"
          },
          fatalCount: {
            type: "integer"
          },
          warningCount: {
            type: "integer"
          },
          infoCount: {
            type: "integer"
          },
          reason: {
            type: "string",
            enum: [
              "xml_worker_schematron_not_requested",
              "xml_worker_schematron_orchestration_disabled",
              "xml_worker_schematron_internal_execution_not_allowed",
              "xml_worker_schematron_orchestration_failed",
              "schematron_execution_orchestrator_preflight_not_configured",
              "schematron_execution_orchestrator_preflight_artifact_unreadable",
              "schematron_execution_orchestrator_preflight_engine_unavailable",
              "schematron_execution_orchestrator_preflight_ready_for_future_execution",
              "schematron_execution_orchestrator_preflight_partial",
              "schematron_execution_orchestrator_preflight_unsupported",
              "schematron_execution_orchestrator_preflight_error",
              "schematron_execution_orchestrator_internal_test_executed",
              "schematron_execution_orchestrator_internal_test_failed",
              "schematron_execution_orchestrator_internal_test_partial",
              "schematron_execution_orchestrator_execute_executed",
              "schematron_execution_orchestrator_execute_failed",
              "schematron_execution_orchestrator_execute_partial",
              "schematron_execution_orchestrator_execute_not_configured",
              "schematron_execution_orchestrator_execute_artifact_unreadable",
              "schematron_execution_orchestrator_execute_engine_unavailable",
              "schematron_execution_orchestrator_execute_unsafe_input",
              "schematron_execution_orchestrator_execute_unsupported",
              "schematron_execution_orchestrator_execute_error",
              "XML_DOCTYPE_BLOCKED",
              "XML_ENTITY_BLOCKED",
              "XML_EXTERNAL_IDENTIFIER_BLOCKED",
              "XML_STYLESHEET_BLOCKED",
              "XML_BODY_TOO_LARGE"
            ]
          },
          orchestrator: {
            type: "object",
            additionalProperties: true,
            description:
              "Nested safe schematron_execution_orchestrator_v1 summary when the worker calls the package orchestrator in preflight_only or explicit internal_test_only mode. selectedLayers and layerSummaries are metadata only and are not official validation. It omits raw XML, Schematron file contents, full absolute local paths, and remote fetch output.",
            properties: {
              orchestratorVersion: {
                type: "string",
                const: "schematron_execution_orchestrator_v1"
              },
              selectedLayers: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["peppol_bis_billing", "en16931_tc434"]
                },
                description:
                  "Package orchestrator layer selection metadata only."
              },
              layerSummaries: {
                type: "array",
                description:
                  "Per-layer preflight/orchestration summaries. These are not official validation and do not certify Peppol or EN 16931 acceptance.",
                items: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    layer: {
                      type: "string",
                      enum: ["peppol_bis_billing", "en16931_tc434"]
                    },
                    status: {
                      type: "string"
                    },
                    findingCount: {
                      type: "integer"
                    },
                    fatalCount: {
                      type: "integer"
                    },
                    warningCount: {
                      type: "integer"
                    },
                    infoCount: {
                      type: "integer"
                    },
                    reason: {
                      type: "string"
                    }
                  }
                }
              }
            }
          }
        }
      },
      XmlValidationJobArtifactInfo: {
        type: "object",
        required: [
          "configured",
          "usable",
          "rootPath",
          "invoiceXsdPath",
          "creditNoteXsdPath",
          "artifactVersion",
          "validatorName",
          "validatorAvailable",
          "invoiceSchema",
          "creditNoteSchema",
          "dependencyGraph",
          "checkedAt"
        ],
        properties: {
          configured: {
            type: "boolean",
            description:
              "For xsd_ubl check results, true only when the artefact needed for the detected document type is configured, readable, and usable."
          },
          usable: {
            type: "boolean"
          },
          rootPath: {
            type: ["string", "null"],
            description:
              "Optional server-side UBL XSD root directory used to derive standard maindoc paths."
          },
          invoiceXsdPath: {
            type: ["string", "null"],
            description:
              "Optional server-side path to the local UBL Invoice XSD artefact."
          },
          creditNoteXsdPath: {
            type: ["string", "null"],
            description:
              "Optional server-side path to the local UBL CreditNote XSD artefact."
          },
          artifactVersion: {
            type: ["string", "null"],
            example: "2.1"
          },
          validatorName: {
            type: "string",
            example: "xmllint-wasm"
          },
          validatorAvailable: {
            type: "boolean"
          },
          invoiceSchema: ref("XmlValidationJobSchemaArtifact"),
          creditNoteSchema: ref("XmlValidationJobSchemaArtifact"),
          dependencyGraph: ref("XmlValidationJobDependencyGraph"),
          checkedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      XmlValidationJobFinding: {
        type: "object",
        description:
          "Structured technical sandbox finding. xsd_ubl findings are mapped from local XSD validator messages and may include sanitized technical detail, but never raw XML. schematron_peppol and schematron_en16931 findings are mapped from guarded local Schematron execution through schematron_result_mapper_v1 when explicit execute policy, xpath_engine, reviewed local artifacts, safe XML, and supported constructs all pass. schematron_peppol_placeholder remains a safe deprecated preflight alias. Optional Schematron fields are sanitized and never contain raw XML, Schematron file contents, full absolute local paths, certification, compliance or legal/tax/accounting guarantees, or authority acceptance.",
        required: [
          "code",
          "severity",
          "checkType",
          "field",
          "message",
          "status",
          "legalConfidence"
        ],
        properties: {
          code: {
            type: "string",
            example: "UBL_XSD_ELEMENT_INVALID",
            description:
              "Stable Invoice Lantern finding code, such as UBL_XSD_ELEMENT_INVALID, UBL_XSD_REQUIRED_ELEMENT_MISSING, UBL_XSD_VALUE_INVALID, UBL_XSD_NOT_CONFIGURED, UBL_XSD_VALIDATOR_ERROR, UBL_XSD_VALIDATION_PASSED, PEPPOL_SCHEMATRON_VALIDATION_NOT_ENABLED, SCHEMATRON_EXECUTION_NOT_ENABLED, SCHEMATRON_ASSERTION_FAILED, SCHEMATRON_REPORT_WARNING, PEPPOL_SCHEMATRON_RULE_FAILED, or EN16931_SCHEMATRON_RULE_FAILED."
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "fatal"]
          },
          checkType: {
            type: "string",
            enum: [
              "worker_readiness",
              "xsd_ubl",
              "schematron_peppol_placeholder",
              "schematron_peppol",
              "schematron_en16931"
            ]
          },
          field: {
            type: "string",
            example: "xml"
          },
          message: {
            type: "string",
            description:
              "User-understandable technical message. It does not claim legal, tax, accounting, Peppol, EN 16931, or authority acceptance."
          },
          status: {
            type: "string",
            enum: [
              "passed",
              "failed",
              "warning",
              "completed",
              "not_configured",
              "not_implemented",
              "unsupported",
              "unsafe_input",
              "disabled",
              "preflight_only",
              "error"
            ]
          },
          legalConfidence: {
            type: "string",
            enum: ["technical", "educational_simulation"]
          },
          fixSuggestion: {
            type: "string"
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          schematronLayer: {
            type: "string",
            enum: ["peppol_bis_billing", "en16931_tc434", "unknown"],
            description:
              "Optional sanitized Schematron layer marker for future rule-level findings."
          },
          ruleId: {
            type: "string",
            description:
              "Optional sanitized Schematron rule identifier, for example PEPPOL-EN16931-R001."
          },
          businessRuleId: {
            type: "string",
            description:
              "Optional sanitized business rule identifier, for example BR-CO-10."
          },
          ruleLocation: {
            type: "string",
            description:
              "Optional sanitized rule location metadata for future Schematron findings."
          },
          testExpression: {
            type: "string",
            description:
              "Optional sanitized Schematron test expression metadata for future findings."
          },
          assertionText: {
            type: "string",
            description:
              "Optional sanitized assertion text metadata for future findings."
          },
          diagnosticReference: {
            type: "string",
            description:
              "Optional sanitized diagnostic reference metadata for future findings."
          },
          technicalMessage: {
            type: "string",
            description:
              "Sanitized validator detail for troubleshooting. Raw XML fragments, raw XML payload values, local file URLs, and control characters are not included."
          },
          technicalCode: {
            type: "string",
            description:
              "Stable technical mapping bucket for the normalized validator message.",
            example: "element_invalid"
          },
          xmlLine: {
            type: "integer",
            minimum: 1,
            description:
              "XML line reported by the local validator when available. The XML body itself is not returned."
          }
        }
      },
      XmlValidationJob: {
        type: "object",
        required: [
          "id",
          "status",
          "sourceType",
          "xmlSha256",
          "xmlSizeBytes",
          "requestedChecks",
          "completedChecks",
          "failedChecks",
          "resultSummary",
          "findings",
          "disclaimer",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: {
            type: "string"
          },
          status: {
            type: "string",
            enum: ["queued", "running", "completed", "failed", "cancelled"]
          },
          sourceType: {
            type: "string"
          },
          documentType: {
            type: ["string", "null"],
            example: "invoice"
          },
          filename: {
            type: ["string", "null"]
          },
          xmlSha256: {
            type: "string",
            description: "SHA-256 hash of the XML body. Raw XML is not stored."
          },
          xmlSizeBytes: {
            type: "integer"
          },
          requestedChecks: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "worker_readiness",
                "xsd_ubl",
                "schematron_peppol_placeholder",
                "schematron_peppol",
                "schematron_en16931"
              ]
            }
          },
          completedChecks: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "worker_readiness",
                "xsd_ubl",
                "schematron_peppol_placeholder",
                "schematron_peppol",
                "schematron_en16931"
              ]
            }
          },
          failedChecks: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "worker_readiness",
                "xsd_ubl",
                "schematron_peppol_placeholder",
                "schematron_peppol",
                "schematron_en16931"
              ]
            }
          },
          workerName: {
            type: ["string", "null"]
          },
          workerVersion: {
            type: ["string", "null"]
          },
          startedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          completedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          failedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          errorCode: {
            type: ["string", "null"]
          },
          errorMessage: {
            type: ["string", "null"]
          },
          resultSummary: {
            type: "object",
            additionalProperties: true,
            example: {
              workerReady: true,
              checkStatuses: {
                worker_readiness: "completed",
                xsd_ubl: "not_configured",
                schematron_peppol_placeholder: "not_implemented",
                schematron_peppol: "not_configured",
                schematron_en16931: "not_configured"
              },
              xsdUbl: {
                requested: true,
                configured: false,
                validationExecuted: false,
                markedValid: false,
                status: "not_configured",
                artifactInfo: {
                  configured: false,
                  usable: false,
                  rootPath: null,
                  invoiceXsdPath: null,
                  creditNoteXsdPath: null,
                  artifactVersion: null,
                  validatorName: "xmllint-wasm",
                  validatorAvailable: true,
                  invoiceSchema: {
                    configured: false,
                    readable: false,
                    usable: false,
                    path: null,
                    sha256: null,
                    status: "not_configured"
                  },
                  creditNoteSchema: {
                    configured: false,
                    readable: false,
                    usable: false,
                    path: null,
                    sha256: null,
                    status: "not_configured"
                  },
                  dependencyGraph: {
                    inspected: false,
                    dependencyCount: 0,
                    status: "not_inspected",
                    schemaResolutionRoot: null
                  },
                  checkedAt: "2026-05-06T12:00:00.000Z"
                }
              },
              schematronPeppol: {
                requested: true,
                implemented: false,
                adapterVersion: "schematron_adapter_preflight_v1",
                executionPreflight: {
                  diagnosticKind: "schematron_execution_preflight",
                  adapterVersion: "schematron_adapter_preflight_v1",
                  mode: "preflight_only",
                  status: "not_configured",
                  selectedLayer: "peppol_bis_billing",
                  validationExecutionEnabled: false,
                  validationExecuted: false,
                  markedValid: false,
                  configured: false,
                  usable: false,
                  readyArtifactCount: 0,
                  requiredArtifactCount: 2,
                  reason: "schematron_artifacts_not_configured"
                },
                executionPolicy: {
                  diagnosticKind: "schematron_execution_policy",
                  policyVersion: "schematron_policy_v1",
                  mode: "preflight_only",
                  engineId: "placeholder",
                  executionPermitted: false,
                  validationExecutionEnabled: false,
                  reason: "schematron_execution_preflight_only",
                  requestedMode: null,
                  requestedEngine: null,
                  allowExperimentalExecution: false
                },
                engineCandidate: {
                  diagnosticKind: "schematron_engine_candidate",
                  engineCandidateVersion: "schematron_engine_candidate_v1",
                  engineId: "placeholder",
                  availabilityStatus: "placeholder_only",
                  executionSupported: false,
                  executionEnabledByDefault: false,
                  capabilities: ["metadata_only"],
                  packageName: null,
                  packageVersion: null,
                  reason: "schematron_placeholder_engine_selected"
                },
                preflightStatus: "not_configured",
                preflightReason: "schematron_artifacts_not_configured",
                policyVersion: "schematron_policy_v1",
                policyMode: "preflight_only",
                policyReason: "schematron_execution_preflight_only",
                engineId: "placeholder",
                engineCandidateVersion: "schematron_engine_candidate_v1",
                engineAvailabilityStatus: "placeholder_only",
                engineExecutionSupported: false,
                schematronOrchestration: {
                  diagnosticKind: "xml_worker_schematron_orchestration",
                  workerSchematronOrchestratorVersion:
                    "xml_worker_schematron_orchestrator_v1",
                  status: "not_configured",
                  mode: "preflight_only",
                  requested: true,
                  validationExecutionEnabled: false,
                  validationExecuted: false,
                  markedValid: false,
                  findingCount: 2,
                  fatalCount: 0,
                  warningCount: 2,
                  infoCount: 0,
                  reason:
                    "schematron_execution_orchestrator_preflight_not_configured",
                  orchestrator: {
                    diagnosticKind: "schematron_execution_orchestrator",
                    orchestratorVersion:
                      "schematron_execution_orchestrator_v1",
                    mode: "preflight_only",
                    status: "not_configured",
                    selectedLayers: ["peppol_bis_billing", "en16931_tc434"],
                    validationExecutionEnabled: false,
                    validationExecuted: false,
                    markedValid: false,
                    findingCount: 2,
                    fatalCount: 0,
                    warningCount: 2,
                    infoCount: 0,
                    layerSummaries: [],
                    reason:
                      "schematron_execution_orchestrator_preflight_not_configured"
                  }
                },
                workerSchematronOrchestratorVersion:
                  "xml_worker_schematron_orchestrator_v1",
                orchestrationMode: "preflight_only",
                orchestrationStatus: "not_configured",
                orchestrationReason:
                  "schematron_execution_orchestrator_preflight_not_configured",
                executionPermitted: false,
                validationExecutionEnabled: false,
                validationExecuted: false,
                markedValid: false,
                findingContractVersion: "schematron_contract_v1",
                supportedFutureFindingCodes: [
                  "SCHEMATRON_EXECUTION_NOT_ENABLED",
                  "SCHEMATRON_ARTIFACT_NOT_CONFIGURED",
                  "SCHEMATRON_ARTIFACT_UNREADABLE",
                  "SCHEMATRON_ASSERTION_FAILED",
                  "SCHEMATRON_REPORT_WARNING",
                  "PEPPOL_SCHEMATRON_RULE_FAILED",
                  "EN16931_SCHEMATRON_RULE_FAILED",
                  "SCHEMATRON_EXECUTION_ERROR"
                ],
                configured: false,
                usable: false,
                readyArtifactCount: 0,
                requiredArtifactCount: 2,
                artifactVersion: null,
                status: "not_implemented",
                artifactDiagnostics: {
                  diagnosticKind: "schematron_artifacts",
                  configured: false,
                  usable: false,
                  readyArtifactCount: 0,
                  requiredArtifactCount: 2,
                  allRequiredArtifactsReadable: false,
                  validatorName: "schematron-placeholder",
                  validatorAvailable: false,
                  validationExecutionEnabled: false,
                  artifactVersion: null,
                  checkedAt: "2026-05-06T12:00:00.000Z",
                  peppolBisArtifact: {
                    artifactKind: "peppol_bis_billing",
                    configured: false,
                    status: "not_configured",
                    readable: false,
                    usable: false,
                    sha256: null,
                    label: null,
                    basename: null,
                    sourceRegisterVersion:
                      "schematron_artifact_source_register_v1",
                    artifactSlotId: "schematron_slot_peppol_bis_billing_v1",
                    reviewStatus: "not_configured",
                    sourceLabels: [
                      "Peppol BIS Billing public artifact metadata",
                      "Invoice Lantern local artifact slot",
                      "technical provenance metadata"
                    ],
                    artifactManifestVersion:
                      "schematron_artifact_manifest_v1",
                    manifestHashStatus: "not_applicable",
                    expectedSha256Recorded: false,
                    actualSha256Recorded: false,
                    manifestReviewStatus: "not_configured",
                    manifestVerification: {
                      manifestVersion: "schematron_artifact_manifest_v1",
                      sourceRegisterVersion:
                        "schematron_artifact_source_register_v1",
                      layer: "peppol_bis_billing",
                      artifactSlotId:
                        "schematron_slot_peppol_bis_billing_v1",
                      displayName:
                        "Peppol BIS Billing local Schematron artifact slot",
                      expectedArtifactVersion: null,
                      actualArtifactVersion: null,
                      expectedSha256: null,
                      actualSha256: null,
                      hashAlgorithm: "sha256",
                      hashStatus: "not_applicable",
                      configured: false,
                      readable: false,
                      usable: false,
                      artifactStatus: "not_configured",
                      reviewStatus: "not_configured",
                      safeLabel: null,
                      basename: null,
                      relativePathUnderRoot: null,
                      sourceLabels: [
                        "Peppol BIS Billing public artifact metadata",
                        "Invoice Lantern local artifact slot",
                        "technical provenance metadata"
                      ],
                      legalConfidence: "technical",
                      safety: {
                        rawXmlReturned: false,
                        schematronFileContentsReturned: false,
                        fullAbsoluteLocalPathsReturned: false,
                        remoteFetching: false,
                        artifactDownloaded: false,
                        artifactExecuted: false,
                        certificationClaimed: false,
                        officialValidationClaimed: false,
                        complianceGuaranteeClaimed: false,
                        authorityAcceptanceClaimed: false
                      },
                      disclaimer:
                        "Hash verification metadata only; hash match is not validation success."
                    }
                  },
                  en16931Artifact: {
                    artifactKind: "en16931_tc434",
                    configured: false,
                    status: "not_configured",
                    readable: false,
                    usable: false,
                    sha256: null,
                    label: null,
                    basename: null,
                    sourceRegisterVersion:
                      "schematron_artifact_source_register_v1",
                    artifactSlotId: "schematron_slot_en16931_tc434_v1",
                    reviewStatus: "not_configured",
                    sourceLabels: [
                      "EN 16931 / TC434 public artifact metadata",
                      "Invoice Lantern local artifact slot",
                      "technical provenance metadata"
                    ],
                    artifactManifestVersion:
                      "schematron_artifact_manifest_v1",
                    manifestHashStatus: "not_applicable",
                    expectedSha256Recorded: false,
                    actualSha256Recorded: false,
                    manifestReviewStatus: "not_configured",
                    manifestVerification: {
                      manifestVersion: "schematron_artifact_manifest_v1",
                      sourceRegisterVersion:
                        "schematron_artifact_source_register_v1",
                      layer: "en16931_tc434",
                      artifactSlotId: "schematron_slot_en16931_tc434_v1",
                      displayName:
                        "EN 16931 / TC434 local Schematron artifact slot",
                      expectedArtifactVersion: null,
                      actualArtifactVersion: null,
                      expectedSha256: null,
                      actualSha256: null,
                      hashAlgorithm: "sha256",
                      hashStatus: "not_applicable",
                      configured: false,
                      readable: false,
                      usable: false,
                      artifactStatus: "not_configured",
                      reviewStatus: "not_configured",
                      safeLabel: null,
                      basename: null,
                      relativePathUnderRoot: null,
                      sourceLabels: [
                        "EN 16931 / TC434 public artifact metadata",
                        "Invoice Lantern local artifact slot",
                        "technical provenance metadata"
                      ],
                      legalConfidence: "technical",
                      safety: {
                        rawXmlReturned: false,
                        schematronFileContentsReturned: false,
                        fullAbsoluteLocalPathsReturned: false,
                        remoteFetching: false,
                        artifactDownloaded: false,
                        artifactExecuted: false,
                        certificationClaimed: false,
                        officialValidationClaimed: false,
                        complianceGuaranteeClaimed: false,
                        authorityAcceptanceClaimed: false
                      },
                      disclaimer:
                        "Hash verification metadata only; hash match is not validation success."
                    }
                  },
                  sourceRegisterVersion:
                    "schematron_artifact_source_register_v1",
                  artifactManifestVersion:
                    "schematron_artifact_manifest_v1",
                  artifactManifestSummary: {
                    manifestVersion: "schematron_artifact_manifest_v1",
                    sourceRegisterVersion:
                      "schematron_artifact_source_register_v1",
                    recordCount: 2,
                    selectedLayers: [
                      "peppol_bis_billing",
                      "en16931_tc434"
                    ],
                    expectedSha256RecordedCount: 0,
                    expectedSha256MissingCount: 2,
                    remoteFetchingPermitted: false,
                    rawFileContentsReturned: false,
                    fullAbsolutePathsReturned: false
                  },
                  disclaimer:
                    "These are technical configuration diagnostics for local Schematron artefacts in Invoice Lantern. Guarded local execution requires explicit execute policy, xpath_engine, reviewed local artefacts, safe XML, and supported constructs."
                }
              }
            }
          },
          findings: {
            type: "array",
            items: ref("XmlValidationJobFinding")
          },
          disclaimer: {
            type: "string",
            example:
              "This XML validation job is a technical sandbox worker-readiness and configured-check result. It does not certify legal, tax, accounting, Peppol, EN 16931, or authority acceptance."
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          },
          xmlReadinessReportId: {
            type: ["string", "null"],
            format: "uuid"
          },
          invoiceDraftId: {
            type: ["string", "null"],
            format: "uuid"
          },
          validationRunId: {
            type: ["string", "null"],
            format: "uuid"
          }
        }
      },
      XmlValidationJobResponse: {
        type: "object",
        required: ["job"],
        properties: {
          job: ref("XmlValidationJob")
        }
      },
      XmlValidationJobListResponse: {
        type: "object",
        required: ["jobs"],
        properties: {
          jobs: {
            type: "array",
            items: ref("XmlValidationJob")
          }
        }
      },
      VatFormatRequest: {
        type: "object",
        required: ["vatId"],
        properties: {
          vatId: {
            type: "string",
            maxLength: 64,
            example: "HU12345678"
          },
          countryHint: {
            type: "string",
            maxLength: 8,
            example: "HU"
          },
          persist: {
            type: "boolean",
            description:
              "Signed-in workspace users may persist evidence records. Organization API-key requests cannot persist records in this step."
          },
          invoiceDraftId: {
            type: "string"
          },
          validationRunId: {
            type: "string"
          },
          partyRole: {
            type: "string",
            enum: ["seller", "buyer", "other"]
          }
        }
      },
      VatFormatCheckResult: {
        type: "object",
        required: [
          "input",
          "normalized",
          "formatValid",
          "checkLevel",
          "source",
          "message",
          "warnings",
          "disclaimer"
        ],
        properties: {
          input: {
            type: "string"
          },
          normalized: {
            type: "string"
          },
          countryCode: {
            type: "string"
          },
          countryName: {
            type: "string"
          },
          formatValid: {
            type: "boolean"
          },
          checkLevel: {
            type: "string",
            const: "local_format"
          },
          source: {
            type: "string",
            const: "invoice_lantern_vat_format_rules"
          },
          message: {
            type: "string"
          },
          warnings: {
            type: "array",
            items: {
              type: "string"
            }
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      VatFormatResponse: {
        type: "object",
        required: [
          "input",
          "normalized",
          "formatValid",
          "checkLevel",
          "source",
          "message",
          "warnings",
          "disclaimer",
          "persisted"
        ],
        properties: {
          input: {
            type: "string"
          },
          normalized: {
            type: "string"
          },
          countryCode: {
            type: "string"
          },
          countryName: {
            type: "string"
          },
          formatValid: {
            type: "boolean"
          },
          checkLevel: {
            type: "string",
            const: "local_format"
          },
          source: {
            type: "string",
            const: "invoice_lantern_vat_format_rules"
          },
          message: {
            type: "string"
          },
          warnings: {
            type: "array",
            items: {
              type: "string"
            }
          },
          disclaimer: {
            type: "string"
          },
          persisted: {
            type: "boolean"
          },
          checkRecordId: {
            type: "string"
          }
        }
      },
      ViesCheckRequest: {
        type: "object",
        additionalProperties: false,
        required: ["countryCode", "vatNumber"],
        properties: {
          countryCode: {
            type: "string",
            minLength: 2,
            maxLength: 8,
            example: "DE"
          },
          vatNumber: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            example: "DE123456789"
          },
          invoiceDraftId: {
            type: "string",
            maxLength: 120
          },
          validationRunId: {
            type: "string",
            maxLength: 120
          },
          partyRole: {
            type: "string",
            enum: ["seller", "buyer", "other"]
          }
        }
      },
      ViesStatus: {
        type: "string",
        enum: [
          "valid",
          "invalid",
          "unavailable",
          "error",
          "not_checked",
          "unsupported",
          "rate_limited"
        ]
      },
      ViesEvidence: {
        type: "object",
        properties: {
          id: {
            type: "string"
          },
          organizationId: {
            type: "string"
          },
          invoiceDraftId: {
            type: ["string", "null"]
          },
          validationRunId: {
            type: ["string", "null"]
          },
          partyRole: {
            type: ["string", "null"],
            enum: ["seller", "buyer", "other", null]
          },
          countryCode: {
            type: "string"
          },
          vatNumberNormalized: {
            type: "string"
          },
          vatNumberDisplay: {
            type: "string"
          },
          requestSource: {
            type: "string",
            enum: ["local_format", "vies"]
          },
          status: ref("ViesStatus"),
          viesValid: {
            type: ["boolean", "null"]
          },
          viesName: {
            type: ["string", "null"]
          },
          viesAddress: {
            type: ["string", "null"]
          },
          requestIdentifier: {
            type: ["string", "null"]
          },
          checkedAt: {
            type: "string",
            format: "date-time"
          },
          sourceLabel: {
            type: "string"
          },
          sourceUrl: {
            type: "string",
            format: "uri"
          },
          responseTimeMs: {
            type: ["integer", "null"]
          },
          errorCode: {
            type: ["string", "null"]
          },
          errorMessageSafe: {
            type: ["string", "null"]
          },
          rawResponseHash: {
            type: ["string", "null"],
            description:
              "SHA-256 hash of the raw VIES response body when available. The raw body is not returned."
          },
          metadata: {
            type: "object",
            additionalProperties: true
          },
          createdAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      ViesCheckSummary: {
        type: "object",
        required: ["status", "viesValid", "checkedAt", "source", "evidence"],
        properties: {
          status: ref("ViesStatus"),
          viesValid: {
            type: ["boolean", "null"]
          },
          checkedAt: {
            type: "string",
            format: "date-time"
          },
          source: {
            type: "object",
            required: ["label", "url"],
            properties: {
              label: {
                type: "string",
                example: "VAT Information Exchange System (VIES)"
              },
              url: {
                type: "string",
                format: "uri"
              }
            }
          },
          evidence: {
            oneOf: [ref("ViesEvidence"), { type: "null" }]
          }
        }
      },
      ViesCheckResponse: {
        type: "object",
        required: [
          "formatCheck",
          "viesCheck",
          "evidence",
          "status",
          "checkedAt",
          "source",
          "disclaimer",
          "findings"
        ],
        properties: {
          formatCheck: ref("VatFormatCheckResult"),
          viesCheck: ref("ViesCheckSummary"),
          evidence: {
            oneOf: [ref("ViesEvidence"), { type: "null" }]
          },
          status: ref("ViesStatus"),
          checkedAt: {
            type: "string",
            format: "date-time"
          },
          source: {
            type: "object",
            required: ["label", "url"],
            properties: {
              label: {
                type: "string"
              },
              url: {
                type: "string",
                format: "uri"
              }
            }
          },
          disclaimer: {
            type: "string",
            description:
              "VIES evidence is time-of-check evidence only. Format valid is not VIES valid, unavailable is not invalid, and VIES valid is not full transaction treatment."
          },
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          }
        }
      },
      VidaSimulationRequest: {
        type: "object",
        required: ["sellerCountry", "buyerCountry"],
        additionalProperties: false,
        properties: {
          sellerCountry: {
            type: "string",
            minLength: 1,
            maxLength: 8,
            example: "DE",
            description:
              "Seller country as a two-letter country code. Greece is represented as GR for user-facing country context; EL is accepted as a VAT-prefix compatibility alias."
          },
          buyerCountry: {
            type: "string",
            minLength: 1,
            maxLength: 8,
            example: "HU",
            description: "Buyer country as a two-letter country code."
          },
          sellerVatId: {
            type: "string",
            maxLength: 64,
            example: "DE123456789",
            description:
              "Optional seller VAT ID context. This endpoint does not validate VIES status or prove VAT registration."
          },
          buyerVatId: {
            type: "string",
            maxLength: 64,
            example: "HU12345678",
            description:
              "Optional buyer VAT ID context. This endpoint does not validate VIES status or prove VAT registration."
          },
          buyerType: {
            type: "string",
            enum: ["business", "consumer", "public_authority", "unknown"],
            default: "unknown"
          },
          sellerType: {
            type: "string",
            enum: ["business", "public_authority", "unknown"],
            default: "business"
          },
          transactionType: {
            type: "string",
            enum: ["goods", "services", "digital_service", "mixed", "unknown"],
            default: "unknown"
          },
          supplyScenario: {
            type: "string",
            enum: ["domestic", "intra_eu", "non_eu", "unknown"],
            default: "unknown"
          },
          invoiceDate: {
            type: "string",
            maxLength: 32,
            example: "2026-05-01"
          },
          issueDate: {
            type: "string",
            maxLength: 32,
            example: "2026-05-01"
          },
          currency: {
            type: "string",
            maxLength: 8,
            example: "EUR"
          },
          amount: {
            type: "string",
            maxLength: 80,
            example: "100.00"
          },
          invoiceProfile: {
            type: "string",
            enum: ["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK"]
          },
          structuredInvoiceSignals: ref("VidaStructuredInvoiceSignals"),
          vatEvidence: ref("VidaVatEvidenceInput"),
          countryPackContext: ref("VidaCountryPackContextInput"),
          countryPackVersions: {
            type: "object",
            additionalProperties: {
              type: "string"
            },
            example: {
              DE: "2026.05.1",
              HU: "2026.05.1"
            },
            description:
              "Optional country-pack version context retained in normalized simulation input."
          },
          persist: {
            type: "boolean",
            default: false,
            description:
              "When true in a signed-in workspace flow, stores a workspace-owned ViDA simulation audit record. Organization API-key requests can run the simulation but cannot persist workspace records."
          },
          invoiceDraftId: {
            type: "string",
            maxLength: 120,
            description:
              "Optional workspace invoice draft association. The API verifies workspace ownership before storing the association."
          },
          validationRunId: {
            type: "string",
            maxLength: 120,
            description:
              "Optional workspace validation run association. The API verifies workspace ownership before storing the association."
          },
          sourceRefs: {
            type: "array",
            maxItems: 50,
            items: {
              type: "string",
              maxLength: 160
            },
            description:
              "Optional caller-provided source reference ids carried as evidence context only."
          },
          sourceLabels: {
            type: "array",
            maxItems: 50,
            items: {
              type: "string",
              maxLength: 240
            },
            description:
              "Optional caller-provided source labels carried as evidence context only."
          }
        }
      },
      VidaStructuredInvoiceSignals: {
        type: "object",
        additionalProperties: false,
        properties: {
          hasCanonicalInvoice: {
            type: "boolean",
            description:
              "True when the scenario is backed by Invoice Lantern canonical invoice data."
          },
          hasUblXml: {
            type: "boolean"
          },
          hasCiiXml: {
            type: "boolean"
          },
          xsdStatus: {
            type: "string",
            enum: [
              "passed",
              "failed",
              "warning",
              "not_configured",
              "not_checked",
              "unavailable",
              "unknown"
            ],
            description:
              "Technical XML XSD evidence status. Passed is technical only; not_configured is not success."
          },
          schematronPeppolStatus: {
            type: "string",
            enum: [
              "passed",
              "failed",
              "warning",
              "not_configured",
              "not_checked",
              "unavailable",
              "unknown"
            ],
            description:
              "Peppol-style Schematron evidence status. This is not Peppol certification."
          },
          schematronEn16931Status: {
            type: "string",
            enum: [
              "passed",
              "failed",
              "warning",
              "not_configured",
              "not_checked",
              "unavailable",
              "unknown"
            ],
            description:
              "EN 16931-style Schematron evidence status. This is not EN 16931 certification."
          },
          validationSummary: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: {
                type: "string"
              },
              totalFindings: {
                type: "integer",
                minimum: 0
              },
              blockedCount: {
                type: "integer",
                minimum: 0
              },
              fatalCount: {
                type: "integer",
                minimum: 0
              },
              warningCount: {
                type: "integer",
                minimum: 0
              },
              infoCount: {
                type: "integer",
                minimum: 0
              }
            }
          }
        }
      },
      VidaVatEvidenceInput: {
        type: "object",
        additionalProperties: false,
        properties: {
          sellerFormatStatus: {
            type: "string",
            enum: ["valid", "invalid", "not_checked", "unknown"]
          },
          buyerFormatStatus: {
            type: "string",
            enum: ["valid", "invalid", "not_checked", "unknown"]
          },
          sellerViesStatus: {
            type: "string",
            enum: ["valid", "invalid", "unavailable", "not_checked", "unknown"],
            description:
              "Caller-supplied or cached VIES evidence status. VIES valid is evidence only; unavailable is not invalid."
          },
          buyerViesStatus: {
            type: "string",
            enum: ["valid", "invalid", "unavailable", "not_checked", "unknown"],
            description:
              "Caller-supplied or cached VIES evidence status. This endpoint does not call live VIES by default."
          },
          checkedAt: {
            type: "string",
            maxLength: 80
          },
          sourceLabel: {
            type: "string",
            maxLength: 160
          }
        }
      },
      VidaCountryPackContextInput: {
        type: "object",
        additionalProperties: false,
        properties: {
          sellerCountryPackVersion: {
            type: "string",
            maxLength: 80
          },
          buyerCountryPackVersion: {
            type: "string",
            maxLength: 80
          },
          sellerCountryPackStatus: {
            type: "string",
            enum: [
              "eu_core_only",
              "draft",
              "beta",
              "reviewed",
              "professional_review_required",
              "deprecated",
              "suspended",
              "unknown"
            ]
          },
          buyerCountryPackStatus: {
            type: "string",
            enum: [
              "eu_core_only",
              "draft",
              "beta",
              "reviewed",
              "professional_review_required",
              "deprecated",
              "suspended",
              "unknown"
            ]
          },
          sourceCoverageStatus: {
            type: "string",
            enum: [
              "reviewed",
              "beta",
              "draft",
              "not_reviewed",
              "unknown",
              "professional_review_required",
              "eu_core_only"
            ]
          }
        }
      },
      ProductionInvoiceVidaSimulationRequest: {
        type: "object",
        additionalProperties: false,
        description:
          "Optional context layered onto the production invoice canonical payload before running a persisted ViDA-readiness simulation. No lifecycle status change is made.",
        properties: {
          buyerType: {
            type: "string",
            enum: ["business", "consumer", "public_authority", "unknown"]
          },
          sellerType: {
            type: "string",
            enum: ["business", "public_authority", "unknown"]
          },
          transactionType: {
            type: "string",
            enum: ["goods", "services", "digital_service", "mixed", "unknown"]
          },
          supplyScenario: {
            type: "string",
            enum: ["domestic", "intra_eu", "non_eu", "unknown"]
          },
          structuredInvoiceSignals: ref("VidaStructuredInvoiceSignals"),
          vatEvidence: ref("VidaVatEvidenceInput"),
          countryPackContext: ref("VidaCountryPackContextInput"),
          sourceRefs: {
            type: "array",
            maxItems: 50,
            items: {
              type: "string",
              maxLength: 160
            }
          },
          sourceLabels: {
            type: "array",
            maxItems: 50,
            items: {
              type: "string",
              maxLength: 240
            }
          }
        }
      },
      VidaCountryContext: {
        type: "object",
        required: [
          "sellerInEu",
          "buyerInEu",
          "sameCountry",
          "crossBorderEu",
          "sellerCountryPackStatus",
          "buyerCountryPackStatus",
          "sellerCountryPackVersion",
          "buyerCountryPackVersion"
        ],
        properties: {
          sellerInEu: {
            type: "boolean"
          },
          buyerInEu: {
            type: "boolean"
          },
          sameCountry: {
            type: "boolean"
          },
          crossBorderEu: {
            type: "boolean"
          },
          sellerCountryPackStatus: {
            type: "string"
          },
          buyerCountryPackStatus: {
            type: "string"
          },
          sellerCountryPackVersion: {
            type: ["string", "null"]
          },
          buyerCountryPackVersion: {
            type: ["string", "null"]
          },
          sellerCountryPackSourceCoverageStatus: {
            type: "string"
          },
          buyerCountryPackSourceCoverageStatus: {
            type: "string"
          }
        }
      },
      VidaNormalizedInput: {
        type: "object",
        required: [
          "sellerCountryCode",
          "buyerCountryCode",
          "sellerVatCountryCode",
          "buyerVatCountryCode",
          "sellerVatId",
          "buyerVatId",
          "buyerType",
          "sellerType",
          "transactionType",
          "supplyScenario",
          "invoiceDate",
          "issueDate",
          "currency",
          "amount",
          "invoiceProfile",
          "structuredInvoiceSignals",
          "vatEvidence",
          "countryPackContext",
          "countryPackVersions"
        ],
        properties: {
          sellerCountryCode: {
            type: ["string", "null"],
            example: "DE"
          },
          buyerCountryCode: {
            type: ["string", "null"],
            example: "HU"
          },
          sellerVatCountryCode: {
            type: ["string", "null"],
            example: "DE"
          },
          buyerVatCountryCode: {
            type: ["string", "null"],
            example: "HU"
          },
          sellerVatId: {
            type: ["string", "null"],
            example: "DE123456789"
          },
          buyerVatId: {
            type: ["string", "null"],
            example: "HU12345678"
          },
          buyerType: {
            type: "string",
            enum: ["business", "consumer", "public_authority", "unknown"]
          },
          sellerType: {
            type: "string",
            enum: ["business", "public_authority", "unknown"]
          },
          transactionType: {
            type: "string",
            enum: ["goods", "services", "digital_service", "mixed", "unknown"]
          },
          supplyScenario: {
            type: "string",
            enum: ["domestic", "intra_eu", "non_eu", "unknown"]
          },
          invoiceDate: {
            type: ["string", "null"],
            example: "2026-05-01"
          },
          issueDate: {
            type: ["string", "null"],
            example: "2026-05-01"
          },
          currency: {
            type: ["string", "null"],
            example: "EUR"
          },
          amount: {
            type: ["string", "null"],
            example: "100.00"
          },
          invoiceProfile: {
            type: ["string", "null"],
            enum: ["EN16931", "PEPPOL_BIS_3", "COUNTRY_PACK", null]
          },
          structuredInvoiceSignals: ref("VidaStructuredInvoiceSignals"),
          vatEvidence: ref("VidaVatEvidenceInput"),
          countryPackContext: ref("VidaCountryPackContextInput"),
          countryPackVersions: {
            type: "object",
            additionalProperties: {
              type: "string"
            }
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      },
      VidaReadinessFinding: {
        type: "object",
        required: [
          "code",
          "severity",
          "category",
          "message",
          "fixSuggestion",
          "sourceLabels",
          "sourceRefs",
          "legalConfidence"
        ],
        properties: {
          code: {
            type: "string",
            example: "VIDA_INTRA_EU_B2B_RELEVANCE_SIGNAL"
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "review_required", "blocked"]
          },
          category: {
            type: "string",
            enum: [
              "VIDA_SIMULATION",
              "VAT_ID",
              "VIES",
              "COUNTRY_PACK",
              "STRUCTURED_INVOICE",
              "UBL",
              "XSD",
              "SCHEMATRON",
              "LEGAL_LABEL"
            ]
          },
          message: {
            type: "string"
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          fixSuggestion: {
            type: "string"
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          countryPackVersion: {
            type: "string"
          },
          countryPackStatus: {
            type: "string"
          },
          evidenceStatus: {
            type: "string"
          }
        }
      },
      VidaTimelineItem: {
        type: "object",
        required: ["date", "label", "sourceRefs", "relevance"],
        properties: {
          date: {
            type: "string",
            example: "2030-07-01"
          },
          label: {
            type: "string",
            description:
              "Timeline label for readiness context only, not a legal obligation conclusion."
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          relevance: {
            type: "string",
            enum: [
              "source_context",
              "readiness_context",
              "cross_border_b2b_readiness",
              "country_review_required"
            ]
          }
        }
      },
      VidaSourceReference: {
        type: "object",
        required: ["id", "label"],
        properties: {
          id: {
            type: "string"
          },
          label: {
            type: "string"
          },
          title: {
            type: "string"
          },
          publisher: {
            type: "string"
          },
          url: {
            type: "string",
            format: "uri"
          },
          sourceType: {
            type: "string"
          },
          reviewedAt: {
            type: "string"
          },
          notes: {
            type: "string"
          }
        }
      },
      VidaEvidenceSummary: {
        type: "object",
        required: [
          "vatFormatEvidence",
          "viesEvidence",
          "structuredInvoiceEvidence",
          "countryPackEvidence",
          "xmlValidationEvidence",
          "schematronEvidence"
        ],
        properties: {
          vatFormatEvidence: {
            type: "object",
            additionalProperties: true,
            description:
              "Local VAT-format evidence only. Format-valid is not VIES-valid."
          },
          viesEvidence: {
            type: "object",
            additionalProperties: true,
            description:
              "VIES evidence summary. VIES valid is time-of-check evidence only and VIES unavailable is not invalid."
          },
          structuredInvoiceEvidence: {
            type: "object",
            additionalProperties: true
          },
          countryPackEvidence: {
            type: "object",
            additionalProperties: true,
            description:
              "Country-pack version, status, and source coverage context. This is not national tax advice."
          },
          xmlValidationEvidence: {
            type: "object",
            additionalProperties: true,
            description:
              "Technical XML validation evidence. XSD pass is technical only."
          },
          schematronEvidence: {
            type: "object",
            additionalProperties: true,
            description:
              "Technical Schematron evidence. Pass/not-configured states are not certification."
          }
        }
      },
      VidaSimulationResponse: {
        type: "object",
        required: [
          "simulationVersion",
          "transactionClass",
          "vidaRelevance",
          "readinessScore",
          "readinessStatus",
          "reason",
          "effectiveDateContext",
          "timeline",
          "confidence",
          "legalConfidence",
          "countryContext",
          "normalizedInput",
          "evidenceSummary",
          "findings",
          "recommendedNextActions",
          "sourceReferences",
          "disclaimer"
        ],
        properties: {
          simulationVersion: {
            type: "string",
            example: "2026.05.2"
          },
          transactionClass: {
            type: "string",
            enum: [
              "intra_eu_b2b_goods",
              "intra_eu_b2b_service",
              "intra_eu_b2b_digital_service",
              "intra_eu_b2b_mixed",
              "intra_eu_b2b_unknown",
              "intra_eu_b2c",
              "intra_eu_public_authority",
              "domestic_eu_business",
              "domestic_eu_consumer",
              "domestic_eu_unknown",
              "non_eu_or_unsupported",
              "insufficient_data"
            ]
          },
          vidaRelevance: {
            type: "string",
            enum: ["high", "medium", "low", "not_relevant", "review_required"]
          },
          readinessScore: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: 100,
            description:
              "Explainable technical readiness score. Null means the simulator lacks minimum country data; it is not a legal or tax score."
          },
          readinessStatus: {
            type: "string",
            enum: [
              "ready_for_technical_review",
              "needs_more_invoice_data",
              "needs_vat_evidence",
              "needs_country_review",
              "not_relevant",
              "professional_review_required"
            ]
          },
          reason: {
            type: "string"
          },
          effectiveDateContext: {
            type: "string",
            description:
              "ViDA rollout context for readiness planning only. This field is simulation context and does not decide legal obligations."
          },
          timeline: {
            type: "array",
            items: ref("VidaTimelineItem")
          },
          confidence: {
            type: "string",
            enum: [
              "educational_simulation",
              "professional_review_required"
            ]
          },
          legalConfidence: {
            type: "string",
            enum: ["educational_simulation", "professional_review_required"]
          },
          countryContext: ref("VidaCountryContext"),
          normalizedInput: ref("VidaNormalizedInput"),
          evidenceSummary: ref("VidaEvidenceSummary"),
          findings: {
            type: "array",
            items: ref("VidaReadinessFinding")
          },
          recommendedNextActions: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceReferences: {
            type: "array",
            items: ref("VidaSourceReference")
          },
          disclaimer: {
            type: "string",
            example:
              "Invoice Lantern ViDA-readiness simulation is an educational and technical sandbox result only. It is not official software, not an official ViDA determination, not legal advice, not tax advice, not accounting advice, not authority submission, not filing software, and not a compliance guarantee."
          },
          persisted: {
            type: "boolean",
            description:
              "True when the simulation result was saved as a workspace-owned simulation run."
          },
          simulationRunId: {
            type: ["string", "null"],
            description:
              "Saved ViDA simulation run identifier when persistence succeeded."
          },
          simulationRun: {
            oneOf: [ref("VidaSimulationRunSummary"), { type: "null" }],
            description:
              "Saved simulation run summary when persistence succeeded."
          }
        }
      },
      VidaSimulationRunSummary: {
        type: "object",
        required: [
          "id",
          "organizationId",
          "createdBy",
          "apiKeyId",
          "invoiceDraftId",
          "validationRunId",
          "source",
          "status",
          "simulationVersion",
          "sellerCountryCode",
          "buyerCountryCode",
          "buyerType",
          "transactionType",
          "transactionClass",
          "vidaRelevance",
          "readinessScore",
          "readinessStatus",
          "legalConfidence",
          "invoiceDate",
          "currencyCode",
          "amountText",
          "countryPackVersions",
          "countryContext",
          "normalizedInput",
          "evidenceSummary",
          "timeline",
          "sourceReferences",
          "findingCount",
          "infoCount",
          "warningCount",
          "reviewRequiredCount",
          "reason",
          "effectiveDateContext",
          "disclaimer",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: {
            type: "string",
            example: "vida_sim_00000000-0000-4000-8000-000000000000"
          },
          organizationId: {
            type: "string"
          },
          createdBy: {
            type: ["string", "null"]
          },
          apiKeyId: {
            type: ["string", "null"]
          },
          invoiceDraftId: {
            type: ["string", "null"]
          },
          validationRunId: {
            type: ["string", "null"]
          },
          source: {
            type: "string",
            enum: ["workspace", "developer_api", "system"]
          },
          status: {
            type: "string",
            enum: ["completed", "failed"]
          },
          simulationVersion: {
            type: "string",
            example: "2026.05.2"
          },
          sellerCountryCode: {
            type: ["string", "null"],
            example: "DE"
          },
          buyerCountryCode: {
            type: ["string", "null"],
            example: "HU"
          },
          buyerType: {
            type: "string",
            enum: ["business", "consumer", "public_authority", "unknown"]
          },
          transactionType: {
            type: "string",
            enum: ["goods", "services", "digital_service", "mixed", "unknown"]
          },
          transactionClass: {
            type: "string",
            enum: [
              "intra_eu_b2b_goods",
              "intra_eu_b2b_service",
              "intra_eu_b2b_digital_service",
              "intra_eu_b2b_mixed",
              "intra_eu_b2b_unknown",
              "intra_eu_b2c",
              "intra_eu_public_authority",
              "domestic_eu_business",
              "domestic_eu_consumer",
              "domestic_eu_unknown",
              "non_eu_or_unsupported",
              "insufficient_data"
            ]
          },
          vidaRelevance: {
            type: "string",
            enum: ["high", "medium", "low", "not_relevant", "review_required"]
          },
          readinessScore: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: 100
          },
          readinessStatus: {
            type: "string",
            enum: [
              "ready_for_technical_review",
              "needs_more_invoice_data",
              "needs_vat_evidence",
              "needs_country_review",
              "not_relevant",
              "professional_review_required"
            ]
          },
          legalConfidence: {
            type: "string",
            enum: ["educational_simulation", "professional_review_required"]
          },
          invoiceDate: {
            type: ["string", "null"],
            example: "2026-05-01"
          },
          currencyCode: {
            type: ["string", "null"],
            example: "EUR"
          },
          amountText: {
            type: ["string", "null"],
            example: "100.00"
          },
          countryPackVersions: {
            type: "object",
            additionalProperties: {
              type: "string"
            }
          },
          countryContext: ref("VidaCountryContext"),
          normalizedInput: ref("VidaNormalizedInput"),
          evidenceSummary: ref("VidaEvidenceSummary"),
          timeline: {
            type: "array",
            items: ref("VidaTimelineItem")
          },
          sourceReferences: {
            type: "array",
            items: ref("VidaSourceReference")
          },
          findingCount: {
            type: "integer",
            minimum: 0
          },
          infoCount: {
            type: "integer",
            minimum: 0
          },
          warningCount: {
            type: "integer",
            minimum: 0
          },
          reviewRequiredCount: {
            type: "integer",
            minimum: 0
          },
          reason: {
            type: "string"
          },
          effectiveDateContext: {
            type: "string"
          },
          disclaimer: {
            type: "string",
            description:
              "Legal-safe disclaimer snapshot preserved with the simulation run."
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          updatedAt: {
            type: "string",
            format: "date-time"
          }
        }
      },
      VidaSimulationRunDetail: {
        allOf: [
          ref("VidaSimulationRunSummary"),
          {
            type: "object",
            required: [
              "inputPayload",
              "resultPayload",
              "findings",
              "sourceLabels",
              "recommendedNextActions",
              "errorCode",
              "errorMessage",
              "requestMetadata"
            ],
            properties: {
              inputPayload: {
                type: "object",
                additionalProperties: true,
                description:
                  "Sanitized simulation request snapshot. Raw XML, full API keys, key hashes, and unnecessary personal data are not stored here."
              },
              resultPayload: ref("VidaSimulationResponse"),
              findings: {
                type: "array",
                items: ref("VidaReadinessFinding")
              },
              sourceLabels: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              recommendedNextActions: {
                type: "array",
                items: {
                  type: "string"
                }
              },
              errorCode: {
                type: ["string", "null"]
              },
              errorMessage: {
                type: ["string", "null"]
              },
              requestMetadata: {
                type: "object",
                additionalProperties: true,
                description:
                  "Safe request metadata only. Request bodies, raw XML, full API keys, key hashes, and full VAT evidence payloads are not stored here."
              }
            }
          }
        ]
      },
      VidaSimulationHistoryResponse: {
        type: "object",
        required: ["records"],
        properties: {
          records: {
            type: "array",
            items: ref("VidaSimulationRunSummary")
          }
        }
      },
      VidaSimulationDetailResponse: {
        type: "object",
        required: ["record"],
        properties: {
          record: ref("VidaSimulationRunDetail")
        }
      },
      CountryPackCatalogResponse: {
        type: "object",
        required: ["countryPacks", "count", "disclaimer", "registrySource"],
        properties: {
          countryPacks: {
            type: "array",
            items: ref("CountryPack")
          },
          count: {
            type: "integer",
            minimum: 0,
            example: 28
          },
          disclaimer: {
            type: "string",
            example:
              "Country rule packs are educational simulations and do not provide legal, tax, accounting, filing, or compliance advice."
          },
          registrySource: {
            type: "string",
            enum: ["database", "bundled"],
            description:
              "database means registry metadata was loaded from Supabase; bundled means package metadata fallback was used."
          }
        }
      },
      CountryPackDetailResponse: {
        type: "object",
        required: ["countryPack", "disclaimer", "registrySource"],
        properties: {
          countryPack: ref("CountryPack"),
          disclaimer: {
            type: "string"
          },
          registrySource: {
            type: "string",
            enum: ["database", "bundled"]
          }
        }
      },
      CountryPack: {
        type: "object",
        required: [
          "countryCode",
          "countryName",
          "euMemberState",
          "defaultCurrency",
          "status",
          "version",
          "lastReviewedAt",
          "reviewerLabel",
          "vatNumber",
          "vatRates",
          "eInvoicingStatus",
          "sourceReferences",
          "sourceCoverageSummary",
          "rules",
          "warnings",
          "legalConfidence",
          "disclaimer",
          "registry"
        ],
        properties: {
          countryCode: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            example: "HU"
          },
          countryName: {
            type: "string",
            example: "Hungary"
          },
          euMemberState: {
            type: "boolean"
          },
          defaultCurrency: {
            type: "string",
            example: "HUF"
          },
          status: {
            type: "string",
            description:
              "Country-pack package status used for educational simulation boundaries.",
            example: "eu_core_only"
          },
          version: {
            type: "string",
            example: "2026.1"
          },
          lastReviewedAt: {
            type: ["string", "null"],
            format: "date"
          },
          reviewerLabel: {
            type: "string"
          },
          vatNumber: ref("CountryPackVatNumber"),
          vatRates: ref("CountryPackVatRates"),
          eInvoicingStatus: ref("CountryPackEInvoicingStatus"),
          sourceReferences: {
            type: "array",
            items: ref("CountryPackSourceReference")
          },
          sourceCoverageSummary: ref("CountryPackSourceCoverageSummary"),
          rules: {
            type: "array",
            items: ref("CountryPackRule")
          },
          warnings: {
            type: "array",
            items: ref("CountryPackWarning")
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          disclaimer: {
            type: "string"
          },
          registry: ref("CountryPackRegistry")
        }
      },
      CountryPackRegistry: {
        type: "object",
        required: [
          "registrySource",
          "packVersion",
          "lifecycleStatus",
          "legalConfidence",
          "sourceCount",
          "ruleCount",
          "capabilities",
          "summary",
          "disclaimer",
          "publishedAt",
          "deprecatedAt",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          registrySource: {
            type: "string",
            enum: ["database", "bundled"]
          },
          packVersion: {
            type: "string",
            example: "2026.1"
          },
          lifecycleStatus: {
            type: "string",
            enum: [
              "draft",
              "internal_review",
              "published",
              "deprecated",
              "archived"
            ]
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          sourceCount: {
            type: "integer",
            minimum: 0
          },
          ruleCount: {
            type: "integer",
            minimum: 0
          },
          capabilities: ref("CountryPackCapabilityMatrix"),
          summary: {
            type: "string"
          },
          disclaimer: {
            type: "string"
          },
          publishedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          deprecatedAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          createdAt: {
            type: ["string", "null"],
            format: "date-time"
          },
          updatedAt: {
            type: ["string", "null"],
            format: "date-time"
          }
        }
      },
      CountryPackCapabilityMatrix: {
        type: "object",
        required: ["vatRules", "invoiceRules", "peppolRules", "vidaReadiness"],
        properties: {
          vatRules: {
            type: "boolean"
          },
          invoiceRules: {
            type: "boolean"
          },
          peppolRules: {
            type: "boolean"
          },
          vidaReadiness: {
            type: "boolean"
          }
        }
      },
      CountryPackVatNumber: {
        type: "object",
        required: [
          "prefix",
          "pattern",
          "localFormatCheck",
          "checksumCheck",
          "notes",
          "sourceRefs",
          "sourceRefIds"
        ],
        properties: {
          prefix: {
            type: "string",
            example: "HU"
          },
          pattern: {
            type: "string",
            example: "^HU[0-9]{8}$"
          },
          localFormatCheck: {
            type: "boolean"
          },
          checksumCheck: {
            type: "boolean"
          },
          exampleFormat: {
            type: "string"
          },
          notes: {
            type: "string"
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      },
      CountryPackVatRates: {
        type: "object",
        required: [
          "standard",
          "reduced",
          "superReduced",
          "parking",
          "zero",
          "notes",
          "sourceRefs",
          "sourceRefIds",
          "lastReviewedAt",
          "confidenceStatus"
        ],
        properties: {
          standard: {
            type: ["string", "null"],
            example: "27"
          },
          reduced: {
            type: "array",
            items: {
              type: "string"
            }
          },
          superReduced: {
            type: "array",
            items: {
              type: "string"
            }
          },
          parking: {
            type: "array",
            items: {
              type: "string"
            }
          },
          zero: {
            type: "array",
            items: {
              type: "string"
            }
          },
          notes: {
            type: "string"
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          },
          lastReviewedAt: {
            type: ["string", "null"],
            format: "date"
          },
          confidenceStatus: {
            type: "string"
          }
        }
      },
      CountryPackEInvoicingStatus: {
        type: "object",
        required: [
          "b2g",
          "b2bDomestic",
          "b2bCrossBorder",
          "clearanceModel",
          "platformNotes",
          "effectiveDateNotes",
          "sourceRefs",
          "sourceRefIds",
          "confidenceStatus"
        ],
        properties: {
          b2g: {
            type: "string"
          },
          b2bDomestic: {
            type: "string"
          },
          b2bCrossBorder: {
            type: "string"
          },
          clearanceModel: {
            type: "string"
          },
          platformNotes: {
            type: "string"
          },
          effectiveDateNotes: {
            type: "string"
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          },
          confidenceStatus: {
            type: "string"
          }
        }
      },
      CountryPackSourceReference: {
        type: "object",
        required: [
          "id",
          "title",
          "jurisdiction",
          "publisher",
          "url",
          "sourceType",
          "reviewedAt",
          "confidenceStatus",
          "confidence"
        ],
        properties: {
          id: {
            type: "string"
          },
          title: {
            type: "string"
          },
          jurisdiction: {
            type: "string"
          },
          publisher: {
            type: "string"
          },
          url: {
            type: "string",
            format: "uri"
          },
          sourceType: {
            type: "string",
            enum: [
              "eu_law",
              "eu_guidance",
              "national_tax_authority",
              "national_einvoicing_authority",
              "standard",
              "peppol",
              "vies",
              "country_pack",
              "legal_notice",
              "other"
            ]
          },
          reviewedAt: {
            type: "string"
          },
          effectiveFrom: {
            type: "string"
          },
          effectiveUntil: {
            type: "string"
          },
          effectiveTo: {
            type: "string"
          },
          confidenceStatus: {
            type: "string"
          },
          confidence: {
            type: "string"
          },
          notes: {
            type: "string"
          }
        }
      },
      CountryPackRule: {
        type: "object",
        required: [
          "code",
          "title",
          "message",
          "description",
          "category",
          "severity",
          "legalConfidence",
          "sourceRefs",
          "sourceRefIds",
          "version",
          "reviewStatus",
          "professionalReviewRequired"
        ],
        properties: {
          code: {
            type: "string"
          },
          title: {
            type: "string"
          },
          message: {
            type: "string"
          },
          description: {
            type: "string"
          },
          category: {
            type: "string",
            example: "COUNTRY_PACK"
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "fatal", "blocked"]
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sourceRefs: {
            type: "array",
            items: {
              type: "string"
            }
          },
          version: {
            type: "string"
          },
          reviewStatus: {
            type: "string"
          },
          professionalReviewRequired: {
            type: "boolean"
          }
        }
      },
      CountryPackWarning: {
        type: "object",
        required: ["code", "severity", "message", "legalConfidence"],
        properties: {
          code: {
            type: "string",
            example: "COUNTRY_REVIEW_REQUIRED"
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "fatal", "blocked"]
          },
          message: {
            type: "string"
          },
          legalConfidence: {
            type: "string",
            enum: [
              "technical",
              "standard_based",
              "official_source_derived",
              "educational_simulation",
              "professional_review_required"
            ]
          },
          sourceRefIds: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      },
      CountryPackSourceCoverageSummary: {
        type: "object",
        required: [
          "vatNumber",
          "vatRates",
          "eInvoicing",
          "rules",
          "overall",
          "missingSourceWarnings"
        ],
        properties: {
          vatNumber: {
            type: "string"
          },
          vatRates: {
            type: "string"
          },
          eInvoicing: {
            type: "string"
          },
          rules: {
            type: "string"
          },
          overall: {
            type: "string"
          },
          missingSourceWarnings: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      },
      ValidationRuleCatalogResponse: {
        type: "object",
        required: ["ruleSets"],
        properties: {
          ruleSets: {
            type: "array",
            items: ref("ValidationRuleSet")
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      ValidationRuleSet: {
        type: "object",
        required: [
          "code",
          "name",
          "description",
          "version",
          "status",
          "legalConfidence",
          "rules"
        ],
        properties: {
          code: {
            type: "string"
          },
          name: {
            type: "string"
          },
          description: {
            type: "string"
          },
          version: {
            type: "string"
          },
          status: {
            type: "string"
          },
          legalConfidence: {
            type: "string"
          },
          rules: {
            type: "array",
            items: ref("ValidationRule")
          }
        }
      },
      ValidationRule: {
        type: "object",
        required: [
          "code",
          "title",
          "description",
          "category",
          "severity",
          "messageTemplate",
          "legalConfidence",
          "version",
          "status",
          "ruleSetCode",
          "sourceLabels",
          "sources"
        ],
        properties: {
          code: {
            type: "string"
          },
          title: {
            type: "string"
          },
          description: {
            type: "string"
          },
          category: {
            type: "string"
          },
          severity: {
            type: "string"
          },
          fieldPath: {
            type: "string"
          },
          messageTemplate: {
            type: "string"
          },
          fixSuggestion: {
            type: "string"
          },
          legalConfidence: {
            type: "string"
          },
          version: {
            type: "string"
          },
          status: {
            type: "string"
          },
          ruleSetCode: {
            type: "string"
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      },
      ValidationRunRecord: {
        type: "object",
        additionalProperties: true,
        required: [
          "id",
          "invoiceNumber",
          "buyer",
          "seller",
          "createdAt",
          "technicalStatus",
          "standardStatus",
          "findings",
          "totals",
          "disclaimer"
        ],
        properties: {
          id: {
            type: "string"
          },
          invoiceNumber: {
            type: "string"
          },
          buyer: {
            type: "string"
          },
          seller: {
            type: "string"
          },
          createdAt: {
            type: "string",
            format: "date-time"
          },
          technicalStatus: {
            type: "string"
          },
          standardStatus: {
            type: "string"
          },
          totals: ref("InvoiceTotals"),
          findings: {
            type: "array",
            items: ref("ValidationFinding")
          },
          disclaimer: {
            type: "string"
          }
        }
      },
      ValidationReportSummary: {
        type: "object",
        additionalProperties: true,
        properties: {
          reportTitle: {
            type: "string",
            example: "Validation report"
          },
          validationRunId: {
            type: "string"
          },
          overallStatus: {
            type: "string"
          },
          findingCounts: {
            type: "object",
            additionalProperties: {
              type: "integer"
            }
          },
          disclaimer: {
            type: "string"
          },
          recommendedNextActions: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    }
  }
} as const;

export { openApiDocument };
