import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { buildApp } from "../../app.js";
import { env } from "../../config/env.js";
import type { WorkspaceAuthorizationContext } from "../../middleware/require-workspace-role.js";
import { workspaceBusinessProfileRoutes } from "./workspace-business-profiles.js";
import { workspaceContactRoutes } from "./workspace-contacts.js";

type CapturedRouteHandler = (
  request: Record<string, unknown>,
  reply: ReturnType<typeof createRouteReply>
) => Promise<unknown> | unknown;

const dataFiles = ["business-profiles.json", "contacts.json"];
const backups = new Map<string, string | null>();

const organizationA = "00000000-0000-4000-8000-00000000a101";
const organizationB = "00000000-0000-4000-8000-00000000b101";
const ownerUserId = "00000000-0000-4000-8000-00000000a102";

before(async () => {
  for (const fileName of dataFiles) {
    const filePath = toDataPath(fileName);

    try {
      backups.set(fileName, await readFile(filePath, "utf8"));
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }

      backups.set(fileName, null);
    }
  }
});

beforeEach(async () => {
  for (const fileName of dataFiles) {
    await rm(toDataPath(fileName), {
      force: true
    });
  }
});

after(async () => {
  for (const fileName of dataFiles) {
    const filePath = toDataPath(fileName);
    const backup = backups.get(fileName) ?? null;

    if (backup === null) {
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
});

function toDataPath(fileName: string) {
  return join(process.cwd(), ".data", fileName);
}

function isFileNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function createContext(
  input: {
    organizationId?: string;
    role?: WorkspaceAuthorizationContext["membershipRole"];
    userId?: string;
  } = {}
): WorkspaceAuthorizationContext {
  const organizationId = input.organizationId ?? organizationA;

  return {
    userId: input.userId ?? ownerUserId,
    accessToken: "test-signed-user-token",
    organizationId,
    organizationName: organizationId === organizationA ? "Org A" : "Org B",
    organizationSlug: organizationId === organizationA ? "org-a" : "org-b",
    membershipRole: input.role ?? "owner",
    userEmail: "owner@example.test"
  };
}

function createRouteReply() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return payload;
    }
  };
}

async function getRouteHandler(method: string, path: string) {
  const handlers = new Map<string, CapturedRouteHandler>();
  const appStub = {
    get(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`GET ${routePath}`, handler);
      return appStub;
    },
    post(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`POST ${routePath}`, handler);
      return appStub;
    },
    patch(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`PATCH ${routePath}`, handler);
      return appStub;
    },
    delete(routePath: string, _options: unknown, handler: CapturedRouteHandler) {
      handlers.set(`DELETE ${routePath}`, handler);
      return appStub;
    }
  };

  await workspaceBusinessProfileRoutes(appStub as never);
  await workspaceContactRoutes(appStub as never);

  const handler = handlers.get(`${method} ${path}`);

  assert.ok(handler, `Expected route handler ${method} ${path}`);

  return handler;
}

function readRecord(value: unknown) {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);

  return value as Record<string, unknown>;
}

function readRecordId(value: unknown) {
  const record = readRecord(value);
  const id = record.id;

  assert.equal(typeof id, "string");

  return id as string;
}

async function createProfile(displayName: string, organizationId = organizationA) {
  const handler = await getRouteHandler("POST", "/business-profiles");
  const reply = createRouteReply();
  const result = await handler(
    {
      body: {
        profileType: "seller",
        displayName,
        countryCode: "DE",
        bankAccountLabel: "Operating account",
        bankAccountLast4: "1234"
      },
      workspaceAuthorization: createContext({ organizationId })
    },
    reply
  );

  assert.equal(reply.statusCode, 201);

  const body = readRecord(reply.payload ?? result);

  return readRecord(body.record);
}

test("workspace business profile routes create and list active profiles", async () => {
  const profile = await createProfile("Seller profile");
  const handler = await getRouteHandler("GET", "/business-profiles");
  const reply = createRouteReply();
  const result = await handler(
    {
      query: {},
      workspaceAuthorization: createContext()
    },
    reply
  );
  const body = readRecord(reply.payload ?? result);
  const records = body.records as Record<string, unknown>[];

  assert.equal(reply.statusCode, 200);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, profile.id);
  assert.equal(records[0]?.bankAccountLabel, "Operating account");
  assert.equal("bankAccountNumber" in (records[0] ?? {}), false);
  assert.match(JSON.stringify(body), /not official registration verification/i);
});

