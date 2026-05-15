import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleClient,
  getSupabaseUserClient,
  hasSupabaseServerConfig
} from "../lib/supabase/server-client.js";
import {
  getPublishedLegalDocument,
  legalDocumentRegistry,
  listPublishedLegalDocuments,
  type LegalDocumentDefinition
} from "../legal/legal-document-registry.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";

export type LegalAcceptanceContext =
  | "workspace"
  | "developer"
  | "api_terms"
  | "webhook"
  | "privacy"
  | "public"
  | "country_pack";

export type LegalDocumentAcceptanceRecord = {
  id: string;
  organizationId: string | null;
  userId: string;
  legalDocumentId: string;
  legalDocumentVersionId: string;
  documentKey: string;
  title: string;
  version: string;
  acceptedAt: string;
  acceptanceContext: LegalAcceptanceContext;
  ipHash: string | null;
  userAgentHash: string | null;
  metadata: Record<string, unknown>;
};

export type LegalAcceptanceCreateInput = {
  userId: string;
  accessToken: string;
  documentKey: string;
  acceptanceContext: LegalAcceptanceContext;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type LegalAcceptanceListContext = {
  userId: string;
  accessToken: string;
};

export type LegalWorkspaceAcceptanceContext = {
  userId: string;
  accessToken: string;
};

type SupabaseWorkspaceBootstrapRecord = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
  userEmail: string;
};

type SupabaseLegalDocumentRow = {
  id: string;
  document_key: string;
  title: string;
  category: string;
  audience: string;
  status: string;
  is_required: boolean;
  requires_acceptance: boolean;
  legal_review_required: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseLegalDocumentVersionRow = {
  id: string;
  legal_document_id: string;
  version: string;
  status: string;
  title: string;
  summary: string | null;
  body_md: string;
  effective_from: string | null;
  effective_to: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  reviewer_label: string | null;
  source_refs: unknown;
  change_notes: string | null;
  legal_review_required: boolean;
  created_at: string;
  updated_at: string;
};

type SupabaseLegalAcceptanceRow = {
  id: string;
  organization_id: string | null;
  user_id: string;
  legal_document_id: string;
  legal_document_version_id: string;
  accepted_at: string;
  acceptance_context: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  metadata: unknown;
};

const LEGAL_ACCEPTANCES_FILE = "legal-document-acceptances.json";
const LEGAL_ACCEPTANCE_SELECT_FIELDS =
  "id, organization_id, user_id, legal_document_id, legal_document_version_id, accepted_at, acceptance_context, ip_hash, user_agent_hash, metadata";
const LEGAL_DOCUMENT_SELECT_FIELDS =
  "id, document_key, title, category, audience, status, is_required, requires_acceptance, legal_review_required, current_version_id, created_at, updated_at";
const LEGAL_DOCUMENT_VERSION_SELECT_FIELDS =
  "id, legal_document_id, version, status, title, summary, body_md, effective_from, effective_to, published_at, reviewed_at, reviewer_label, source_refs, change_notes, legal_review_required, created_at, updated_at";

const storageProvider = getCollectionStorageProvider();

export class LegalDocumentRepositoryError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "LegalDocumentRepositoryError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function normalizeAcceptanceContext(value: string): LegalAcceptanceContext {
  if (
    value === "developer" ||
    value === "api_terms" ||
    value === "webhook" ||
    value === "privacy" ||
    value === "public" ||
    value === "country_pack"
  ) {
    return value;
  }

  return "workspace";
}

function hashOptionalValue(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  return createHash("sha256").update(trimmedValue, "utf8").digest("hex");
}

function normalizeWorkspaceBootstrapRecord(
  value: unknown
): SupabaseWorkspaceBootstrapRecord | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const organizationId = readStringField(value, "organization_id");
  const organizationName = readStringField(value, "organization_name");
  const organizationSlug = readStringField(value, "organization_slug");
  const membershipRole = readStringField(value, "membership_role", "viewer");
  const userEmail = readStringField(value, "user_email");

  if (!organizationId || !organizationName || !organizationSlug) {
    return null;
  }

  return {
    organizationId,
    organizationName,
    organizationSlug,
    membershipRole,
    userEmail
  };
}

