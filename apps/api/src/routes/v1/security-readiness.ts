import type { FastifyInstance } from "fastify";
import { requireSupabaseUser } from "../../middleware/require-api-key.js";
import {
  WORKSPACE_ROLE_SETS,
  requireWorkspaceRole
} from "../../middleware/require-workspace-role.js";
import { buildWorkspaceSecurityReadiness } from "../../services/security-readiness-service.js";

export async function securityReadinessRoutes(app: FastifyInstance) {
  app.get(
    "/security/readiness",
    {
      preHandler: [
        requireSupabaseUser,
        requireWorkspaceRole(WORKSPACE_ROLE_SETS.apiRequestViewers, {
          code: "WORKSPACE_SECURITY_READINESS_ROLE_REQUIRED",
          message:
            "Workspace security readiness requires an organization owner, admin, or developer role."
        })
      ]
    },
    async (request, reply) => {
      const workspace = request.workspaceAuthorization;

      if (!workspace) {
        return reply.status(401).send({
          error: {
            code: "WORKSPACE_AUTHORIZATION_REQUIRED",
            message:
              "Workspace security readiness requires a signed-in workspace context.",
            details: null
          }
        });
      }

      return reply.header("Cache-Control", "no-store").send(
        buildWorkspaceSecurityReadiness({
          organizationId: workspace.organizationId,
          membershipRole: workspace.membershipRole
        })
      );
    }
  );
}
