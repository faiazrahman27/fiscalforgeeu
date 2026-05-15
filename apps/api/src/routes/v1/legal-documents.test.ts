import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import { legalDocumentRegistry } from "../../legal/legal-document-registry.js";
import { resolvePublishedVersionForDocument } from "../../repositories/legal-document-repository.js";

const legalAcceptancesPath = join(
  process.cwd(),
  ".data",
  "legal-document-acceptances.json"
);

let originalAcceptancesData: string | null = null;

before(async () => {
  try {
    originalAcceptancesData = await readFile(legalAcceptancesPath, "utf8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    originalAcceptancesData = null;
  }

  await rm(legalAcceptancesPath, {
    force: true
  });
});

after(async () => {
  if (originalAcceptancesData === null) {
    await rm(legalAcceptancesPath, {
      force: true
    });
    return;
  }

  await mkdir(dirname(legalAcceptancesPath), {
    recursive: true
  });
  await writeFile(legalAcceptancesPath, originalAcceptancesData, "utf8");
});

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string) {
  assert.equal(isPlainObject(value), true, `${label} should be an object`);

  return value as Record<string, unknown>;
}

function readDocumentsResponse(value: unknown) {
  const response = readRecord(value, "documents response");

  assert.equal(Array.isArray(response.documents), true);

  return response.documents as Record<string, unknown>[];
}

function createLegalVersionSupabaseStub(input: {
  currentVersion?: Record<string, unknown> | null;
  latestVersions?: Record<string, unknown>[];
  currentError?: { message: string } | null;
  latestError?: { message: string } | null;
}) {
  const calls: Array<{
    kind: "current" | "latest";
    eqs: Array<[string, unknown]>;
    orders: Array<[string, { ascending: boolean }]>;
    limit?: number;
  }> = [];

  return {
    calls,
    client: {
      from(table: string) {
        assert.equal(table, "legal_document_versions");

        const state: {
          eqs: Array<[string, unknown]>;
          orders: Array<[string, { ascending: boolean }]>;
        } = {
          eqs: [],
          orders: []
        };

        const builder = {
          select(_fields: string) {
            return builder;
          },
          eq(key: string, value: unknown) {
            state.eqs.push([key, value]);
            return builder;
          },
          order(column: string, options: { ascending: boolean }) {
            state.orders.push([column, options]);
            return builder;
          },
          async maybeSingle() {
            calls.push({
              kind: "current",
              eqs: [...state.eqs],
              orders: [...state.orders]
            });

            return {
              data: input.currentVersion ?? null,
              error: input.currentError ?? null
            };
          },
          async limit(count: number) {
            calls.push({
              kind: "latest",
              eqs: [...state.eqs],
              orders: [...state.orders],
              limit: count
            });

            return {
              data: input.latestVersions ?? [],
              error: input.latestError ?? null
            };
          }
        };

        return builder;
      }
    }
  };
}

test("legal document registry includes all required safe published documents", () => {
  const requiredDocumentKeys = [
    "terms",
    "privacy",
    "cookies",
    "dpa",
    "acceptable-use",
    "security",
    "disclaimer",
    "subprocessors",
    "retention",
    "incident-response",
    "vulnerability-disclosure",
    "trademark",
    "api-terms",
    "country-rule-pack-disclaimer",
    "webhook-simulator-notice",
    "vida-simulator-notice",
    "vies-evidence-notice",
    "xml-xsd-schematron-notice"
  ];

  for (const documentKey of requiredDocumentKeys) {
    const document = legalDocumentRegistry.find(
      (candidate) => candidate.documentKey === documentKey
    );

    assert.ok(document, `Expected legal document ${documentKey}`);
    assert.equal(document?.status, "published");
    assert.equal(document?.legalReviewRequired, true);
    assert.equal(document?.professionalReviewRequired, true);
    assert.equal(typeof document?.bodyMd, "string");
    assert.match(
      `${document?.bodyMd ?? ""} ${(document?.disclaimers ?? []).join(" ")}`,
      /professional .*review/i
    );
    assert.match(
      `${document?.bodyMd ?? ""} ${(document?.disclaimers ?? []).join(" ")}`,
      /not legal advice|not tax advice|not accounting advice|not privacy advice/i
    );
    assert.doesNotMatch(document?.bodyMd ?? "", /FiscalForge/i);
    assert.doesNotMatch(
      document?.bodyMd ?? "",
      /\bis official EU software\b|\bprovides official validation\b|\bis GDPR compliant\b|\bGDPR compliance guaranteed\b|\bcertifies compliance\b|\bis authority accepted\b|\blawyer-approved\b/i
    );
  }
});

