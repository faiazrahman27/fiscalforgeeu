import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { recordApiRequest } from "../services/api-key-service.js";

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function getRequestPath(request: FastifyRequest) {
  const rawUrl = request.url || "/";
  const queryIndex = rawUrl.indexOf("?");

  return queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl;
}

function getDurationMs(request: FastifyRequest) {
  const startedAt = request.apiKeyRequestStartedAt;

  if (!startedAt) {
    return null;
  }

  return Math.max(0, Date.now() - startedAt);
}

function recordRequestLog(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.authenticatedApiKey;

  if (!apiKey) {
    return;
  }

  void recordApiRequest({
    organizationId: apiKey.organizationId,
    apiKeyId: apiKey.id,
    requestMethod: request.method,
    requestPath: getRequestPath(request),
    statusCode: reply.statusCode,
    durationMs: getDurationMs(request),
    ipAddress: request.ip,
    userAgent: readHeaderString(request.headers["user-agent"]),
    errorCode: request.apiKeyRequestErrorCode ?? null
  }).catch((error) => {
    request.log.warn(
      {
        error
      },
      "API key request log was not recorded"
    );
  });
}

export async function registerApiKeyRequestLogging(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    recordRequestLog(request, reply);
  });
}
