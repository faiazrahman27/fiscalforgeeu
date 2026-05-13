import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  calculateInvoiceTotals,
  validateCanonicalInvoice,
  type CanonicalInvoice,
  type ValidationFinding
} from "@invoice-lantern/invoice-core";
import {
  inspectXmlSafety,
  ublInvoiceXmlToCanonicalInvoice
} from "@invoice-lantern/ubl";
import { env } from "../../config/env.js";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  buildDraftSummary,
  createAuthenticatedInvoiceDraft,
  createInvoiceDraft,
  hasAuthenticatedInvoiceDraftContext,
  type AuthenticatedInvoiceDraftContext
} from "../../repositories/invoice-draft-repository.js";
import {
  createAuthenticatedWorkspaceActivityEvent,
  hasAuthenticatedWorkspaceActivityContext,
  type AuthenticatedWorkspaceActivityContext
} from "../../repositories/workspace-activity-repository.js";
import {
  invoiceEditorDraftSchema,
  type InvoiceEditorDraftPayload
} from "../../schemas/invoice.js";

const UBL_IMPORT_DISCLAIMER =
  "This imported draft was created from parsed UBL XML for technical sandbox use. It is not official XML validation, Peppol certification, tax advice, legal advice, accounting advice, or authority acceptance.";

const rawXmlBodySchema = z.string().trim().min(1, "XML body cannot be empty.");

const jsonXmlBodySchema = z
  .object({
    xml: z.string().trim().min(1, "XML body cannot be empty.")
  })
  .strict();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function isXmlContentType(value: string) {
  const normalizedContentType = value.toLowerCase();

  return (
    normalizedContentType.includes("text/xml") ||
    normalizedContentType.includes("application/xml") ||
    normalizedContentType.includes("+xml")
  );
}

function isJsonContentType(value: string) {
  return value.toLowerCase().includes("application/json");
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
}

function buildCreatedFalseResponse(input: {
  reason: string;
  detected?: Record<string, unknown>;
  findings?: ValidationFinding[];
  totals?: ReturnType<typeof calculateInvoiceTotals> | null;
}) {
  return {
    created: false,
    reason: input.reason,
    detected: input.detected ?? {},
    findings: input.findings ?? [],
    totals: input.totals ?? null,
    disclaimer: UBL_IMPORT_DISCLAIMER
  };
}

function buildValidationError(message: string, details: unknown) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message,
      details
    },
    ...buildCreatedFalseResponse({
      reason: message
    })
  };
}

function readXmlFromRequest(request: FastifyRequest) {
  const contentType = readHeaderString(request.headers["content-type"]);

  if (typeof request.body === "string") {
    if (!isXmlContentType(contentType)) {
      return {
        ok: false as const,
        statusCode: 415,
        body: buildValidationError(
          "Raw UBL import requests must use an XML content type.",
          null
        )
      };
    }

    const parsedXml = rawXmlBodySchema.safeParse(request.body);

    if (!parsedXml.success) {
      return {
        ok: false as const,
        statusCode: 400,
        body: buildValidationError(
          "XML body failed validation.",
          formatZodIssues(parsedXml.error)
        )
      };
    }

    return {
      ok: true as const,
      xml: parsedXml.data
    };
  }

  if (isPlainObject(request.body) || isJsonContentType(contentType)) {
    const parsedJsonBody = jsonXmlBodySchema.safeParse(request.body);

    if (!parsedJsonBody.success) {
      return {
        ok: false as const,
        statusCode: 400,
        body: buildValidationError(
          "JSON body must contain an xml string.",
          formatZodIssues(parsedJsonBody.error)
        )
      };
    }

    return {
      ok: true as const,
      xml: parsedJsonBody.data.xml
    };
  }

  return {
    ok: false as const,
    statusCode: 415,
    body: buildValidationError(
      "Use raw XML or JSON with an xml string for UBL draft import.",
      null
    )
  };
}

function getAuthenticatedInvoiceDraftContext(
  request: FastifyRequest
): AuthenticatedInvoiceDraftContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedInvoiceDraftContext(context) ? context : null;
}