test("legal document version resolution falls back from broken current version to latest published version", async () => {
  const latestVersion = {
    id: "legal_version_latest",
    legal_document_id: "legal_document_terms",
    version: "2026.05.15",
    status: "published",
    title: "Terms",
    body_md: "Latest published terms body.",
    legal_review_required: true,
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z"
  };
  const supabaseStub = createLegalVersionSupabaseStub({
    currentVersion: null,
    latestVersions: [latestVersion]
  });

  const resolvedVersion = await resolvePublishedVersionForDocument({
    supabase: supabaseStub.client as never,
    documentRow: {
      id: "legal_document_terms",
      document_key: "terms",
      title: "Terms",
      category: "terms",
      audience: "all",
      status: "published",
      is_required: true,
      requires_acceptance: true,
      legal_review_required: true,
      current_version_id: "missing_current_version",
      created_at: "2026-05-15T00:00:00.000Z",
      updated_at: "2026-05-15T00:00:00.000Z"
    },
    versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_READ_FAILED"
  });

  assert.equal(resolvedVersion?.id, latestVersion.id);
  assert.equal(supabaseStub.calls.length, 2);
  assert.equal(supabaseStub.calls[0]?.kind, "current");
  assert.deepEqual(supabaseStub.calls[0]?.eqs.at(-1), [
    "id",
    "missing_current_version"
  ]);
  assert.equal(supabaseStub.calls[1]?.kind, "latest");
  assert.equal(supabaseStub.calls[1]?.limit, 1);
  assert.deepEqual(
    supabaseStub.calls[1]?.orders.map(([column]) => column),
    ["published_at", "created_at"]
  );
});

test("legal document version resolution falls back when current version link is null", async () => {
  const latestVersion = {
    id: "legal_version_latest_null_current",
    legal_document_id: "legal_document_privacy",
    version: "2026.05.15",
    status: "published",
    title: "Privacy",
    body_md: "Latest published privacy body.",
    legal_review_required: true,
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z"
  };
  const supabaseStub = createLegalVersionSupabaseStub({
    latestVersions: [latestVersion]
  });

  const resolvedVersion = await resolvePublishedVersionForDocument({
    supabase: supabaseStub.client as never,
    documentRow: {
      id: "legal_document_privacy",
      document_key: "privacy",
      title: "Privacy",
      category: "privacy",
      audience: "all",
      status: "published",
      is_required: true,
      requires_acceptance: true,
      legal_review_required: true,
      current_version_id: null,
      created_at: "2026-05-15T00:00:00.000Z",
      updated_at: "2026-05-15T00:00:00.000Z"
    },
    versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_READ_FAILED"
  });

  assert.equal(resolvedVersion?.id, latestVersion.id);
  assert.equal(supabaseStub.calls.length, 1);
  assert.equal(supabaseStub.calls[0]?.kind, "latest");
});

test("legal document version resolution keeps Supabase read failures sanitized", async () => {
  const supabaseStub = createLegalVersionSupabaseStub({
    currentError: {
      message: "raw Supabase detail should not leak"
    }
  });

  await assert.rejects(
    () =>
      resolvePublishedVersionForDocument({
        supabase: supabaseStub.client as never,
        documentRow: {
          id: "legal_document_terms",
          document_key: "terms",
          title: "Terms",
          category: "terms",
          audience: "all",
          status: "published",
          is_required: true,
          requires_acceptance: true,
          legal_review_required: true,
          current_version_id: "broken_current_version",
          created_at: "2026-05-15T00:00:00.000Z",
          updated_at: "2026-05-15T00:00:00.000Z"
        },
        versionReadFailureCode: "LEGAL_DOCUMENT_VERSION_READ_FAILED"
      }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.doesNotMatch(
        (error as Error).message,
        /raw Supabase detail/i
      );

      return true;
    }
  );
});

