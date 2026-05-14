const DB_NAME = "invoice-lantern-secure-local-store";
const DB_VERSION = 1;
const STORE_NAME = "encrypted-records";
const KEY_DERIVATION_ITERATIONS = 210000;

export type EncryptedLocalPayload = {
  version: "invoice-lantern.local-encrypted.v1";
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

type StoredEncryptedRecord = {
  id: string;
  payload: EncryptedLocalPayload;
  updatedAt: string;
};

function assertBrowserStorageAvailable() {
  if (
    typeof window === "undefined" ||
    !("indexedDB" in window) ||
    !("crypto" in window) ||
    !window.crypto.subtle
  ) {
    throw new Error("Encrypted local draft storage is not available.");
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function openDatabase() {
  assertBrowserStorageAvailable();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function runStoreOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);

        transaction.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const material = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: KEY_DERIVATION_ITERATIONS
    },
    material,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isSecureLocalStoreAvailable() {
  return (
    typeof window !== "undefined" &&
    "indexedDB" in window &&
    "crypto" in window &&
    Boolean(window.crypto.subtle)
  );
}

export async function encryptJsonPayload(
  value: unknown,
  passphrase: string
): Promise<EncryptedLocalPayload> {
  assertBrowserStorageAvailable();

  const normalizedPassphrase = passphrase.trim();

  if (normalizedPassphrase.length < 12) {
    throw new Error("Use a local draft passphrase with at least 12 characters.");
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(normalizedPassphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv)
    },
    key,
    encoded
  );

  return {
    version: "invoice-lantern.local-encrypted.v1",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: KEY_DERIVATION_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString()
  };
}

export async function decryptJsonPayload<T>(
  payload: EncryptedLocalPayload,
  passphrase: string
): Promise<T> {
  assertBrowserStorageAvailable();

  if (payload.version !== "invoice-lantern.local-encrypted.v1") {
    throw new Error("Unsupported encrypted draft payload.");
  }

  const key = await deriveKey(passphrase.trim(), base64ToBytes(payload.salt));
  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64ToBytes(payload.iv))
    },
    key,
    toArrayBuffer(base64ToBytes(payload.ciphertext))
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function putEncryptedRecord(
  id: string,
  payload: EncryptedLocalPayload
) {
  const record: StoredEncryptedRecord = {
    id,
    payload,
    updatedAt: new Date().toISOString()
  };

  await runStoreOperation("readwrite", (store) => store.put(record));
}

export async function getEncryptedRecord(id: string) {
  const record = await runStoreOperation<StoredEncryptedRecord>(
    "readonly",
    (store) => store.get(id)
  );

  return record ?? null;
}

export async function deleteEncryptedRecord(id: string) {
  await runStoreOperation("readwrite", (store) => store.delete(id));
}

export async function clearEncryptedLocalStore() {
  await runStoreOperation("readwrite", (store) => store.clear());
}

export function deleteEncryptedLocalStoreDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(DB_NAME);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
  });
}
