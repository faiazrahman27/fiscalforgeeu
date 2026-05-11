import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isProductionEnvironment,
  resolveApiStorageBackend
} from "../config/env.js";

const DATA_DIR = path.join(process.cwd(), ".data");

type JsonCollection<T> = {
  records: T[];
};

function assertJsonStorageAllowed(fileName: string) {
  const resolvedBackend = resolveApiStorageBackend();

  if (isProductionEnvironment()) {
    throw new Error(
      [
        "Unsafe production JSON storage access blocked.",
        `Collection file: ${fileName}`,
        "Local .data JSON storage is forbidden in production.",
        "Use Supabase/Postgres-backed persistence for production workspace, invoice, XML, VAT, API-key, privacy, retention, and audit data."
      ].join(" ")
    );
  }

  if (resolvedBackend !== "json") {
    throw new Error(
      [
        "Unsafe JSON storage access blocked.",
        `Collection file: ${fileName}`,
        `Resolved storage backend: ${resolvedBackend}`,
        "The current API storage policy does not allow local .data JSON storage."
      ].join(" ")
    );
  }
}

function assertSafeCollectionFileName(fileName: string) {
  const trimmedFileName = fileName.trim();

  if (!trimmedFileName) {
    throw new Error("JSON collection file name must not be blank.");
  }

  if (path.isAbsolute(trimmedFileName)) {
    throw new Error("JSON collection file name must not be an absolute path.");
  }

  if (
    trimmedFileName.includes("/") ||
    trimmedFileName.includes("\\") ||
    trimmedFileName.includes("..")
  ) {
    throw new Error(
      "JSON collection file name must not contain path traversal segments."
    );
  }

  if (!/^[a-zA-Z0-9._-]+\.json$/.test(trimmedFileName)) {
    throw new Error(
      "JSON collection file name must use only letters, numbers, dots, underscores, or hyphens and must end with .json."
    );
  }

  return trimmedFileName;
}

async function ensureDataDirectory() {
  await mkdir(DATA_DIR, {
    recursive: true
  });
}

function getCollectionPath(fileName: string) {
  const safeFileName = assertSafeCollectionFileName(fileName);
  assertJsonStorageAllowed(safeFileName);

  return path.join(DATA_DIR, safeFileName);
}

export async function readJsonCollection<T>(fileName: string): Promise<T[]> {
  const filePath = getCollectionPath(fileName);

  await ensureDataDirectory();

  try {
    const rawContent = await readFile(filePath, "utf8");
    const parsedContent = JSON.parse(rawContent) as JsonCollection<T>;

    if (!parsedContent || !Array.isArray(parsedContent.records)) {
      return [];
    }

    return parsedContent.records;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

export async function writeJsonCollection<T>(
  fileName: string,
  records: T[]
): Promise<void> {
  const filePath = getCollectionPath(fileName);

  await ensureDataDirectory();

  const temporaryPath = `${filePath}.tmp`;

  const payload: JsonCollection<T> = {
    records
  };

  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}