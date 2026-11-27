"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/base-path";

/**
 * Registers public/sw.js (the app opens without waiting for the network, and offline). Only in
 * the built app: during development it would serve old files.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => {
      // Without it the app works as before, only not offline.
    });
  }, []);
  return null;
}
