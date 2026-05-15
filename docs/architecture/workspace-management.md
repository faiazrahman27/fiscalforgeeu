# Workspace Management

Invoice Lantern is an independent, educational, technical e-invoice validation
and ViDA-readiness sandbox. Workspace management protects tenant data and
operator access, but it does not make validation results official, certified,
legally valid, tax compliant, accounting advice, or accepted by any authority.

## Scope

Step 4 completes the organization member and invitation management layer needed
before the canonical invoice lifecycle work begins. It does not add email
delivery, billing, platform-admin tooling, full invoice lifecycle state
transitions, UBL expansion, VIES, real Schematron execution, expanded country
packs, webhooks, monitoring, or official filing behavior. Technical CII XML
support is added later through canonical invoice mapping and remains sandbox
technical support only.

## Organization Model

The tenant boundary remains `organizations.id`. User membership is stored in
`organization_memberships`; every member operation reads or mutates rows by both
membership ID and `organization_id`. Workspace settings, activity, privacy,
retention, deletion, API-key, invoice draft, validation, XML, VAT, and
ViDA-simulation behavior remains separate and keeps its existing authorization
rules.

The web app obtains a signed-user workspace context from
`/api/v1/workspace/me`. The response contains only safe organization, role, and
permission summary fields. It does not expose service-role details, secrets, API
key hashes, private auth metadata, or backend credentials.

## Role Matrix

| Role | Workspace management behavior |
| --- | --- |
| `owner` | Can list members, create/revoke invitations, update member roles, remove members, and manage workspace settings. Last-owner protection prevents removing or demoting the final owner. |
| `admin` | Can list members, create/revoke invitations, update member roles, remove members, and manage workspace settings, subject to last-owner protection and self-escalation checks. |
| `accountant` | Cannot manage members or invitations. |
| `developer` | Cannot manage members or invitations. Developer API-key and request-log permissions remain separate. |
| `reviewer` | Cannot manage members or invitations. |
| `viewer` | Cannot manage members or invitations. |

Member management routes require signed-in Supabase users. Organization API keys
are rejected even if they are valid for other technical API operations.

## Member Lifecycle

Owners and admins can list workspace members. Responses include membership ID,
role, creation/update timestamps, and safe user identity fields when available.
They do not include private auth metadata.

Owners and admins can update roles for members in the same organization. The
service rejects invalid roles, cross-organization membership IDs, attempts to
demote the last owner, and self-escalation to a more privileged role.

Owners and admins can remove members in the same organization. The service and
database trigger both prevent removing the last owner from a workspace.

## Invitation Lifecycle

Owners and admins can create invitations for normalized lowercase email
addresses and one of the existing workspace roles:

- `owner`
- `admin`
- `accountant`
- `developer`
- `reviewer`
- `viewer`

Invitations expire by default after seven days. The API enforces one pending
invite per organization/email pair and returns a conflict for duplicate pending
invitations.

No email provider is integrated in Step 4. The create response returns a manual
invite token and URL once for sharing outside the platform. List responses never
return raw invite tokens or token hashes.

Invite acceptance requires a signed-in user whose authenticated email matches
the invite email case-insensitively. Pending, unexpired invites can be accepted
once. Revoked, expired, accepted, replayed, or email-mismatched tokens are
rejected.

## Token Storage

Raw invite tokens are generated with Node crypto secure randomness. The database
stores only a SHA-256 token hash and a short token prefix for safe support
display. Raw tokens are not stored, logged, listed, or returned after creation.

## Database Backstops

Migration `035_create_workspace_member_invitations.sql` adds
`workspace_member_invitations` with RLS enabled. Owner/admin policies allow
workspace managers to create, list, and revoke invites. A matching-email invitee
policy allows an authenticated user to read and accept only their own pending
unexpired invitation. Authenticated column grants exclude `token_hash`.

The same migration updates `organization_memberships` policies so owner/admin
workspace managers can manage memberships, while preserving workspace bootstrap.
It also adds a trigger that prevents deleting or demoting the final owner.

## Tenant Isolation

Every repository operation that lists, reads, updates, revokes, or removes
tenant-owned membership data includes `organization_id`. Object-oriented
cross-organization attempts return not found or conflict-style errors without
leaking another workspace's records.

## Activity And Security Events

Workspace activity events are written for:

- member invitations created;
- invitations revoked;
- invitations accepted;
- member roles changed;
- members removed.

Security events are written for security-sensitive invite and membership blocks
where practical, including invalid token attempts, expired/replayed invites,
email mismatch, self-escalation blocks, and last-owner protection blocks. Event
metadata must not contain raw tokens, API secrets, request bodies, private auth
metadata, or provider credentials.

## Remaining Work For Step 5

Step 5 should build on this tenant and role foundation to implement the
canonical invoice lifecycle. It should not rely on invite tokens or member UI
state for invoice truth, and it should continue using canonical invoice data,
decimal-string money logic, organization ownership checks, source-linked
technical validation language, and non-official disclaimers.
