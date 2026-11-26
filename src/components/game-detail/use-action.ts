"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/errors";

/** Runs a change, then reloads what it touched; keeps «busy» and the error for the card. */
export function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  };
  return { busy, error, run };
}
