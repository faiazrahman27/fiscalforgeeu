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
    authenticatedAccessToken?: string;
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

function authenticateWithDevApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
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