function getAuthenticatedWorkspaceActivityContext(
  request: FastifyRequest
): AuthenticatedWorkspaceActivityContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedWorkspaceActivityContext(context) ? context : null;
}

function mergeFindings(findings: ValidationFinding[]) {
  const seen = new Set<string>();
  const merged: ValidationFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.code}::${finding.fieldPath}::${finding.message}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(finding);
  }

  return merged;
}

function hasUnsafeFinding(findings: ValidationFinding[]) {
  return findings.some(
    (finding) => finding.severity === "blocked" || finding.severity === "fatal"
  );
}

function makeImportFinding(input: {
  code: string;
  severity: "blocked" | "fatal";
  fieldPath: string;
  message: string;
  fixSuggestion: string;
}): ValidationFinding {
  return {
    code: input.code,
    severity: input.severity,
    category: "CANONICAL",
    fieldPath: input.fieldPath,
    message: input.message,
    fixSuggestion: input.fixSuggestion,
    legalConfidence: "technical",
    ruleSetCode: "INVOICE_LANTERN_UBL_IMPORT",
    ruleVersion: "2026.04.1",
    sourceLabels: ["Invoice Lantern UBL import technical policy"]
  };
}

function mapCanonicalProfileToDraftProfile(input: {
  profile: string;
  customizationId: string | undefined;
}) {
  const combinedProfileText = `${input.profile} ${
    input.customizationId ?? ""
  }`.toLowerCase();

  if (combinedProfileText.includes("peppol")) {
    return "PEPPOL_BIS_3" as const;
  }

  if (
    combinedProfileText.includes("en16931") ||
    combinedProfileText.includes("en 16931")
  ) {
    return "EN16931" as const;
  }

  if (combinedProfileText.includes("country_pack")) {
    return "COUNTRY_PACK" as const;
  }

  if (input.profile === "PEPPOL_BIS_3") {
    return "PEPPOL_BIS_3" as const;
  }

  if (input.profile === "EN16931") {
    return "EN16931" as const;
  }

  if (input.profile === "COUNTRY_PACK") {
    return "COUNTRY_PACK" as const;
  }

  return null;
}

function buildDraftPayloadFromCanonicalInvoice(input: {
  invoice: CanonicalInvoice;
  detected: Record<string, unknown>;
}) {
  const draftProfile = mapCanonicalProfileToDraftProfile({
    profile: input.invoice.document.profile,
    customizationId:
      typeof input.detected.customizationId === "string"
        ? input.detected.customizationId
        : undefined
  });

  if (!draftProfile) {
    return {
      ok: false as const,
      finding: makeImportFinding({
        code: "DRAFT_PROFILE_NOT_REPRESENTABLE",
        severity: "blocked",
        fieldPath: "document.profile",
        message:
          "The parsed UBL profile cannot be safely represented by the current invoice draft profile options.",
        fixSuggestion:
          "Use UBL XML with a recognizable EN16931, Peppol BIS 3, or supported country-pack profile signal before creating an editable draft."
      })
    };
  }

  const calculation = calculateInvoiceTotals(input.invoice);

  const payload: InvoiceEditorDraftPayload = {
    document: {
      number: input.invoice.document.number,
      issueDate: input.invoice.document.issueDate,
      dueDate: input.invoice.document.dueDate,
      currency: input.invoice.document.currency,
      invoiceType: input.invoice.document.type,
      profile: draftProfile,
      buyerReference: input.invoice.document.buyerReference,
      contractReference: input.invoice.document.contractReference
    },
    seller: {
      name: input.invoice.seller.name,
      country: input.invoice.seller.country,
      vatId: input.invoice.seller.vatId,
      city: input.invoice.seller.city,
      postalCode: input.invoice.seller.postalCode,
      street: input.invoice.seller.street,
      electronicAddress: input.invoice.seller.electronicAddress
    },
    buyer: {
      name: input.invoice.buyer.name,
      country: input.invoice.buyer.country,
      vatId: input.invoice.buyer.vatId,
      city: input.invoice.buyer.city,
      postalCode: input.invoice.buyer.postalCode,
      street: input.invoice.buyer.street,
      electronicAddress: input.invoice.buyer.electronicAddress
    },
    lines: input.invoice.lines.map((line, index) => {
      const calculatedLine = calculation.lines[index];

      return {
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitCode: line.unitCode,
        unitPrice: line.unitPrice,
        vatCategory: line.vatCategory,
        vatRate: line.vatRate,
        netAmount: line.netAmount ?? calculatedLine?.netAmount ?? ""
      };
    }),
    totals: {
      lineExtensionAmount: calculation.totals.lineExtensionAmount,
      taxExclusiveAmount: calculation.totals.taxExclusiveAmount,
      taxAmount: calculation.totals.taxAmount,
      taxInclusiveAmount: calculation.totals.taxInclusiveAmount,
      payableAmount: calculation.totals.payableAmount
    }
  };

  const parsedDraftPayload = invoiceEditorDraftSchema.safeParse(payload);

  if (!parsedDraftPayload.success) {
    return {
      ok: false as const,
      finding: makeImportFinding({
        code: "DRAFT_SCHEMA_NOT_REPRESENTABLE",
        severity: "blocked",
        fieldPath: "invoiceDraft",
        message:
          "The parsed UBL invoice cannot be safely represented by the current editable draft schema without changing or inventing values.",
        fixSuggestion: formatZodIssues(parsedDraftPayload.error)
          .map((issue) => `${issue.path || "invoiceDraft"}: ${issue.message}`)
          .join(" ")
          .slice(0, 500)
      })
    };
  }

  return {
    ok: true as const,
    payload: parsedDraftPayload.data,
    totals: calculation
  };
}