function getRegistryDocumentId(document: LegalDocumentDefinition) {
  return `registry:${document.documentKey}`;
}

function getRegistryVersionId(document: LegalDocumentDefinition) {
  return `registry:${document.documentKey}:${document.version}`;
}

function getFallbackRegistryDocument() {
  const firstDocument = legalDocumentRegistry[0];

  if (!firstDocument) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_REGISTRY_EMPTY",
      "Legal document registry is empty.",
      500
    );
  }

  return firstDocument;
}

function findRegistryDocumentForAcceptanceRow(row: SupabaseLegalAcceptanceRow) {
  return (
    legalDocumentRegistry.find(
      (document) =>
        getRegistryDocumentId(document) === row.legal_document_id ||
        getRegistryVersionId(document) === row.legal_document_version_id ||
        row.legal_document_version_id.endsWith(
          `${document.documentKey}:${document.version}`
        )
    ) ?? getFallbackRegistryDocument()
  );
}

function buildRegistryAcceptanceRecord(input: {
  document: LegalDocumentDefinition;
  userId: string;
  organizationId: string | null;
  acceptanceContext: LegalAcceptanceContext;
  ipHash: string | null;
  userAgentHash: string | null;
  metadata: Record<string, unknown>;
}) {
  return {
    id: `legal_acceptance_${randomUUID()}`,
    organizationId: input.organizationId,
    userId: input.userId,
    legalDocumentId: getRegistryDocumentId(input.document),
    legalDocumentVersionId: getRegistryVersionId(input.document),
    documentKey: input.document.documentKey,
    title: input.document.title,
    version: input.document.version,
    acceptedAt: new Date().toISOString(),
    acceptanceContext: input.acceptanceContext,
    ipHash: input.ipHash,
    userAgentHash: input.userAgentHash,
    metadata: input.metadata
  } satisfies LegalDocumentAcceptanceRecord;
}

function normalizeSupabaseAcceptanceRow(
  row: SupabaseLegalAcceptanceRow,
  document: LegalDocumentDefinition
): LegalDocumentAcceptanceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    legalDocumentId: row.legal_document_id,
    legalDocumentVersionId: row.legal_document_version_id,
    documentKey: document.documentKey,
    title: document.title,
    version: document.version,
    acceptedAt: row.accepted_at,
    acceptanceContext: normalizeAcceptanceContext(row.acceptance_context),
    ipHash: row.ip_hash,
    userAgentHash: row.user_agent_hash,
    metadata: normalizeMetadata(row.metadata)
  };
}

function toLegalDocumentDefinition(
  documentRow: SupabaseLegalDocumentRow,
  versionRow: SupabaseLegalDocumentVersionRow
): LegalDocumentDefinition {
  const registryFallback = getPublishedLegalDocument(documentRow.document_key);

  return {
    documentKey: documentRow.document_key,
    title: versionRow.title || documentRow.title,
    category:
      registryFallback?.category ??
      (documentRow.category as LegalDocumentDefinition["category"]),
    audience:
      registryFallback?.audience ??
      (documentRow.audience as LegalDocumentDefinition["audience"]),
    status: "published",
    version: versionRow.version,
    effectiveFrom: versionRow.effective_from ?? "",
    reviewedAt: versionRow.reviewed_at,
    reviewerLabel:
      versionRow.reviewer_label ?? "Professional legal review required",
    isRequired: documentRow.is_required,
    requiresAcceptance: documentRow.requires_acceptance,
    legalReviewRequired: versionRow.legal_review_required,
    professionalReviewRequired: versionRow.legal_review_required,
    summary: versionRow.summary ?? registryFallback?.summary ?? "",
    bodyMd: versionRow.body_md,
    sourceRefs: Array.isArray(versionRow.source_refs)
      ? (versionRow.source_refs as LegalDocumentDefinition["sourceRefs"])
      : (registryFallback?.sourceRefs ?? []),
    changeNotes: versionRow.change_notes ?? registryFallback?.changeNotes ?? "",
    disclaimers: registryFallback?.disclaimers ?? [
      "This document is a product policy draft and is not legal advice.",
      "Professional review is required before public launch."
    ]
  };
}

