import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  cleanupTransientXmlPayloads,
  createTransientXmlPayload,
  deleteTransientXmlPayload,
  inspectTransientXmlPayloadMetadata,
  readTransientXmlPayload,
  readTransientXmlPayloadReference,
  XML_TRANSIENT_PAYLOAD_EXPIRED_CODE,
  XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
  XML_TRANSIENT_PAYLOAD_MISSING_CODE,
  XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE
} from "./transient-xml-payload-store.js";

const fixedNow = new Date("2026-05-07T11:00:00.000Z");
const safeXml = "<Invoice><ID>TRANSIENT-STORE-STEP-44</ID></Invoice>";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function createTempRoot() {
  return mkdtemp(join(tmpdir(), "invoice-lantern-payloads-"));
}

test("transient payload store writes metadata and reads by safe id", async () => {
  const rootDir = await createTempRoot();

  try {
    const reference = await createTransientXmlPayload({
      xml: safeXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    const metadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });
    const readResult = await readTransientXmlPayload({
      reference,
      rootDir,
      now: fixedNow
    });

    assert.equal(reference.sha256, sha256(safeXml));
    assert.equal(reference.byteLength, Buffer.byteLength(safeXml, "utf8"));
    assert.equal(JSON.stringify(reference).includes(safeXml), false);
    assert.equal(metadata.exists, true);
    assert.equal(metadata.byteLength, Buffer.byteLength(safeXml, "utf8"));
    assert.equal(readResult.status, "available");
    assert.equal(
      readResult.status === "available" ? readResult.xml : "",
      safeXml
    );

    assert.equal(
      await deleteTransientXmlPayload({
        payloadId: reference.payloadId,
        rootDir
      }),
      true
    );

    const deletedMetadata = await inspectTransientXmlPayloadMetadata({
      payloadId: reference.payloadId,
      rootDir
    });

    assert.equal(deletedMetadata.exists, false);
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("transient payload references reject unsafe ids", async () => {
  const reference = readTransientXmlPayloadReference({
    payloadId: "../outside",
    sha256: "0".repeat(64),
    byteLength: 1,
    createdAt: fixedNow.toISOString(),
    expiresAt: fixedNow.toISOString(),
    storageProvider: "local_file_v1"
  });

  assert.equal(reference, null);
  await assert.rejects(
    deleteTransientXmlPayload({
      payloadId: "../outside"
    })
  );
});

test("transient payload read reports missing payload safely", async () => {
  const rootDir = await createTempRoot();
  const reference = {
    payloadId: "xmlpayload_00000000-0000-4000-8000-000000000000",
    sha256: "0".repeat(64),
    byteLength: 12,
    createdAt: fixedNow.toISOString(),
    expiresAt: new Date(fixedNow.getTime() + 60000).toISOString(),
    storageProvider: "local_file_v1" as const
  };

  try {
    const readResult = await readTransientXmlPayload({
      reference,
      rootDir,
      now: fixedNow
    });

    assert.equal(readResult.status, "failed");
    assert.equal(
      readResult.status === "failed" ? readResult.errorCode : "",
      XML_TRANSIENT_PAYLOAD_MISSING_CODE
    );
    assert.equal(JSON.stringify(readResult).includes("<Invoice"), false);
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("transient payload read detects expired payloads", async () => {
  const rootDir = await createTempRoot();

  try {
    const reference = await createTransientXmlPayload({
      xml: safeXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 60
    });
    const readResult = await readTransientXmlPayload({
      reference,
      rootDir,
      now: new Date(fixedNow.getTime() + 61000)
    });

    assert.equal(readResult.status, "failed");
    assert.equal(
      readResult.status === "failed" ? readResult.errorCode : "",
      XML_TRANSIENT_PAYLOAD_EXPIRED_CODE
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("transient payload read detects hash mismatch", async () => {
  const rootDir = await createTempRoot();

  try {
    const reference = await createTransientXmlPayload({
      xml: safeXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });

    await writeFile(
      join(rootDir, `${reference.payloadId}.xml`),
      "<Invoice><ID>TRANSIENT-STORE-STEP-45</ID></Invoice>",
      "utf8"
    );

    const readResult = await readTransientXmlPayload({
      reference,
      rootDir,
      now: fixedNow
    });

    assert.equal(readResult.status, "failed");
    assert.equal(
      readResult.status === "failed" ? readResult.errorCode : "",
      XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE
    );
    assert.equal(
      JSON.stringify(readResult).includes("TRANSIENT-STORE-STEP-45"),
      false
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("transient payload read detects size mismatch before reading XML", async () => {
  const rootDir = await createTempRoot();
  const reference = {
    payloadId: "xmlpayload_22222222-2222-4222-8222-222222222222",
    sha256: "2".repeat(64),
    byteLength: 999,
    createdAt: fixedNow.toISOString(),
    expiresAt: new Date(fixedNow.getTime() + 60000).toISOString(),
    storageProvider: "local_file_v1" as const
  };
  const rawXml = "<Invoice><ID>SIZE-MISMATCH-SECRET</ID></Invoice>";

  try {
    await writeFile(join(rootDir, `${reference.payloadId}.xml`), rawXml, "utf8");

    const readResult = await readTransientXmlPayload({
      reference,
      rootDir,
      now: fixedNow
    });

    assert.equal(readResult.status, "failed");
    assert.equal(
      readResult.status === "failed" ? readResult.errorCode : "",
      XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE
    );
    assert.equal(JSON.stringify(readResult).includes(rawXml), false);
    assert.equal(
      JSON.stringify(readResult).includes("SIZE-MISMATCH-SECRET"),
      false
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});

test("transient payload cleanup deletes expired payloads and old malformed orphans only", async () => {
  const rootDir = await createTempRoot();
  const expiredXml = "<Invoice><ID>CLEANUP-EXPIRED-SECRET</ID></Invoice>";
  const activeXml = "<Invoice><ID>CLEANUP-ACTIVE-SECRET</ID></Invoice>";
  const oldDate = new Date(fixedNow.getTime() - 700_000);

  try {
    const expiredReference = await createTransientXmlPayload({
      xml: expiredXml,
      rootDir,
      now: oldDate,
      ttlSeconds: 600
    });
    const activeReference = await createTransientXmlPayload({
      xml: activeXml,
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    const malformedPath = join(rootDir, "malformed-orphan.xml");

    await writeFile(
      malformedPath,
      "<Invoice><ID>CLEANUP-MALFORMED-SECRET</ID></Invoice>",
      "utf8"
    );
    await utimes(
      join(rootDir, `${expiredReference.payloadId}.xml`),
      oldDate,
      oldDate
    );
    await utimes(malformedPath, oldDate, oldDate);

    const cleanup = await cleanupTransientXmlPayloads({
      rootDir,
      now: fixedNow,
      ttlSeconds: 600
    });
    const expiredMetadata = await inspectTransientXmlPayloadMetadata({
      payloadId: expiredReference.payloadId,
      rootDir
    });
    const activeMetadata = await inspectTransientXmlPayloadMetadata({
      payloadId: activeReference.payloadId,
      rootDir
    });

    await assert.rejects(stat(malformedPath));
    assert.equal(cleanup.scannedCount, 3);
    assert.equal(cleanup.deletedCount, 2);
    assert.equal(cleanup.skippedCount, 1);
    assert.equal(cleanup.failedCount, 0);
    assert.equal(cleanup.storageProvider, "local_file_v1");
    assert.equal(expiredMetadata.exists, false);
    assert.equal(activeMetadata.exists, true);
    assert.equal(JSON.stringify(cleanup).includes(rootDir), false);
    assert.equal(JSON.stringify(cleanup).includes(expiredXml), false);
    assert.equal(JSON.stringify(cleanup).includes(activeXml), false);
    assert.equal(
      JSON.stringify(cleanup).includes("CLEANUP-MALFORMED-SECRET"),
      false
    );
  } finally {
    await rm(rootDir, {
      force: true,
      recursive: true
    });
  }
});