async function recordImportActivity(
  request: FastifyRequest,
  input: {
    invoiceDraftId: string;
    invoiceNumber: string;
    detected: Record<string, unknown>;
    findingsCount: number;
  }
) {
  const context = getAuthenticatedWorkspaceActivityContext(request);

  if (!context) {
    return;
  }

  try {
    await createAuthenticatedWorkspaceActivityEvent(context, {
      eventType: "invoice.ubl_import.draft_created",
      entityType: "invoice_draft",
      entityId: input.invoiceDraftId,
      entityLabel: input.invoiceNumber || input.invoiceDraftId,
      severity: "info",
      metadata: {
        source: "ubl_parse",
        parsedAt: new Date().toISOString(),
        detected: input.detected,
        findingsCount: input.findingsCount
      }
    });
  } catch (error) {
    console.warn(
      `Workspace activity event was not recorded: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("UBL import draft storage error:", error);

  return reply.status(500).send({
    error: {
      code: "UBL_IMPORT_DRAFT_STORAGE_ERROR",
      message: "Could not create the invoice draft from parsed UBL XML.",
      details: error instanceof Error ? error.message : null
    },
    ...buildCreatedFalseResponse({
      reason: "Could not create the invoice draft from parsed UBL XML."
    })
  });
}

export async function importUblRoutes(app: FastifyInstance) {
  app.post(
    "/import/ubl",
    {
      preHandler: [
        requireApiKeyScopes(["invoices:import_ubl"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceDraftEditors, {
          code: "UBL_IMPORT_ROLE_REQUIRED",
          message:
            "UBL draft import requires an organization owner, admin, accountant, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      if (request.authenticatedApiKey) {
        return reply.status(403).send({
          error: {
            code: "API_KEY_UBL_IMPORT_DRAFT_UNSUPPORTED",
            message:
              "Organization API keys can parse UBL XML with the parse scope, but editable draft import requires a signed-in workspace user in this step.",
            details: null
          },
          ...buildCreatedFalseResponse({
            reason:
              "Editable draft import requires a signed-in workspace user in this step."
          })
        });
      }

      const parsedRequest = readXmlFromRequest(request);

      if (!parsedRequest.ok) {
        return reply.status(parsedRequest.statusCode).send(parsedRequest.body);
      }

      const xml = parsedRequest.xml;

      if (getUtf8ByteLength(xml) > env.API_BODY_LIMIT_BYTES) {
        return reply.status(413).send({
          error: {
            code: "XML_BODY_TOO_LARGE",
            message: "XML body is too large.",
            details: {
              maxBytes: env.API_BODY_LIMIT_BYTES
            }
          },
          ...buildCreatedFalseResponse({
            reason: "XML body is too large."
          })
        });
      }

      const safety = inspectXmlSafety(xml, {
        maxBytes: env.API_BODY_LIMIT_BYTES
      });

      if (!safety.safe) {
        const parseResult = ublInvoiceXmlToCanonicalInvoice(xml, {
          maxBytes: env.API_BODY_LIMIT_BYTES
        });

        return reply.status(400).send(
          buildCreatedFalseResponse({
            reason:
              "The XML contains blocked constructs and was rejected before draft creation.",
            detected: parseResult.detected,
            findings: parseResult.findings
          })
        );
      }

      const parseResult = ublInvoiceXmlToCanonicalInvoice(xml, {
        maxBytes: env.API_BODY_LIMIT_BYTES
      });

      if (!parseResult.ok || !parseResult.invoice) {
        return reply.status(422).send(
          buildCreatedFalseResponse({
            reason:
              "The UBL XML could not be parsed into a canonical invoice suitable for editable draft creation.",
            detected: parseResult.detected,
            findings: parseResult.findings
          })
        );
      }

      const validationResult = validateCanonicalInvoice(parseResult.invoice);
      const validationFindings = validationResult.findings;
      const canonicalInvoice = validationResult.success
        ? validationResult.invoice
        : parseResult.invoice;
      const findings = mergeFindings([
        ...parseResult.findings,
        ...validationFindings
      ]);
      const totals = calculateInvoiceTotals(canonicalInvoice);

      if (!validationResult.success || hasUnsafeFinding(findings)) {
        return reply.status(422).send(
          buildCreatedFalseResponse({
            reason:
              "The parsed invoice has blocked or fatal findings that must be fixed before creating an editable draft.",
            detected: parseResult.detected,
            findings,
            totals
          })
        );
      }

      if (canonicalInvoice.document.type !== "invoice") {
        const creditNoteFinding = makeImportFinding({
          code: "DRAFT_CREDIT_NOTE_IMPORT_UNSUPPORTED",
          severity: "blocked",
          fieldPath: "document.type",
          message:
            "CreditNote import-to-draft is not enabled in this technical sandbox step.",
          fixSuggestion:
            "Use UBL Invoice XML for editable draft import until dedicated CreditNote draft support is available."
        });

        return reply.status(422).send(
          buildCreatedFalseResponse({
            reason:
              "The parsed document type is not supported for editable draft creation.",
            detected: parseResult.detected,
            findings: mergeFindings([...findings, creditNoteFinding]),
            totals
          })
        );
      }

      const draftPayload = buildDraftPayloadFromCanonicalInvoice({
        invoice: canonicalInvoice,
        detected: parseResult.detected
      });

      if (!draftPayload.ok) {
        return reply.status(422).send(
          buildCreatedFalseResponse({
            reason:
              "The parsed invoice cannot be safely represented by the current editable draft schema.",
            detected: parseResult.detected,
            findings: mergeFindings([...findings, draftPayload.finding]),
            totals
          })
        );
      }

      try {
        const authenticatedContext = getAuthenticatedInvoiceDraftContext(request);

        const draft = authenticatedContext
          ? await createAuthenticatedInvoiceDraft(
              authenticatedContext,
              draftPayload.payload
            )
          : await createInvoiceDraft(draftPayload.payload);

        await recordImportActivity(request, {
          invoiceDraftId: draft.id,
          invoiceNumber: draft.document.number,
          detected: parseResult.detected,
          findingsCount: findings.length
        });

        return reply.status(201).send({
          created: true,
          invoiceDraftId: draft.id,
          redirectPath: `/workspace/invoices/${encodeURIComponent(draft.id)}`,
          detected: parseResult.detected,
          findings,
          totals: draftPayload.totals,
          summary: buildDraftSummary(draft),
          disclaimer: UBL_IMPORT_DISCLAIMER
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
