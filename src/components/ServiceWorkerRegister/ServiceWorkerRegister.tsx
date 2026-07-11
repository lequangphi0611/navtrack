"use client";

import { useEffect } from "react";

// Registered only in production: `next dev` rebuilds chunks constantly, and a
// caching service worker would serve stale ones during development.
function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}

export { ServiceWorkerRegister };
