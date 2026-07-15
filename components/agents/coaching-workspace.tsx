"use client";

import { useState } from "react";
import { CoachAgenda, type CoachAgendaInitial, type AgendaSource } from "./coach-agenda";
import { PaiementAgentChat } from "./paiement-agent-chat";
import type { Attachment } from "@/lib/attachments";

type SourceOption = { key: string; label: string; icon: string; category: string };
type SuggestionSets = { crm?: string[]; billing?: string[]; support?: string[]; cross?: string[] } | null;

/** RDV aujourd'hui ou plus tard. */
function isUpcoming(d?: string | null): boolean {
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`).getTime() >= today.getTime();
}
/** RDV strictement après aujourd'hui. */
function isStrictFuture(d?: string | null): boolean {
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`).getTime() > today.getTime();
}

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
  reportBrief = null,
  persona,
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
  /** Coaching issu d'un rapport : contexte prêt à l'emploi, démarrage auto. */
  reportBrief?: { objectives: string; pains: string } | null;
  /** Personnage de l'agent (avatar dans les bulles). */
  persona?: { name: string; emoji: string; image?: string | null } | null;
}) {
  const [agenda, setAgenda] = useState<CoachAgendaInitial>(initialAgenda);
  // Incrémenté par le bouton « Démarrer un nouveau coaching » de l'agenda pour
  // lancer une séance sur une conversation vierge côté chat. Si le coaching vient
  // d'un rapport, on démarre automatiquement (nonce initial à 1).
  const [startNonce, setStartNonce] = useState(reportBrief ? 1 : 0);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "active" | "ended">("idle");
  // Bloc replié affiché uniquement pour un RDV à venir (aujourd'hui ou plus tard).
  const [collapsed, setCollapsed] = useState(isUpcoming(initialAgenda.next_meeting_at));
  // Conversations remontées par le chat (bloc historique des rendez-vous).
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: number; count: number }[]>([]);
  const [openConv, setOpenConv] = useState<{ id: string; nonce: number } | null>(null);

  // Contexte de coaching : celui du rapport s'il est fourni, sinon l'agenda.
  const coachingCtx = reportBrief ?? { objectives: agenda.objectives ?? "", pains: agenda.pains ?? "" };
  // Un RDV programmé (aujourd'hui/à venir) active le suivi de séance « coaching réalisé ».
  const hasMeeting = Boolean(agenda.next_meeting_at);
  // Bloc de confirmation dynamique : visible pour un RDV strictement futur, ou
  // pour un RDV du jour tant que la séance n'est pas terminée. Disparaît sinon.
  const effectiveCollapsed = collapsed && (isStrictFuture(agenda.next_meeting_at) || sessionStatus !== "ended");
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
          collapsed={effectiveCollapsed}
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
        onConversationsChange={setConversations}
        openConversationSignal={openConv}
        persona={persona}
      />

      {/* Historique des rendez-vous de coaching (conversations passées) */}
      <div className="mt-6 card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Historique des rendez-vous
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{conversations.length}</span>
        </h3>
        {conversations.length === 0 ? (
          <p className="mt-3 text-xs text-slate-400">Aucune séance pour le moment. Démarre un coaching pour la retrouver ici.</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {[...conversations]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {c.count} message(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenConv({ id: c.id, nonce: Date.now() })}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-accent hover:bg-slate-50"
                  >
                    Reprendre la conversation →
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
