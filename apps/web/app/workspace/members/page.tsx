"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Copy,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from "lucide-react";

type WorkspaceRole =
  | "owner"
  | "admin"
  | "accountant"
  | "developer"
  | "reviewer"
  | "viewer";

type WorkspaceMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: WorkspaceRole;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

type WorkspaceInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: WorkspaceRole;
  tokenPrefix: string;
  status: WorkspaceInvitationStatus;
  invitedBy: string | null;
  acceptedBy: string | null;
  revokedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: WorkspaceRole;
  userId: string;
  userEmail: string;
  permissions: {
    canManageMembers: boolean;
    canManageInvitations: boolean;
    canManageWorkspaceSettings: boolean;
    canManagePrivacy: boolean;
    canManageApiKeys: boolean;
    canViewActivity: boolean;
  };
};

type CreatedInvitation = {
  invitation: WorkspaceInvitation;
  token: string;
  inviteUrl: string;
  warning: string;
};

const roleOptions: {
  value: WorkspaceRole;
  label: string;
  description: string;
}[] = [
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only report and draft visibility where allowed."
  },
  {
    value: "reviewer",
    label: "Reviewer",
    description: "Review-oriented invoice and validation work."
  },
  {
    value: "accountant",
    label: "Accountant",
    description: "Invoice draft, validation, and export work."
  },
  {
    value: "developer",
    label: "Developer",
    description: "API keys, request logs, and developer diagnostics."
  },
  {
    value: "admin",
    label: "Admin",
    description: "Broad workspace management without owner handoff."
  },
  {
    value: "owner",
    label: "Owner",
    description: "Full workspace control with last-owner protection."
  }
];

const defaultInviteForm = {
  email: "",
  role: "viewer" as WorkspaceRole
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readNullableStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "accountant" ||
    value === "developer" ||
    value === "reviewer" ||
    value === "viewer"
  );
}

function normalizeRole(value: unknown): WorkspaceRole {
  return isWorkspaceRole(value) ? value : "viewer";
}

function normalizeStatus(value: unknown): WorkspaceInvitationStatus {
  if (value === "accepted" || value === "revoked" || value === "expired") {
    return value;
  }

  return "pending";
}

function normalizeWorkspaceContext(value: unknown): WorkspaceContext | null {
  if (!isPlainObject(value) || !isPlainObject(value.workspace)) {
    return null;
  }

  const workspace = value.workspace;
  const permissions = isPlainObject(workspace.permissions)
    ? workspace.permissions
    : {};
  const organizationId = readStringField(workspace, "organizationId");
  const organizationName = readStringField(workspace, "organizationName");
  const organizationSlug = readStringField(workspace, "organizationSlug");
  const userId = readStringField(workspace, "userId");
  const userEmail = readStringField(workspace, "userEmail");

  if (!organizationId || !organizationName || !organizationSlug || !userId) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    role: normalizeRole(workspace.role),
    userId,
    userEmail,
    permissions: {
      canManageMembers: permissions.canManageMembers === true,
      canManageInvitations: permissions.canManageInvitations === true,
      canManageWorkspaceSettings: permissions.canManageWorkspaceSettings === true,
      canManagePrivacy: permissions.canManagePrivacy === true,
      canManageApiKeys: permissions.canManageApiKeys === true,
      canViewActivity: permissions.canViewActivity === true
    }
  };
}

function normalizeMember(value: unknown): WorkspaceMember | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const organizationId = readStringField(value, "organizationId");
  const userId = readStringField(value, "userId");
  const createdAt = readStringField(value, "createdAt");
  const updatedAt = readStringField(value, "updatedAt");

  if (!id || !organizationId || !userId || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    organizationId,
    userId,
    role: normalizeRole(value.role),
    email: readNullableStringField(value, "email"),
    displayName: readNullableStringField(value, "displayName"),
    createdAt,
    updatedAt
  };
}

function normalizeInvitation(value: unknown): WorkspaceInvitation | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = readStringField(value, "id");
  const organizationId = readStringField(value, "organizationId");
  const email = readStringField(value, "email");
  const tokenPrefix = readStringField(value, "tokenPrefix");
  const expiresAt = readStringField(value, "expiresAt");
  const createdAt = readStringField(value, "createdAt");
  const updatedAt = readStringField(value, "updatedAt");

  if (
    !id ||
    !organizationId ||
    !email ||
    !tokenPrefix ||
    !expiresAt ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    organizationId,
    email,
    role: normalizeRole(value.role),
    tokenPrefix,
    status: normalizeStatus(value.status),
    invitedBy: readNullableStringField(value, "invitedBy"),
    acceptedBy: readNullableStringField(value, "acceptedBy"),
    revokedBy: readNullableStringField(value, "revokedBy"),
    expiresAt,
    acceptedAt: readNullableStringField(value, "acceptedAt"),
    revokedAt: readNullableStringField(value, "revokedAt"),
    createdAt,
    updatedAt
  };
}

