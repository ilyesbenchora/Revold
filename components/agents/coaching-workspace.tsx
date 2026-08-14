"use client";

import { useState } from "react";
import { CoachAgenda, type CoachAgendaInitial, type AgendaSource } from "./coach-agenda";
import { CoachingActionPlan } from "./coaching-action-plan";
import { PaiementAgentChat } from "./paiement-agent-chat";
import type { Attachment } from "@/lib/attachments";

type SourceOption = { key: string; label: string; icon: string; category: string };
type SuggestionSets = { crm?: string[]; billing?: string[]; support?: string[]; cross?: string[] } | null;

/** Date+heure du RDV (heure par défaut 09:00 si absente). */
function meetingDate(d?: string | null, t?: string | null): Date | null {
  if (!d) return null;
  return new Date(`${d}T${t && /^\d{2}:\d{2}$/.test(t) ? t : "09:00"}:00`);
}
/** RDV échu : l'heure est atteinte ou dépassée. */
function isDue(d?: string | null, t?: string | null): boolean {
  const dt = meetingDate(d, t);
  return dt ? dt.getTime() <= Date.now() : false;
}
/** RDV daté d'aujourd'hui. */
function isToday(d?: string | null): boolean {
  if (!d) return false;
  const now = new Date();
  const [y, m, day] = d.split("-").map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && day === now.getDate();
}
/**
 * RDV encore pertinent pour la confirmation « Rendez-vous enregistré » : à venir,
 * ou aujourd'hui (état « c'est l'heure »). Un RDV d'un jour passé n'affiche plus
 * le bloc — il vit dans l'historique des rendez-vous en bas de page.
 */
