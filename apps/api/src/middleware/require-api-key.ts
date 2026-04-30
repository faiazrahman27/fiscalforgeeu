import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import {
  getSupabasePublicClient,
  hasSupabaseJwtConfig
} from "../lib/supabase/server-client.js";
import {
  looksLikeInvoiceLanternApiKey,
  verifyApiKey,
  type ApiKeyMetadata,
  type ApiKeyScope
} from "../services/api-key-service.js";

export type AuthenticatedRequestUser = {
  id: string;
  email: string;
  role: "authenticated";
};

declare module "fastify" {
  interface FastifyRequest {
    authenticatedUser?: AuthenticatedRequestUser;
    authenticatedAccessToken?: string;
    authenticatedApiKey?: ApiKeyMetadata;
    authenticationMode?:
      | "dev_api_key"
      | "supabase_user"
      | "organization_api_key";
    apiKeyRequestStartedAt?: number;
  }
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readBearerToken(request: FastifyRequest) {
  const rawAuthorizationHeader = request.headers.authorization;

  if (
    Array.isArray(rawAuthorizationHeader) ||
    typeof rawAuthorizationHeader !== "string"
  ) {
    return "";
  }

  const trimmedHeader = rawAuthorizationHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return trimmedHeader.slice("bearer ".length).trim();
}

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function readXApiKey(request: FastifyRequest) {
  return readHeaderString(request.headers["x-api-key"]);
}

function sendUnauthorized(
  reply: FastifyReply,
  code: string,
  message: string,
  details: unknown = null
) {
  return reply.status(401).send({
    error: {
      code,
      message,
      details
    }
  });
}

function sendAuthenticationError(
  reply: FastifyReply,
  statusCode: 401 | 403,
  code: string,
  message: string,
  details: unknown = null
) {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
      details
    }
  });
}

function authenticateWithDevApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const rawApiKey = readXApiKey(request);

  if (!rawApiKey) {
    return sendUnauthorized(
      reply,
      "API_KEY_REQUIRED",
      "Missing x-api-key header."
    );
  }

  if (!safeCompare(rawApiKey, env.DEV_API_KEY)) {
    return sendUnauthorized(reply, "API_KEY_INVALID", "Invalid API key.");
  }

  request.authenticationMode = "dev_api_key";
}

async function authenticateWithOrganizationApiKey(
  rawApiKey: string,
  requiredScopes: readonly ApiKeyScope[],
  request: FastifyRequest,
  reply: FastifyReply
) {
  const verification = await verifyApiKey(rawApiKey, requiredScopes, {
    ipAddress: request.ip
  });

  if (!verification.ok) {
    return sendAuthenticationError(
      reply,
      verification.statusCode,
      verification.code,
      verification.message
    );
  }

  request.authenticatedApiKey = verification.apiKey;
  request.authenticationMode = "organization_api_key";
  request.apiKeyRequestStartedAt = Date.now();
}

async function authenticateWithSupabaseBearerToken(
  token: string,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return sendUnauthorized(
      reply,
      "AUTH_TOKEN_INVALID",
      "Invalid or expired authentication token."
    );
  }

  request.authenticatedUser = {
    id: data.user.id,
    email: data.user.email ?? "",
    role: "authenticated"
  };

  /*
   * Keep the bearer token available only inside the API request lifecycle.
   * Repository functions can use it to create a user-scoped Supabase client,
   * so database reads/writes are evaluated by RLS as the signed-in user.
   */
  request.authenticatedAccessToken = token;
  request.authenticationMode = "supabase_user";
}

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bearerToken = readBearerToken(request);

  /*
   * During the current transition phase, the web proxy sends both:
   * - x-api-key for the existing local API flow
   * - Authorization: Bearer <token> when the user is signed in
   *
   * If the API does not have Supabase auth config yet, ignore the bearer token
   * and preserve the working development API-key flow.
   */
  if (bearerToken && hasSupabaseJwtConfig()) {
    return authenticateWithSupabaseBearerToken(bearerToken, request, reply);
  }

  return authenticateWithDevApiKey(request, reply);
}

export function requireApiKeyScopes(requiredScopes: readonly ApiKeyScope[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const bearerToken = readBearerToken(request);
    const xApiKey = readXApiKey(request);

    if (
      bearerToken &&
      !looksLikeInvoiceLanternApiKey(bearerToken) &&
      hasSupabaseJwtConfig()
    ) {
      return authenticateWithSupabaseBearerToken(bearerToken, request, reply);
    }

    if (xApiKey) {
      if (safeCompare(xApiKey, env.DEV_API_KEY)) {
        request.authenticationMode = "dev_api_key";
        return;
      }

      return authenticateWithOrganizationApiKey(
        xApiKey,
        requiredScopes,
        request,
        reply
      );
    }

    if (bearerToken && looksLikeInvoiceLanternApiKey(bearerToken)) {
      return authenticateWithOrganizationApiKey(
        bearerToken,
        requiredScopes,
        request,
        reply
      );
    }

    return sendUnauthorized(
      reply,
      "API_KEY_REQUIRED",
      "Missing x-api-key header."
    );
  };
}

export async function requireSupabaseUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bearerToken = readBearerToken(request);

  if (!bearerToken) {
    return sendUnauthorized(
      reply,
      "AUTH_TOKEN_REQUIRED",
      "Missing Supabase bearer token."
    );
  }

  if (!hasSupabaseJwtConfig()) {
    return sendUnauthorized(
      reply,
      "AUTH_NOT_CONFIGURED",
      "Supabase authentication is not configured for this API service."
    );
  }

  if (looksLikeInvoiceLanternApiKey(bearerToken)) {
    return sendUnauthorized(
      reply,
      "AUTH_TOKEN_REQUIRED",
      "API key authentication is not allowed for this endpoint."
    );
  }

  return authenticateWithSupabaseBearerToken(bearerToken, request, reply);
}
