"use client";

import type { ReactNode } from "react";
import type { Library, RawData } from "@/core/library";
import { useLibraryContext } from "./LibraryProvider";
import { Card, Notice } from "./ui";

/** Shows loading and error states; renders children once the library is there. */
export function LibraryGate({
  children,
}: {
  children: (ctx: { library: Library; raw: RawData; reload: () => Promise<void>; userId: string }) => ReactNode;
}) {
  const { library, raw, error, reload, session } = useLibraryContext();
  if (error && !library) {
    return (
      <Card title="Daten nicht verfügbar">
        <Notice tone="danger">Die Datenbank antwortet mit einem Fehler: {error}</Notice>
      </Card>
    );
  }
  if (!library || !raw) return <Notice>Lade …</Notice>;
  return <>{children({ library, raw, reload, userId: session.user.id })}</>;
}
