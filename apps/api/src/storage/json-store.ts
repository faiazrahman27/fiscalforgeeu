import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");

type JsonCollection<T> = {
  records: T[];
};

async function ensureDataDirectory() {
  await mkdir(DATA_DIR, {
    recursive: true
  });
}

function getCollectionPath(fileName: string) {
  return path.join(DATA_DIR, fileName);
}

export async function readJsonCollection<T>(fileName: string): Promise<T[]> {
  await ensureDataDirectory();

  const filePath = getCollectionPath(fileName);

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
  await ensureDataDirectory();

  const filePath = getCollectionPath(fileName);
  const temporaryPath = `${filePath}.tmp`;

  const payload: JsonCollection<T> = {
    records
  };

  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}
