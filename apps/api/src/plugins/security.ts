import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function registerSecurityPlugins(app: FastifyInstance) {
  await app.register(helmet, {
    global: true
  });

  await app.register(cors, {
    origin: env.APP_ENV === "production" ? [env.WEB_APP_URL] : true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-api-key",
      "x-file-name",
      "x-file-size"
    ],
    credentials: false
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down and try again.",
        details: {
          limit: env.RATE_LIMIT_MAX,
          window: env.RATE_LIMIT_WINDOW
        }
      }
    })
  });
}
