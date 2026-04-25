import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return {
      status: "ok",
      service: "FiscalForge EU API",
      environment: env.APP_ENV,
      timestamp: new Date().toISOString()
    };
  });
}
