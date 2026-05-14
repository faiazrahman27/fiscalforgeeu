import {
  getCountryPack,
  listCountryPacks
} from "@invoice-lantern/country-packs";
import { listPublishedValidationRules } from "../repositories/validation-rule-repository.js";
import {
  addCountryPackSourceLink,
  createAdminLifecycleEvent,
  createAdminSourceReference,
  createAdminValidationRule,
  getAdminSourceReferenceById,
  getAdminValidationRuleById,
  getCountryPackReviewOverlay,
  listAdminLifecycleEvents,
  listAdminSourceReferences,
  listAdminValidationRules,
  listCountryPackReviewOverlays,
  publishValidationRuleSources,
  removeCountryPackSourceLink,
  replaceAdminRuleSourceLinks,
  updateAdminSourceReference,
  updateAdminValidationRule,
  upsertCountryPackReviewOverlay,
  type AdminActor,
  type AdminCountryPackReviewRecord,
  type AdminSourceReferenceRecord,
  type AdminValidationRuleRecord
} from "../repositories/admin-rule-console-repository.js";
import type {
  AdminCountryPackReviewPatchInput,
  AdminCountryPackSourceLinkInput,
  AdminRuleCreateInput,
  AdminRulePatchInput,
  AdminRuleStatus,
  AdminSourceCreateInput,
  AdminSourcePatchInput
} from "../schemas/admin-rule-console.js";
import { HttpError } from "../utils/http-error.js";

export const ADMIN_RULE_CONSOLE_DISCLAIMER =
  "Platform rule, source, and country-pack review metadata supports independent technical validation, source traceability, educational simulation, and professional review workflows only. It is not official legal, tax, accounting, filing, authority, Peppol, EN 16931, or ViDA certification.";

