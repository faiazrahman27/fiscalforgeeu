import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  requireApiKey,
  requireApiKeyScopes
} from "../../middleware/require-api-key.js";
import {
  deleteAuthenticatedValidationRunById,
  deleteValidationRunById,
  getAuthenticatedValidationRunById,
  getOrganizationValidationRunById,
  getValidationRunById,
  hasAuthenticatedValidationRunContext,
  listAuthenticatedValidationRuns,
  listValidationRuns,
  recordAuthenticatedValidationReportPdfExported,
  type AuthenticatedValidationRunContext,
  type ValidationRunRecord
} from "../../repositories/validation-run-repository.js";
import {
  buildValidationReportSummary,
  type ValidationReportFindingCounts,
  type ValidationReportSummary
} from "../../services/validation-report-summary.js";
import { generateValidationReportPdf } from "../../services/validation-report-pdf.js";
import { formatZodError } from "../../utils/zod-error.js";

type ValidationRunVidaSeed = {
  validationRunId: string;
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId: string;
  buyerVatId: string;
  buyerType: "business" | "consumer" | "public_authority" | "unknown";
  transactionType: "goods" | "services" | "digital_service" | "mixed" | "unknown";
  invoiceDate: string;
  currency: string;
  amount: string;
};

type ValidationRunSafeVidaContext = {
  sellerCountry: string;
  buyerCountry: string;
  sellerVatId: string;
  buyerVatId: string;
  vidaSimulationSeed: ValidationRunVidaSeed;
};

type ValidationRunDetailRecord = ValidationRunRecord & ValidationRunSafeVidaContext;

type ValidationRunSummary = {
  id: string;
  invoiceNumber: string;
  buyer: string;
  seller: string;
  buyerCountry: string;
  sellerCountry: string;
  buyerVatId: string;
  sellerVatId: string;
  issueDate: string;
  createdAt: string;
  technicalStatus: string;
  standardStatus: string;
  countrySimulationStatus: string;
  vidaReadinessStatus: string;
  confidence: string;
  profile: string;
  currency: string;
  overallStatus: string;
  findingCounts: ValidationReportFindingCounts;
  findingsCount: number;
  payableAmount: string;
  reportLabel: string;
  vidaSimulationSeed: ValidationRunVidaSeed;
};

const validationRunParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAuthenticatedValidationRunContext(
  request: FastifyRequest
): AuthenticatedValidationRunContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedValidationRunContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("Validation run storage error:", error);

  return reply.status(500).send({
    error: {
      code: "VALIDATION_RUN_STORAGE_ERROR",
      message: "Could not complete the validation run storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : "";
}

function readDirectString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  return sanitizeText(record[key], maxLength);
}

function readNestedString(
  record: Record<string, unknown>,
  path: string[],
  maxLength: number
) {
  let current: unknown = record;

  for (const segment of path) {
    if (!isPlainObject(current)) {
      return "";
    }

    current = current[segment];
  }

  return sanitizeText(current, maxLength);
}

function readFirstDirectString(
  record: Record<string, unknown>,
  keys: string[],
  maxLength: number
) {
  for (const key of keys) {
    const value = readDirectString(record, key, maxLength);

    if (value) {
      return value;
    }
  }

  return "";
}

function readFirstNestedString(
  record: Record<string, unknown>,
  paths: string[][],
  maxLength: number
) {
  for (const path of paths) {
    const value = readNestedString(record, path, maxLength);

    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeCountryCandidate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed.slice(0, 8);
}

function readCountryCandidate(
  record: Record<string, unknown>,
  directKeys: string[],
  nestedPaths: string[][]
) {
  const directValue = readFirstDirectString(record, directKeys, 32);

  if (directValue) {
    return normalizeCountryCandidate(directValue);
  }

  return normalizeCountryCandidate(readFirstNestedString(record, nestedPaths, 32));
}

function readVatCandidate(
  record: Record<string, unknown>,
  directKeys: string[],
  nestedPaths: string[][]
) {
  const directValue = readFirstDirectString(record, directKeys, 64);

  if (directValue) {
    return directValue;
  }

  return readFirstNestedString(record, nestedPaths, 64);
}

function amountToText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().replace(/^[A-Z]{3}\s*/u, "").slice(0, 80);
  }

  return "";
}

function readPayableAmount(run: ValidationRunRecord) {
  return amountToText(run.totals?.payableAmount);
}

function buildValidationRunVidaSeed(run: ValidationRunRecord): ValidationRunVidaSeed {
  const record = run as unknown as Record<string, unknown>;

  const sellerCountry = readCountryCandidate(
    record,
    ["sellerCountry", "sellerCountryCode", "seller_country", "seller_country_code"],
    [
      ["sellerParty", "country"],
      ["sellerParty", "countryCode"],
      ["seller_party", "country"],
      ["seller_party", "country_code"],
      ["seller", "country"],
      ["seller", "countryCode"]
    ]
  );

  const buyerCountry = readCountryCandidate(
    record,
    ["buyerCountry", "buyerCountryCode", "buyer_country", "buyer_country_code"],
    [
      ["buyerParty", "country"],
      ["buyerParty", "countryCode"],
      ["buyer_party", "country"],
      ["buyer_party", "country_code"],
      ["buyer", "country"],
      ["buyer", "countryCode"]
    ]
  );

  const sellerVatId = readVatCandidate(
    record,
    ["sellerVatId", "sellerVatID", "seller_vat_id", "sellerVatNumber"],
    [
      ["sellerParty", "vatId"],
      ["sellerParty", "vatNumber"],
      ["seller_party", "vat_id"],
      ["seller", "vatId"],
      ["seller", "vatNumber"]
    ]
  );

  const buyerVatId = readVatCandidate(
    record,
    ["buyerVatId", "buyerVatID", "buyer_vat_id", "buyerVatNumber"],
    [
      ["buyerParty", "vatId"],
      ["buyerParty", "vatNumber"],
      ["buyer_party", "vat_id"],
      ["buyer", "vatId"],
      ["buyer", "vatNumber"]
    ]
  );

  return {
    validationRunId: run.id,
    sellerCountry,
    buyerCountry,
    sellerVatId,
    buyerVatId,
    buyerType: "business",
    transactionType: "services",
    invoiceDate: run.issueDate ?? "",
    currency: run.currency || "EUR",
    amount: readPayableAmount(run)
  };
}

