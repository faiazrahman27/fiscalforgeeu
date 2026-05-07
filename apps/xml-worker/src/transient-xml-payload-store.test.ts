import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createTransientXmlPayload,
  deleteTransientXmlPayload,
  inspectTransientXmlPayloadMetadata,
  readTransientXmlPayload,
  readTransientXmlPayloadReference,
  XML_TRANSIENT_PAYLOAD_EXPIRED_CODE,
  XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
  XML_TRANSIENT_PAYLOAD_MISSING_CODE
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
