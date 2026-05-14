const STATIC_CACHE = "invoice-lantern-static-v1";
const LEGAL_CACHE = "invoice-lantern-public-legal-v1";
const OFFLINE_URL = "/offline";

const STATIC_ASSETS = [
  OFFLINE_URL,
  "/icon.png",
  "/apple-icon.png",
  "/brand/invoice-lantern.png"
];

const SENSITIVE_PREFIXES = [
  "/api/",
  "/api/local/",
  "/api/v1/",
  "/workspace",
  "/auth/callback",
  "/auth/sign-out"
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSensitiveUrl(url) {
  if (!isSameOrigin(url)) {
    return true;
  }

  return SENSITIVE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isStaticAsset(url) {
  return (
    isSameOrigin(url) &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/icon.png" ||
      url.pathname === "/apple-icon.png" ||
      url.pathname.startsWith("/brand/"))
  );
}

function isPublicDocumentPage(url) {
  return (
    isSameOrigin(url) &&
    (url.pathname === "/" ||
      url.pathname === OFFLINE_URL ||
      url.pathname === "/legal" ||
      url.pathname.startsWith("/legal/"))
  );
}

async function networkOnly(request) {
  return fetch(request, {
    cache: "no-store"
  });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}

async function publicNetworkFirst(request) {
  const cache = await caches.open(LEGAL_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("invoice-lantern-") &&
                key !== STATIC_CACHE &&
                key !== LEGAL_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    event.respondWith(networkOnly(request));
    return;
  }

  const url = new URL(request.url);

  if (isSensitiveUrl(url)) {
    event.respondWith(
      networkOnly(request).catch(() => {
        if (request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }

        throw new Error("Network unavailable for sensitive request.");
      })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" && isPublicDocumentPage(url)) {
    event.respondWith(publicNetworkFirst(request));
    return;
  }

  event.respondWith(fetch(request));
});
