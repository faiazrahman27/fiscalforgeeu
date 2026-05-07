import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { inspectXmlSafety } from "@invoice-lantern/ubl";

export const TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER = "local_file_v1";
export const DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS = 600;
export const DEFAULT_TRANSIENT_XML_PAYLOAD_MAX_BYTES = 2 * 1024 * 1024;

export const XML_TRANSIENT_PAYLOAD_ID_INVALID_CODE =
  "XML_TRANSIENT_PAYLOAD_ID_INVALID";
export const XML_TRANSIENT_PAYLOAD_MISSING_CODE =
  "XML_TRANSIENT_PAYLOAD_MISSING";
export const XML_TRANSIENT_PAYLOAD_EXPIRED_CODE =
  "XML_TRANSIENT_PAYLOAD_EXPIRED";
export const XML_TRANSIENT_PAYLOAD_TOO_LARGE_CODE =
  "XML_TRANSIENT_PAYLOAD_TOO_LARGE";
export const XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE =
  "XML_TRANSIENT_PAYLOAD_HASH_MISMATCH";
export const XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE =
  "XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH";
export const XML_TRANSIENT_PAYLOAD_UNSAFE_CODE =
  "XML_TRANSIENT_PAYLOAD_UNSAFE";
export const XML_TRANSIENT_PAYLOAD_READ_FAILED_CODE =
  "XML_TRANSIENT_PAYLOAD_READ_FAILED";
export const XML_TRANSIENT_PAYLOAD_UNREADABLE_CODE =
  XML_TRANSIENT_PAYLOAD_READ_FAILED_CODE;

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

export type ReadTransientXmlPayloadResult =
  | {
      status: "available";
      xml: string;
      reference: TransientXmlPayloadReference;
    }
  | {
      status: "failed";
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
      reference?: TransientXmlPayloadReference;
    };

