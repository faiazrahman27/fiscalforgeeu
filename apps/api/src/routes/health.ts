import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return {
      status: "ok",
      service: "Invoice Lantern API",
      environment: env.APP_ENV,
      timestamp: new Date().toISOString()
    };
  });
}

