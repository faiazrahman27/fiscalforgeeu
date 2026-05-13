import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { z } from "zod";
import { env } from "../../config/env.js";
import { requireApiKeyRateLimitPolicy } from "../../middleware/require-api-rate-limit.js";
import {
  requireApiKey,
  requireApiKeyScopes
} from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  rejectOrganizationApiKey,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import {
  createAuthenticatedXmlUploadRecord,
  createXmlUploadRecord,
  deleteAuthenticatedXmlUploadRecordById,
  deleteXmlUploadRecordById,
  getAuthenticatedXmlUploadRecordById,
  getXmlUploadRecordById,
  hasAuthenticatedXmlUploadContext,
  listAuthenticatedXmlUploadRecords,
  listXmlUploadRecords,
  type AuthenticatedXmlUploadContext,
  type XmlApiInspectionStatus
} from "../../repositories/xml-upload-repository.js";
import {
  buildXmlUploadSummary,
  inspectXmlReadiness
} from "../../services/xml-readiness-engine.js";
import {
  completeAuthenticatedJob,
  completeJob,
  completeOrganizationJob,
  createAuthenticatedXmlValidationJob,
  createOrganizationXmlValidationJob,
  createXmlValidationJob,
  getAuthenticatedXmlValidationJob,
  getOrganizationXmlValidationJob,
  getXmlValidationJob,
  hasAuthenticatedXmlValidationJobContext,
  listAuthenticatedXmlValidationJobs,
  listOrganizationXmlValidationJobs,
  listXmlValidationJobs,
  markAuthenticatedJobRunning,
  markJobRunning,
  markOrganizationJobRunning,
  type AuthenticatedXmlValidationJobContext,
  type XmlValidationJobRecord,
  type XmlValidationJobStatus
} from "../../repositories/xml-validation-job-repository.js";
import {
  XML_VALIDATION_JOB_DISCLAIMER,
  XML_VALIDATION_JOB_WORKER_NAME,
  XML_VALIDATION_JOB_WORKER_VERSION,
  buildQueuedXmlValidationJobLifecycle,
  buildXmlValidationJobCompletion,
  calculateXmlSha256,
  detectXmlDocumentType,
  detectXmlRootElement,
  normalizeRequestedXmlValidationChecks
} from "../../services/xml-validation-job-service.js";
import {
  createTransientXmlPayload,
  deleteTransientXmlPayload,
  type TransientXmlPayloadReference
} from "../../services/transient-xml-payload-store.js";

const xmlBodySchema = z.string().min(1, "XML body cannot be empty");

const xmlUploadParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(120)
  })
  .strict();

const xmlValidationJobParamsSchema = xmlUploadParamsSchema;

const xmlValidationJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

const xmlValidationJobSourceTypeSchema = z.enum([
  "uploaded_xml",
  "pasted_xml",
  "generated_ubl",
  "api_payload"
]);

const xmlValidationJobCheckSchema = z.enum([
  "worker_readiness",
  "xsd_ubl",
  "schematron_peppol",
  "schematron_en16931",
  "schematron_peppol_placeholder"
]);

const xmlValidationJobProcessingModeSchema = z.enum([
  "inline",
  "async_worker"
]);

const xmlValidationJobBodySchema = z
  .object({
    xml: z.string().min(1, "XML body cannot be empty."),
    filename: z.string().trim().max(180).optional(),
    sourceType: xmlValidationJobSourceTypeSchema.optional(),
    processingMode: xmlValidationJobProcessingModeSchema.optional(),
    requestedChecks: z.array(xmlValidationJobCheckSchema).max(5).optional(),
    xmlReadinessReportId: z.string().uuid().nullable().optional(),
    invoiceDraftId: z.string().uuid().nullable().optional(),
    validationRunId: z.string().uuid().nullable().optional()
  })
  .strict();

const xmlValidationJobListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: xmlValidationJobStatusSchema.optional()
  })
  .strict();

const LOCAL_XML_VALIDATION_ORGANIZATION_ID = "local_development";