function isDuplicateAcceptanceError(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "23505" ||
    (error.message ?? "").toLowerCase().includes("duplicate")
  );
}

async function getWorkspaceForAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bootstrap_personal_workspace");

  if (error) {
    throw new LegalDocumentRepositoryError(
      "WORKSPACE_CONTEXT_UNAVAILABLE",
      `Workspace bootstrap failed: ${error.message}`,
      503
    );
  }

  const firstRecord = Array.isArray(data) ? data[0] : data;
  const workspace = normalizeWorkspaceBootstrapRecord(firstRecord);

  if (!workspace) {
    throw new LegalDocumentRepositoryError(
      "WORKSPACE_CONTEXT_REQUIRED",
      "Workspace bootstrap returned an unreadable record.",
      409
    );
  }

  return workspace;
}

async function readPublishedDocumentFromSupabase(documentKey: string) {
  if (!hasSupabaseServerConfig()) {
    return null;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: documentData, error: documentError } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT_FIELDS)
    .eq("document_key", documentKey)
    .eq("status", "published")
    .maybeSingle();

  if (documentError) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_READ_FAILED",
      `Could not read legal document: ${documentError.message}`,
      500
    );
  }

  if (!documentData) {
    return null;
  }

  const documentRow = documentData as SupabaseLegalDocumentRow;
  const versionRow = await resolvePublishedVersionForDocument({
    supabase,
    documentRow,
    versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_READ_FAILED"
  });

  if (!versionRow) {
    return null;
  }

  return toLegalDocumentDefinition(documentRow, versionRow);
}

async function readCurrentPublishedVersionForDocument(input: {
  supabase: SupabaseClient;
  documentRow: SupabaseLegalDocumentRow;
  versionReadFailureCode: string;
}) {
  if (!input.documentRow.current_version_id) {
    return null;
  }

  const { data, error } = await input.supabase
    .from("legal_document_versions")
    .select(LEGAL_DOCUMENT_VERSION_SELECT_FIELDS)
    .eq("legal_document_id", input.documentRow.id)
    .eq("status", "published")
    .eq("id", input.documentRow.current_version_id)
    .maybeSingle();

  if (error) {
    throw new LegalDocumentRepositoryError(
      input.versionReadFailureCode,
      "Could not read the published legal document version.",
      500
    );
  }

  return data ? (data as SupabaseLegalDocumentVersionRow) : null;
}

async function readLatestPublishedVersionForDocument(input: {
  supabase: SupabaseClient;
  documentRow: SupabaseLegalDocumentRow;
  versionReadFailureCode: string;
}) {
  const { data, error } = await input.supabase
    .from("legal_document_versions")
    .select(LEGAL_DOCUMENT_VERSION_SELECT_FIELDS)
    .eq("legal_document_id", input.documentRow.id)
    .eq("status", "published")
    .order("published_at", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    })
    .limit(1);

  if (error) {
    throw new LegalDocumentRepositoryError(
      input.versionReadFailureCode,
      "Could not read the latest published legal document version.",
      500
    );
  }

  return ((data ?? []) as SupabaseLegalDocumentVersionRow[])[0] ?? null;
}

export async function resolvePublishedVersionForDocument(input: {
  supabase: SupabaseClient;
  documentRow: SupabaseLegalDocumentRow;
  versionReadFailureCode: string;
}) {
  return (
    (await readCurrentPublishedVersionForDocument(input)) ??
    (await readLatestPublishedVersionForDocument(input))
  );
}

async function listPublishedDocumentsFromSupabase() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: documentData, error: documentError } = await supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT_FIELDS)
    .eq("status", "published")
    .order("title", {
      ascending: true
    });

  if (documentError) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_LIST_FAILED",
      `Could not list legal documents: ${documentError.message}`,
      500
    );
  }

  const documentRows = (documentData ?? []) as SupabaseLegalDocumentRow[];
  const documents: LegalDocumentDefinition[] = [];

  for (const documentRow of documentRows) {
    const versionRow = await resolvePublishedVersionForDocument({
      supabase,
      documentRow,
      versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_LIST_FAILED"
    });

    if (versionRow) {
      documents.push(toLegalDocumentDefinition(documentRow, versionRow));
    }
  }

  return documents.sort((first, second) =>
    first.title.localeCompare(second.title)
  );
}

