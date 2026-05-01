const SANDBOX_DISCLAIMER =
  "Invoice Lantern is an independent, non-official EU e-invoice validation and ViDA-readiness sandbox. The Developer API provides technical validation and readiness tooling only. It is not official filing, not authority submission, not tax, legal, or accounting advice, and not a compliance guarantee.";

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
    country: "DE",
    vatId: "DE123456789",
    city: "Berlin",
    postalCode: "10115",
    street: "Example Street 1",
    electronicAddress: "seller@example.test"
  },
  buyer: {
    name: "Invoice Lantern Buyer Kft",
    country: "HU",
    vatId: "HU12345678",
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
      vatCategory: "S",
      vatRate: "27"
    }
  ]
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

function jsonContent(schema: Record<string, unknown>, examples?: Record<string, unknown>) {
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
        "Metadata-only XML validation job endpoints for the validation worker foundation. Real XSD, Schematron, Peppol, and EN 16931 validation are not active yet."
    },
    {
      name: "VAT",
      description:
        "Local VAT format checks only. These endpoints do not perform VIES checks or prove VAT registration."
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
          "Lists safe API key metadata for the signed-in workspace. Requires an organization owner or admin. Full API keys and key hashes are never returned.",
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
          "Creates a scoped organization API key for sandbox developer endpoints. Requires an organization owner or admin. The secret is returned once only; Invoice Lantern stores only hashed key material.",
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
          "Revokes an organization API key for the signed-in workspace. Requires an organization owner or admin.",
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
          "Lists safe API request log metadata for the signed-in workspace. Requires an organization owner or admin. Request bodies, XML payloads, full API keys, full VAT IDs, and key hashes are not returned.",
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
          "Returns a safe usage summary for the signed-in workspace over a recent day window. Requires an organization owner or admin.",
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
    "/invoices/validate": {
      post: scopedApiKeyOperation({
        tags: ["Invoices"],
        summary: "Validate a canonical invoice payload",
        description:
          "Runs Invoice Lantern technical validation against a canonical invoice payload and stores a validation run. This is a sandbox technical validation result only.",
        scope: "invoices:validate",
        requestBody: {
          required: true,
          content: jsonContent(ref("CanonicalInvoice"), {
            invoiceValidation: {
              value: exampleCanonicalInvoice
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
        summary: "Export a canonical invoice as UBL XML",
        description:
          "Generates UBL Invoice XML from a canonical invoice payload and stores safe export metadata. Draft-only lookup is not available to organization API keys.",
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
            description: "Generated UBL XML and safe export metadata.",
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
        summary: "Parse UBL XML into the canonical invoice shape",
        description:
          "Parses UBL XML into Invoice Lantern's canonical invoice shape and returns technical parser findings. The endpoint accepts raw XML with an XML content type or JSON with an xml string.",
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
          "422": response("UBL XML parsed but could not produce a valid canonical invoice.", ref("UblParseResponse"))
        }
      })
    },
    "/xml/validation-jobs": {
      get: scopedApiKeyOperation({
        tags: ["XML Validation Jobs"],
        summary: "List XML validation jobs",
        description:
          "Lists metadata-only XML validation jobs for the caller's organization. Raw XML is never returned. These jobs are worker-readiness sandbox records, not official validation, Peppol certification, EN 16931 certification, authority acceptance, or a compliance guarantee.",
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
          "Creates a metadata-only XML validation job and completes a worker-readiness stub synchronously. The request may ask for placeholder XSD or Schematron checks, but they are returned as planned and inactive. This endpoint does not perform real XSD, Schematron, Peppol, or EN 16931 validation.",
        scope: "xml:validation_jobs",
        requestBody: {
          required: true,
          content: jsonContent(ref("XmlValidationJobCreateRequest"), {
            workerReadiness: {
              value: {
                xml: tinyUblXml,
                filename: "invoice-lantern-worker-readiness.xml",
                sourceType: "api_payload",
                requestedChecks: [
                  "worker_readiness",
                  "xsd_ubl_placeholder",
                  "schematron_peppol_placeholder"
                ]
              }
            }
          })
        },
        responses: {
          "200": {
            description: "Completed worker-readiness XML validation job.",
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
                      version: "2026.04.1",
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
      get: bearerOperation({
        tags: ["Reports"],
        summary: "Download a validation report PDF",
        description:
          "Downloads a non-official technical sandbox validation report PDF. Documented for signed-in workspace users. Local development may also accept the development API key for compatibility, but organization API keys are not documented for PDF report downloads.",
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
        }
      })
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
        required: ["document", "seller", "buyer", "lines"],
        properties: {
          document: {
            type: "object",
            required: ["type", "number", "currency"],
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
                maxLength: 32
              },
              dueDate: {
                type: "string",
                maxLength: 32
              },
              profile: {
                type: "string",
                maxLength: 40
              },
              buyerReference: {
                type: "string",
                maxLength: 120
              },
              contractReference: {
                type: "string",
                maxLength: 120
              }
            }
          },
          seller: ref("CanonicalParty"),
          buyer: ref("CanonicalParty"),
          lines: {
            type: "array",
            maxItems: 200,
            items: ref("CanonicalInvoiceLine")
          },
          taxSubtotals: {
            type: "array",
            maxItems: 100,
            items: ref("InvoiceTaxSubtotal")
          },
          totals: ref("InvoiceTotals")
        }
      },
      CanonicalParty: {
        type: "object",
        required: ["name", "country"],
        properties: {
          name: {
            type: "string",
            maxLength: 160
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
          }
        }
      },
      CanonicalInvoiceLine: {
        type: "object",
        required: ["description", "quantity", "unitPrice", "vatRate"],
        properties: {
          id: {
            type: "string",
            maxLength: 80
          },
          description: {
            type: "string",
            maxLength: 280
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
          vatCategory: {
            type: "string",
            maxLength: 12,
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
          }
        }
      },
      InvoiceTaxSubtotal: {
        type: "object",
        properties: {
          taxableAmount: {
            type: "string"
          },
          taxAmount: {
            type: "string"
          },
          vatCategory: {
            type: "string"
          },
          vatRate: {
            type: "string"
          }
        }
      },
      InvoiceTotals: {
        type: "object",
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
          taxInclusiveAmount: {
            type: "string",
            example: "127.00"
          },
          allowanceTotalAmount: {
            type: "string"
          },
          chargeTotalAmount: {
            type: "string"
          },
          prepaidAmount: {
            type: "string"
          },
          payableRoundingAmount: {
            type: "string"
          },
          payableAmount: {
            type: "string",
            example: "127.00"
          }
        }
      },
      ValidationFinding: {
        type: "object",
        required: ["code", "severity", "category", "fieldPath", "message", "legalConfidence"],
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
            example: "CANONICAL"
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
            type: "string"
          },
          ruleVersion: {
            type: "string"
          },
          sourceLabels: {
            type: "array",
            items: {
              type: "string"
            }
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
            example: "UBL export readiness"
          },
          exportId: {
            type: "string"
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
        required: ["xml", "metadata", "readinessStatus", "totals", "findings", "disclaimer"],
        properties: {
          xml: {
            type: "string",
            description: "Generated UBL XML. Request logs do not store this payload."
          },
          metadata: ref("UblExportMetadata"),
          exportId: {
            type: "string"
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
                "xsd_ubl_placeholder",
                "schematron_peppol_placeholder"
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
      XmlValidationJobFinding: {
        type: "object",
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
            example: "XML_VALIDATION_WORKER_READY"
          },
          severity: {
            type: "string",
            enum: ["info", "warning", "fatal"]
          },
          checkType: {
            type: "string",
            enum: [
              "worker_readiness",
              "xsd_ubl_placeholder",
              "schematron_peppol_placeholder"
            ]
          },
          field: {
            type: "string",
            example: "xml"
          },
          message: {
            type: "string"
          },
          status: {
            type: "string",
            enum: ["completed", "not_implemented"]
          },
          legalConfidence: {
            type: "string",
            enum: ["technical", "educational_simulation"]
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
              type: "string"
            }
          },
          completedChecks: {
            type: "array",
            items: {
              type: "string"
            }
          },
          failedChecks: {
            type: "array",
            items: {
              type: "string"
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
            additionalProperties: true
          },
          findings: {
            type: "array",
            items: ref("XmlValidationJobFinding")
          },
          disclaimer: {
            type: "string",
            example:
              "This XML validation job is a technical sandbox worker-readiness result. Real XSD, Schematron, Peppol, and EN 16931 validation are not enabled yet."
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
        required: ["code", "name", "description", "version", "status", "legalConfidence", "rules"],
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
