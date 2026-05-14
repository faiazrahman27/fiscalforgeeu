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
  const { data: versionData, error: versionError } = await supabase
    .from("legal_document_versions")
    .select(LEGAL_DOCUMENT_VERSION_SELECT_FIELDS)
    .eq("legal_document_id", documentRow.id)
    .eq("status", "published")
    .eq("id", documentRow.current_version_id)
    .maybeSingle();

  if (versionError) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_VERSION_READ_FAILED",
      `Could not read legal document version: ${versionError.message}`,
      500
    );
  }

  if (!versionData) {
    return null;
  }

  return toLegalDocumentDefinition(
    documentRow,
    versionData as SupabaseLegalDocumentVersionRow
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
  const { data: versionData, error: versionError } = await input.supabase
    .from("legal_document_versions")
    .select(LEGAL_DOCUMENT_VERSION_SELECT_FIELDS)
    .eq("legal_document_id", documentRow.id)
    .eq("status", "published")
    .eq("id", documentRow.current_version_id)
    .maybeSingle();

  if (versionError) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_DOCUMENT_VERSION_READ_FAILED",
      `Could not read legal document version: ${versionError.message}`,
      500
    );
  }

  if (!versionData) {
    throw new LegalDocumentRepositoryError(
      "VERSION_NOT_PUBLISHED",
      "The latest legal document version is not published.",
      409
    );
  }

  return {
    documentRow,
    versionRow: versionData as SupabaseLegalDocumentVersionRow,
    document: toLegalDocumentDefinition(
      documentRow,
      versionData as SupabaseLegalDocumentVersionRow
    )
  };
}

export async function listLegalDocuments() {
  if (!hasSupabaseServerConfig()) {
    return listPublishedLegalDocuments();
  }

  try {
    const documents = await Promise.all(
      legalDocumentRegistry.map((document) =>
        readPublishedDocumentFromSupabase(document.documentKey)
      )
    );

    return documents
      .filter((document): document is LegalDocumentDefinition => document !== null)
      .sort((first, second) => first.title.localeCompare(second.title));
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
  const document = getPublishedLegalDocument(input.documentKey);

  if (!document) {
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

  const supabase = getSupabaseUserClient(input.accessToken);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const resolved = await resolveSupabasePublishedDocument({
    supabase,
    documentKey: input.documentKey
  });

  const insertValues = {
    organization_id: workspace.organizationId,
    user_id: input.userId,
    legal_document_id: resolved.documentRow.id,
    legal_document_version_id: resolved.versionRow.id,
    acceptance_context: acceptanceContext,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    metadata
  };

  const { data, error } = await supabase
    .from("legal_document_acceptances")
    .upsert(insertValues, {
      onConflict:
        "user_id,legal_document_version_id,acceptance_context"
    })
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new LegalDocumentRepositoryError(
      "LEGAL_ACCEPTANCE_SAVE_FAILED",
      `Could not save legal document acceptance: ${error.message}`,
      500
    );
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

  const supabase = getSupabaseUserClient(context.accessToken);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const { data, error } = await supabase
    .from("legal_document_acceptances")
    .select(LEGAL_ACCEPTANCE_SELECT_FIELDS)
    .eq("user_id", context.userId)
    .eq("organization_id", workspace.organizationId)
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

  const documentsByVersion = new Map(
    legalDocumentRegistry.map((document) => [
      `${document.documentKey}:${document.version}`,
      document
    ])
  );

  return ((data ?? []) as SupabaseLegalAcceptanceRow[]).map((row) => {
    const document =
      legalDocumentRegistry.find(
        (candidate) =>
          getRegistryVersionId(candidate) === row.legal_document_version_id
      ) ??
      documentsByVersion.values().next().value ??
      legalDocumentRegistry[0];

    return normalizeSupabaseAcceptanceRow(row, document);
  });
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

  const supabase = getSupabaseUserClient(context.accessToken);
  const workspace = await getWorkspaceForAuthenticatedUser(supabase);
  const { data, error } = await supabase
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

  return ((data ?? []) as SupabaseLegalAcceptanceRow[]).map((row) => {
    const document =
      legalDocumentRegistry.find((candidate) =>
        row.legal_document_version_id.endsWith(
          `${candidate.documentKey}:${candidate.version}`
        )
      ) ?? legalDocumentRegistry[0];

    return normalizeSupabaseAcceptanceRow(row, document);
  });
}
