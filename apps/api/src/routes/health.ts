import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  buildHealthStatus,
  buildPublicReadinessStatus
} from "../services/security-readiness-service.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    return reply.header("Cache-Control", "no-store").send(buildHealthStatus());
  });

  app.get("/ready", async (_request, reply) => {
    return reply
      .header("Cache-Control", "no-store")
      .send(buildPublicReadinessStatus());
  });
}

export async function publicReadyRoute(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply
    .header("Cache-Control", "no-store")
    .send(buildPublicReadinessStatus());
}
