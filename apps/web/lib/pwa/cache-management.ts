import { deleteEncryptedLocalStoreDatabase } from "./secure-local-store";

const CACHE_PREFIX = "invoice-lantern-";
const STORAGE_KEY_PREFIX = "invoice-lantern:";

function clearPrefixedWebStorage(storage: Storage) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}

export async function clearInvoiceLanternBrowserCaches() {
  if (typeof window === "undefined") {
    return;
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();

    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .map((key) => window.caches.delete(key))
    );
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations
        .filter((registration) =>
          registration.active?.scriptURL.endsWith("/sw.js")
        )
        .map((registration) => registration.unregister())
    );
  }

  if ("localStorage" in window) {
    clearPrefixedWebStorage(window.localStorage);
  }

  if ("sessionStorage" in window) {
    clearPrefixedWebStorage(window.sessionStorage);
  }

  await deleteEncryptedLocalStoreDatabase();
}
