import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import {
  getSupabasePublicClient,
  hasSupabaseJwtConfig
} from "../lib/supabase/server-client.js";

export type AuthenticatedRequestUser = {
  id: string;
  email: string;
  role: "authenticated";
};

declare module "fastify" {
  interface FastifyRequest {
    authenticatedUser?: AuthenticatedRequestUser;
    authenticationMode?: "dev_api_key" | "supabase_user";
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

async function authenticateWithSupabaseBearerToken(
  token: string,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!hasSupabaseJwtConfig()) {
    return reply.status(503).send({
      error: {
        code: "AUTH_PROVIDER_NOT_CONFIGURED",
        message:
          "Supabase authentication is not configured for the API service.",
        details: null
      }
    });
  }

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

  request.authenticationMode = "supabase_user";
}

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bearerToken = readBearerToken(request);

  if (bearerToken) {
    return authenticateWithSupabaseBearerToken(bearerToken, request, reply);
  }

  const rawApiKey = request.headers["x-api-key"];

  if (Array.isArray(rawApiKey) || typeof rawApiKey !== "string") {
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