function buildValidationRunSafeVidaContext(
  run: ValidationRunRecord
): ValidationRunSafeVidaContext {
  const vidaSimulationSeed = buildValidationRunVidaSeed(run);

  return {
    sellerCountry: vidaSimulationSeed.sellerCountry,
    buyerCountry: vidaSimulationSeed.buyerCountry,
    sellerVatId: vidaSimulationSeed.sellerVatId,
    buyerVatId: vidaSimulationSeed.buyerVatId,
    vidaSimulationSeed
  };
}

function buildValidationRunDetailRecord(
  run: ValidationRunRecord
): ValidationRunDetailRecord {
  return {
    ...run,
    ...buildValidationRunSafeVidaContext(run)
  };
}

function buildValidationRunSummary(
  run: ValidationRunRecord
): ValidationRunSummary {
  const reportSummary = buildValidationReportSummary(run);
  const safeVidaContext = buildValidationRunSafeVidaContext(run);

  return {
    id: run.id,
    invoiceNumber: run.invoiceNumber,
    buyer: run.buyer,
    seller: run.seller,
    buyerCountry: safeVidaContext.buyerCountry,
    sellerCountry: safeVidaContext.sellerCountry,
    buyerVatId: safeVidaContext.buyerVatId,
    sellerVatId: safeVidaContext.sellerVatId,
    issueDate: run.issueDate ?? "",
    createdAt: run.createdAt,
    technicalStatus: run.technicalStatus,
    standardStatus: run.standardStatus,
    countrySimulationStatus: run.countrySimulationStatus,
    vidaReadinessStatus: run.vidaReadinessStatus,
    confidence: run.confidence,
    profile: run.profile,
    currency: run.currency,
    overallStatus: reportSummary.overallStatus,
    findingCounts: reportSummary.findingCounts,
    findingsCount: run.findings.length,
    payableAmount: run.totals.payableAmount,
    reportLabel: "sandbox report",
    vidaSimulationSeed: safeVidaContext.vidaSimulationSeed
  };
}

function buildValidationRunDetailResponse(run: ValidationRunRecord): {
  record: ValidationRunDetailRecord;
  reportSummary: ValidationReportSummary;
} {
  return {
    record: buildValidationRunDetailRecord(run),
    reportSummary: buildValidationReportSummary(run)
  };
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 32);

  return cleaned || "report";
}

function buildValidationReportPdfFilename(runId: string) {
  const shortRunId = sanitizeFilenamePart(runId).slice(0, 12) || "report";

  return `invoice-lantern-validation-report-${shortRunId}.pdf`;
}

export async function validationRunRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const runs = authenticatedContext
          ? await listAuthenticatedValidationRuns(authenticatedContext)
          : await listValidationRuns();

        return {
          records: runs.map(buildValidationRunSummary)
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/:id/report.pdf",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const run = authenticatedContext
          ? await getAuthenticatedValidationRunById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await getValidationRunById(parsedParams.data.id);

        if (!run) {
          return reply.status(404).send({
            error: {
              code: "VALIDATION_RUN_NOT_FOUND",
              message: "Validation run was not found.",
              details: null
            }
          });
        }

        const reportSummary = buildValidationReportSummary(run);
        const pdfBuffer = await generateValidationReportPdf({
          run,
          reportSummary
        });
        const filename = buildValidationReportPdfFilename(run.id);

        if (authenticatedContext) {
          await recordAuthenticatedValidationReportPdfExported(
            authenticatedContext,
            run,
            filename
          );
        }

        return reply
          .header("Content-Type", "application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          )
          .header("Content-Length", String(pdfBuffer.length))
          .send(pdfBuffer);
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/:id",
    {
      preHandler: requireApiKeyScopes(["validation_runs:read"])
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const run = request.authenticatedApiKey
          ? await getOrganizationValidationRunById(
              request.authenticatedApiKey.organizationId,
              parsedParams.data.id
            )
          : authenticatedContext
            ? await getAuthenticatedValidationRunById(
                authenticatedContext,
                parsedParams.data.id
              )
            : await getValidationRunById(parsedParams.data.id);

        if (!run) {
          return reply.status(404).send({
            error: {
              code: "VALIDATION_RUN_NOT_FOUND",
              message: "Validation run was not found.",
              details: null
            }
          });
        }

        return buildValidationRunDetailResponse(run);
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: requireApiKey
    },
    async (request, reply) => {
      const parsedParams = validationRunParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation run ID failed schema validation.",
            details: formatZodError(parsedParams.error)
          }
        });
      }

      try {
        const authenticatedContext = getAuthenticatedValidationRunContext(request);

        const wasDeleted = authenticatedContext
          ? await deleteAuthenticatedValidationRunById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await deleteValidationRunById(parsedParams.data.id);

        if (!wasDeleted) {
          return reply.status(404).send({
            error: {
              code: "VALIDATION_RUN_NOT_FOUND",
              message: "Validation run was not found.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          deleted: true,
          id: parsedParams.data.id
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