async function resolveSupabasePublishedDocument(input: {
  supabase: SupabaseClient;
  documentKey: string;
}) {
  const { data: documentData, error: documentError } = await input.supabase
    .from("legal_documents")
    .select(LEGAL_DOCUMENT_SELECT_FIELDS)
    .eq("document_key", input.documentKey)
    .eq("status", "published")
    .maybeSingle();

  if (documentError) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_READ_FAILED",
      `Could not read legal document: ${documentError.message}`,
      500
    );
  }

  if (!documentData) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_NOT_FOUND",
      "Legal document was not found or is not published.",
      404
    );
  }

  const documentRow = documentData as SupabaseLegalDocumentRow;
  const versionRow = await resolvePublishedVersionForDocument({
    supabase: input.supabase,
    documentRow,
    versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_READ_FAILED"
  });

  if (!versionRow) {
    throw new LegalDocumentRepositoryError(
      "VERSION_NOT_PUBLISHED",
      "No published legal document version is available for this document.",
      409
    );
  }

  return {
    documentRow,
    versionRow,
    document: toLegalDocumentDefinition(
      documentRow,
      versionRow
    )
  };
}

async function readExistingSupabaseAcceptance(input: {
  supabase: SupabaseClient;
  userId: string;
  legalDocumentVersionId: string;
  acceptanceContext: LegalAcceptanceContext;
}) {
  /*
   * Match the database unique constraint exactly:
   * unique (user_id, legal_document_version_id, acceptance_context)
   *
   * Do not filter by organization_id here. Older or conflicting records may
   * already exist with a different organization_id/null value, while the unique
   * constraint still blocks a second acceptance for the same user/version/context.
   */
  const { data, error } = await input.supabase
    .from("legal_document_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .eq("user_id", input.userId)
    .eq("legal_document_version_id", input.legalDocumentVersionId)
    .eq("acceptance_context", input.acceptanceContext)
    .order("accepted_at", {
      ascending: false
    })
    .limit(1);

  if (error) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_ACCEPTANCE_READ_FAILED",
      `Could not read legal document acceptance: ${error.message}`,
      500
    );
  }

  return ((data ?? []) as SupabaseLegalAcceptanceRow[])[0] ?? null;
}

async function normalizeSupabaseAcceptanceRowsWithDocuments(
  supabase: SupabaseClient,
  rows: SupabaseLegalAcceptanceRow[]
) {
  if (!rows.length) {
    return [];
  }

  const legalDocumentIds = Array.from(
    new Set(rows.map((row) => row.legal_document_id).filter(Boolean))
  );
  const legalDocumentVersionIds = Array.from(
    new Set(rows.map((row) => row.legal_document_version_id).filter(Boolean))
  );

  const documentRowsById = new Map<string, SupabaseLegalDocumentRow>();
  const versionRowsById = new Map<string, SupabaseLegalDocumentVersionRow>();

  if (legalDocumentIds.length) {
    const { data, error } = await supabase
      .from("legal_documents")
      .select(LEGAL_DOCUMENT_SELECT_FIELDS)
      .in("id", legalDocumentIds);

    if (error) {
      throw new LegalDocumentRepositoryError(
        "LEGAL_ACCEPTANCE_DOCUMENT_HYDRATION_FAILED",
        `Could not hydrate legal acceptance documents: ${error.message}`,
        500
      );
    }

    for (const row of (data ?? []) as SupabaseLegalDocumentRow[]) {
      documentRowsById.set(row.id, row);
    }
  }

  if (legalDocumentVersionIds.length) {
    const { data, error } = await supabase
      .from("legal_document_versions")
      .select(LEGAL_DOCUMENT_VERSION_SELECT_FIELDS)
      .in("id", legalDocumentVersionIds);

    if (error) {
      throw new LegalDocumentRepositoryError(
        "LEGAL_ACCEPTANCE_VERSION_HYDRATION_FAILED",
        `Could not hydrate legal acceptance versions: ${error.message}`,
        500
      );
    }

    for (const row of (data ?? []) as SupabaseLegalDocumentVersionRow[]) {
      versionRowsById.set(row.id, row);
    }
  }

  return rows.map((row) => {
    const documentRow = documentRowsById.get(row.legal_document_id);
    const versionRow = versionRowsById.get(row.legal_document_version_id);

    if (documentRow && versionRow) {
      return normalizeSupabaseAcceptanceRow(
        row,
        toLegalDocumentDefinition(documentRow, versionRow)
      );
    }

    return normalizeSupabaseAcceptanceRow(
      row,
      findRegistryDocumentForAcceptanceRow(row)
    );
  });
}

