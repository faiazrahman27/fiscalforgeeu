import { randomUUID } from "node:crypto";
import { getSupabaseServiceRoleClient } from "../lib/supabase/server-client.js";
import type {
  AdminCountryPackReviewPatchInput,
  AdminLegalConfidence,
  AdminRuleCategory,
  AdminRuleCreateInput,
  AdminRulePatchInput,
  AdminRuleSeverity,
  AdminRuleStatus,
  AdminSourceConfidenceStatus,
  AdminSourceCreateInput,
  AdminSourcePatchInput,
  AdminSourceType,
  CountryPackReviewStatus
} from "../schemas/admin-rule-console.js";
import { getCollectionStorageProvider } from "../storage/storage-provider.js";
import { resolveApiStorageBackend } from "../config/env.js";

export type AdminActor = {
  userId: string;
  emailHash: string;
};

export type AdminValidationRuleRecord = {
  id: string;
  code: string;
  title: string;
  description: string;
  message: string;
  category: AdminRuleCategory;
  severity: AdminRuleSeverity;
  legalConfidence: AdminLegalConfidence;
  checkType: string | null;
  layer: string | null;
  jurisdiction: string;
  countryCode: string | null;
  ruleSet: string;
  ruleVersion: string;
  status: AdminRuleStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  reviewedAt: string | null;
  reviewerLabel: string | null;
  sourceRefIds: string[];
  sourceCount: number;
  fixSuggestion: string | null;
  professionalReviewRequired: boolean;
  internalNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  archivedAt: string | null;
  disabledAt: string | null;
  catalogSource: "admin" | "database" | "bundled";
};