function getAuthenticatedXmlUploadContext(
  request: FastifyRequest
): AuthenticatedXmlUploadContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedXmlUploadContext(context) ? context : null;
}

function getAuthenticatedXmlValidationJobContext(
  request: FastifyRequest
): AuthenticatedXmlValidationJobContext | null {
  const user = request.authenticatedUser;
  const accessToken = request.authenticatedAccessToken;

  const context =
    user && accessToken
      ? {
          userId: user.id,
          accessToken
        }
      : null;

  return hasAuthenticatedXmlValidationJobContext(context) ? context : null;
}

function sendStorageError(reply: FastifyReply, error: unknown) {
  console.error("XML upload storage error:", error);

  return reply.status(500).send({
    error: {
      code: "XML_UPLOAD_STORAGE_ERROR",
      message: "Could not complete the XML upload storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function sendXmlValidationJobStorageError(reply: FastifyReply, error: unknown) {
  console.error("XML validation job storage error:", error);

  return reply.status(500).send({
    error: {
      code: "XML_VALIDATION_JOB_STORAGE_ERROR",
      message: "Could not complete the XML validation job storage operation.",
      details: error instanceof Error ? error.message : null
    }
  });
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
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

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[^\x20-\x7E]/g, "_")
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180);

  return cleaned || "uploaded-invoice.xml";
}

function formatBytesFromHeader(value: string) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function buildValidationError(message: string, details: unknown) {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message,
      details
    }
  };
}

function sanitizeOptionalFileName(value: string | undefined) {
  return value ? safeFileName(value) : null;
}

function buildAsyncXmlValidationJobResultSummary(input: {
  xmlSha256: string;
  xmlSizeBytes: number;
  rootElement: string;
  documentType: string;
  requestedChecks: readonly string[];
  transientPayload: TransientXmlPayloadReference;
}) {
  return {
    workerReady: false,
    xmlSha256: input.xmlSha256,
    xmlSizeBytes: input.xmlSizeBytes,
    rootElement: input.rootElement,
    documentType: input.documentType,
    safetyPolicyPassed: true,
    requestedChecks: input.requestedChecks,
    completedChecks: [],
    failedChecks: [],
    queue: buildQueuedXmlValidationJobLifecycle(),
    transientPayload: input.transientPayload,
    activeValidation: {
      xsd: false,
      schematron: false,
      peppolArtifacts: false,
      en16931Certification: false
    },
    xsdUbl: {
      requested: input.requestedChecks.includes("xsd_ubl"),
      configured: false,
      validationExecuted: false,
      markedValid: false
    },
    schematronPeppol: {
      requested:
        input.requestedChecks.includes("schematron_peppol") ||
        input.requestedChecks.includes("schematron_peppol_placeholder"),
      implemented: false,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false
    },
    schematronEn16931: {
      requested: input.requestedChecks.includes("schematron_en16931"),
      implemented: false,
      validationExecutionEnabled: false,
      validationExecuted: false,
      markedValid: false
    }
  };
}

function formatXmlValidationJob(job: XmlValidationJobRecord) {
  return {
    id: job.id,
    status: job.status,
    sourceType: job.sourceType,
    documentType: job.documentType,
    filename: job.filename,
    xmlSha256: job.xmlSha256,
    xmlSizeBytes: job.xmlSizeBytes,
    requestedChecks: job.requestedChecks,
    completedChecks: job.completedChecks,
    failedChecks: job.failedChecks,
    workerName: job.workerName,
    workerVersion: job.workerVersion,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    resultSummary: job.resultSummary,
    findings: job.findings,
    disclaimer: job.disclaimer,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    xmlReadinessReportId: job.xmlReadinessReportId,
    invoiceDraftId: job.invoiceDraftId,
    validationRunId: job.validationRunId
  };
}

