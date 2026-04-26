import { readJsonCollection, writeJsonCollection } from "./json-store.js";

export type CollectionStorageProvider = {
  readCollection<T>(collectionName: string): Promise<T[]>;
  writeCollection<T>(collectionName: string, records: T[]): Promise<void>;
};

const jsonCollectionStorageProvider: CollectionStorageProvider = {
  async readCollection<T>(collectionName: string) {
    return readJsonCollection<T>(collectionName);
  },

  async writeCollection<T>(collectionName: string, records: T[]) {
    await writeJsonCollection(collectionName, records);
  }
};

export function getCollectionStorageProvider() {
  return jsonCollectionStorageProvider;
}
