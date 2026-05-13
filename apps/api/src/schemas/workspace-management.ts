import { z } from "zod";
import { WORKSPACE_ROLES } from "../middleware/require-workspace-role.js";

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const workspaceMemberParamsSchema = z
  .object({
    memberId: z.string().trim().uuid()
  })
  .strict();

export const workspaceInvitationParamsSchema = z
  .object({
    id: z.string().trim().uuid()
  })
  .strict();

export const workspaceInvitationCreateSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    role: workspaceRoleSchema,
    expiresInDays: z.number().int().min(1).max(30).optional().default(7)
  })
  .strict();

export const workspaceInvitationAcceptSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(40)
      .max(300)
      .regex(/^il_inv_[A-Za-z0-9_-]{8,48}\.[A-Za-z0-9_-]{24,240}$/)
  })
  .strict();

export const workspaceMemberRoleUpdateSchema = z
  .object({
    role: workspaceRoleSchema
  })
  .strict();