async function listJobsForRequest(input: {
  request: FastifyRequest;
  limit: number | undefined;
  status: XmlValidationJobStatus | undefined;
}) {
  const authenticatedContext = getAuthenticatedXmlValidationJobContext(
    input.request
  );

  if (input.request.authenticatedApiKey) {
    const listInput: {
      organizationId: string;
      limit?: number;
      status?: XmlValidationJobStatus;
    } = {
      organizationId: input.request.authenticatedApiKey.organizationId
    };

    if (input.limit !== undefined) {
      listInput.limit = input.limit;
    }

    if (input.status !== undefined) {
      listInput.status = input.status;
    }

    return listOrganizationXmlValidationJobs(listInput);
  }

  if (authenticatedContext) {
    const listInput: {
      limit?: number;
      status?: XmlValidationJobStatus;
    } = {};

    if (input.limit !== undefined) {
      listInput.limit = input.limit;
    }

    if (input.status !== undefined) {
      listInput.status = input.status;
    }

    return listAuthenticatedXmlValidationJobs(authenticatedContext, listInput);
  }

  const listInput: {
    organizationId: string;
    limit?: number;
    status?: XmlValidationJobStatus;
  } = {
    organizationId: LOCAL_XML_VALIDATION_ORGANIZATION_ID
  };

  if (input.limit !== undefined) {
    listInput.limit = input.limit;
  }

  if (input.status !== undefined) {
    listInput.status = input.status;
  }

  return listXmlValidationJobs(listInput);
}

async function getJobForRequest(input: {
  request: FastifyRequest;
  jobId: string;
}) {
  const authenticatedContext = getAuthenticatedXmlValidationJobContext(
    input.request
  );

  if (input.request.authenticatedApiKey) {
    return getOrganizationXmlValidationJob({
      organizationId: input.request.authenticatedApiKey.organizationId,
      jobId: input.jobId
    });
  }

  if (authenticatedContext) {
    return getAuthenticatedXmlValidationJob(authenticatedContext, input.jobId);
  }

  return getXmlValidationJob({
    organizationId: LOCAL_XML_VALIDATION_ORGANIZATION_ID,
    jobId: input.jobId
  });
}

