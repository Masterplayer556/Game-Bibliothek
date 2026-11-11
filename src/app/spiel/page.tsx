"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GameDetail } from "@/components/GameDetail";
import { Notice } from "@/components/ui";

function GamePageContent() {
  const id = useSearchParams().get("id");
  if (!id) return <Notice>Kein Spiel ausgewählt.</Notice>;
  return <GameDetail id={id} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<Notice>Lade …</Notice>}>
      <GamePageContent />
    </Suspense>
  );
}