function isUpcoming(d?: string | null, t?: string | null): boolean {
  if (!d) return false;
  return isToday(d) || !isDue(d, t);
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
  initialTab,
  initialAsk,
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
  /** Tour de contrôle vocale (?ask=…) : demande exécutée automatiquement. */
  initialAsk?: string | null;
  /** Onglet ouvert à l'arrivée (deep-link depuis les compteurs d'agent). */
  initialTab?: "chat" | "history" | "alerts" | "suggestions" | "actions" | "routines";
}) {
  // Un NOUVEAU rendez-vous & objectif part de ZÉRO : l'agenda persisté ne
  // pré-remplit le formulaire (objectifs, pains, outils, FICHIERS) que si un
  // RDV est encore d'actualité (à venir ou aujourd'hui) — on est alors en
  // modification de ce RDV. RDV passé ou aucun RDV → formulaire vierge ;
  // la continuité entre séances est portée par la mémoire du coach, pas par
  // le recyclage du formulaire.
  const upcomingAtLoad = isUpcoming(initialAgenda.next_meeting_at, initialAgenda.next_meeting_time);
  const baseAgenda: CoachAgendaInitial = upcomingAtLoad ? initialAgenda : {};
  const [agenda, setAgenda] = useState<CoachAgendaInitial>(baseAgenda);
  // Remonte le formulaire vierge (remount) après une clôture de séance.
  const [formNonce, setFormNonce] = useState(0);
  // Incrémenté par le bouton « Démarrer un nouveau coaching » de l'agenda pour
  // lancer une séance sur une conversation vierge côté chat. Si le coaching vient
  // d'un rapport, on démarre automatiquement (nonce initial à 1).
  // RDV du JOUR échu au chargement → on démarre automatiquement la séance (le
  // message de l'agent part à l'arrivée sur la page). Un RDV d'un jour passé ne
  // relance rien : il vit dans l'historique.
  const meetingDueAtLoad =
    isToday(initialAgenda.next_meeting_at) &&
    isDue(initialAgenda.next_meeting_at, initialAgenda.next_meeting_time);
  const [startNonce, setStartNonce] = useState(reportBrief || meetingDueAtLoad ? 1 : 0);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "active" | "ended">("idle");
  // Bloc replié (confirmation) affiché uniquement pour un RDV à venir (ou du
  // jour) — jamais pour un RDV passé.
  const [collapsed, setCollapsed] = useState(
    isUpcoming(initialAgenda.next_meeting_at, initialAgenda.next_meeting_time),
  );
  // Formulaire rendez-vous & objectif : OUVERT par défaut (sauf si une
  // confirmation de RDV à venir prend sa place).
  const [formOpen, setFormOpen] = useState(true);
  // Conversations remontées par le chat (bloc historique des rendez-vous).
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: number; count: number }[]>([]);
  const [openConv, setOpenConv] = useState<{ id: string; nonce: number } | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  // Incrémenté à la clôture d'une séance → recharge le plan d'action (le
  // résumé + les engagements viennent d'être générés côté serveur).
  const [planRefresh, setPlanRefresh] = useState(0);

  // Contexte de coaching : celui du rapport s'il est fourni, sinon l'agenda.
  const coachingCtx = reportBrief ?? { objectives: agenda.objectives ?? "", pains: agenda.pains ?? "" };
  // Un RDV programmé active le suivi de séance « coaching réalisé ».
  const hasMeeting = Boolean(agenda.next_meeting_at);
  // RDV encore d'actualité (à venir ou aujourd'hui) → seul cas où la
  // confirmation « Rendez-vous enregistré » a le droit d'exister.
  const meetingUpcoming = isUpcoming(agenda.next_meeting_at, agenda.next_meeting_time);
  // RDV du jour échu → CTA rouge + démarrage direct.
  const meetingDue = isDue(agenda.next_meeting_at, agenda.next_meeting_time);
  // Confirmation visible uniquement pour un RDV à venir (disparaît quand il est
  // effacé à la clôture de la séance, ou si la date est passée).
  const effectiveCollapsed = collapsed && meetingUpcoming;
  const preselectedSources = agenda.sources ?? null;
  const contextAttachments = (agenda.attachments as Attachment[] | null) ?? null;
  // Agenda masqué par défaut : il s'ouvre via le bouton « + Créer un RDV… », ou
  // s'affiche en confirmation quand un RDV existe.
  const showAgenda = effectiveCollapsed || formOpen;

  // Clôture de séance : REMISE À ZÉRO complète de l'agenda (RDV, objectifs,
  // pains, outils, fichiers) — le prochain rendez-vous & objectif repart d'un
  // formulaire vierge. La continuité vit dans la mémoire du coach (résumé +
  // plan d'action), pas dans le formulaire. Le plan d'action vient d'être
  // régénéré côté serveur → on le recharge.
  async function handleSessionComplete() {
    setPlanRefresh((n) => n + 1);
    if (!hasMeeting) return;
    setAgenda({});
    setFormNonce((n) => n + 1); // remonte un formulaire vierge
    try {
      await fetch("/api/coaching/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          objectives: "",
          pains: "",
          cadence: "monthly",
          next_meeting_at: null,
          next_meeting_time: null,
          sources: [],
          attachments: [],
        }),
      });
    } catch {
      /* silencieux */
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => {
            setFormOpen(true);
            setCollapsed(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-white px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50"
        >
          <span className="text-sm leading-none">＋</span> Créer un rendez-vous &amp; objectif de coaching
        </button>
      </div>

      {/* Plan d'action : engagements des séances précédentes + résumé (mémoire du coach) */}
      <CoachingActionPlan category={category} refreshSignal={planRefresh} />

      {showAgenda && (
      <div className="mb-6">
        <CoachAgenda
          key={formNonce}
          category={category}
          label={coachLabel}
          // Pré-rempli UNIQUEMENT en modification d'un RDV encore d'actualité ;
          // sinon formulaire vierge (nouveau rendez-vous & objectif = zéro).
          initial={meetingUpcoming ? baseAgenda : {}}
          availableSources={availableSources}
          collapsed={effectiveCollapsed}
          onCollapsedChange={(v) => {
            setCollapsed(v);
            if (!v) setFormOpen(true);
          }}
          sessionStatus={sessionStatus}
          overdue={meetingDue}
          onSaved={(a) =>
            setAgenda({
              objectives: a.objectives,
              pains: a.pains,
              cadence: a.cadence,
              next_meeting_at: a.next_meeting_at,
              next_meeting_time: a.next_meeting_time,
              sources: a.sources,
              attachments: a.attachments,
            })
          }
          onStart={() => setStartNonce((n) => n + 1)}
        />
      </div>
      )}

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
        onSessionComplete={handleSessionComplete}
        onConversationsChange={setConversations}
        openConversationSignal={openConv}
        persona={persona}
        initialTab={initialTab}
        initialAsk={initialAsk}
      />

      {/* Les rapports enregistrés sont rendus par la PAGE (AgentPageShell) :
          ils restent visibles quand le chat est replié au profit des rapports
          de routine en pleine largeur. */}

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
          <>
            <div className="mt-3 divide-y divide-slate-100">
              {[...conversations]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, showAllHistory ? undefined : 3)
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
                      Reprendre →
                    </button>
                  </div>
                ))}
            </div>
            {conversations.length > 3 && (
              <button
                onClick={() => setShowAllHistory((v) => !v)}
                className="mt-2 text-xs font-medium text-accent hover:underline"
              >
                {showAllHistory ? "Réduire" : `Voir l'ensemble des rendez-vous (${conversations.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
