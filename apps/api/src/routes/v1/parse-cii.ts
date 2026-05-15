import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  calculateInvoiceTotals,
  validateCanonicalInvoice,
  type ValidationFinding
} from "@invoice-lantern/invoice-core";
import {
  CII_TECHNICAL_DISCLAIMER,
  ciiInvoiceXmlToCanonicalInvoice,
  inspectCiiXmlSafety
} from "@invoice-lantern/cii";
import { env } from "../../config/env.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import { requireApiKeyScopes } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  createAuthenticatedWorkspaceActivityEvent,
  hasAuthenticatedWorkspaceActivityContext,
  type AuthenticatedWorkspaceActivityContext
} from "../../repositories/workspace-activity-repository.js";

const CII_PARSE_DISCLAIMER = CII_TECHNICAL_DISCLAIMER;

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

function buildValidationError(message: string, details: unknown) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message,
      details
    },
    parsed: false,
    disclaimer: CII_PARSE_DISCLAIMER
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
          "Raw CII parse requests must use an XML content type.",
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
      "Use raw XML or JSON with an xml string for CII parsing.",
      null
    )
  };
}

async function recordParseActivity(
  request: FastifyRequest,
  input: {
    parsed: boolean;
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
      eventType: "invoice.cii_parse.completed",
      entityType: "cii_parse",
      entityId: `cii_parse_${randomUUID()}`,
      entityLabel:
        typeof input.detected.invoiceNumber === "string" &&
        input.detected.invoiceNumber.trim()
          ? input.detected.invoiceNumber
          : "CII parse preview",
      severity: input.parsed ? "info" : "warning",
      metadata: {
        parsed: input.parsed,
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

export async function parseCiiRoutes(app: FastifyInstance) {
  app.post(
    "/parse/cii",
    {
      preHandler: [
        requireApiKeyScopes(["invoices:parse_cii"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "CII_PARSE_ROLE_REQUIRED",
          message:
            "CII parsing requires an organization owner, admin, accountant, developer, or reviewer role."
        }),
        requireApiKeyRateLimitPolicy("invoices_parse_cii")
      ]
    },
    async (request, reply) => {
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
          parsed: false,
          disclaimer: CII_PARSE_DISCLAIMER
        });
      }

      const safety = inspectCiiXmlSafety(xml, {
        maxBytes: env.API_BODY_LIMIT_BYTES
      });

      if (!safety.safe) {
        const parseResult = ciiInvoiceXmlToCanonicalInvoice(xml, {
          maxBytes: env.API_BODY_LIMIT_BYTES
        });

        await recordParseActivity(request, {
          parsed: false,
          detected: parseResult.detected,
          findingsCount: parseResult.findings.length
        });

        return reply.status(400).send({
          parsed: false,
          detected: parseResult.detected,
          findings: parseResult.findings,
          disclaimer: CII_PARSE_DISCLAIMER
        });
      }

      const parseResult = ciiInvoiceXmlToCanonicalInvoice(xml, {
        maxBytes: env.API_BODY_LIMIT_BYTES
      });
      let canonicalInvoice = parseResult.invoice;
      let totals: ReturnType<typeof calculateInvoiceTotals> | null = null;
      let validationFindings: ValidationFinding[] = [];

      if (canonicalInvoice) {
        const validationResult = validateCanonicalInvoice(canonicalInvoice);

        validationFindings = validationResult.findings;

        if (validationResult.success) {
          canonicalInvoice = validationResult.invoice;
          totals = calculateInvoiceTotals(validationResult.invoice);
        }
      }

      const findings = mergeFindings([
        ...parseResult.findings,
        ...validationFindings
      ]);
      const parsed = Boolean(parseResult.ok && canonicalInvoice);

      await recordParseActivity(request, {
        parsed,
        detected: parseResult.detected,
        findingsCount: findings.length
      });

      return reply.status(parsed ? 200 : 422).send({
        parsed,
        canonicalInvoice,
        detected: parseResult.detected,
        findings,
        totals,
        disclaimer: CII_PARSE_DISCLAIMER
      });
    }
  );
}
