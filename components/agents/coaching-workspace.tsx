"use client";

import { useState } from "react";
import { CoachAgenda, type CoachAgendaInitial, type AgendaSource } from "./coach-agenda";
import { PaiementAgentChat } from "./paiement-agent-chat";
import type { Attachment } from "@/lib/attachments";

type SourceOption = { key: string; label: string; icon: string; category: string };
type SuggestionSets = { crm?: string[]; billing?: string[]; support?: string[]; cross?: string[] } | null;

/**
 * Espace de coaching : rend l'agenda (objectifs/pains/RDV/outils/fichiers) au-dessus
 * du chat et partage l'état entre les deux. Quand l'utilisateur enregistre un RDV,
 * le contexte du chat (objectifs, pains, RDV du jour, outils à croiser, fichiers)
 * se met à jour immédiatement — « Démarrer ma séance de coaching du jour » reflète
 * alors le dernier rendez-vous pris, sans rechargement de page.
 */
export function CoachingWorkspace({
  category,
  coachLabel,
  initialAgenda,
  availableSources,
  agentKey,
  agentLabel,
  sources,
  suggestions,
  suggestionSets,
}: {
  category: string;
  coachLabel: string;
  initialAgenda: CoachAgendaInitial;
  availableSources: AgendaSource[];
  agentKey: string;
  agentLabel: string;
  sources: SourceOption[];
  suggestions: string[];
  suggestionSets?: SuggestionSets;
}) {
  const [agenda, setAgenda] = useState<CoachAgendaInitial>(initialAgenda);

  const coachingCtx = { objectives: agenda.objectives ?? "", pains: agenda.pains ?? "" };
  // Un RDV programmé (aujourd'hui/à venir) active le suivi de séance « coaching réalisé ».
  const hasMeeting = Boolean(agenda.next_meeting_at);
  const preselectedSources = agenda.sources ?? null;
  const initialAttachments = (agenda.attachments as Attachment[] | null) ?? null;

  return (
    <>
      <div className="mb-6">
        <CoachAgenda
          category={category}
          label={coachLabel}
          initial={initialAgenda}
          availableSources={availableSources}
          onSaved={(a) =>
            setAgenda({
              objectives: a.objectives,
              pains: a.pains,
              cadence: a.cadence,
              next_meeting_at: a.next_meeting_at,
              sources: a.sources,
              attachments: a.attachments,
            })
          }
        />
      </div>

      <PaiementAgentChat
        agentKey={agentKey}
        agentLabel={agentLabel}
        sources={sources}
        suggestions={suggestions}
        suggestionSets={suggestionSets ?? null}
        coaching={coachingCtx}
        coachingCategory={category}
        sessionTracking={hasMeeting}
        preselectedSources={preselectedSources}
        initialAttachments={initialAttachments}
      />
    </>
  );
}
