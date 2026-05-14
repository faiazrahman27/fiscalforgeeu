import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";

const adminHeaders = {
  "x-test-user-email": "platform-admin@example.test",
  "x-test-user-id": "00000000-0000-4000-8000-000000000901"
};

const nonAdminHeaders = {
  "x-test-user-email": "workspace-owner@example.test",
  "x-test-user-id": "00000000-0000-4000-8000-000000000902",
  "x-test-workspace-role": "owner"
};

const adminDataFiles = [
  "admin-validation-rules.json",
  "admin-source-references.json",
  "admin-rule-source-links.json",
  "admin-country-pack-reviews.json",
  "admin-country-pack-source-links.json",
  "admin-lifecycle-events.json"
];

const backups = new Map<string, string | null>();

function dataPath(fileName: string) {
  return join(process.cwd(), ".data", fileName);
}

async function backupAdminDataFiles() {
  backups.clear();

  for (const fileName of adminDataFiles) {
    const filePath = dataPath(fileName);

    try {
      backups.set(fileName, await readFile(filePath, "utf8"));
    } catch {
      backups.set(fileName, null);
    }

    await rm(filePath, {
      force: true
    });
  }
}

async function restoreAdminDataFiles() {
  for (const fileName of adminDataFiles) {
    const filePath = dataPath(fileName);
    const backup = backups.get(fileName);

    if (backup === null || backup === undefined) {
      await rm(filePath, {
        force: true
      });
      continue;
    }

    await mkdir(dirname(filePath), {
      recursive: true
    });
    await writeFile(filePath, backup, "utf8");
  }

  backups.clear();
}

function createSourcePayload() {
  return {
    title: `European Commission public source ${randomUUID()}`,
    publisher: "European Commission",
    jurisdiction: "EU",
    url: "https://commission.europa.eu/example-source",
    sourceType: "eu_guidance",
    confidenceStatus: "reviewed",
    reviewedAt: "2026-05-14",
    notes:
      "Metadata-only source reference for platform rule traceability; no source text is scraped."
  };
}

function createRulePayload(input?: {
  sourceRefIds?: string[];
  technical?: boolean;
  code?: string;
}) {
  const technical = input?.technical === true;

  return {
    code: input?.code ?? `ADMIN_TEST_RULE_${randomUUID().slice(0, 8)}`,
    title: technical ? "Technical API guard" : "VAT source-linked rule",
    description: technical
      ? "Technical sandbox guard with no legal or tax claim."
      : "VAT-like rule metadata that requires source traceability before publishing.",
    message: technical
      ? "Technical sandbox guard triggered."
      : "VAT metadata requires reviewed source context.",
    category: technical ? "API" : "VAT_ID",
    severity: "warning",
    legalConfidence: technical ? "technical" : "professional_review_required",
    jurisdiction: "EU",
    ruleSet: "INVOICE_LANTERN_ADMIN_TEST_RULES",
    ruleVersion: "2026.05.test",
    sourceRefIds: input?.sourceRefIds ?? [],
    professionalReviewRequired: !technical,
    fixSuggestion: "Review the source-linked metadata before relying on output."
  };
}

beforeEach(async () => {
  await backupAdminDataFiles();
});

afterEach(async () => {
  await restoreAdminDataFiles();
});

test("admin routes reject unauthenticated users, API keys, and non-platform workspace admins", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const unauthenticated = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    payload: createSourcePayload()
  });

  assert.equal(unauthenticated.statusCode, 401);
  assert.match(unauthenticated.body, /AUTH_TOKEN_REQUIRED/);

  const apiKey = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: {
      "x-api-key": env.DEV_API_KEY
    },
    payload: createSourcePayload()
  });

  assert.equal(apiKey.statusCode, 401);
  assert.match(apiKey.body, /AUTH_TOKEN_REQUIRED/);

  const nonAdmin = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: nonAdminHeaders,
    payload: createSourcePayload()
  });

  assert.equal(nonAdmin.statusCode, 403);
  assert.match(nonAdmin.body, /PLATFORM_ADMIN_REQUIRED/);

  const context = await app.inject({
    method: "GET",
    url: "/api/v1/admin/context",
    headers: nonAdminHeaders
  });

  assert.equal(context.statusCode, 200);
  assert.equal(context.json().isPlatformAdmin, false);
  assert.doesNotMatch(context.body, /platform-admin@example\.test/);
});

