import { randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { inspectXmlSafety } from "@invoice-lantern/ubl";
import { env } from "../config/env.js";
import { calculateXmlSha256, getUtf8ByteLength } from "./xml-validation-job-service.js";

export const TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER = "local_file_v1";
export const DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS = 600;

export type TransientXmlPayloadReference = {
  payloadId: string;
  sha256: string;
  byteLength: number;
  createdAt: string;
  expiresAt: string;
  storageProvider: typeof TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER;
};

export type CreateTransientXmlPayloadInput = {
  xml: string;
  rootDir?: string;
  now?: Date;
  ttlSeconds?: number;
  maxBytes?: number;
};

const safePayloadIdPattern = /^xmlpayload_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getMonorepoRootFromCwd() {
  const cwd = process.cwd();
  const baseName = path.basename(cwd);

  if (baseName === "api" || baseName === "xml-worker" || baseName === "web") {
    return path.resolve(cwd, "..", "..");
  }

  if (baseName === "apps") {
    return path.resolve(cwd, "..");
  }

  return cwd;
}

export function getDefaultTransientXmlPayloadRootDir() {
  return (
    env.XML_TRANSIENT_PAYLOAD_DIR ||
    path.join(getMonorepoRootFromCwd(), ".data", "xml-transient-payloads")
  );
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function isSafeTransientXmlPayloadId(payloadId: string) {
  return safePayloadIdPattern.test(payloadId);
}

function resolveTransientXmlPayloadPath(input: {
  rootDir: string;
  payloadId: string;
}) {
  if (!isSafeTransientXmlPayloadId(input.payloadId)) {
    throw new Error("Unsafe transient XML payload id.");
  }

  const resolvedRoot = path.resolve(input.rootDir);
  const resolvedPath = path.resolve(resolvedRoot, `${input.payloadId}.xml`);
  const rootPrefix = `${resolvedRoot}${path.sep}`;

  if (!resolvedPath.startsWith(rootPrefix)) {
    throw new Error("Transient XML payload path escaped the configured root.");
  }

  return resolvedPath;
}

function buildPayloadReference(input: {
  payloadId: string;
  xml: string;
  createdAt: string;
  expiresAt: string;
}): TransientXmlPayloadReference {
  return {
    payloadId: input.payloadId,
    sha256: calculateXmlSha256(input.xml),
    byteLength: getUtf8ByteLength(input.xml),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    storageProvider: TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
  };
}

export async function createTransientXmlPayload(
  input: CreateTransientXmlPayloadInput
): Promise<TransientXmlPayloadReference> {
  const maxBytes = normalizePositiveInteger(input.maxBytes, env.API_BODY_LIMIT_BYTES);
  const byteLength = getUtf8ByteLength(input.xml);

  if (byteLength > maxBytes) {
    throw new Error("Transient XML payload is too large.");
  }

  const safety = inspectXmlSafety(input.xml, {
    maxBytes
  });

  if (!safety.safe) {
    throw new Error("Transient XML payload failed XML safety inspection.");
  }

  const rootDir = input.rootDir ?? getDefaultTransientXmlPayloadRootDir();
  const createdAtDate = input.now ?? new Date();
  const createdAt = createdAtDate.toISOString();
  const ttlSeconds = normalizePositiveInteger(
    input.ttlSeconds,
    env.XML_TRANSIENT_PAYLOAD_TTL_SECONDS
  );
  const expiresAtDate = new Date(createdAtDate);
  expiresAtDate.setSeconds(expiresAtDate.getSeconds() + ttlSeconds);

  const payloadId = `xmlpayload_${randomUUID()}`;
  const payloadPath = resolveTransientXmlPayloadPath({
    rootDir,
    payloadId
  });
  const reference = buildPayloadReference({
    payloadId,
    xml: input.xml,
    createdAt,
    expiresAt: expiresAtDate.toISOString()
  });

  await mkdir(rootDir, {
    recursive: true
  });
  await writeFile(payloadPath, input.xml, {
    encoding: "utf8",
    flag: "wx"
  });

  return reference;
}

export async function deleteTransientXmlPayload(input: {
  payloadId: string;
  rootDir?: string;
}) {
  const rootDir = input.rootDir ?? getDefaultTransientXmlPayloadRootDir();
  const payloadPath = resolveTransientXmlPayloadPath({
    rootDir,
    payloadId: input.payloadId
  });

  try {
    await unlink(payloadPath);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

export async function inspectTransientXmlPayloadMetadata(input: {
  payloadId: string;
  rootDir?: string;
}) {
  const rootDir = input.rootDir ?? getDefaultTransientXmlPayloadRootDir();
  const payloadPath = resolveTransientXmlPayloadPath({
    rootDir,
    payloadId: input.payloadId
  });

  try {
    const payloadStat = await stat(payloadPath);

    return {
      payloadId: input.payloadId,
      exists: true,
      byteLength: payloadStat.size,
      storageProvider: TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        payloadId: input.payloadId,
        exists: false,
        byteLength: 0,
        storageProvider: TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
      };
    }

    throw error;
  }
}
