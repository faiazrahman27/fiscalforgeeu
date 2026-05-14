import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { requireSupabaseUser } from "./require-api-key.js";

export type PlatformAdminContext = {
  userId: string;
  email: string;
  emailHash: string;
};

declare module "fastify" {
  interface FastifyRequest {
    platformAdmin?: PlatformAdminContext;
  }
}

const TEST_PLATFORM_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000901";

function readHeaderString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parsePlatformAdminEmails() {
  return env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);
}

function hashEmail(email: string) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function isPlatformAdminEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return parsePlatformAdminEmails().includes(normalizedEmail);
}

function sendUnauthorized(
  reply: FastifyReply,
  code: string,
  message: string
) {
  return reply.status(401).send({
    error: {
      code,
      message,
      details: null
    }
  });
}

function sendPlatformAdminRequired(reply: FastifyReply) {
  return reply.status(403).send({
    error: {
      code: "PLATFORM_ADMIN_REQUIRED",
      message:
        "Platform rule, source, and country-pack administration requires a signed-in platform administrator.",
      details: null
    }
  });
}

function authenticateTestUser(request: FastifyRequest) {
  if (env.APP_ENV !== "test") {
    return false;
  }

  const email = readHeaderString(request.headers["x-test-user-email"]);

  if (!email) {
    return false;
  }

  const userId =
    readHeaderString(request.headers["x-test-user-id"]) ||
    TEST_PLATFORM_ADMIN_USER_ID;

  request.authenticatedUser = {
    id: userId,
    email,
    role: "authenticated"
  };
  request.authenticatedAccessToken = "test-signed-user-token";
  request.authenticationMode = "supabase_user";

  return true;
}

export async function requirePlatformAdminSignedUser(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.authenticatedUser) {
    return;
  }

  if (authenticateTestUser(request)) {
    return;
  }

  return requireSupabaseUser(request, reply);
}

export async function requirePlatformAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requirePlatformAdminSignedUser(request, reply);

  if (reply.sent) {
    return;
  }

  if (request.authenticationMode !== "supabase_user") {
    return sendUnauthorized(
      reply,
      "AUTH_TOKEN_REQUIRED",
      "API key authentication is not allowed for platform administration."
    );
  }

  const user = request.authenticatedUser;

  if (!user || !isPlatformAdminEmail(user.email)) {
    return sendPlatformAdminRequired(reply);
  }

  request.platformAdmin = {
    userId: user.id,
    email: user.email,
    emailHash: hashEmail(user.email)
  };
}