test("workspace contact routes create and list contacts", async () => {
  const profile = await createProfile("Buyer-linked profile");
  const createHandler = await getRouteHandler("POST", "/contacts");
  const createReply = createRouteReply();
  const createResult = await createHandler(
    {
      body: {
        businessProfileId: profile.id,
        contactType: "business",
        displayName: "Buyer contact",
        email: "buyer@example.test",
        countryCode: "DE"
      },
      workspaceAuthorization: createContext()
    },
    createReply
  );

  assert.equal(createReply.statusCode, 201);

  const createdBody = readRecord(createReply.payload ?? createResult);
  const contactId = readRecordId(createdBody.record);
  const listHandler = await getRouteHandler("GET", "/contacts");
  const listReply = createRouteReply();
  const listResult = await listHandler(
    {
      query: {},
      workspaceAuthorization: createContext()
    },
    listReply
  );
  const listBody = readRecord(listReply.payload ?? listResult);
  const records = listBody.records as Record<string, unknown>[];

  assert.equal(listReply.statusCode, 200);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, contactId);
  assert.equal(records[0]?.businessProfileId, profile.id);
});

test("workspace contacts cannot link to another organization's business profile", async () => {
  const otherProfile = await createProfile("Other org profile", organizationB);
  const handler = await getRouteHandler("POST", "/contacts");
  const reply = createRouteReply();
  const result = await handler(
    {
      body: {
        businessProfileId: otherProfile.id,
        contactType: "business",
        displayName: "Cross org contact"
      },
      workspaceAuthorization: createContext({ organizationId: organizationA })
    },
    reply
  );

  assert.equal(reply.statusCode, 404);
  assert.match(JSON.stringify(reply.payload ?? result), /BUSINESS_PROFILE_NOT_FOUND/);
});

test("workspace profile and contact routes reject unknown fields", async () => {
  const profileHandler = await getRouteHandler("POST", "/business-profiles");
  const profileReply = createRouteReply();
  const profileResult = await profileHandler(
    {
      body: {
        profileType: "seller",
        displayName: "Unsafe profile",
        countryCode: "DE",
        iban: "DE89370400440532013000"
      },
      workspaceAuthorization: createContext()
    },
    profileReply
  );

  assert.equal(profileReply.statusCode, 400);
  assert.match(JSON.stringify(profileReply.payload ?? profileResult), /VALIDATION_ERROR/);

  const contactHandler = await getRouteHandler("POST", "/contacts");
  const contactReply = createRouteReply();
  const contactResult = await contactHandler(
    {
      body: {
        displayName: "Unsafe contact",
        rawXml: "<Invoice />"
      },
      workspaceAuthorization: createContext()
    },
    contactReply
  );

  assert.equal(contactReply.statusCode, 400);
  assert.match(JSON.stringify(contactReply.payload ?? contactResult), /VALIDATION_ERROR/);
});

test("workspace profile and contact mutators reject viewer role", async () => {
  const profileHandler = await getRouteHandler("POST", "/business-profiles");
  const profileReply = createRouteReply();
  const profileResult = await profileHandler(
    {
      body: {
        profileType: "seller",
        displayName: "Viewer profile",
        countryCode: "DE"
      },
      workspaceAuthorization: createContext({ role: "viewer" })
    },
    profileReply
  );

  assert.equal(profileReply.statusCode, 403);
  assert.match(
    JSON.stringify(profileReply.payload ?? profileResult),
    /WORKSPACE_BUSINESS_RECORD_MUTATION_ROLE_REQUIRED/
  );

  const contactHandler = await getRouteHandler("POST", "/contacts");
  const contactReply = createRouteReply();
  const contactResult = await contactHandler(
    {
      body: {
        displayName: "Viewer contact"
      },
      workspaceAuthorization: createContext({ role: "viewer" })
    },
    contactReply
  );

  assert.equal(contactReply.statusCode, 403);
  assert.match(
    JSON.stringify(contactReply.payload ?? contactResult),
    /WORKSPACE_BUSINESS_RECORD_MUTATION_ROLE_REQUIRED/
  );
});

test("organization API keys cannot use signed-user workspace profile/contact routes", async (t) => {
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const responses = await Promise.all([
    app.inject({
      method: "GET",
      url: "/api/v1/workspace/business-profiles",
      headers: {
        "x-api-key": env.DEV_API_KEY
      }
    }),
    app.inject({
      method: "POST",
      url: "/api/v1/workspace/contacts",
      headers: {
        "x-api-key": env.DEV_API_KEY
      },
      payload: {
        displayName: "API key contact"
      }
    })
  ]);

  for (const response of responses) {
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /AUTH_TOKEN_REQUIRED/);
  }
});
