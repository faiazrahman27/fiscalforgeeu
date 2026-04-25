import Fastify from "fastify";
import { env } from "./config/env.js";
import { registerSecurityPlugins } from "./plugins/security.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
import { HttpError, sendHttpError } from "./utils/http-error.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.APP_ENV === "development" ? "info" : "warn"
    },
    bodyLimit: env.API_BODY_LIMIT_BYTES
  });

  app.addContentTypeParser(
    ["application/xml", "text/xml"],
    {
      parseAs: "string",
      bodyLimit: env.API_BODY_LIMIT_BYTES
    },
    (_request, body, done) => {
      done(null, body);
    }
  );

  await registerSecurityPlugins(app);

  app.get("/", async () => {
    return {
      service: "FiscalForge EU API",
      status: "ok",
      version: "0.1.0"
    };
  });

  await app.register(healthRoutes, {
    prefix: "/health"
  });

  await app.register(v1Routes, {
    prefix: "/api/v1"
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        details: null
      }
    });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof HttpError) {
      return sendHttpError(reply, error);
    }

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error.",
        details: env.APP_ENV === "development" ? error.message : null
      }
    });
  });

  return app;
}
