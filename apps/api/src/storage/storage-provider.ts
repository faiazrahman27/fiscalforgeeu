import {
  resolveApiStorageBackend,
  isProductionEnvironment
} from "../config/env.js";
import { readJsonCollection, writeJsonCollection } from "./json-store.js";

export type CollectionStorageProvider = {
  readCollection<T>(collectionName: string): Promise<T[]>;
  writeCollection<T>(collectionName: string, records: T[]): Promise<void>;
};

const jsonCollectionStorageProvider: CollectionStorageProvider = {
  async readCollection<T>(collectionName: string) {
    assertJsonStorageAllowed(collectionName);
    return readJsonCollection<T>(collectionName);
  },

  async writeCollection<T>(collectionName: string, records: T[]) {
    assertJsonStorageAllowed(collectionName);
    await writeJsonCollection(collectionName, records);
  }
};

function assertJsonStorageAllowed(collectionName: string) {
  const resolvedBackend = resolveApiStorageBackend();

  if (resolvedBackend !== "json") {
    throw new Error(
      [
        "Unsafe local JSON storage access blocked.",
        `Collection: ${collectionName}`,
        `Resolved storage backend: ${resolvedBackend}`,
        "Invoice Lantern production and Supabase-backed environments must not read or write workspace data through local .data JSON files.",
        "Use a Supabase/Postgres-backed repository for this collection instead."
      ].join(" ")
    );
  }

  if (isProductionEnvironment()) {
    throw new Error(
      [
        "Unsafe production storage configuration blocked.",
        `Collection: ${collectionName}`,
        "Local JSON storage is forbidden in production."
      ].join(" ")
    );
  }
}

export function getCollectionStorageProvider() {
  return jsonCollectionStorageProvider;
}