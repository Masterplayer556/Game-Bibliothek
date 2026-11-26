"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GameDetail } from "@/components/GameDetail";
import { Notice } from "@/components/ui";

function GamePageContent() {
  const id = useSearchParams().get("id");
  if (!id) return <Notice>Kein Spiel ausgewählt.</Notice>;
  // /spiel?id=… to another game keeps the page mounted: the key starts every card of the new
  // game fresh (achievement filter, merge search, IGDB search, errors).
  return <GameDetail key={id} id={id} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<Notice>Lade …</Notice>}>
      <GamePageContent />
    </Suspense>
  );
}
