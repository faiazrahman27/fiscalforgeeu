"use client";

import { useEffect } from "react";

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  if (process.env.NEXT_PUBLIC_ENABLE_PWA_INSTALL_PROMPT === "false") {
    return false;
  }

  return (
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /*
       * Registration failure should not block auth, validation, privacy, or
       * invoice workflows. The app remains network-first without PWA caching.
       */
    });
  }, []);

  return null;
}