function getRecords(data: unknown) {
  if (!isPlainObject(data) || !Array.isArray(data.records)) {
    return [];
  }

  return data.records;
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) {
    return data.slice(0, 240);
  }

  if (!isPlainObject(data) || !isPlainObject(data.error)) {
    return fallback;
  }

  const message = data.error.message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatRole(role: WorkspaceRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function formatStatus(status: WorkspaceInvitationStatus) {
  return status.replaceAll("_", " ");
}

export default function WorkspaceMembersPage() {
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteForm, setInviteForm] = useState(defaultInviteForm);
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedInvitation | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [revokingInvitationId, setRevokingInvitationId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const canManageMembers = workspace?.permissions.canManageMembers === true;

  const sortedInvitations = useMemo(() => {
    return [...invitations].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }, [invitations]);

  const loadWorkspaceManagement = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const contextResponse = await fetch("/api/local/workspace/me", {
        method: "GET",
        cache: "no-store"
      });
      const contextData = await readResponseBody(contextResponse);

      if (!contextResponse.ok) {
        setWorkspace(null);
        setMembers([]);
        setInvitations([]);
        setMessage(
          getApiErrorMessage(contextData, "Workspace context is unavailable.")
        );
        return;
      }

      const nextWorkspace = normalizeWorkspaceContext(contextData);

      setWorkspace(nextWorkspace);

      if (!nextWorkspace?.permissions.canManageMembers) {
        setMembers([]);
        setInvitations([]);
        setMessage("Workspace member management is available to owners and admins.");
        return;
      }

      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch("/api/local/workspace/members", {
          method: "GET",
          cache: "no-store"
        }),
        fetch("/api/local/workspace/invitations", {
          method: "GET",
          cache: "no-store"
        })
      ]);

      const membersData = await readResponseBody(membersResponse);
      const invitationsData = await readResponseBody(invitationsResponse);
      const messages: string[] = [];

      if (membersResponse.ok) {
        setMembers(
          getRecords(membersData)
            .map((record) => normalizeMember(record))
            .filter((record): record is WorkspaceMember => record !== null)
        );
      } else {
        setMembers([]);
        messages.push(
          getApiErrorMessage(membersData, "Workspace members are unavailable.")
        );
      }

      if (invitationsResponse.ok) {
        setInvitations(
          getRecords(invitationsData)
            .map((record) => normalizeInvitation(record))
            .filter((record): record is WorkspaceInvitation => record !== null)
        );
      } else {
        setInvitations([]);
        messages.push(
          getApiErrorMessage(
            invitationsData,
            "Workspace invitations are unavailable."
          )
        );
      }

      setMessage(messages.join(" "));
    } catch {
      setWorkspace(null);
      setMembers([]);
      setInvitations([]);
      setMessage("Workspace management could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceManagement();
  }, [loadWorkspaceManagement]);

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmittingInvite(true);
    setMessage("");
    setCreatedInvitation(null);
    setCopyMessage("");

    try {
      const response = await fetch("/api/local/workspace/invitations", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(inviteForm)
      });
      const data = await readResponseBody(response);

      if (!response.ok || !isPlainObject(data)) {
        setMessage(getApiErrorMessage(data, "Could not create invitation."));
        return;
      }

      const invitation = normalizeInvitation(data.invitation);
      const token = readStringField(data, "token");
      const inviteUrl = readStringField(data, "inviteUrl");
      const warning = readStringField(data, "warning");

      if (!invitation || !token || !inviteUrl) {
        setMessage("Invitation response was incomplete.");
        return;
      }

      setCreatedInvitation({
        invitation,
        token,
        inviteUrl,
        warning
      });
      setInviteForm(defaultInviteForm);
      await loadWorkspaceManagement();
    } catch {
      setMessage("Could not create invitation.");
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  async function updateMemberRole(member: WorkspaceMember, role: WorkspaceRole) {
    setUpdatingMemberId(member.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/members/${encodeURIComponent(member.id)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            role
          })
        }
      );
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not update member role."));
        return;
      }

      await loadWorkspaceManagement();
    } catch {
      setMessage("Could not update member role.");
    } finally {
      setUpdatingMemberId("");
    }
  }

  async function removeMember(member: WorkspaceMember) {
    setRemovingMemberId(member.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/members/${encodeURIComponent(member.id)}`,
        {
          method: "DELETE"
        }
      );
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not remove member."));
        return;
      }

      await loadWorkspaceManagement();
    } catch {
      setMessage("Could not remove member.");
    } finally {
      setRemovingMemberId("");
    }
  }

  async function revokeInvitation(invitation: WorkspaceInvitation) {
    setRevokingInvitationId(invitation.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/local/workspace/invitations/${encodeURIComponent(
          invitation.id
        )}/revoke`,
        {
          method: "POST"
        }
      );
      const data = await readResponseBody(response);

      if (!response.ok) {
        setMessage(getApiErrorMessage(data, "Could not revoke invitation."));
        return;
      }

      await loadWorkspaceManagement();
    } catch {
      setMessage("Could not revoke invitation.");
    } finally {
      setRevokingInvitationId("");
    }
  }

  async function copyInviteLink() {
    if (!createdInvitation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdInvitation.inviteUrl);
      setCopyMessage("Invite link copied.");
    } catch {
      setCopyMessage("Copy failed. Select the link text manually.");
    }
  }

  return (
    <div className="workspace-page">
      <section className="workspace-page-head">
        <p className="workspace-kicker">Members and invitations</p>
        <h2>Control workspace access before invoice lifecycle work expands.</h2>
        <p>
          Workspace access controls protect organization data. Roles define who
          can validate, manage API keys, view logs, manage privacy settings, or
          administer member access.
        </p>
      </section>

      <section className="workspace-data-grid workspace-member-summary">
        <div className="workspace-data-card">
          <p>Current role</p>
          <strong>{workspace ? formatRole(workspace.role) : "Unavailable"}</strong>
          <span>{workspace?.userEmail || "Signed-user context required."}</span>
        </div>
        <div className="workspace-data-card is-good">
          <p>Members</p>
          <strong>{isLoading ? "Loading" : members.length}</strong>
          <span>Tenant-scoped organization memberships.</span>
        </div>
        <div className="workspace-data-card is-warn">
          <p>Pending invites</p>
          <strong>
            {isLoading
              ? "Loading"
              : invitations.filter((invite) => invite.status === "pending").length}
          </strong>
          <span>Raw invite tokens are shown once and never stored.</span>
        </div>
      </section>

      {message ? (
        <section className="workspace-alerts">
          <div className="alert-item">
            <span />
            <p>{message}</p>
          </div>
        </section>
      ) : null}

      {canManageMembers ? (
        <section className="workspace-table-shell">
          <div className="workspace-table-head">
            <div>
              <p>Invite</p>
              <h3>Create a workspace invitation</h3>
            </div>
            <button
              type="button"
              onClick={() => void loadWorkspaceManagement()}
              disabled={isLoading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <form className="workspace-form-grid" onSubmit={submitInvitation}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={inviteForm.email}
                autoComplete="email"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setInviteForm((current) => ({
                    ...current,
                    email: event.target.value
                  }))
                }
                placeholder="member@example.com"
                required
              />
            </label>

            <label>
              <span>Role</span>
              <select
                value={inviteForm.role}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: normalizeRole(event.target.value)
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option value={role.value} key={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="workspace-auth-action"
              disabled={isSubmittingInvite}
            >
              <UserPlus size={16} />
              {isSubmittingInvite ? "Creating" : "Invite member"}
            </button>
          </form>

          <div className="workspace-role-guide">
            {roleOptions.map((role) => (
              <div key={role.value}>
                <strong>{role.label}</strong>
                <span>{role.description}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="workspace-alerts">
          <div className="alerts-head">
            <LockKeyhole size={22} />
            <div>
              <p>Access restricted</p>
              <h3>Owner or admin required</h3>
            </div>
          </div>
          <div className="alert-list">
            <div className="alert-item">
              <span />
              <p>
                Member and invitation management is restricted to workspace
                owners and admins. Other roles keep their existing validation,
                developer, privacy, and read-only boundaries.
              </p>
            </div>
          </div>
        </section>
      )}

      {createdInvitation ? (
        <section className="developer-console workspace-invite-result">
          <div className="developer-console-head">
            <div>
              <p>One-time invitation link</p>
              <h3>{createdInvitation.invitation.email}</h3>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <p className="workspace-muted-copy">
            {createdInvitation.warning ||
              "Invoice Lantern stores only a token hash and cannot show this token again."}
          </p>
          <pre>{createdInvitation.inviteUrl}</pre>
          <div className="workspace-row-actions">
            <button type="button" onClick={() => void copyInviteLink()}>
              <Copy size={16} />
              Copy link
            </button>
            {copyMessage ? <span className="api-key-safe-label">{copyMessage}</span> : null}
          </div>
        </section>
      ) : null}

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Members</p>
            <h3>Workspace member roles</h3>
          </div>
          <UsersRound size={20} />
        </div>

        <div className="workspace-member-list">
          {isLoading ? (
            <article className="workspace-member-row">
              <div>
                <strong>Loading members</strong>
                <span>Reading workspace memberships.</span>
              </div>
            </article>
          ) : members.length === 0 ? (
            <article className="workspace-member-row">
              <div>
                <strong>No members available</strong>
                <span>Member listing requires owner or admin access.</span>
              </div>
            </article>
          ) : (
            members.map((member) => (
              <article className="workspace-member-row" key={member.id}>
                <div>
                  <strong>
                    {member.email || member.userId}
                    {member.userId === workspace?.userId ? " (you)" : ""}
                  </strong>
                  <span>
                    Added {formatDateTime(member.createdAt)}. Updated{" "}
                    {formatDateTime(member.updatedAt)}.
                  </span>
                </div>

                <span className="status-pill">{formatRole(member.role)}</span>

                <select
                  value={member.role}
                  disabled={!canManageMembers || updatingMemberId === member.id}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void updateMemberRole(member, normalizeRole(event.target.value))
                  }
                  aria-label={`Role for ${member.email || member.userId}`}
                >
                  {roleOptions.map((role) => (
                    <option value={role.value} key={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="text-link-button"
                  onClick={() => void removeMember(member)}
                  disabled={!canManageMembers || removingMemberId === member.id}
                >
                  <Trash2 size={16} />
                  {removingMemberId === member.id ? "Removing" : "Remove"}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-table-shell">
        <div className="workspace-table-head">
          <div>
            <p>Invitations</p>
            <h3>Pending and recent invites</h3>
          </div>
          <Mail size={20} />
        </div>

        <div className="workspace-member-list">
          {isLoading ? (
            <article className="workspace-member-row">
              <div>
                <strong>Loading invitations</strong>
                <span>Reading invite metadata.</span>
              </div>
            </article>
          ) : sortedInvitations.length === 0 ? (
            <article className="workspace-member-row">
              <div>
                <strong>No invitations</strong>
                <span>Create an invite to add another signed-in user.</span>
              </div>
            </article>
          ) : (
            sortedInvitations.map((invitation) => (
              <article className="workspace-member-row" key={invitation.id}>
                <div>
                  <strong>{invitation.email}</strong>
                  <span>
                    Token prefix {invitation.tokenPrefix}. Expires{" "}
                    {formatDateTime(invitation.expiresAt)}.
                  </span>
                </div>

                <span className="status-pill">{formatStatus(invitation.status)}</span>
                <span>{formatRole(invitation.role)}</span>

                {invitation.status === "pending" ? (
                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => void revokeInvitation(invitation)}
                    disabled={
                      !canManageMembers ||
                      revokingInvitationId === invitation.id
                    }
                  >
                    <Ban size={16} />
                    {revokingInvitationId === invitation.id
                      ? "Revoking"
                      : "Revoke"}
                  </button>
                ) : (
                  <span className="api-key-safe-label">
                    <ShieldCheck size={16} />
                    Closed
                  </span>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-alerts">
        <div className="alerts-head">
          <AlertTriangle size={22} />
          <div>
            <p>Security boundary</p>
            <h3>Signed-user management only</h3>
          </div>
        </div>
        <div className="alert-list">
          <div className="alert-item">
            <span />
            <p>
              Organization API keys are rejected for member and invitation
              management. Invite acceptance requires a signed-in user whose
              email matches the invitation.
            </p>
          </div>
          <div className="alert-item">
            <span />
            <p>
              Last-owner protection blocks removing or demoting the final owner.
              Activity and security events record membership-sensitive changes
              without storing raw invite tokens.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