export type CleanupTransientXmlPayloadsSummary = {
  scannedCount: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
  storageProvider: typeof TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER;
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
    process.env.XML_TRANSIENT_PAYLOAD_DIR?.trim() ||
    path.join(getMonorepoRootFromCwd(), ".data", "xml-transient-payloads")
  );
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function sha256Hex(xml: string) {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

function getUtf8ByteLength(xml: string) {
  return Buffer.byteLength(xml, "utf8");
}

export function isSafeTransientXmlPayloadId(payloadId: string) {
  return safePayloadIdPattern.test(payloadId);
}

function buildFailure(input: {
  errorCode: string;
  errorMessage: string;
  retryable?: boolean;
  reference?: TransientXmlPayloadReference;
}): ReadTransientXmlPayloadResult {
  return {
    status: "failed",
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    retryable: input.retryable ?? false,
    ...(input.reference ? { reference: input.reference } : {})
  };
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

function resolveTransientXmlPayloadEntryPath(input: {
  rootDir: string;
  fileName: string;
}) {
  const resolvedRoot = path.resolve(input.rootDir);
  const resolvedPath = path.resolve(resolvedRoot, input.fileName);
  const rootPrefix = `${resolvedRoot}${path.sep}`;

  if (!resolvedPath.startsWith(rootPrefix)) {
    return null;
  }

  return resolvedPath;
}

function readPayloadIdFromFileName(fileName: string) {
  if (!fileName.endsWith(".xml")) {
    return null;
  }

  const payloadId = fileName.slice(0, -".xml".length);

  return isSafeTransientXmlPayloadId(payloadId) ? payloadId : null;
}

function shouldConsiderMalformedOrphan(fileName: string) {
  return fileName.endsWith(".xml") && readPayloadIdFromFileName(fileName) === null;
}

function isExpiredByFileMetadata(input: {
  modifiedAtMs: number;
  now: Date;
  ttlSeconds: number;
}) {
  return input.modifiedAtMs <= input.now.getTime() - input.ttlSeconds * 1000;
}

function buildPayloadReference(input: {
  payloadId: string;
  xml: string;
  createdAt: string;
  expiresAt: string;
  sha256: string;
}): TransientXmlPayloadReference {
  return {
    payloadId: input.payloadId,
    sha256: input.sha256,
    byteLength: getUtf8ByteLength(input.xml),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    storageProvider: TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
  };
}

export function readTransientXmlPayloadReference(
  value: unknown
): TransientXmlPayloadReference | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const payloadId = record.payloadId;
  const sha256 = record.sha256;
  const byteLength = record.byteLength;
  const createdAt = record.createdAt;
  const expiresAt = record.expiresAt;
  const storageProvider = record.storageProvider;

  if (
    typeof payloadId !== "string" ||
    !isSafeTransientXmlPayloadId(payloadId) ||
    typeof sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    typeof byteLength !== "number" ||
    !Number.isInteger(byteLength) ||
    byteLength < 0 ||
    typeof createdAt !== "string" ||
    typeof expiresAt !== "string" ||
    storageProvider !== TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
  ) {
    return null;
  }

  return {
    payloadId,
    sha256,
    byteLength,
    createdAt,
    expiresAt,
    storageProvider
  };
}

export function readTransientXmlPayloadReferenceFromSummary(
  summary: Record<string, unknown>
) {
  return readTransientXmlPayloadReference(summary.transientPayload);
}

export async function createTransientXmlPayload(
  input: CreateTransientXmlPayloadInput
): Promise<TransientXmlPayloadReference> {
  const maxBytes = normalizePositiveInteger(
    input.maxBytes,
    DEFAULT_TRANSIENT_XML_PAYLOAD_MAX_BYTES
  );
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
    DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS
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
    expiresAt: expiresAtDate.toISOString(),
    sha256: sha256Hex(input.xml)
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

export async function readTransientXmlPayload(input: {
  reference: TransientXmlPayloadReference;
  rootDir?: string;
  maxBytes?: number;
  now?: Date;
}): Promise<ReadTransientXmlPayloadResult> {
  if (!isSafeTransientXmlPayloadId(input.reference.payloadId)) {
    return buildFailure({
      errorCode: XML_TRANSIENT_PAYLOAD_ID_INVALID_CODE,
      errorMessage: "The transient XML payload reference id is not safe."
    });
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(input.reference.expiresAt);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime()
  ) {
    return buildFailure({
      errorCode: XML_TRANSIENT_PAYLOAD_EXPIRED_CODE,
      errorMessage: "The transient XML payload has expired.",
      reference: input.reference
    });
  }

  const rootDir = input.rootDir ?? getDefaultTransientXmlPayloadRootDir();
  let payloadPath: string;

  try {
    payloadPath = resolveTransientXmlPayloadPath({
      rootDir,
      payloadId: input.reference.payloadId
    });
  } catch {
    return buildFailure({
      errorCode: XML_TRANSIENT_PAYLOAD_ID_INVALID_CODE,
      errorMessage: "The transient XML payload reference id is not safe."
    });
  }

  try {
    const payloadStat = await stat(payloadPath);
    const maxBytes = normalizePositiveInteger(
      input.maxBytes,
      DEFAULT_TRANSIENT_XML_PAYLOAD_MAX_BYTES
    );

    if (payloadStat.size > maxBytes) {
      return buildFailure({
        errorCode: XML_TRANSIENT_PAYLOAD_TOO_LARGE_CODE,
        errorMessage: "The transient XML payload is too large.",
        reference: input.reference
      });
    }

    if (payloadStat.size !== input.reference.byteLength) {
      return buildFailure({
        errorCode: XML_TRANSIENT_PAYLOAD_SIZE_MISMATCH_CODE,
        errorMessage:
          "The transient XML payload file size did not match its metadata.",
        reference: input.reference
      });
    }

    const xml = await readFile(payloadPath, "utf8");
    const byteLength = getUtf8ByteLength(xml);
    const sha256 = sha256Hex(xml);

    if (
      byteLength !== input.reference.byteLength ||
      sha256 !== input.reference.sha256
    ) {
      return buildFailure({
        errorCode: XML_TRANSIENT_PAYLOAD_HASH_MISMATCH_CODE,
        errorMessage: "The transient XML payload metadata did not match the file.",
        reference: input.reference
      });
    }

    const safety = inspectXmlSafety(xml, {
      maxBytes
    });

    if (!safety.safe) {
      return buildFailure({
        errorCode: safety.code ?? XML_TRANSIENT_PAYLOAD_UNSAFE_CODE,
        errorMessage:
          "The transient XML payload failed XML safety inspection.",
        reference: input.reference
      });
    }

    return {
      status: "available",
      xml,
      reference: input.reference
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return buildFailure({
        errorCode: XML_TRANSIENT_PAYLOAD_MISSING_CODE,
        errorMessage: "The transient XML payload file is missing.",
        reference: input.reference
      });
    }

    return buildFailure({
      errorCode: XML_TRANSIENT_PAYLOAD_READ_FAILED_CODE,
      errorMessage: "The transient XML payload could not be read.",
      retryable: true,
      reference: input.reference
    });
  }
}

export async function cleanupTransientXmlPayloads(
  input: {
    rootDir?: string;
    now?: Date;
    ttlSeconds?: number;
  } = {}
): Promise<CleanupTransientXmlPayloadsSummary> {
  const rootDir = input.rootDir ?? getDefaultTransientXmlPayloadRootDir();
  const now = input.now ?? new Date();
  const ttlSeconds = normalizePositiveInteger(
    input.ttlSeconds,
    DEFAULT_TRANSIENT_XML_PAYLOAD_TTL_SECONDS
  );
  const summary: CleanupTransientXmlPayloadsSummary = {
    scannedCount: 0,
    deletedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    storageProvider: TRANSIENT_XML_PAYLOAD_STORAGE_PROVIDER
  };

  let entries;

  try {
    entries = await readdir(rootDir, {
      withFileTypes: true
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return summary;
    }

    return {
      ...summary,
      failedCount: 1
    };
  }

  for (const entry of entries) {
    summary.scannedCount += 1;

    if (!entry.isFile()) {
      summary.skippedCount += 1;
      continue;
    }

    const payloadId = readPayloadIdFromFileName(entry.name);
    const isMalformedOrphan = shouldConsiderMalformedOrphan(entry.name);

    if (!payloadId && !isMalformedOrphan) {
      summary.skippedCount += 1;
      continue;
    }

    const payloadPath = payloadId
      ? resolveTransientXmlPayloadPath({
          rootDir,
          payloadId
        })
      : resolveTransientXmlPayloadEntryPath({
          rootDir,
          fileName: entry.name
        });

    if (!payloadPath) {
      summary.skippedCount += 1;
      continue;
    }

    try {
      const payloadStat = await stat(payloadPath);
      const isExpired = isExpiredByFileMetadata({
        modifiedAtMs: payloadStat.mtimeMs,
        now,
        ttlSeconds
      });

      if (!isExpired) {
        summary.skippedCount += 1;
        continue;
      }

      await unlink(payloadPath);
      summary.deletedCount += 1;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        summary.skippedCount += 1;
        continue;
      }

      summary.failedCount += 1;
    }
  }

  return summary;
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