test("platform admins can create and update source references with safe URL validation", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const invalidUrl = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: adminHeaders,
    payload: {
      ...createSourcePayload(),
      url: "javascript:alert(1)"
    }
  });

  assert.equal(invalidUrl.statusCode, 400);
  assert.match(invalidUrl.body, /Source URL must use http or https|VALIDATION_ERROR/);

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: adminHeaders,
    payload: createSourcePayload()
  });

  assert.equal(createResponse.statusCode, 201);

  const source = createResponse.json().source as Record<string, unknown>;

  assert.equal(source.sourceType, "eu_guidance");
  assert.equal(source.confidenceStatus, "reviewed");
  assert.doesNotMatch(JSON.stringify(source), /<html|sourceText|documentBody/i);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/sources/${source.id}`,
    headers: adminHeaders,
    payload: {
      confidenceStatus: "deprecated",
      notes: "Deprecated for test traceability."
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().source.confidenceStatus, "deprecated");
});

test("rule publishing enforces source requirements and preserves lifecycle boundaries", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const sourceResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: adminHeaders,
    payload: createSourcePayload()
  });
  const sourceId = sourceResponse.json().source.id as string;

  const unsourcedRuleResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/rules",
    headers: adminHeaders,
    payload: createRulePayload({
      code: "ADMIN_TEST_UNSOURCED_VAT"
    })
  });

  assert.equal(unsourcedRuleResponse.statusCode, 201);

  const unsourcedRuleId = unsourcedRuleResponse.json().rule.id as string;
  const blockedPublish = await app.inject({
    method: "POST",
    url: `/api/v1/admin/rules/${unsourcedRuleId}/publish`,
    headers: adminHeaders
  });

  assert.equal(blockedPublish.statusCode, 409);
  assert.match(blockedPublish.body, /SOURCE_REQUIRED/);

  const sourcedRuleResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/rules",
    headers: adminHeaders,
    payload: createRulePayload({
      code: "ADMIN_TEST_SOURCED_VAT",
      sourceRefIds: [sourceId]
    })
  });

  assert.equal(sourcedRuleResponse.statusCode, 201);

  const duplicateResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/rules",
    headers: adminHeaders,
    payload: createRulePayload({
      code: "ADMIN_TEST_SOURCED_VAT",
      sourceRefIds: [sourceId]
    })
  });

  assert.equal(duplicateResponse.statusCode, 409);
  assert.match(duplicateResponse.body, /RULE_VERSION_CONFLICT/);

  const sourcedRuleId = sourcedRuleResponse.json().rule.id as string;
  const publishResponse = await app.inject({
    method: "POST",
    url: `/api/v1/admin/rules/${sourcedRuleId}/publish`,
    headers: adminHeaders
  });

  assert.equal(publishResponse.statusCode, 200);
  assert.equal(publishResponse.json().rule.status, "published");

  const editPublished = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/rules/${sourcedRuleId}`,
    headers: adminHeaders,
    payload: {
      title: "Should not overwrite published metadata"
    }
  });

  assert.equal(editPublished.statusCode, 409);
  assert.match(editPublished.body, /historical validation reports|historical explanation/);

  const technicalRuleResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/rules",
    headers: adminHeaders,
    payload: createRulePayload({
      code: "ADMIN_TEST_TECHNICAL",
      technical: true
    })
  });

  const technicalRuleId = technicalRuleResponse.json().rule.id as string;
  const technicalPublish = await app.inject({
    method: "POST",
    url: `/api/v1/admin/rules/${technicalRuleId}/publish`,
    headers: adminHeaders
  });

  assert.equal(technicalPublish.statusCode, 200);
  assert.equal(technicalPublish.json().rule.status, "published");

  const deprecate = await app.inject({
    method: "POST",
    url: `/api/v1/admin/rules/${technicalRuleId}/deprecate`,
    headers: adminHeaders
  });

  assert.equal(deprecate.statusCode, 200);
  assert.equal(deprecate.json().rule.status, "deprecated");
});

test("country-pack admin list preserves EU coverage and GR/EL compatibility", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/admin/country-packs",
    headers: adminHeaders
  });

  assert.equal(listResponse.statusCode, 200);

  const packs = listResponse.json().countryPacks as Record<string, unknown>[];

  assert.equal(packs.length, 28);
  assert.ok(packs.some((pack) => pack.countryCode === "EU"));
  assert.ok(packs.some((pack) => pack.countryCode === "GR"));
  assert.equal(packs.some((pack) => pack.countryCode === "EL"), false);

  const elDetail = await app.inject({
    method: "GET",
    url: "/api/v1/admin/country-packs/EL",
    headers: adminHeaders
  });

  assert.equal(elDetail.statusCode, 200);
  assert.equal(elDetail.json().countryPack.countryCode, "GR");
  assert.match(elDetail.body, /EL remains VAT-prefix compatibility/);
});

test("country-pack review metadata requires platform admin and source-backed reviewed status", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const nonAdminUpdate = await app.inject({
    method: "PATCH",
    url: "/api/v1/admin/country-packs/DE/review",
    headers: nonAdminHeaders,
    payload: {
      reviewStatus: "reviewed",
      legalConfidence: "standard_based",
      sourceRefIds: [],
      warnings: [],
      metadata: {}
    }
  });

  assert.equal(nonAdminUpdate.statusCode, 403);

  const unsourcedReview = await app.inject({
    method: "PATCH",
    url: "/api/v1/admin/country-packs/DE/review",
    headers: adminHeaders,
    payload: {
      reviewStatus: "reviewed",
      legalConfidence: "standard_based",
      sourceRefIds: [],
      warnings: [],
      metadata: {}
    }
  });

  assert.equal(unsourcedReview.statusCode, 409);
  assert.match(unsourcedReview.body, /SOURCE_REQUIRED/);

  const sourceResponse = await app.inject({
    method: "POST",
    url: "/api/v1/admin/sources",
    headers: adminHeaders,
    payload: createSourcePayload()
  });
  const sourceId = sourceResponse.json().source.id as string;

  const sourcedReview = await app.inject({
    method: "PATCH",
    url: "/api/v1/admin/country-packs/DE/review",
    headers: adminHeaders,
    payload: {
      reviewStatus: "reviewed",
      legalConfidence: "standard_based",
      sourceRefIds: [sourceId],
      reviewedAt: "2026-05-14",
      reviewerLabel: "Internal source review",
      professionalReviewRequired: false,
      warnings: ["Professional review is still recommended for real invoices."],
      metadata: {}
    }
  });

  assert.equal(sourcedReview.statusCode, 200);

  const countryPack = sourcedReview.json().countryPack as Record<string, unknown>;

  assert.equal(countryPack.countryCode, "DE");
  assert.match(JSON.stringify(countryPack), /Internal source review/);
  assert.doesNotMatch(
    JSON.stringify(countryPack),
    /\bofficial validation\b|\btax authority endorsement\b|\bPeppol certified\b|\bEN 16931 compliant\b|\bViDA compliant\b/
  );
});

