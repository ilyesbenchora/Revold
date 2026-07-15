"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAgenda, type CoachAgendaInitial, type AgendaSource } from "./coach-agenda";

/** RDV encore à venir (date + heure). */
function isFutureMeeting(date?: string | null, time?: string | null): boolean {
  if (!date) return false;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  return new Date(`${date}T${t}:00`).getTime() > Date.now();
}

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
  // Confirmation affichée uniquement pour un RDV encore à venir ; un RDV
  // passé/terminé n'affiche pas le bloc « rendez-vous enregistré ».
  const [collapsed, setCollapsed] = useState(isFutureMeeting(initial.next_meeting_at, initial.next_meeting_time));

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
