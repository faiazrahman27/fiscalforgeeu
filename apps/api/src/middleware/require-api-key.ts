import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const rawApiKey = request.headers["x-api-key"];

  if (Array.isArray(rawApiKey) || typeof rawApiKey !== "string") {
    return reply.status(401).send({
      error: {
        code: "API_KEY_REQUIRED",
        message: "Missing x-api-key header.",
        details: null
      }
    });
  }

  if (!safeCompare(rawApiKey, env.DEV_API_KEY)) {
    return reply.status(401).send({
      error: {
        code: "API_KEY_INVALID",
        message: "Invalid API key.",
        details: null
      }
    });
  }
}