export async function listLegalDocuments() {
  if (!hasSupabaseServerConfig()) {
    return listPublishedLegalDocuments();
  }

  try {
    const documents = await listPublishedDocumentsFromSupabase();

    return documents.length > 0 ? documents : listPublishedLegalDocuments();
  } catch {
    return listPublishedLegalDocuments();
  }
}

export async function getLegalDocumentByKey(documentKey: string) {
  if (!hasSupabaseServerConfig()) {
    return getPublishedLegalDocument(documentKey);
  }

  try {
    return (
      (await readPublishedDocumentFromSupabase(documentKey)) ??
      getPublishedLegalDocument(documentKey)
    );
  } catch {
    return getPublishedLegalDocument(documentKey);
  }
}

export async function acceptLegalDocument(
  input: LegalAcceptanceCreateInput
): Promise<{
  record: LegalDocumentAcceptanceRecord;
  alreadyAccepted: boolean;
}> {
  const registryDocument = getPublishedLegalDocument(input.documentKey);

  if (!registryDocument && !hasSupabaseServerConfig()) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_NOT_FOUND",
      "Legal document was not found or is not published.",
      404
    );
  }

  const acceptanceContext = normalizeAcceptanceContext(input.acceptanceContext);
  const ipHash = hashOptionalValue(input.ipAddress);
  const userAgentHash = hashOptionalValue(input.userAgent);
  const metadata = normalizeMetadata(input.metadata);

  if (!hasSupabaseServerConfig()) {
    const document = registryDocument;

    if (!document) {
      throw new LegalDocumentRepositoryError(
        "LEGAL_DOCUMENT_NOT_FOUND",
        "Legal document was not found or is not published.",
        404
      );
    }

    const records =
      await storageProvider.readCollection<LegalDocumentAcceptanceRecord>(
        LEGAL_ACCEPTANCES_FILE
      );

    const existingRecord = records.find(
      (record) =>
        record.userId === input.userId &&
        record.documentKey === document.documentKey &&
        record.version === document.version &&
        record.acceptanceContext === acceptanceContext
    );

    if (existingRecord) {
      return {
        record: existingRecord,
        alreadyAccepted: true
      };
    }

    const record = buildRegistryAcceptanceRecord({
      document,
      userId: input.userId,
      organizationId: null,
      acceptanceContext,
      ipHash,
      userAgentHash,
      metadata
    });

    await storageProvider.writeCollection(LEGAL_ACCEPTANCES_FILE, [
      record,
      ...records
    ]);

    return {
      record,
      alreadyAccepted: false
    };
  }

  /*
   * Keep the signed-user client for authentication and workspace bootstrap.
   * Use the service-role client only after the signed user has been verified,
   * so the backend can perform the controlled insert without being blocked by
   * browser-facing RLS policies.
   */
  const userSupabase = getSupabaseUserClient(input.accessToken);
  const serviceSupabase = getSupabaseServiceRoleClient();
  const workspace = await getWorkspaceForAuthenticatedUser(userSupabase);
  const resolved = await resolveSupabasePublishedDocument({
    supabase: serviceSupabase,
    documentKey: input.documentKey
  });

  const existingRecord = await readExistingSupabaseAcceptance({
    supabase: serviceSupabase,
    userId: input.userId,
    legalDocumentVersionId: resolved.versionRow.id,
    acceptanceContext
  });

  if (existingRecord) {
    return {
      record: normalizeSupabaseAcceptanceRow(existingRecord, resolved.document),
      alreadyAccepted: true
    };
  }

  const insertValues = {
    organization_id: workspace.organizationId,
    user_id: input.userId,
    legal_document_id: resolved.documentRow.id,
    legal_document_version_id: resolved.versionRow.id,
    accepted_at: new Date().toISOString(),
    acceptance_context: acceptanceContext,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    metadata
  };

  const { data, error } = await serviceSupabase
    .from("legal_document_acceptances")
    .insert(insertValues)
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .single();

  if (error) {
    if (isDuplicateAcceptanceError(error)) {
      const duplicateRecord = await readExistingSupabaseAcceptance({
        supabase: serviceSupabase,
        userId: input.userId,
        legalDocumentVersionId: resolved.versionRow.id,
        acceptanceContext
      });

      if (duplicateRecord) {
        return {
          record: normalizeSupabaseAcceptanceRow(
            duplicateRecord,
            resolved.document
          ),
          alreadyAccepted: true
        };
      }
    }

    throw new LegalDocumentRepositoryError(
      "LEGAL_ACCEPTANCE_SAVE_FAILED",
      `Could not save legal document acceptance: ${error.message}`,
      500
    );
  }

  try {
    await serviceSupabase.from("legal_document_lifecycle_events").insert({
      legal_document_id: resolved.documentRow.id,
      legal_document_version_id: resolved.versionRow.id,
      actor_user_id: input.userId,
      event_type: "acceptance.recorded",
      metadata: {
        acceptanceContext,
        organizationId: workspace.organizationId,
        storesRawIpAddress: false,
        storesRawUserAgent: false,
        legalAdviceCreated: false,
        officialComplianceCreated: false
      }
    });
  } catch {
    /*
     * Acceptance persistence is the source of truth. Lifecycle logging can be
     * repaired separately if a deployment has not applied the additive table
     * yet or service-role logging is unavailable.
     */
  }

  return {
    record: normalizeSupabaseAcceptanceRow(
      data as SupabaseLegalAcceptanceRow,
      resolved.document
    ),
    alreadyAccepted: false
  };
}