const LEGAL_TAX_RULE_CATEGORIES = new Set([
  "VAT_ID",
  "VIES",
  "EN16931",
  "PEPPOL",
  "COUNTRY_PACK",
  "VIDA_SIMULATION",
  "LEGAL_LABEL"
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function statusConflict(message: string) {
  return new HttpError({
    statusCode: 409,
    code: "RULE_LIFECYCLE_CONFLICT",
    message
  });
}

function sourceRequired(message: string) {
  return new HttpError({
    statusCode: 409,
    code: "SOURCE_REQUIRED",
    message
  });
}

function notFound(code: string, message: string) {
  return new HttpError({
    statusCode: 404,
    code,
    message
  });
}

function isEditableRule(rule: AdminValidationRuleRecord) {
  return rule.status === "draft" || rule.status === "review";
}

function isLegalOrTaxLikeRule(
  rule: Pick<
    AdminValidationRuleRecord,
    "category" | "legalConfidence" | "professionalReviewRequired"
  >
) {
  return (
    rule.legalConfidence !== "technical" ||
    rule.professionalReviewRequired ||
    LEGAL_TAX_RULE_CATEGORIES.has(rule.category)
  );
}

async function listBundledRuleRecords(existingRules: AdminValidationRuleRecord[]) {
  const catalog = await listPublishedValidationRules();
  const existingCodeVersions = new Set(
    existingRules.map((rule) => `${rule.ruleSet}:${rule.code}:${rule.ruleVersion}`)
  );
  const timestamp = nowIso();
  const records: AdminValidationRuleRecord[] = [];

  for (const ruleSet of catalog.ruleSets) {
    for (const rule of ruleSet.rules) {
      const key = `${rule.ruleSetCode}:${rule.code}:${rule.ruleVersion}`;

      if (existingCodeVersions.has(key)) {
        continue;
      }

      records.push({
        id: `catalog:${rule.ruleSetCode}:${rule.code}:${rule.ruleVersion}`,
        code: rule.code,
        title: rule.title,
        description: rule.description,
        message: rule.messageTemplate,
        category: rule.category,
        severity: rule.severity === "blocked" ? "warning" : rule.severity,
        legalConfidence: rule.legalConfidence,
        checkType: null,
        layer: null,
        jurisdiction:
          rule.sources.find((source) => source.jurisdiction)?.jurisdiction ?? "EU",
        countryCode: null,
        ruleSet: rule.ruleSetCode,
        ruleVersion: rule.ruleVersion,
        status: "published",
        effectiveFrom:
          rule.sources.find((source) => source.effectiveFrom)?.effectiveFrom ??
          null,
        effectiveTo:
          rule.sources.find((source) => source.effectiveUntil)?.effectiveUntil ??
          null,
        reviewedAt:
          rule.sources.find((source) => source.reviewedAt)?.reviewedAt ?? null,
        reviewerLabel: "Bundled rule catalog",
        sourceRefIds: [],
        sourceCount: rule.sources.length,
        fixSuggestion: rule.fixSuggestion ?? null,
        professionalReviewRequired:
          rule.legalConfidence === "professional_review_required",
        internalNotes: null,
        metadata: {
          sourceLabels: rule.sourceLabels,
          catalogOnly: true
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: null,
        updatedBy: null,
        publishedAt: timestamp,
        deprecatedAt: null,
        archivedAt: null,
        disabledAt: null,
        catalogSource: "bundled"
      });
    }
  }

  return records;
}

async function assertSourcesExist(sourceRefIds: string[]) {
  const uniqueSourceRefIds = [...new Set(sourceRefIds)];
  const sources = await listAdminSourceReferences();
  const existingSourceIds = new Set(sources.map((source) => source.id));
  const missingSourceIds = uniqueSourceRefIds.filter(
    (sourceRefId) => !existingSourceIds.has(sourceRefId)
  );

  if (missingSourceIds.length > 0) {
    throw new HttpError({
      statusCode: 400,
      code: "SOURCE_REFERENCE_NOT_FOUND",
      message: "One or more source references were not found.",
      details: {
        sourceRefIds: missingSourceIds
      }
    });
  }
}

async function assertRuleSourceRequirements(rule: AdminValidationRuleRecord) {
  if (isLegalOrTaxLikeRule(rule) && rule.sourceRefIds.length === 0) {
    throw sourceRequired(
      "Legal, tax, standards, country-pack, VIES, Peppol-style, EN 16931-style, or ViDA-simulation rule metadata cannot be published without at least one source reference."
    );
  }

  await assertSourcesExist(rule.sourceRefIds);
}

function assertRuleCanBeModified(rule: AdminValidationRuleRecord) {
  if (rule.catalogSource === "bundled") {
    throw statusConflict(
      "Bundled rule catalog entries are view-only in the admin console. Create a new sourced draft rule version instead."
    );
  }

  if (!isEditableRule(rule)) {
    throw statusConflict(
      "Only draft and review rule metadata can be edited. Published, deprecated, archived, disabled, and suspended rules remain readable for historical explanation."
    );
  }
}

async function assertNoDuplicateRuleVersion(
  input: AdminRuleCreateInput,
  existingId?: string
) {
  const rules = await listRules();
  const duplicateRule = rules.find(
    (rule) =>
      rule.id !== existingId &&
      rule.ruleSet === input.ruleSet &&
      rule.code === input.code &&
      rule.ruleVersion === input.ruleVersion
  );

  if (duplicateRule) {
    throw new HttpError({
      statusCode: 409,
      code: "RULE_VERSION_CONFLICT",
      message:
        "A validation rule with the same rule set, code, and version already exists. Create a new version instead of overwriting historical metadata."
    });
  }
}

async function recordEvent(input: {
  actor: AdminActor;
  entityType: "validation_rule" | "source_reference" | "country_pack";
  entityId: string;
  entityLabel: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  return createAdminLifecycleEvent({
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    eventType: input.eventType,
    actorUserId: input.actor.userId,
    actorEmailHash: input.actor.emailHash,
    metadata: input.metadata ?? {}
  });
}

export async function listRules() {
  const adminRules = await listAdminValidationRules();
  const bundledRules = await listBundledRuleRecords(adminRules);

  return [...adminRules, ...bundledRules].sort((first, second) =>
    `${first.code}:${first.ruleVersion}`.localeCompare(
      `${second.code}:${second.ruleVersion}`
    )
  );
}

export async function getRule(id: string) {
  const adminRule = await getAdminValidationRuleById(id);

  if (adminRule) {
    return {
      rule: adminRule,
      events: await listAdminLifecycleEvents({
        entityType: "validation_rule",
        entityId: id
      })
    };
  }

  const rule = (await listRules()).find((candidate) => candidate.id === id);

  if (!rule) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  return {
    rule,
    events: []
  };
}

export async function createRule(input: AdminRuleCreateInput, actor: AdminActor) {
  await assertNoDuplicateRuleVersion(input);
  await assertSourcesExist(input.sourceRefIds);

  const previewRule = {
    ...input,
    id: "preview",
    message: input.message ?? input.description,
    checkType: input.checkType ?? null,
    layer: input.layer ?? null,
    countryCode: input.countryCode ?? null,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    reviewedAt: input.reviewedAt ?? null,
    reviewerLabel: input.reviewerLabel ?? null,
    sourceCount: input.sourceRefIds.length,
    fixSuggestion: input.fixSuggestion ?? null,
    internalNotes: input.internalNotes ?? null,
    createdAt: "",
    updatedAt: "",
    createdBy: null,
    updatedBy: null,
    publishedAt: null,
    deprecatedAt: null,
    archivedAt: null,
    disabledAt: null,
    catalogSource: "admin" as const
  };

  if (input.status === "published") {
    await assertRuleSourceRequirements(previewRule);
  }

  const rule = await createAdminValidationRule(input, actor);

  await recordEvent({
    actor,
    entityType: "validation_rule",
    entityId: rule.id,
    entityLabel: rule.code,
    eventType: "rule.created",
    metadata: {
      status: rule.status,
      ruleVersion: rule.ruleVersion,
      sourceCount: rule.sourceCount
    }
  });

  return rule;
}

export async function updateRule(
  id: string,
  input: AdminRulePatchInput,
  actor: AdminActor
) {
  const existing = await getAdminValidationRuleById(id);

  if (!existing) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  assertRuleCanBeModified(existing);

  if (input.status && input.status !== "draft" && input.status !== "review") {
    throw statusConflict(
      "Use lifecycle actions to publish, deprecate, archive, disable, or suspend validation rules."
    );
  }

  if (input.sourceRefIds !== undefined) {
    await assertSourcesExist(input.sourceRefIds);
  }

  const updated = await updateAdminValidationRule(id, input, actor);

  if (!updated) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  await recordEvent({
    actor,
    entityType: "validation_rule",
    entityId: updated.id,
    entityLabel: updated.code,
    eventType: "rule.updated",
    metadata: {
      status: updated.status,
      sourceCount: updated.sourceCount
    }
  });

  return updated;
}

export async function submitRuleForReview(id: string, actor: AdminActor) {
  const rule = await getAdminValidationRuleById(id);

  if (!rule) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  assertRuleCanBeModified(rule);

  const updated = await updateAdminValidationRule(
    id,
    {
      status: "review"
    },
    actor
  );

  if (!updated) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  await recordEvent({
    actor,
    entityType: "validation_rule",
    entityId: updated.id,
    entityLabel: updated.code,
    eventType: "rule.submitted_for_review",
    metadata: {
      ruleVersion: updated.ruleVersion
    }
  });

  return updated;
}

export async function publishRule(id: string, actor: AdminActor) {
  const rule = await getAdminValidationRuleById(id);

  if (!rule) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  assertRuleCanBeModified(rule);
  await assertRuleSourceRequirements(rule);

  const updated = await updateAdminValidationRule(
    id,
    {
      status: "published",
      reviewedAt: rule.reviewedAt ?? today()
    },
    actor
  );

  if (!updated) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  await publishValidationRuleSources(id);

  await recordEvent({
    actor,
    entityType: "validation_rule",
    entityId: updated.id,
    entityLabel: updated.code,
    eventType: "rule.published",
    metadata: {
      ruleVersion: updated.ruleVersion,
      sourceCount: updated.sourceCount
    }
  });

  return updated;
}

async function transitionRule(
  id: string,
  status: Exclude<AdminRuleStatus, "draft" | "review" | "published" | "suspended">,
  actor: AdminActor
) {
  const rule = await getAdminValidationRuleById(id);

  if (!rule) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  if (rule.catalogSource === "bundled") {
    throw statusConflict(
      "Bundled rule catalog entries are view-only in the admin console."
    );
  }

  if (rule.status === "archived" && status !== "archived") {
    throw statusConflict("Archived rule metadata cannot transition back.");
  }

  const updated = await updateAdminValidationRule(id, { status }, actor);

  if (!updated) {
    throw notFound("RULE_NOT_FOUND", "Validation rule metadata was not found.");
  }

  await recordEvent({
    actor,
    entityType: "validation_rule",
    entityId: updated.id,
    entityLabel: updated.code,
    eventType: `rule.${status}`,
    metadata: {
      previousStatus: rule.status,
      ruleVersion: updated.ruleVersion
    }
  });

  return updated;
}

export async function deprecateRule(id: string, actor: AdminActor) {
  return transitionRule(id, "deprecated", actor);
}

export async function archiveRule(id: string, actor: AdminActor) {
  return transitionRule(id, "archived", actor);
}

export async function disableRule(id: string, actor: AdminActor) {
  return transitionRule(id, "disabled", actor);
}

export async function listSources() {
  return listAdminSourceReferences();
}

export async function getSource(id: string) {
  const source = await getAdminSourceReferenceById(id);

  if (!source) {
    throw notFound("SOURCE_REFERENCE_NOT_FOUND", "Source reference was not found.");
  }

  return {
    source,
    events: await listAdminLifecycleEvents({
      entityType: "source_reference",
      entityId: id
    })
  };
}

export async function createSource(
  input: AdminSourceCreateInput,
  actor: AdminActor
) {
  const source = await createAdminSourceReference(input, actor);

  await recordEvent({
    actor,
    entityType: "source_reference",
    entityId: source.id,
    entityLabel: source.title,
    eventType: "source.created",
    metadata: {
      sourceType: source.sourceType,
      confidenceStatus: source.confidenceStatus,
      jurisdiction: source.jurisdiction
    }
  });

  return source;
}

export async function updateSource(
  id: string,
  input: AdminSourcePatchInput,
  actor: AdminActor
) {
  const source = await updateAdminSourceReference(id, input, actor);

  if (!source) {
    throw notFound("SOURCE_REFERENCE_NOT_FOUND", "Source reference was not found.");
  }

  await recordEvent({
    actor,
    entityType: "source_reference",
    entityId: source.id,
    entityLabel: source.title,
    eventType: "source.updated",
    metadata: {
      sourceType: source.sourceType,
      confidenceStatus: source.confidenceStatus
    }
  });

  return source;
}

export async function deprecateSource(id: string, actor: AdminActor) {
  const source = await updateSource(
    id,
    {
      confidenceStatus: "deprecated"
    },
    actor
  );

  await recordEvent({
    actor,
    entityType: "source_reference",
    entityId: source.id,
    entityLabel: source.title,
    eventType: "source.deprecated",
    metadata: {
      sourceType: source.sourceType
    }
  });

  return source;
}

function buildCountryPackAdminRecord(
  countryPack: ReturnType<typeof listCountryPacks>[number],
  overlay: AdminCountryPackReviewRecord | null,
  sources: AdminSourceReferenceRecord[]
) {
  const overlaySourceIds = overlay?.sourceRefIds ?? [];
  const sourceReferences = sources.filter((source) =>
    overlaySourceIds.includes(source.id)
  );

  return {
    countryCode: countryPack.countryCode,
    countryName: countryPack.countryName,
    packageStatus: countryPack.status,
    packageVersion: countryPack.version,
    packageLegalConfidence: countryPack.legalConfidence,
    euMemberState: countryPack.euMemberState,
    sourceCoverageSummary: countryPack.sourceCoverageSummary,
    packageSourceCount: countryPack.sourceReferences.length,
    packageRuleCount: countryPack.rules.length,
    packageWarnings: countryPack.warnings,
    review: overlay,
    reviewSourceCount: sourceReferences.length,
    sourceReferences,
    professionalReviewRequired:
      overlay?.professionalReviewRequired ??
      countryPack.legalConfidence === "professional_review_required",
    grElCompatibilityNote:
      countryPack.countryCode === "GR"
        ? "Greece is exposed as GR. EL remains VAT-prefix compatibility only and is not a duplicate country pack."
        : null,
    disclaimer: countryPack.disclaimer
  };
}

export async function listCountryPackAdminRecords() {
  const [countryPacks, overlays, sources] = await Promise.all([
    Promise.resolve(listCountryPacks()),
    listCountryPackReviewOverlays(),
    listAdminSourceReferences()
  ]);

  return countryPacks.map((countryPack) =>
    buildCountryPackAdminRecord(
      countryPack,
      overlays.find((overlay) => overlay.countryCode === countryPack.countryCode) ??
        null,
      sources
    )
  );
}

export async function getCountryPackAdminRecord(countryCode: string) {
  const normalizedCountryCode = countryCode.toUpperCase() === "EL" ? "GR" : countryCode.toUpperCase();
  const countryPack = getCountryPack(normalizedCountryCode);

  if (!countryPack) {
    throw notFound(
      "COUNTRY_PACK_NOT_FOUND",
      "Country-pack metadata is not currently supported for that country code."
    );
  }

  const [overlay, sources] = await Promise.all([
    getCountryPackReviewOverlay(normalizedCountryCode),
    listAdminSourceReferences()
  ]);

  return buildCountryPackAdminRecord(countryPack, overlay, sources);
}

function countryPackReviewRequiresSource(
  input: AdminCountryPackReviewPatchInput,
  existing: AdminCountryPackReviewRecord | null
) {
  const nextReviewStatus = input.reviewStatus ?? existing?.reviewStatus;
  const nextLegalConfidence =
    input.legalConfidence ?? existing?.legalConfidence;
  const nextProfessionalReviewRequired =
    input.professionalReviewRequired ?? existing?.professionalReviewRequired;

  return (
    nextReviewStatus === "reviewed" ||
    nextProfessionalReviewRequired === false ||
    nextLegalConfidence === "standard_based" ||
    nextLegalConfidence === "official_source_derived"
  );
}

export async function updateCountryPackReview(
  countryCode: string,
  input: AdminCountryPackReviewPatchInput,
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode.toUpperCase() === "EL" ? "GR" : countryCode.toUpperCase();

  if (!getCountryPack(normalizedCountryCode)) {
    throw notFound(
      "COUNTRY_PACK_NOT_FOUND",
      "Country-pack metadata is not currently supported for that country code."
    );
  }

  const existing = await getCountryPackReviewOverlay(normalizedCountryCode);
  const nextSourceRefIds = input.sourceRefIds ?? existing?.sourceRefIds ?? [];

  await assertSourcesExist(nextSourceRefIds);

  if (countryPackReviewRequiresSource(input, existing) && nextSourceRefIds.length === 0) {
    throw sourceRequired(
      "Country-pack review metadata cannot be marked reviewed or stronger than professional-review-required without at least one source reference."
    );
  }

  const review = await upsertCountryPackReviewOverlay(
    normalizedCountryCode,
    input,
    actor
  );

  await recordEvent({
    actor,
    entityType: "country_pack",
    entityId: normalizedCountryCode,
    entityLabel: normalizedCountryCode,
    eventType: "country_pack.review_updated",
    metadata: {
      reviewStatus: review.reviewStatus,
      legalConfidence: review.legalConfidence,
      sourceCount: review.sourceCount
    }
  });

  return getCountryPackAdminRecord(normalizedCountryCode);
}

export async function linkCountryPackSource(
  countryCode: string,
  input: AdminCountryPackSourceLinkInput,
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode.toUpperCase() === "EL" ? "GR" : countryCode.toUpperCase();

  if (!getCountryPack(normalizedCountryCode)) {
    throw notFound(
      "COUNTRY_PACK_NOT_FOUND",
      "Country-pack metadata is not currently supported for that country code."
    );
  }

  await assertSourcesExist([input.sourceRefId]);
  await addCountryPackSourceLink(
    normalizedCountryCode,
    input.sourceRefId,
    input.linkType,
    actor
  );

  const existing = await getCountryPackReviewOverlay(normalizedCountryCode);
  const sourceRefIds = [
    ...new Set([...(existing?.sourceRefIds ?? []), input.sourceRefId])
  ];

  await upsertCountryPackReviewOverlay(
    normalizedCountryCode,
    {
      sourceRefIds,
      warnings: [],
      metadata: {}
    },
    actor
  );

  await recordEvent({
    actor,
    entityType: "country_pack",
    entityId: normalizedCountryCode,
    entityLabel: normalizedCountryCode,
    eventType: "country_pack.source_linked",
    metadata: {
      sourceRefId: input.sourceRefId,
      linkType: input.linkType
    }
  });

  return getCountryPackAdminRecord(normalizedCountryCode);
}

export async function unlinkCountryPackSource(
  countryCode: string,
  sourceRefId: string,
  actor: AdminActor
) {
  const normalizedCountryCode = countryCode.toUpperCase() === "EL" ? "GR" : countryCode.toUpperCase();

  await removeCountryPackSourceLink(normalizedCountryCode, sourceRefId);

  const existing = await getCountryPackReviewOverlay(normalizedCountryCode);

  if (existing) {
    await upsertCountryPackReviewOverlay(
      normalizedCountryCode,
      {
        sourceRefIds: existing.sourceRefIds.filter((id) => id !== sourceRefId),
        warnings: [],
        metadata: {}
      },
      actor
    );
  }

  await recordEvent({
    actor,
    entityType: "country_pack",
    entityId: normalizedCountryCode,
    entityLabel: normalizedCountryCode,
    eventType: "country_pack.source_unlinked",
    metadata: {
      sourceRefId
    }
  });

  return getCountryPackAdminRecord(normalizedCountryCode);
}
