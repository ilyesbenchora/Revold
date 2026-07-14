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
  // Incrémenté par le bouton « Démarrer un nouveau coaching » de l'agenda pour
  // lancer une séance sur une conversation vierge côté chat.
  const [startNonce, setStartNonce] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "active" | "ended">("idle");
  // Replié dès qu'un RDV existe ; le bouton haut de page le déplie.
  const [collapsed, setCollapsed] = useState(Boolean(initialAgenda.next_meeting_at));

  const coachingCtx = { objectives: agenda.objectives ?? "", pains: agenda.pains ?? "" };
  // Un RDV programmé (aujourd'hui/à venir) active le suivi de séance « coaching réalisé ».
  const hasMeeting = Boolean(agenda.next_meeting_at);
  const preselectedSources = agenda.sources ?? null;
  const contextAttachments = (agenda.attachments as Attachment[] | null) ?? null;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-white px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50"
        >
          <span className="text-sm leading-none">＋</span> Créer un rendez-vous &amp; objectif de coaching
        </button>
      </div>

      <div className="mb-6">
        <CoachAgenda
          category={category}
          label={coachLabel}
          initial={initialAgenda}
          availableSources={availableSources}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          sessionStatus={sessionStatus}
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
          onStart={() => setStartNonce((n) => n + 1)}
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
        contextAttachments={contextAttachments}
        startSignal={startNonce}
        onSessionStatusChange={setSessionStatus}
      />
    </>
  );
}