export async function xmlRoutes(app: FastifyInstance) {
  app.post(
    "/validation-jobs",
    {
      preHandler: [
        requireApiKeyScopes(["xml:validation_jobs"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "XML_VALIDATION_JOB_ROLE_REQUIRED",
          message:
            "XML validation jobs require an organization owner, admin, accountant, developer, or reviewer role."
        }),
        requireApiKeyRateLimitPolicy("xml_validation_jobs")
      ]
    },
    async (request, reply) => {
      const parsedBody = xmlValidationJobBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML validation job request failed schema validation.",
            formatZodIssues(parsedBody.error)
          )
        );
      }

      const xml = parsedBody.data.xml;

      if (!xml.trim()) {
        return reply.status(400).send({
          error: {
            code: "XML_BODY_INVALID",
            message: "XML body cannot be empty.",
            details: null
          }
        });
      }

      const xmlSizeBytes = getUtf8ByteLength(xml);

      if (xmlSizeBytes > env.API_BODY_LIMIT_BYTES) {
        return reply.status(413).send({
          error: {
            code: "XML_BODY_TOO_LARGE",
            message: "XML body is too large.",
            details: {
              maxBytes: env.API_BODY_LIMIT_BYTES
            }
          }
        });
      }

      const safety = inspectXmlSafety(xml, {
        maxBytes: env.API_BODY_LIMIT_BYTES
      });

      if (!safety.safe) {
        return reply.status(400).send({
          error: {
            code: safety.code ?? "XML_SAFETY_REJECTED",
            message: safety.message,
            details: {
              byteLength: safety.byteLength,
              maxBytes: safety.maxBytes ?? env.API_BODY_LIMIT_BYTES
            }
          },
          disclaimer: XML_VALIDATION_JOB_DISCLAIMER
        });
      }

      const requestedChecks = normalizeRequestedXmlValidationChecks(
        parsedBody.data.requestedChecks
      );
      const rootElement = detectXmlRootElement(xml);
      const documentType = detectXmlDocumentType(rootElement);
      const xmlSha256 = calculateXmlSha256(xml);
      const filename = sanitizeOptionalFileName(parsedBody.data.filename);
      const processingMode = parsedBody.data.processingMode ?? "inline";
      let transientPayload: TransientXmlPayloadReference | null = null;

      try {
        const authenticatedContext = getAuthenticatedXmlValidationJobContext(
          request
        );
        transientPayload =
          processingMode === "async_worker"
            ? await createTransientXmlPayload({
                xml,
                maxBytes: env.API_BODY_LIMIT_BYTES
              })
            : null;
        const asyncResultSummary = transientPayload
          ? buildAsyncXmlValidationJobResultSummary({
              xmlSha256,
              xmlSizeBytes,
              rootElement,
              documentType,
              requestedChecks,
              transientPayload
            })
          : null;
        const createInput = {
          xmlReadinessReportId: parsedBody.data.xmlReadinessReportId ?? null,
          invoiceDraftId: parsedBody.data.invoiceDraftId ?? null,
          validationRunId: parsedBody.data.validationRunId ?? null,
          sourceType: parsedBody.data.sourceType ?? "uploaded_xml",
          documentType,
          filename,
          xmlSha256,
          xmlSizeBytes,
          requestedChecks,
          ...(asyncResultSummary ? { resultSummary: asyncResultSummary } : {}),
          disclaimer: XML_VALIDATION_JOB_DISCLAIMER
        };

        let job: XmlValidationJobRecord;
        let organizationId = LOCAL_XML_VALIDATION_ORGANIZATION_ID;

        if (request.authenticatedApiKey) {
          organizationId = request.authenticatedApiKey.organizationId;
          job = await createOrganizationXmlValidationJob({
            ...createInput,
            organizationId,
            createdBy: null
          });
        } else if (authenticatedContext) {
          job = await createAuthenticatedXmlValidationJob(
            authenticatedContext,
            createInput
          );
        } else {
          job = await createXmlValidationJob({
            ...createInput,
            organizationId,
            createdBy: null
          });
        }

        if (processingMode === "async_worker") {
          return reply.status(202).send({
            job: formatXmlValidationJob(job)
          });
        }

        if (request.authenticatedApiKey) {
          await markOrganizationJobRunning({
            organizationId,
            jobId: job.id,
            workerName: XML_VALIDATION_JOB_WORKER_NAME,
            workerVersion: XML_VALIDATION_JOB_WORKER_VERSION
          });
        } else if (authenticatedContext) {
          await markAuthenticatedJobRunning(authenticatedContext, {
            jobId: job.id,
            workerName: XML_VALIDATION_JOB_WORKER_NAME,
            workerVersion: XML_VALIDATION_JOB_WORKER_VERSION
          });
        } else {
          await markJobRunning({
            organizationId,
            jobId: job.id,
            workerName: XML_VALIDATION_JOB_WORKER_NAME,
            workerVersion: XML_VALIDATION_JOB_WORKER_VERSION
          });
        }

        const completion = await buildXmlValidationJobCompletion({
          xml,
          xmlSha256,
          xmlSizeBytes,
          requestedChecks,
          safety,
          rootElement,
          documentType,
          queueMode: "inline",
          queueClaimedBy: XML_VALIDATION_JOB_WORKER_NAME
        });

        const completedJob = request.authenticatedApiKey
          ? await completeOrganizationJob({
              organizationId,
              jobId: job.id,
              ...completion
            })
          : authenticatedContext
            ? await completeAuthenticatedJob(authenticatedContext, {
                jobId: job.id,
                ...completion
              })
            : await completeJob({
                organizationId,
                jobId: job.id,
                ...completion
              });

        if (!completedJob) {
          return reply.status(500).send({
            error: {
              code: "XML_VALIDATION_JOB_COMPLETION_FAILED",
              message: "XML validation job was created but could not be completed.",
              details: null
            }
          });
        }

        return reply.status(200).send({
          job: formatXmlValidationJob(completedJob)
        });
      } catch (error) {
        if (transientPayload) {
          try {
            await deleteTransientXmlPayload({
              payloadId: transientPayload.payloadId
            });
          } catch {
            // Best-effort cleanup only; the original storage error is more useful.
          }
        }

        return sendXmlValidationJobStorageError(reply, error);
      }
    }
  );

  app.get(
    "/validation-jobs",
    {
      preHandler: [
        requireApiKeyScopes(["xml:validation_jobs"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.validationRunReaders, {
          code: "XML_VALIDATION_JOB_READ_ROLE_REQUIRED",
          message:
            "XML validation job reading requires workspace membership with an allowed report-read role."
        }),
        requireApiKeyRateLimitPolicy("xml_validation_jobs")
      ]
    },
    async (request, reply) => {
      const parsedQuery = xmlValidationJobListQuerySchema.safeParse(
        request.query
      );

      if (!parsedQuery.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML validation job query failed schema validation.",
            formatZodIssues(parsedQuery.error)
          )
        );
      }

      try {
        const jobs = await listJobsForRequest({
          request,
          limit: parsedQuery.data.limit,
          status: parsedQuery.data.status
        });

        return {
          jobs: jobs.map(formatXmlValidationJob)
        };
      } catch (error) {
        return sendXmlValidationJobStorageError(reply, error);
      }
    }
  );

  app.get(
    "/validation-jobs/:id",
    {
      preHandler: [
        requireApiKeyScopes(["xml:validation_jobs"]),
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.validationRunReaders, {
          code: "XML_VALIDATION_JOB_READ_ROLE_REQUIRED",
          message:
            "XML validation job detail requires workspace membership with an allowed report-read role."
        }),
        requireApiKeyRateLimitPolicy("xml_validation_jobs")
      ]
    },
    async (request, reply) => {
      const parsedParams = xmlValidationJobParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML validation job ID failed schema validation.",
            formatZodIssues(parsedParams.error)
          )
        );
      }

      try {
        const job = await getJobForRequest({
          request,
          jobId: parsedParams.data.id
        });

        if (!job) {
          return reply.status(404).send({
            error: {
              code: "XML_VALIDATION_JOB_NOT_FOUND",
              message: "XML validation job was not found.",
              details: null
            }
          });
        }

        return {
          job: formatXmlValidationJob(job)
        };
      } catch (error) {
        return sendXmlValidationJobStorageError(reply, error);
      }
    }
  );

  app.get(
    "/uploads",
    {
      preHandler: [
        requireApiKey,
        rejectOrganizationApiKey,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.validationRunReaders, {
          code: "XML_UPLOAD_READ_ROLE_REQUIRED",
          message:
            "XML upload history requires workspace membership with an allowed report-read role."
        })
      ]
    },
    async (request, reply) => {
      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const records = authenticatedContext
          ? await listAuthenticatedXmlUploadRecords(authenticatedContext)
          : await listXmlUploadRecords();

        return {
          records
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.get(
    "/uploads/:id",
    {
      preHandler: [
        requireApiKey,
        rejectOrganizationApiKey,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.validationRunReaders, {
          code: "XML_UPLOAD_READ_ROLE_REQUIRED",
          message:
            "XML upload detail requires workspace membership with an allowed report-read role."
        })
      ]
    },
    async (request, reply) => {
      const parsedParams = xmlUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML upload ID failed schema validation.",
            formatZodIssues(parsedParams.error)
          )
        );
      }

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const record = authenticatedContext
          ? await getAuthenticatedXmlUploadRecordById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await getXmlUploadRecordById(parsedParams.data.id);

        if (!record) {
          return reply.status(404).send({
            error: {
              code: "XML_UPLOAD_NOT_FOUND",
              message: "XML upload record was not found.",
              details: null
            }
          });
        }

        return {
          record
        };
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );

  app.delete(
    "/uploads/:id",
    {
      preHandler: [
        requireApiKey,
        rejectOrganizationApiKey,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.workspaceManagers, {
          code: "XML_UPLOAD_DELETE_ROLE_REQUIRED",
          message:
            "XML upload deletion requires an organization owner or admin role."
        })
      ]
    },
    async (request, reply) => {
      const parsedParams = xmlUploadParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send(
          buildValidationError(
            "XML upload ID failed schema validation.",
            formatZodIssues(parsedParams.error)
          )
        );
      }

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const wasDeleted = authenticatedContext
          ? await deleteAuthenticatedXmlUploadRecordById(
              authenticatedContext,
              parsedParams.data.id
            )
          : await deleteXmlUploadRecordById(parsedParams.data.id);

        if (!wasDeleted) {
          return reply.status(404).send({
            error: {
              code: "XML_UPLOAD_NOT_FOUND",
              message: "XML upload record was not found.",
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

  app.post(
    "/inspect",
    {
      preHandler: [
        requireApiKey,
        rejectOrganizationApiKey,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.invoiceValidators, {
          code: "XML_INSPECT_ROLE_REQUIRED",
          message:
            "XML inspection requires an organization owner, admin, accountant, developer, or reviewer role."
        })
      ]
    },
    async (request, reply) => {
      const contentType = readHeaderString(request.headers["content-type"]);

      if (!isXmlContentType(contentType)) {
        return reply.status(415).send({
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message:
              "Use content-type text/xml, application/xml, or another XML media type.",
            details: null
          }
        });
      }

      const rawBody = typeof request.body === "string" ? request.body : "";
      const parsedBody = xmlBodySchema.safeParse(rawBody);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: {
            code: "XML_BODY_INVALID",
            message: "XML body failed validation.",
            details: formatZodIssues(parsedBody.error)
          }
        });
      }

      const xml = parsedBody.data;

      if (getUtf8ByteLength(xml) > env.API_BODY_LIMIT_BYTES) {
        return reply.status(413).send({
          error: {
            code: "XML_BODY_TOO_LARGE",
            message: "XML body is too large.",
            details: {
              maxBytes: env.API_BODY_LIMIT_BYTES
            }
          }
        });
      }

      const inspection = inspectXmlReadiness(xml);
      const readinessReport = inspection.report;

      const apiStatus: XmlApiInspectionStatus =
        readinessReport.documentStatus === "unsupported"
          ? "review_required"
          : "parsed";

      const disclaimer =
        "Invoice Lantern performs a technical readiness simulation only. This result is not official XML, Peppol, EN 16931, ViDA, tax, legal, accounting, government, or authority validation.";

      try {
        const authenticatedContext = getAuthenticatedXmlUploadContext(request);

        const recordInput = {
          fileName: safeFileName(readHeaderString(request.headers["x-file-name"])),
          fileSize: formatBytesFromHeader(
            readHeaderString(request.headers["x-file-size"])
          ),
          detectedDocument: inspection.detectedDocument,
          rootElement: inspection.rootElement,
          invoiceId: inspection.invoiceId,
          issueDate: inspection.issueDate,
          currency: inspection.currency,
          apiStatus,
          disclaimer,
          readinessReport,
          summary: buildXmlUploadSummary(readinessReport)
        };

        const record = authenticatedContext
          ? await createAuthenticatedXmlUploadRecord(
              authenticatedContext,
              recordInput
            )
          : await createXmlUploadRecord(recordInput);

        return reply.status(200).send({
          uploadInspectionId: record.id,
          detectedDocument: record.detectedDocument,
          rootElement: record.rootElement,
          invoiceId: record.invoiceId,
          issueDate: record.issueDate,
          currency: record.currency,
          status: record.apiStatus,
          technicalStatus: record.technicalStatus,
          readinessStatus: record.readinessStatus,
          documentStatus: record.documentStatus,
          calculationStatus: record.calculationStatus,
          profileStatus: record.profileStatus,
          extractedData: record.extractedData,
          findings: record.findings,
          disclaimer: record.disclaimer,
          record
        });
      } catch (error) {
        return sendStorageError(reply, error);
      }
    }
  );
}