export async function listMyLegalAcceptances(
  context: LegalAcceptanceListContext
) {
  if (!hasSupabaseServerConfig()) {
    const records =
      await storageProvider.readCollection<LegalDocumentAcceptanceRecord>(
        LEGAL_ACCEPTANCES_FILE
      );

    return records
      .filter((record) => record.userId === context.userId)
      .sort((first, second) => second.acceptedAt.localeCompare(first.acceptedAt));
  }

  const serviceSupabase = getSupabaseServiceRoleClient();

  /*
   * Legal acceptance is user/version/context-level in migration 040, not
   * workspace-level. Filtering by organization_id can hide already recorded
   * acceptances and make the UI ask for documents again.
   */
  const { data, error } = await serviceSupabase
    .from("legal_document_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .eq("user_id", context.userId)
    .order("accepted_at", {
      ascending: false
    });

  if (error) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_ACCEPTANCE_LIST_FAILED",
      `Could not list legal acceptances: ${error.message}`,
      500
    );
  }

  return normalizeSupabaseAcceptanceRowsWithDocuments(
    serviceSupabase,
    (data ?? []) as SupabaseLegalAcceptanceRow[]
  );
}

export async function listWorkspaceLegalAcceptances(
  context: LegalWorkspaceAcceptanceContext
) {
  if (!hasSupabaseServerConfig()) {
    const records =
      await storageProvider.readCollection<LegalDocumentAcceptanceRecord>(
        LEGAL_ACCEPTANCES_FILE
      );

    return records.sort((first, second) =>
      second.acceptedAt.localeCompare(first.acceptedAt)
    );
  }

  const userSupabase = getSupabaseUserClient(context.accessToken);
  const serviceSupabase = getSupabaseServiceRoleClient();
  const workspace = await getWorkspaceForAuthenticatedUser(userSupabase);

  const { data, error } = await serviceSupabase
    .from("legal_document_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .eq("organization_id", workspace.organizationId)
    .order("accepted_at", {
      ascending: false
    });

  if (error) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_WORKSPACE_ACCEPTANCE_LIST_FAILED",
      `Could not list workspace legal acceptances: ${error.message}`,
      500
    );
  }

  return normalizeSupabaseAcceptanceRowsWithDocuments(
    serviceSupabase,
    (data ?? []) as SupabaseLegalAcceptanceRow[]
  );
}