export type AdminSourceReferenceRecord = {
  id: string;
  title: string;
  publisher: string;
  jurisdiction: string;
  url: string;
  sourceType: AdminSourceType;
  reviewedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  confidenceStatus: AdminSourceConfidenceStatus;
  notes: string | null;
  language: string | null;
  retrievedAt: string | null;
  versionLabel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AdminCountryPackReviewRecord = {
  countryCode: string;
  reviewStatus: CountryPackReviewStatus;
  legalConfidence: AdminLegalConfidence;
  reviewNotes: string | null;
  sourceRefIds: string[];
  sourceCount: number;
  reviewedAt: string | null;
  reviewerLabel: string | null;
  versionLabel: string | null;
  professionalReviewRequired: boolean;
  warnings: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AdminLifecycleEventRecord = {
  id: string;
  entityType: "validation_rule" | "source_reference" | "country_pack";
  entityId: string;
  entityLabel: string;
  eventType: string;
  actorUserId: string;
  actorEmailHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type RuleSourceLinkRecord = {
  ruleId: string;
  sourceRefId: string;
};

type CountryPackSourceLinkRecord = {
  countryCode: string;
  sourceRefId: string;
  linkType: string;
  createdAt: string;
  createdBy: string | null;
};

const ADMIN_RULES_FILE = "admin-validation-rules.json";
const ADMIN_SOURCE_REFERENCES_FILE = "admin-source-references.json";
const ADMIN_RULE_SOURCE_LINKS_FILE = "admin-rule-source-links.json";
const ADMIN_COUNTRY_PACK_REVIEWS_FILE = "admin-country-pack-reviews.json";
const ADMIN_COUNTRY_PACK_SOURCE_LINKS_FILE =
  "admin-country-pack-source-links.json";
const ADMIN_LIFECYCLE_EVENTS_FILE = "admin-lifecycle-events.json";

const storageProvider = getCollectionStorageProvider();

function nowIso() {
  return new Date().toISOString();
}

function nullable(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function readBooleanField(
  record: Record<string, unknown>,
  key: string,
  fallback = false
) {
  return typeof record[key] === "boolean" ? (record[key] as boolean) : fallback;
}

function readMetadata(record: Record<string, unknown>) {
  const metadata = record.metadata;

  return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeStatus(value: string): AdminRuleStatus {
  if (
    value === "review" ||
    value === "published" ||
    value === "deprecated" ||
    value === "archived" ||
    value === "disabled" ||
    value === "suspended"
  ) {
    return value;
  }

  return "draft";
}

function normalizeCountryReviewStatus(value: string): CountryPackReviewStatus {
  if (
    value === "internal_review" ||
    value === "reviewed" ||
    value === "professional_review_required" ||
    value === "deprecated" ||
    value === "suspended"
  ) {
    return value;
  }

  return "draft";
}

function normalizeLegalConfidence(value: string): AdminLegalConfidence {
  if (
    value === "standard_based" ||
    value === "official_source_derived" ||
    value === "educational_simulation" ||
    value === "professional_review_required"
  ) {
    return value;
  }

  return "technical";
}

function normalizeSeverity(value: string): AdminRuleSeverity {
  if (value === "info" || value === "fatal") {
    return value;
  }

  return "warning";
}

function normalizeCategory(value: string): AdminRuleCategory {
  const allowed: readonly AdminRuleCategory[] = [
    "CANONICAL",
    "CALCULATION",
    "SCHEMA",
    "UBL",
    "CII",
    "EN16931",
    "PEPPOL",
    "VAT_ID",
    "VIES",
    "COUNTRY_PACK",
    "VIDA_SIMULATION",
    "API",
    "SECURITY",
    "LEGAL_LABEL",
    "OTHER"
  ];

  return allowed.includes(value as AdminRuleCategory)
    ? (value as AdminRuleCategory)
    : "OTHER";
}

function normalizeSourceType(value: string): AdminSourceType {
  const allowed: readonly AdminSourceType[] = [
    "eu_law",
    "eu_guidance",
    "national_tax_authority",
    "national_einvoicing_authority",
    "standard",
    "peppol",
    "vies",
    "country_pack",
    "legal_notice",
    "internal_policy",
    "other"
  ];

  return allowed.includes(value as AdminSourceType)
    ? (value as AdminSourceType)
    : "other";
}

function normalizeSourceConfidence(
  value: string
): AdminSourceConfidenceStatus {
  if (
    value === "reviewed" ||
    value === "professional_review_required" ||
    value === "deprecated" ||
    value === "suspended"
  ) {
    return value;
  }

  return "draft";
}

function toRuleRecord(
  input: AdminRuleCreateInput,
  actor: AdminActor
): AdminValidationRuleRecord {
  const timestamp = nowIso();
  const sourceRefIds = dedupe(input.sourceRefIds);

  return {
    id: randomUUID(),
    code: input.code,
    title: input.title,
    description: input.description,
    message: input.message ?? input.description,
    category: input.category,
    severity: input.severity,
    legalConfidence: input.legalConfidence,
    checkType: nullable(input.checkType),
    layer: nullable(input.layer),
    jurisdiction: input.jurisdiction,
    countryCode: nullable(input.countryCode),
    ruleSet: input.ruleSet,
    ruleVersion: input.ruleVersion,
    status: input.status,
    effectiveFrom: nullable(input.effectiveFrom),
    effectiveTo: nullable(input.effectiveTo),
    reviewedAt: nullable(input.reviewedAt),
    reviewerLabel: nullable(input.reviewerLabel),
    sourceRefIds,
    sourceCount: sourceRefIds.length,
    fixSuggestion: nullable(input.fixSuggestion),
    professionalReviewRequired: input.professionalReviewRequired,
    internalNotes: nullable(input.internalNotes),
    metadata: input.metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.userId,
    updatedBy: actor.userId,
    publishedAt: input.status === "published" ? timestamp : null,
    deprecatedAt: input.status === "deprecated" ? timestamp : null,
    archivedAt: input.status === "archived" ? timestamp : null,
    disabledAt: input.status === "disabled" ? timestamp : null,
    catalogSource: "admin"
  };
}

function toSourceRecord(
  input: AdminSourceCreateInput,
  actor: AdminActor
): AdminSourceReferenceRecord {
  const timestamp = nowIso();

  return {
    id: randomUUID(),
    title: input.title,
    publisher: input.publisher,
    jurisdiction: input.jurisdiction,
    url: input.url,
    sourceType: input.sourceType,
    reviewedAt: nullable(input.reviewedAt),
    effectiveFrom: nullable(input.effectiveFrom),
    effectiveTo: nullable(input.effectiveTo),
    confidenceStatus: input.confidenceStatus,
    notes: nullable(input.notes),
    language: nullable(input.language),
    retrievedAt: nullable(input.retrievedAt),
    versionLabel: nullable(input.versionLabel),
    metadata: input.metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: actor.userId,
    updatedBy: actor.userId
  };
}

function mapRuleRow(
  row: Record<string, unknown>,
  sourceRefIds: string[]
): AdminValidationRuleRecord {
  const ruleSet = readRecord(
    Array.isArray(row.validation_rule_sets)
      ? row.validation_rule_sets[0]
      : row.validation_rule_sets
  );
  const timestamp = nowIso();

  return {
    id: readStringField(row, "id"),
    code: readStringField(row, "code"),
    title: readStringField(row, "title"),
    description: readStringField(row, "description"),
    message:
      readStringField(row, "message_template") ||
      readStringField(row, "message") ||
      readStringField(row, "description"),
    category: normalizeCategory(readStringField(row, "category")),
    severity: normalizeSeverity(readStringField(row, "severity")),
    legalConfidence: normalizeLegalConfidence(
      readStringField(row, "legal_confidence")
    ),
    checkType: readNullableStringField(row, "check_type"),
    layer: readNullableStringField(row, "layer"),
    jurisdiction: readStringField(row, "jurisdiction", "EU"),
    countryCode: readNullableStringField(row, "country_code"),
    ruleSet: readStringField(ruleSet, "code", "INVOICE_LANTERN_ADMIN_RULES"),
    ruleVersion: readStringField(row, "version"),
    status: normalizeStatus(readStringField(row, "status")),
    effectiveFrom: readNullableStringField(row, "effective_from"),
    effectiveTo: readNullableStringField(row, "effective_to"),
    reviewedAt: readNullableStringField(row, "reviewed_at"),
    reviewerLabel: readNullableStringField(row, "reviewer_label"),
    sourceRefIds,
    sourceCount: sourceRefIds.length,
    fixSuggestion: readNullableStringField(row, "fix_suggestion"),
    professionalReviewRequired: readBooleanField(
      row,
      "professional_review_required",
      true
    ),
    internalNotes: readNullableStringField(row, "internal_notes"),
    metadata: readMetadata(row),
    createdAt: readStringField(row, "created_at", timestamp),
    updatedAt: readStringField(row, "updated_at", timestamp),
    createdBy: readNullableStringField(row, "created_by"),
    updatedBy: readNullableStringField(row, "updated_by"),
    publishedAt: readNullableStringField(row, "published_at"),
    deprecatedAt: readNullableStringField(row, "deprecated_at"),
    archivedAt: readNullableStringField(row, "archived_at"),
    disabledAt: readNullableStringField(row, "disabled_at"),
    catalogSource: "database"
  };
}

function mapSourceRow(row: Record<string, unknown>): AdminSourceReferenceRecord {
  const timestamp = nowIso();

  return {
    id: readStringField(row, "id"),
    title: readStringField(row, "title"),
    publisher: readStringField(row, "publisher"),
    jurisdiction: readStringField(row, "jurisdiction", "EU"),
    url: readStringField(row, "url"),
    sourceType: normalizeSourceType(readStringField(row, "source_type")),
    reviewedAt: readNullableStringField(row, "reviewed_at"),
    effectiveFrom: readNullableStringField(row, "effective_from"),
    effectiveTo: readNullableStringField(row, "effective_to"),
    confidenceStatus: normalizeSourceConfidence(
      readStringField(row, "confidence_status")
    ),
    notes: readNullableStringField(row, "notes"),
    language: readNullableStringField(row, "language_code"),
    retrievedAt: readNullableStringField(row, "retrieved_at"),
    versionLabel: readNullableStringField(row, "version_label"),
    metadata: readMetadata(row),
    createdAt: readStringField(row, "created_at", timestamp),
    updatedAt: readStringField(row, "updated_at", timestamp),
    createdBy: readNullableStringField(row, "created_by"),
    updatedBy: readNullableStringField(row, "updated_by")
  };
}

function mapCountryReviewRow(
  row: Record<string, unknown>,
  linkedSourceIds: string[]
): AdminCountryPackReviewRecord {
  const sourceRefIds = dedupe([
    ...readStringArray(row.source_ref_ids),
    ...linkedSourceIds
  ]);
  const timestamp = nowIso();

  return {
    countryCode: readStringField(row, "country_code"),
    reviewStatus: normalizeCountryReviewStatus(
      readStringField(row, "review_status")
    ),
    legalConfidence: normalizeLegalConfidence(
      readStringField(row, "legal_confidence")
    ),
    reviewNotes: readNullableStringField(row, "review_notes"),
    sourceRefIds,
    sourceCount: sourceRefIds.length,
    reviewedAt: readNullableStringField(row, "reviewed_at"),
    reviewerLabel: readNullableStringField(row, "reviewer_label"),
    versionLabel: readNullableStringField(row, "version_label"),
    professionalReviewRequired: readBooleanField(
      row,
      "professional_review_required",
      true
    ),
    warnings: readStringArray(row.warnings),
    metadata: readMetadata(row),
    createdAt: readStringField(row, "created_at", timestamp),
    updatedAt: readStringField(row, "updated_at", timestamp),
    createdBy: readNullableStringField(row, "created_by"),
    updatedBy: readNullableStringField(row, "updated_by")
  };
}

function shouldUseSupabase() {
  return resolveApiStorageBackend() === "supabase";
}

async function listLocalRules() {
  return storageProvider.readCollection<AdminValidationRuleRecord>(
    ADMIN_RULES_FILE
  );
}

async function writeLocalRules(records: AdminValidationRuleRecord[]) {
  await storageProvider.writeCollection(
    ADMIN_RULES_FILE,
    [...records].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
  );
}

async function listLocalSources() {
  return storageProvider.readCollection<AdminSourceReferenceRecord>(
    ADMIN_SOURCE_REFERENCES_FILE
  );
}

async function writeLocalSources(records: AdminSourceReferenceRecord[]) {
  await storageProvider.writeCollection(
    ADMIN_SOURCE_REFERENCES_FILE,
    [...records].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
  );
}

async function listLocalCountryReviews() {
  return storageProvider.readCollection<AdminCountryPackReviewRecord>(
    ADMIN_COUNTRY_PACK_REVIEWS_FILE
  );
}

async function writeLocalCountryReviews(
  records: AdminCountryPackReviewRecord[]
) {
  await storageProvider.writeCollection(
    ADMIN_COUNTRY_PACK_REVIEWS_FILE,
    [...records].sort((first, second) => first.countryCode.localeCompare(second.countryCode))
  );
}

async function listLocalCountrySourceLinks() {
  return storageProvider.readCollection<CountryPackSourceLinkRecord>(
    ADMIN_COUNTRY_PACK_SOURCE_LINKS_FILE
  );
}

async function writeLocalCountrySourceLinks(
  records: CountryPackSourceLinkRecord[]
) {
  await storageProvider.writeCollection(
    ADMIN_COUNTRY_PACK_SOURCE_LINKS_FILE,
    records
  );
}

async function writeRuleSourceLinks(
  ruleId: string,
  sourceRefIds: string[],
  actor: AdminActor
) {
  const links = await storageProvider.readCollection<RuleSourceLinkRecord>(
    ADMIN_RULE_SOURCE_LINKS_FILE
  );
  const nextLinks = [
    ...links.filter((link) => link.ruleId !== ruleId),
    ...dedupe(sourceRefIds).map((sourceRefId) => ({
      ruleId,
      sourceRefId,
      createdBy: actor.userId,
      createdAt: nowIso()
    }))
  ];

  await storageProvider.writeCollection(
    ADMIN_RULE_SOURCE_LINKS_FILE,
    nextLinks
  );
}

async function readRuleSourceIds(ruleId: string) {
  const links = await storageProvider.readCollection<RuleSourceLinkRecord>(
    ADMIN_RULE_SOURCE_LINKS_FILE
  );

  return dedupe(
    links
      .filter((link) => link.ruleId === ruleId)
      .map((link) => link.sourceRefId)
  );
}

async function listSupabaseRuleSourceLinks() {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("validation_rule_source_links")
    .select("rule_id, source_reference_id");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    ruleId: readStringField(row as Record<string, unknown>, "rule_id"),
    sourceRefId: readStringField(
      row as Record<string, unknown>,
      "source_reference_id"
    )
  }));
}

async function getSupabaseAdminRuleSetId(input: AdminRuleCreateInput) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: existing, error: existingError } = await supabase
    .from("validation_rule_sets")
    .select("id")
    .eq("code", input.ruleSet)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing && typeof existing.id === "string") {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("validation_rule_sets")
    .insert({
      code: input.ruleSet,
      name: input.ruleSet.replaceAll("_", " "),
      description:
        "Platform-admin managed validation rule intelligence metadata for Invoice Lantern.",
      version: input.ruleVersion,
      status: "draft",
      legal_confidence: input.legalConfidence
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

function toSupabaseRuleValues(
  input: AdminRuleCreateInput,
  ruleSetId: string,
  actor: AdminActor
) {
  return {
    rule_set_id: ruleSetId,
    code: input.code,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    field_path: null,
    message_template: input.message ?? input.description,
    fix_suggestion: nullable(input.fixSuggestion),
    legal_confidence: input.legalConfidence,
    version: input.ruleVersion,
    status: input.status,
    check_type: nullable(input.checkType),
    layer: nullable(input.layer),
    jurisdiction: input.jurisdiction,
    country_code: nullable(input.countryCode),
    effective_from: nullable(input.effectiveFrom),
    effective_to: nullable(input.effectiveTo),
    reviewed_at: nullable(input.reviewedAt),
    reviewer_label: nullable(input.reviewerLabel),
    professional_review_required: input.professionalReviewRequired,
    internal_notes: nullable(input.internalNotes),
    metadata: input.metadata,
    created_by: actor.userId,
    updated_by: actor.userId,
    published_at: input.status === "published" ? nowIso() : null,
    deprecated_at: input.status === "deprecated" ? nowIso() : null,
    archived_at: input.status === "archived" ? nowIso() : null,
    disabled_at: input.status === "disabled" ? nowIso() : null
  };
}

function sourceTypeForValidationRuleSource(sourceType: AdminSourceType) {
  if (sourceType === "internal_policy") {
    return "internal_technical_policy";
  }

  if (sourceType === "standard" || sourceType === "peppol") {
    return "standard_documentation";
  }

  if (sourceType === "eu_law" || sourceType === "eu_guidance") {
    return "official_eu_source";
  }

  if (
    sourceType === "national_tax_authority" ||
    sourceType === "national_einvoicing_authority"
  ) {
    return "official_national_source";
  }

  if (sourceType === "legal_notice") {
    return "professional_review";
  }

  return "public_reference";
}

export async function listAdminValidationRules() {
  if (!shouldUseSupabase()) {
    const rules = await listLocalRules();

    return Promise.all(
      rules.map(async (rule) => {
        const linkedSourceIds = await readRuleSourceIds(rule.id);
        const sourceRefIds = dedupe([...rule.sourceRefIds, ...linkedSourceIds]);

        return {
          ...rule,
          sourceRefIds,
          sourceCount: sourceRefIds.length
        };
      })
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  const [links, rulesResult] = await Promise.all([
    listSupabaseRuleSourceLinks(),
    supabase
      .from("validation_rules")
      .select("*, validation_rule_sets(code, name, version)")
      .order("updated_at", { ascending: false })
  ]);

  const { data, error } = rulesResult;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const ruleId = readStringField(record, "id");

    return mapRuleRow(
      record,
      links
        .filter((link) => link.ruleId === ruleId)
        .map((link) => link.sourceRefId)
    );
  });
}

export async function getAdminValidationRuleById(id: string) {
  const rules = await listAdminValidationRules();

  return rules.find((rule) => rule.id === id) ?? null;
}

export async function createAdminValidationRule(
  input: AdminRuleCreateInput,
  actor: AdminActor
) {
  if (!shouldUseSupabase()) {
    const rules = await listLocalRules();
    const record = toRuleRecord(input, actor);

    await writeLocalRules([record, ...rules]);
    await writeRuleSourceLinks(record.id, record.sourceRefIds, actor);

    return record;
  }

  const supabase = getSupabaseServiceRoleClient();
  const ruleSetId = await getSupabaseAdminRuleSetId(input);
  const values = toSupabaseRuleValues(input, ruleSetId, actor);
  const { data, error } = await supabase
    .from("validation_rules")
    .insert(values)
    .select("*, validation_rule_sets(code, name, version)")
    .single();

  if (error) {
    throw error;
  }

  await replaceAdminRuleSourceLinks(data.id as string, input.sourceRefIds, actor);

  return mapRuleRow(data as Record<string, unknown>, input.sourceRefIds);
}

export async function updateAdminValidationRule(
  id: string,
  input: AdminRulePatchInput,
  actor: AdminActor
) {
  const timestamp = nowIso();

  if (!shouldUseSupabase()) {
    const rules = await listLocalRules();
    const existing = rules.find((rule) => rule.id === id);

    if (!existing) {
      return null;
    }

    const sourceRefIds =
      input.sourceRefIds === undefined
        ? existing.sourceRefIds
        : dedupe(input.sourceRefIds);
    const updated: AdminValidationRuleRecord = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      message: input.message ?? existing.message,
      category: input.category ?? existing.category,
      severity: input.severity ?? existing.severity,
      legalConfidence: input.legalConfidence ?? existing.legalConfidence,
      checkType:
        input.checkType === undefined ? existing.checkType : nullable(input.checkType),
      layer: input.layer === undefined ? existing.layer : nullable(input.layer),
      jurisdiction: input.jurisdiction ?? existing.jurisdiction,
      countryCode:
        input.countryCode === undefined
          ? existing.countryCode
          : nullable(input.countryCode),
      status: input.status ?? existing.status,
      effectiveFrom:
        input.effectiveFrom === undefined
          ? existing.effectiveFrom
          : nullable(input.effectiveFrom),
      effectiveTo:
        input.effectiveTo === undefined
          ? existing.effectiveTo
          : nullable(input.effectiveTo),
      reviewedAt:
        input.reviewedAt === undefined
          ? existing.reviewedAt
          : nullable(input.reviewedAt),
      reviewerLabel:
        input.reviewerLabel === undefined
          ? existing.reviewerLabel
          : nullable(input.reviewerLabel),
      sourceRefIds,
      sourceCount: sourceRefIds.length,
      fixSuggestion:
        input.fixSuggestion === undefined
          ? existing.fixSuggestion
          : nullable(input.fixSuggestion),
      professionalReviewRequired:
        input.professionalReviewRequired ?? existing.professionalReviewRequired,
      internalNotes:
        input.internalNotes === undefined
          ? existing.internalNotes
          : nullable(input.internalNotes),
      metadata: input.metadata ?? existing.metadata,
      updatedAt: timestamp,
      updatedBy: actor.userId,
      publishedAt:
        input.status === "published"
          ? existing.publishedAt ?? timestamp
          : existing.publishedAt,
      deprecatedAt:
        input.status === "deprecated"
          ? existing.deprecatedAt ?? timestamp
          : existing.deprecatedAt,
      archivedAt:
        input.status === "archived"
          ? existing.archivedAt ?? timestamp
          : existing.archivedAt,
      disabledAt:
        input.status === "disabled"
          ? existing.disabledAt ?? timestamp
          : existing.disabledAt
    };

    await writeLocalRules(rules.map((rule) => (rule.id === id ? updated : rule)));
    await writeRuleSourceLinks(id, sourceRefIds, actor);

    return updated;
  }

  const updates: Record<string, unknown> = {
    updated_by: actor.userId,
    updated_at: timestamp
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.message !== undefined) updates.message_template = input.message;
  if (input.category !== undefined) updates.category = input.category;
  if (input.severity !== undefined) updates.severity = input.severity;
  if (input.legalConfidence !== undefined) {
    updates.legal_confidence = input.legalConfidence;
  }
  if (input.checkType !== undefined) updates.check_type = nullable(input.checkType);
  if (input.layer !== undefined) updates.layer = nullable(input.layer);
  if (input.jurisdiction !== undefined) updates.jurisdiction = input.jurisdiction;
  if (input.countryCode !== undefined) {
    updates.country_code = nullable(input.countryCode);
  }
  if (input.status !== undefined) {
    updates.status = input.status;

    if (input.status === "published") updates.published_at = timestamp;
    if (input.status === "deprecated") updates.deprecated_at = timestamp;
    if (input.status === "archived") updates.archived_at = timestamp;
    if (input.status === "disabled") updates.disabled_at = timestamp;
  }
  if (input.effectiveFrom !== undefined) {
    updates.effective_from = nullable(input.effectiveFrom);
  }
  if (input.effectiveTo !== undefined) {
    updates.effective_to = nullable(input.effectiveTo);
  }
  if (input.reviewedAt !== undefined) {
    updates.reviewed_at = nullable(input.reviewedAt);
  }
  if (input.reviewerLabel !== undefined) {
    updates.reviewer_label = nullable(input.reviewerLabel);
  }
  if (input.fixSuggestion !== undefined) {
    updates.fix_suggestion = nullable(input.fixSuggestion);
  }
  if (input.professionalReviewRequired !== undefined) {
    updates.professional_review_required = input.professionalReviewRequired;
  }
  if (input.internalNotes !== undefined) {
    updates.internal_notes = nullable(input.internalNotes);
  }
  if (input.metadata !== undefined) updates.metadata = input.metadata;

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("validation_rules")
    .update(updates)
    .eq("id", id)
    .select("*, validation_rule_sets(code, name, version)")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (input.sourceRefIds !== undefined) {
    await replaceAdminRuleSourceLinks(id, input.sourceRefIds, actor);
  }

  const sourceRefIds =
    input.sourceRefIds ??
    (await listSupabaseRuleSourceLinks())
      .filter((link) => link.ruleId === id)
      .map((link) => link.sourceRefId);

  return mapRuleRow(data as Record<string, unknown>, sourceRefIds);
}

export async function replaceAdminRuleSourceLinks(
  ruleId: string,
  sourceRefIds: string[],
  actor: AdminActor
) {
  const uniqueSourceRefIds = dedupe(sourceRefIds);

  if (!shouldUseSupabase()) {
    await writeRuleSourceLinks(ruleId, uniqueSourceRefIds, actor);
    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error: deleteError } = await supabase
    .from("validation_rule_source_links")
    .delete()
    .eq("rule_id", ruleId);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueSourceRefIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("validation_rule_source_links").insert(
    uniqueSourceRefIds.map((sourceRefId) => ({
      rule_id: ruleId,
      source_reference_id: sourceRefId,
      created_by: actor.userId
    }))
  );

  if (error) {
    throw error;
  }
}

export async function publishValidationRuleSources(ruleId: string) {
  if (!shouldUseSupabase()) {
    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: links, error: linkError } = await supabase
    .from("validation_rule_source_links")
    .select("source_reference_id")
    .eq("rule_id", ruleId);

  if (linkError) {
    throw linkError;
  }

  const sourceIds = (links ?? [])
    .map((link) =>
      readStringField(link as Record<string, unknown>, "source_reference_id")
    )
    .filter(Boolean);

  if (sourceIds.length === 0) {
    return;
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from("source_references")
    .select("*")
    .in("id", sourceIds);

  if (sourceError) {
    throw sourceError;
  }

  const sources = (sourceRows ?? []).map((row) =>
    mapSourceRow(row as Record<string, unknown>)
  );

  await supabase.from("validation_rule_sources").delete().eq("rule_id", ruleId);

  const { error } = await supabase.from("validation_rule_sources").insert(
    sources.map((source) => ({
      rule_id: ruleId,
      source_name: source.title,
      source_url: source.url,
      jurisdiction: source.jurisdiction,
      source_type: sourceTypeForValidationRuleSource(source.sourceType),
      reviewed_at: source.reviewedAt,
      effective_from: source.effectiveFrom,
      effective_until: source.effectiveTo,
      notes: source.notes
    }))
  );

  if (error) {
    throw error;
  }
}

export async function listAdminSourceReferences() {
  if (!shouldUseSupabase()) {
    return listLocalSources();
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("source_references")
    .select("*")
    .eq("scope", "platform")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSourceRow(row as Record<string, unknown>));
}

export async function getAdminSourceReferenceById(id: string) {
  const sources = await listAdminSourceReferences();

  return sources.find((source) => source.id === id) ?? null;
}

export async function createAdminSourceReference(
  input: AdminSourceCreateInput,
  actor: AdminActor
) {
  if (!shouldUseSupabase()) {
    const sources = await listLocalSources();
    const record = toSourceRecord(input, actor);

    await writeLocalSources([record, ...sources]);

    return record;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("source_references")
    .insert({
      scope: "platform",
      organization_id: null,
      source_type: input.sourceType,
      title: input.title,
      publisher: input.publisher,
      jurisdiction: input.jurisdiction,
      url: input.url,
      citation: null,
      reviewed_at: nullable(input.reviewedAt),
      effective_from: nullable(input.effectiveFrom),
      effective_to: nullable(input.effectiveTo),
      version_label: nullable(input.versionLabel),
      confidence_status: input.confidenceStatus,
      language_code: nullable(input.language),
      retrieved_at: nullable(input.retrievedAt),
      notes: nullable(input.notes),
      metadata: input.metadata,
      created_by: actor.userId,
      updated_by: actor.userId
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapSourceRow(data as Record<string, unknown>);
}

export async function updateAdminSourceReference(
  id: string,
  input: AdminSourcePatchInput,
  actor: AdminActor
) {
  const timestamp = nowIso();

  if (!shouldUseSupabase()) {
    const sources = await listLocalSources();
    const existing = sources.find((source) => source.id === id);

    if (!existing) {
      return null;
    }

    const updated: AdminSourceReferenceRecord = {
      ...existing,
      title: input.title ?? existing.title,
      publisher: input.publisher ?? existing.publisher,
      jurisdiction: input.jurisdiction ?? existing.jurisdiction,
      url: input.url ?? existing.url,
      sourceType: input.sourceType ?? existing.sourceType,
      reviewedAt:
        input.reviewedAt === undefined
          ? existing.reviewedAt
          : nullable(input.reviewedAt),
      effectiveFrom:
        input.effectiveFrom === undefined
          ? existing.effectiveFrom
          : nullable(input.effectiveFrom),
      effectiveTo:
        input.effectiveTo === undefined
          ? existing.effectiveTo
          : nullable(input.effectiveTo),
      confidenceStatus: input.confidenceStatus ?? existing.confidenceStatus,
      notes: input.notes === undefined ? existing.notes : nullable(input.notes),
      language:
        input.language === undefined ? existing.language : nullable(input.language),
      retrievedAt:
        input.retrievedAt === undefined
          ? existing.retrievedAt
          : nullable(input.retrievedAt),
      versionLabel:
        input.versionLabel === undefined
          ? existing.versionLabel
          : nullable(input.versionLabel),
      metadata: input.metadata ?? existing.metadata,
      updatedAt: timestamp,
      updatedBy: actor.userId
    };

    await writeLocalSources(
      sources.map((source) => (source.id === id ? updated : source))
    );

    return updated;
  }

  const updates: Record<string, unknown> = {
    updated_by: actor.userId,
    updated_at: timestamp
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.publisher !== undefined) updates.publisher = input.publisher;
  if (input.jurisdiction !== undefined) updates.jurisdiction = input.jurisdiction;
  if (input.url !== undefined) updates.url = input.url;
  if (input.sourceType !== undefined) updates.source_type = input.sourceType;
  if (input.reviewedAt !== undefined) {
    updates.reviewed_at = nullable(input.reviewedAt);
  }
  if (input.effectiveFrom !== undefined) {
    updates.effective_from = nullable(input.effectiveFrom);
  }
  if (input.effectiveTo !== undefined) {
    updates.effective_to = nullable(input.effectiveTo);
  }
  if (input.confidenceStatus !== undefined) {
    updates.confidence_status = input.confidenceStatus;
  }
  if (input.notes !== undefined) updates.notes = nullable(input.notes);
  if (input.language !== undefined) updates.language_code = nullable(input.language);
  if (input.retrievedAt !== undefined) {
    updates.retrieved_at = nullable(input.retrievedAt);
  }
  if (input.versionLabel !== undefined) {
    updates.version_label = nullable(input.versionLabel);
  }
  if (input.metadata !== undefined) updates.metadata = input.metadata;

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("source_references")
    .update(updates)
    .eq("id", id)
    .eq("scope", "platform")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSourceRow(data as Record<string, unknown>) : null;
}

export async function listCountryPackReviewOverlays() {
  if (!shouldUseSupabase()) {
    const [reviews, links] = await Promise.all([
      listLocalCountryReviews(),
      listLocalCountrySourceLinks()
    ]);

    return reviews.map((review) => {
      const sourceRefIds = dedupe([
        ...review.sourceRefIds,
        ...links
          .filter((link) => link.countryCode === review.countryCode)
          .map((link) => link.sourceRefId)
      ]);

      return {
        ...review,
        sourceRefIds,
        sourceCount: sourceRefIds.length
      };
    });
  }

  const supabase = getSupabaseServiceRoleClient();
  const [reviewResult, linkResult] = await Promise.all([
    supabase
      .from("country_pack_review_overlays")
      .select("*")
      .order("country_code", { ascending: true }),
    supabase.from("country_pack_source_links").select("country_code, source_reference_id")
  ]);

  if (reviewResult.error) throw reviewResult.error;
  if (linkResult.error) throw linkResult.error;

  const links = (linkResult.data ?? []).map((row) => ({
    countryCode: readStringField(row as Record<string, unknown>, "country_code"),
    sourceRefId: readStringField(
      row as Record<string, unknown>,
      "source_reference_id"
    )
  }));

  return (reviewResult.data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const countryCode = readStringField(record, "country_code");

    return mapCountryReviewRow(
      record,
      links
        .filter((link) => link.countryCode === countryCode)
        .map((link) => link.sourceRefId)
    );
  });
}

export async function getCountryPackReviewOverlay(countryCode: string) {
  const normalizedCountryCode = countryCode === "EL" ? "GR" : countryCode;
  const overlays = await listCountryPackReviewOverlays();

  return (
    overlays.find((overlay) => overlay.countryCode === normalizedCountryCode) ??
    null
  );
}

export async function upsertCountryPackReviewOverlay(
  countryCode: string,
  input: AdminCountryPackReviewPatchInput,
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode === "EL" ? "GR" : countryCode;
  const timestamp = nowIso();

  if (!shouldUseSupabase()) {
    const reviews = await listLocalCountryReviews();
    const existing = reviews.find(
      (review) => review.countryCode === normalizedCountryCode
    );
    const sourceRefIds = dedupe(
      input.sourceRefIds ?? existing?.sourceRefIds ?? []
    );
    const updated: AdminCountryPackReviewRecord = {
      countryCode: normalizedCountryCode,
      reviewStatus:
        input.reviewStatus ?? existing?.reviewStatus ?? "professional_review_required",
      legalConfidence:
        input.legalConfidence ??
        existing?.legalConfidence ??
        "professional_review_required",
      reviewNotes:
        input.reviewNotes === undefined
          ? existing?.reviewNotes ?? null
          : nullable(input.reviewNotes),
      sourceRefIds,
      sourceCount: sourceRefIds.length,
      reviewedAt:
        input.reviewedAt === undefined
          ? existing?.reviewedAt ?? null
          : nullable(input.reviewedAt),
      reviewerLabel:
        input.reviewerLabel === undefined
          ? existing?.reviewerLabel ?? null
          : nullable(input.reviewerLabel),
      versionLabel:
        input.versionLabel === undefined
          ? existing?.versionLabel ?? null
          : nullable(input.versionLabel),
      professionalReviewRequired:
        input.professionalReviewRequired ??
        existing?.professionalReviewRequired ??
        true,
      warnings: input.warnings ?? existing?.warnings ?? [],
      metadata: input.metadata ?? existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      createdBy: existing?.createdBy ?? actor.userId,
      updatedBy: actor.userId
    };

    await writeLocalCountryReviews([
      updated,
      ...reviews.filter((review) => review.countryCode !== normalizedCountryCode)
    ]);

    if (input.sourceRefIds !== undefined) {
      await replaceCountryPackSourceLinks(
        normalizedCountryCode,
        input.sourceRefIds,
        actor
      );
    }

    return updated;
  }

  const existing = await getCountryPackReviewOverlay(normalizedCountryCode);
  const sourceRefIds = dedupe(input.sourceRefIds ?? existing?.sourceRefIds ?? []);
  const values = {
    country_code: normalizedCountryCode,
    review_status:
      input.reviewStatus ?? existing?.reviewStatus ?? "professional_review_required",
    legal_confidence:
      input.legalConfidence ??
      existing?.legalConfidence ??
      "professional_review_required",
    review_notes:
      input.reviewNotes === undefined
        ? existing?.reviewNotes ?? null
        : nullable(input.reviewNotes),
    source_ref_ids: sourceRefIds,
    reviewed_at:
      input.reviewedAt === undefined
        ? existing?.reviewedAt ?? null
        : nullable(input.reviewedAt),
    reviewer_label:
      input.reviewerLabel === undefined
        ? existing?.reviewerLabel ?? null
        : nullable(input.reviewerLabel),
    version_label:
      input.versionLabel === undefined
        ? existing?.versionLabel ?? null
        : nullable(input.versionLabel),
    professional_review_required:
      input.professionalReviewRequired ??
      existing?.professionalReviewRequired ??
      true,
    warnings: input.warnings ?? existing?.warnings ?? [],
    metadata: input.metadata ?? existing?.metadata ?? {},
    created_by: existing?.createdBy ?? actor.userId,
    updated_by: actor.userId,
    updated_at: timestamp
  };

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("country_pack_review_overlays")
    .upsert(values, {
      onConflict: "country_code"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (input.sourceRefIds !== undefined) {
    await replaceCountryPackSourceLinks(
      normalizedCountryCode,
      input.sourceRefIds,
      actor
    );
  }

  return mapCountryReviewRow(data as Record<string, unknown>, sourceRefIds);
}

export async function replaceCountryPackSourceLinks(
  countryCode: string,
  sourceRefIds: string[],
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode === "EL" ? "GR" : countryCode;
  const uniqueSourceRefIds = dedupe(sourceRefIds);

  if (!shouldUseSupabase()) {
    const links = await listLocalCountrySourceLinks();
    const remainingLinks = links.filter(
      (link) => link.countryCode !== normalizedCountryCode
    );
    const timestamp = nowIso();

    await writeLocalCountrySourceLinks([
      ...remainingLinks,
      ...uniqueSourceRefIds.map((sourceRefId) => ({
        countryCode: normalizedCountryCode,
        sourceRefId,
        linkType: "reviewed_against",
        createdAt: timestamp,
        createdBy: actor.userId
      }))
    ]);

    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error: deleteError } = await supabase
    .from("country_pack_source_links")
    .delete()
    .eq("country_code", normalizedCountryCode);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueSourceRefIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("country_pack_source_links").insert(
    uniqueSourceRefIds.map((sourceRefId) => ({
      country_code: normalizedCountryCode,
      source_reference_id: sourceRefId,
      link_type: "reviewed_against",
      created_by: actor.userId
    }))
  );

  if (error) {
    throw error;
  }
}

export async function addCountryPackSourceLink(
  countryCode: string,
  sourceRefId: string,
  linkType: string,
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode === "EL" ? "GR" : countryCode;

  if (!shouldUseSupabase()) {
    const links = await listLocalCountrySourceLinks();

    if (
      links.some(
        (link) =>
          link.countryCode === normalizedCountryCode &&
          link.sourceRefId === sourceRefId
      )
    ) {
      return;
    }

    await writeLocalCountrySourceLinks([
      ...links,
      {
        countryCode: normalizedCountryCode,
        sourceRefId,
        linkType,
        createdAt: nowIso(),
        createdBy: actor.userId
      }
    ]);
    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("country_pack_source_links").upsert(
    {
      country_code: normalizedCountryCode,
      source_reference_id: sourceRefId,
      link_type: linkType,
      created_by: actor.userId
    },
    {
      onConflict: "country_code,source_reference_id"
    }
  );

  if (error) {
    throw error;
  }
}

export async function removeCountryPackSourceLink(
  countryCode: string,
  sourceRefId: string
) {
  const normalizedCountryCode = countryCode === "EL" ? "GR" : countryCode;

  if (!shouldUseSupabase()) {
    const links = await listLocalCountrySourceLinks();
    await writeLocalCountrySourceLinks(
      links.filter(
        (link) =>
          link.countryCode !== normalizedCountryCode ||
          link.sourceRefId !== sourceRefId
      )
    );
    return;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("country_pack_source_links")
    .delete()
    .eq("country_code", normalizedCountryCode)
    .eq("source_reference_id", sourceRefId);

  if (error) {
    throw error;
  }
}

export async function createAdminLifecycleEvent(
  input: Omit<AdminLifecycleEventRecord, "id" | "createdAt">
) {
  const event: AdminLifecycleEventRecord = {
    id: randomUUID(),
    ...input,
    createdAt: nowIso()
  };

  if (!shouldUseSupabase()) {
    const events = await storageProvider.readCollection<AdminLifecycleEventRecord>(
      ADMIN_LIFECYCLE_EVENTS_FILE
    );

    await storageProvider.writeCollection(ADMIN_LIFECYCLE_EVENTS_FILE, [
      event,
      ...events
    ]);
    return event;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("platform_admin_lifecycle_events").insert({
    id: event.id,
    entity_type: event.entityType,
    entity_id: event.entityId,
    entity_label: event.entityLabel,
    event_type: event.eventType,
    actor_user_id: event.actorUserId,
    actor_email_hash: event.actorEmailHash,
    metadata: event.metadata,
    created_at: event.createdAt
  });

  if (error) {
    throw error;
  }

  return event;
}

export async function listAdminLifecycleEvents(input?: {
  entityType?: AdminLifecycleEventRecord["entityType"];
  entityId?: string;
}) {
  if (!shouldUseSupabase()) {
    const events = await storageProvider.readCollection<AdminLifecycleEventRecord>(
      ADMIN_LIFECYCLE_EVENTS_FILE
    );

    return events.filter((event) => {
      if (input?.entityType && event.entityType !== input.entityType) {
        return false;
      }

      if (input?.entityId && event.entityId !== input.entityId) {
        return false;
      }

      return true;
    });
  }

  const supabase = getSupabaseServiceRoleClient();
  let query = supabase
    .from("platform_admin_lifecycle_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (input?.entityType) {
    query = query.eq("entity_type", input.entityType);
  }

  if (input?.entityId) {
    query = query.eq("entity_id", input.entityId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;

    return {
      id: readStringField(record, "id"),
      entityType: readStringField(
        record,
        "entity_type",
        "validation_rule"
      ) as AdminLifecycleEventRecord["entityType"],
      entityId: readStringField(record, "entity_id"),
      entityLabel: readStringField(record, "entity_label"),
      eventType: readStringField(record, "event_type"),
      actorUserId: readStringField(record, "actor_user_id"),
      actorEmailHash: readStringField(record, "actor_email_hash"),
      metadata: readMetadata(record),
      createdAt: readStringField(record, "created_at")
    };
  });
}