test("public legal routes list and read published documents without unsafe body injection", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/legal/documents"
  });

  assert.equal(listResponse.statusCode, 200);

  const documents = readDocumentsResponse(listResponse.json());
  const termsSummary = documents.find(
    (document) => document.documentKey === "terms"
  );

  assert.ok(termsSummary);
  assert.equal(termsSummary.bodyMd, undefined);
  assert.equal(termsSummary.status, "published");
  assert.equal(termsSummary.legalReviewRequired, true);
  assert.match(JSON.stringify(listResponse.json()), /not legal advice/i);

  const detailResponse = await app.inject({
    method: "GET",
    url: "/api/v1/legal/documents/privacy"
  });

  assert.equal(detailResponse.statusCode, 200);

  const detail = readRecord(detailResponse.json(), "detail response");
  const document = readRecord(detail.document, "document");

  assert.equal(document.documentKey, "privacy");
  assert.equal(document.status, "published");
  assert.equal(document.legalReviewRequired, true);
  assert.equal(document.professionalReviewRequired, true);
  assert.match(String(document.bodyMd), /GDPR-aware/i);
  assert.match(String(document.bodyMd), /professional .*review/i);
  assert.doesNotMatch(String(document.bodyMd), /<script/i);

  const missingResponse = await app.inject({
    method: "GET",
    url: "/api/v1/legal/documents/unpublished-draft-only"
  });

  assert.equal(missingResponse.statusCode, 404);
});

test("signed users can accept latest required legal documents idempotently without raw IP or user-agent", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const headers = {
    "content-type": "application/json",
    "user-agent": "UnitTestBrowser/1.0 raw agent should not be stored",
    "x-test-user-email": "legal-acceptance@example.test",
    "x-test-user-id": "00000000-0000-4000-8000-000000000999"
  };

  const firstResponse = await app.inject({
    method: "POST",
    url: "/api/v1/legal/documents/terms/accept",
    headers,
    payload: {
      acceptanceContext: "workspace",
      metadata: {
        source: "route-test"
      }
    }
  });

  assert.equal(firstResponse.statusCode, 201);

  const firstBody = readRecord(firstResponse.json(), "first accept response");
  const firstRecord = readRecord(firstBody.record, "first acceptance record");

  assert.equal(firstBody.alreadyAccepted, false);
  assert.equal(firstRecord.documentKey, "terms");
  assert.equal(firstRecord.acceptanceContext, "workspace");
  assert.match(String(firstRecord.ipHash), /^[a-f0-9]{64}$/);
  assert.match(String(firstRecord.userAgentHash), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(firstBody), /UnitTestBrowser/);
  assert.doesNotMatch(JSON.stringify(firstBody), /127\.0\.0\.1/);
  assert.match(JSON.stringify(firstBody), /does not create official compliance/i);

  const secondResponse = await app.inject({
    method: "POST",
    url: "/api/v1/legal/documents/terms/accept",
    headers,
    payload: {
      acceptanceContext: "workspace"
    }
  });

  assert.equal(secondResponse.statusCode, 200);

  const secondBody = readRecord(secondResponse.json(), "second accept response");

  assert.equal(secondBody.alreadyAccepted, true);

  const acceptancesResponse = await app.inject({
    method: "GET",
    url: "/api/v1/legal/acceptances/me",
    headers
  });

  assert.equal(acceptancesResponse.statusCode, 200);
  assert.match(
    JSON.stringify(acceptancesResponse.json()),
    /not.*tax.*accounting.*privacy.*officially compliant/i
  );
});

test("organization API keys cannot accept legal documents", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/legal/documents/api-terms/accept",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.DEV_API_KEY
    },
    payload: {
      acceptanceContext: "api_terms"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.match(JSON.stringify(response.json()), /Supabase bearer token/i);
});
