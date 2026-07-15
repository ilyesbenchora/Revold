"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAgenda, type CoachAgendaInitial, type AgendaSource } from "./coach-agenda";

/**
 * Bloc de création de rendez-vous & objectifs de coaching, embarqué sur une page
 * catégorie. « Démarrer le coaching » redirige vers le chat de l'agent.
 */
export function CategoryAgendaBlock({
  category,
  coachLabel,
  agentKey,
  initial,
  availableSources,
}: {
  category: string;
  coachLabel: string;
  agentKey: string;
  initial: CoachAgendaInitial;
  availableSources: AgendaSource[];
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(Boolean(initial.next_meeting_at));

  return (
    <CoachAgenda
      category={category}
      label={coachLabel}
      initial={initial}
      availableSources={availableSources}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onStart={() => router.push(`/dashboard/agents/${agentKey}`)}
    />
  );
}
