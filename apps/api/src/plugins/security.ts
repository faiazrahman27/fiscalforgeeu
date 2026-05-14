import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { env, isProductionEnvironment } from "../config/env.js";

function isSensitiveApiPath(url: string) {
  if (!url.startsWith("/api/v1/")) {
    return false;
  }

  return url !== "/api/v1/openapi.json";
}

export async function registerSecurityPlugins(app: FastifyInstance) {
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        connectSrc: ["'self'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        upgradeInsecureRequests: isProductionEnvironment() ? [] : null
      }
    },
    crossOriginOpenerPolicy: {
      policy: "same-origin"
    },
    crossOriginResourcePolicy: {
      policy: "same-origin"
    },
    frameguard: {
      action: "deny"
    },
    hsts: isProductionEnvironment()
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        }
      : false,
    noSniff: true,
    originAgentCluster: true,
    referrerPolicy: {
      policy: "no-referrer"
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: "none"
    }
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

  app.addHook("onSend", async (request, reply, payload) => {
    if (!reply.getHeader("Permissions-Policy")) {
      reply.header(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      );
    }

    if (
      isSensitiveApiPath(request.url) &&
      !reply.getHeader("Cache-Control")
    ) {
      reply.header("Cache-Control", "no-store");
    }

    return payload;
  });
}
