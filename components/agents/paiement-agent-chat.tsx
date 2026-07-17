"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setActiveChat, clearActiveChat } from "@/lib/chat/active-chat";
import { MessageArtifacts } from "./message-artifacts";
import { AlertSuggestionCard } from "./alert-suggestion-card";
import { ActivatedAlertsContext, type ActivatedAlert } from "./activated-alerts";
import { DealActionCard } from "./deal-action-card";
import { suggestionsForCategories } from "@/lib/ai/agents/analysis-suggestions";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import type { DealActionProposal } from "@/lib/ai/agents/sales-actions";
import type { AgentRedirect } from "@/lib/ai/agents/redirect";
import { AttachMenu, AttachmentChips } from "./attach-menu";
import { AgentAvatar } from "./agent-avatar";
import type { Attachment } from "@/lib/attachments";
import type { ReportSpec, ChartProposal, ProposedAction } from "@/lib/ai/agents/agent-runtime";

type SourceOption = { key: string; label: string; icon: string; category: string };
type SuggestionSets = { crm?: string[]; billing?: string[]; support?: string[]; cross?: string[] } | null;

/** Choisit les suggestions selon les catégories de sources cochées (1 → set dédié, 2+ → croisé). */
function resolveSuggestions(def: string[], sets: SuggestionSets, cats: Set<string>): string[] {
  if (!sets) return def;
  const list = [...cats];
  if (list.length >= 2 && sets.cross?.length) return sets.cross;
  if (list.length === 1) {
    const c = list[0];
    if (c === "crm" && sets.crm?.length) return sets.crm;
    if (c === "billing" && sets.billing?.length) return sets.billing;
    if (c === "support" && sets.support?.length) return sets.support;
  }
  return def;
}
type Msg = {
  role: "user" | "assistant";
  content: string;
  report?: ReportSpec | null;
  chart?: ChartProposal | null;
  action?: ProposedAction | null;
  dealAction?: DealActionProposal | null;
  redirect?: AgentRedirect | null;
};
type Conversation = {
  id: string;
  title: string;
  sources: string[];
  messages: Msg[];
  attachments?: Attachment[];
  updatedAt: number;
};

/** Nettoie le markdown résiduel pour un rendu texte propre (pas de ** ni #). */
function cleanText(t: string): string {
  return t
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[*+]\s+/gm, "- ");
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

function titleFrom(messages: Msg[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nouvelle conversation";
  return first.content.length > 52 ? `${first.content.slice(0, 52)}…` : first.content;
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString("fr-FR");
}

export function PaiementAgentChat({
  agentKey,
  agentLabel,
  sources,
  suggestions,
  suggestionSets,
  coaching,
  coachingCategory,
  sessionTracking,
  preselectedSources,
  contextAttachments,
  startSignal,
  onSessionStatusChange,
  onSessionComplete,
  onConversationsChange,
  openConversationSignal,
  persona,
}: {
  agentKey: string;
  agentLabel: string;
  sources: SourceOption[];
  suggestions: string[];
  suggestionSets?: SuggestionSets;
  coaching?: { objectives: string; pains: string } | null;
  coachingCategory?: string | null;
  sessionTracking?: boolean;
  preselectedSources?: string[] | null;
  /** Fichiers issus du coaching : contexte permanent injecté à l'agent. */
  contextAttachments?: Attachment[] | null;
  startSignal?: number;
  /** Remonte l'état de la séance de coaching (bouton de l'agenda). */
  onSessionStatusChange?: (status: "idle" | "active" | "ended") => void;
  /** Appelé quand une séance de coaching est clôturée (efface le RDV). */
  onSessionComplete?: () => void;
  /** Remonte la liste des conversations (pour le bloc historique des rendez-vous). */
  onConversationsChange?: (list: { id: string; title: string; updatedAt: number; count: number }[]) => void;
  /** Signal pour rouvrir une conversation donnée depuis l'historique. */
  openConversationSignal?: { id: string; nonce: number } | null;
  /** Personnage de l'agent (avatar dans les bulles de réponse). */
  persona?: { name: string; emoji: string; image?: string | null } | null;
}) {
  // Mode coaching : les sources reflètent EXACTEMENT l'agenda (même vide), et les
  // fichiers du coaching sont épinglés comme contexte permanent (non supprimables).
  const coachingMode = Boolean(coachingCategory);
  const preselList = preselectedSources ?? [];
  const contextFiles = contextAttachments ?? [];
  const exactCoachingSources = () => sources.filter((s) => preselList.includes(s.key)).map((s) => s.key);
  const storageKey = `revold:agent:${agentKey}:v1`;
  const statusKey = `revold:agent:${agentKey}:status`;
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "history" | "alerts" | "suggestions" | "actions">("chat");
  const pathname = usePathname();
  // Alertes activées durant la session (suggestion OU depuis un rapport).
  const [activatedAlerts, setActivatedAlerts] = useState<ActivatedAlert[]>([]);
  const addActivatedAlert = (a: ActivatedAlert) => setActivatedAlerts((prev) => [a, ...prev]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Sources initiales : en coaching, reflet EXACT de l'agenda (peut être vide) ;
  // sinon, les sources pré-cochées, à défaut toutes.
  const initialSelected = coachingMode
    ? exactCoachingSources()
    : preselList.length
      ? sources.filter((s) => preselList.includes(s.key)).map((s) => s.key)
      : sources.map((s) => s.key);
  const [selected, setSelected] = useState<string[]>(
    coachingMode ? initialSelected : initialSelected.length ? initialSelected : sources.map((s) => s.key),
  );
  const [error, setError] = useState<string | null>(null);
  // Fichiers ajoutés dans le chat (via +), supprimables, propres à la conversation.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sessionEnd, setSessionEnd] = useState<"none" | "asking" | "ended">("none");
  // Séance de coaching effectivement démarrée dans cette vue (pas via historique).
  const [sessionStarted, setSessionStarted] = useState(false);
  // Agents non-coach : relance « Avez-vous une autre question ? » après 2 min.
  const [askAnother, setAskAnother] = useState(false);
  const askRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inactRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(0);

  const INACT_MS = 5 * 60 * 1000; // 5 min d'inactivité → propose de terminer (coaching)
  const AUTO_MS = 2 * 60 * 1000; // 2 min sans réponse → terminaison auto (coaching)
  const ASK_MS = 2 * 60 * 1000; // 2 min d'inactivité → « Avez-vous une autre question ? » (non-coach)
  const CLOSE_MS = 10 * 60 * 1000; // 10 min d'inactivité → ferme le chat (→ page blanche)

  function clearSessionTimers() {
    if (inactRef.current) clearTimeout(inactRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
    inactRef.current = null;
    autoRef.current = null;
  }

  async function completeSession(auto: boolean) {
    clearSessionTimers();
    setSessionEnd("ended");
    onSessionComplete?.();
    if (!coachingCategory) return;
    try {
      await fetch("/api/coaching/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: coachingCategory, auto }),
      });
    } catch {
      /* silencieux */
    }
  }

  // Inactivité (agents coach) : 5 min sans message → propose de terminer ; sans
  // réponse pendant 2 min → terminaison automatique.
  useEffect(() => {
    if (!coaching || !coachingCategory || !sessionTracking) return;
    if (sessionEnd === "ended" || sessionEnd === "asking") return;
    if (messages.length === 0 || loading) return;
    clearSessionTimers();
    inactRef.current = setTimeout(() => {
      setSessionEnd("asking");
      autoRef.current = setTimeout(() => completeSession(true), AUTO_MS);
    }, INACT_MS);
    return () => clearSessionTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading, sessionEnd, coachingCategory, sessionTracking]);

  // Démarrage de séance déclenché depuis l'agenda (bouton « Démarrer un nouveau
  // coaching ») : le parent incrémente startSignal → on lance sur une conv vierge.
  useEffect(() => {
    if (!startSignal || startSignal === startedRef.current) return;
    startedRef.current = startSignal;
    if (!hydrated) return;
    startCoachingSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal, hydrated]);

  // Statut de la séance de coaching, remonté à l'agenda pour le libellé du bouton :
  // idle (pas démarrée) → active (en cours) → ended (terminée). On s'appuie sur un
  // flag explicite (démarrage effectif dans cette vue), pas sur l'historique chargé.
  // « en cours » = une conversation de coaching est ouverte et non terminée
  // (démarrée dans la vue OU rechargée depuis l'historique). « terminé » persiste.
  const coachingStatus: "idle" | "active" | "ended" =
    sessionEnd === "ended" ? "ended" : sessionStarted || messages.length > 0 ? "active" : "idle";
  useEffect(() => {
    onSessionStatusChange?.(coachingStatus);
    // Persistance du statut → CTA fiable au rechargement (en cours / terminé).
    if (hydrated && coachingMode) {
      try {
        localStorage.setItem(statusKey, coachingStatus);
      } catch {
        /* ignore */
      }
    }
  }, [coachingStatus, onSessionStatusChange, hydrated, coachingMode, statusKey]);

  // Inactivité (agents non-coach) : à 2 min l'agent relance « Avez-vous une autre
  // question ? » ; sans activité au bout de 10 min, le chat se ferme (la conv
  // reste dans l'historique) et repart sur une page blanche avec les suggestions.
  function clearIdleTimers() {
    if (askRef.current) clearTimeout(askRef.current);
    if (closeRef.current) clearTimeout(closeRef.current);
    askRef.current = null;
    closeRef.current = null;
  }
  useEffect(() => {
    if (coachingMode) return;
    if (messages.length === 0 || loading) return;
    clearIdleTimers();
    askRef.current = setTimeout(() => setAskAnother(true), ASK_MS);
    closeRef.current = setTimeout(() => {
      setAskAnother(false);
      startNew();
    }, CLOSE_MS);
    return () => clearIdleTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, input, loading, coachingMode]);

  // Hydratation depuis localStorage (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed)) {
          // Tous les agents (coaching inclus) démarrent sur une conversation
          // vierge avec les suggestions ; l'historique reste dans l'onglet dédié.
          setConversations(parsed);
        }
      }
    } catch {
      /* localStorage indisponible / corrompu → on démarre à vide */
    }
    setHydrated(true);
  }, [storageKey, statusKey]);

  // Remonte la liste des conversations au parent (bloc historique des rendez-vous).
  useEffect(() => {
    if (!hydrated) return;
    onConversationsChange?.(
      conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, count: c.messages.length })),
    );
  }, [conversations, hydrated, onConversationsChange]);

  // Rouvre une conversation depuis le bloc historique (« Reprendre »).
  const openNonceRef = useRef(0);
  useEffect(() => {
    if (!openConversationSignal || openConversationSignal.nonce === openNonceRef.current) return;
    openNonceRef.current = openConversationSignal.nonce;
    const conv = conversations.find((c) => c.id === openConversationSignal.id);
    if (conv) openConversation(conv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConversationSignal]);

  // Persistance : réécrit localStorage à chaque changement (après hydratation).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
      /* quota / mode privé → on ignore */
    }
  }, [conversations, hydrated, storageKey]);

  // Conversation active en arrière-plan : dès qu'il y a des messages, on publie
  // un pointeur (href de retour + contexte) pour le bandeau flottant global.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    const snippet = last ? last.content.slice(0, 90) : "";
    setActiveChat({
      href: pathname,
      agentLabel: persona?.name ? `${persona.name} · ${agentLabel}` : agentLabel,
      personaName: persona?.name,
      personaEmoji: persona?.emoji,
      personaImage: persona?.image ?? null,
      snippet,
    });
  }, [messages, pathname, persona, agentLabel]);

  // Coaching : quand l'agenda est mis à jour (outils à croiser) et qu'aucune
  // conversation n'est en cours, on resynchronise les sources sélectionnées pour
  // qu'elles restent le reflet EXACT du coaching enregistré (même vide).
  const preselKey = preselList.join(",");
  useEffect(() => {
    if (!hydrated || messages.length > 0) return;
    if (coachingMode) setSelected(exactCoachingSources());
    else if (preselList.length) setSelected(sources.filter((s) => preselList.includes(s.key)).map((s) => s.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselKey, hydrated, messages.length]);

  function upsertConversation(id: string, msgs: Msg[], srcs: string[], atts: Attachment[]) {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      const conv: Conversation = {
        id,
        title: titleFrom(msgs),
        sources: srcs,
        messages: msgs,
        attachments: atts,
        updatedAt: Date.now(),
      };
      return [conv, ...rest];
    });
  }

  function addAttachment(att: Attachment) {
    setAttachments((prev) => [...prev, att]);
  }
  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function toggleSource(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setAttachments([]);
    // Les fichiers du coaching restent en contexte ; on remet les sources au
    // reflet du coaching et le statut de séance à zéro.
    if (coachingMode) setSelected(exactCoachingSources());
    setSessionEnd("none");
    setSessionStarted(false);
    setAskAnother(false);
    setError(null);
    setTab("chat");
    clearActiveChat();
  }

  function openConversation(c: Conversation) {
    setCurrentId(c.id);
    setMessages(c.messages);
    setSelected(c.sources.length ? c.sources : coachingMode ? exactCoachingSources() : sources.map((s) => s.key));
    setAttachments(c.attachments ?? []);
    setError(null);
    setTab("chat");
  }

  function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === currentId) startNew();
  }

  const START_TEXT = "Démarrer ma séance de coaching du jour";

  function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const id = currentId ?? newId();
    if (!currentId) setCurrentId(id);
    void runSend(messages, content, id);
  }

  // Démarre une séance de coaching sur une conversation vierge (bouton agenda).
  function startCoachingSession() {
    if (loading) return;
    const id = newId();
    setCurrentId(id);
    setMessages([]);
    setSessionEnd("none");
    setError(null);
    setTab("chat");
    void runSend([], START_TEXT, id);
  }

  async function runSend(base: Msg[], content: string, id: string) {
    if (loading) return;
    setError(null);
    setAskAnother(false);
    if (coachingMode) setSessionStarted(true);

    const next: Msg[] = [...base, { role: "user", content }];
    setMessages(next);
    upsertConversation(id, next, selected, attachments);
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));

    try {
      // On n'envoie que le texte + les fichiers joints au serveur (les artefacts
      // de rendu restent locaux).
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          sources: selected,
          coaching: coaching ?? null,
          // Fichiers du coaching (épinglés) + fichiers ajoutés dans le chat.
          attachments: [...contextFiles, ...attachments],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur agent");
      const assistant: Msg = {
        role: "assistant",
        content: data.message || "(réponse vide)",
        report: data.report ?? null,
        chart: data.chartProposal ?? null,
        action: data.proposedAction ?? null,
        dealAction: data.dealAction ?? null,
        redirect: data.redirect ?? null,
      };
      const finalMsgs = [...next, assistant];
      setMessages(finalMsgs);
      upsertConversation(id, finalMsgs, selected, attachments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));
    }
  }

  const empty = messages.length === 0;
  // Suggestions d'alerte de la conversation courante (accumulées au fil des
  // réponses). Reléguées dans l'onglet « Alertes » pour ne pas casser le flux.
  const suggestedAlerts = messages
    .map((m, i) => (m.role === "assistant" && m.action ? { i, action: m.action } : null))
    .filter((x): x is { i: number; action: ProposedAction } => x !== null);
  // Actions pipeline proposées par l'agent (onglet Actions).
  const proposedActions = messages
    .map((m, i) => (m.role === "assistant" && m.dealAction ? { i, action: m.dealAction } : null))
    .filter((x): x is { i: number; action: DealActionProposal } => x !== null);
  const sortedHistory = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const selectedCats = new Set(sources.filter((s) => selected.includes(s.key)).map((s) => s.category));
  const baseSuggestions = resolveSuggestions(suggestions, suggestionSets ?? null, selectedCats);
  // Agent coach : propose de démarrer la séance du jour (sans la lancer
  // automatiquement). Le contexte (objectifs/pains/RDV) est celui de l'agenda
  // à jour grâce à la resynchro des props ci-dessus.
  const activeSuggestions = coaching
    ? ["Démarrer ma séance de coaching du jour", ...baseSuggestions]
    : baseSuggestions;
  // Onglet Suggestions : liste riche selon les sources sélectionnées (celles de
  // l'agent + le catalogue d'analyses), sans surcharger le fil.
  const analysisSuggestions = [...new Set([...baseSuggestions, ...suggestionsForCategories(selectedCats)])];

  function runSuggestion(text: string) {
    setTab("chat");
    send(text);
  }

  return (
    <ActivatedAlertsContext.Provider value={addActivatedAlert}>
    <div className="card flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col overflow-hidden">
      {/* Onglets + nouvelle conversation — flex-wrap pour ne JAMAIS rogner un
          onglet (notamment « Alertes ») sur une largeur réduite. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--card-border)] px-3 py-2">
        <button
          onClick={() => setTab("chat")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "chat" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Discussion
        </button>
        <button
          onClick={() => setTab("history")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "history" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Historique{conversations.length > 0 ? ` (${conversations.length})` : ""}
        </button>
        <button
          onClick={() => setTab("suggestions")}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "suggestions" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <span>💡</span> Suggestions
          {analysisSuggestions.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {analysisSuggestions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("actions")}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "actions" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <span>⚡</span> Actions
          {proposedActions.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {proposedActions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("alerts")}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "alerts" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <span>✨</span> Alertes
          {suggestedAlerts.length + activatedAlerts.length > 0 && (
            <span className="rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-700">
              {suggestedAlerts.length + activatedAlerts.length}
            </span>
          )}
        </button>
        <div className="flex-1" />
        {coachingMode && coachingStatus === "active" && (
          <button
            onClick={() => completeSession(false)}
            className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          >
            ✓ Terminer le coaching
          </button>
        )}
        <button
          onClick={startNew}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Nouvelle
        </button>
      </div>

      {/* ── Onglet Historique ── */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {sortedHistory.length === 0 ? (
            <p className="pt-8 text-center text-sm text-slate-400">
              Aucune conversation enregistrée pour l&apos;instant.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedHistory.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center gap-3 rounded-xl border p-3 transition hover:bg-slate-50 ${
                    c.id === currentId ? "border-fuchsia-200 bg-fuchsia-50/40" : "border-[var(--card-border)]"
                  }`}
                >
                  <button onClick={() => openConversation(c)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-slate-800">{c.title}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {c.messages.length} message{c.messages.length > 1 ? "s" : ""} · {relativeDate(c.updatedAt)}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteConversation(c.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Onglet Suggestions (analyses pertinentes selon les sources) ── */}
      {tab === "suggestions" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2 text-xs text-slate-400">
            Analyses pertinentes selon tes sources sélectionnées. Clique pour lancer la question dans le chat.
          </p>
          {analysisSuggestions.length === 0 ? (
            <p className="pt-8 text-center text-sm text-slate-400">Sélectionne une source pour voir des suggestions.</p>
          ) : (
            <div className="space-y-2">
              {analysisSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => runSuggestion(s)}
                  disabled={loading}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-fuchsia-200 hover:bg-fuchsia-50/50 disabled:opacity-60"
                >
                  <span className="text-slate-300">💡</span>
                  <span className="min-w-0 flex-1">{s}</span>
                  <span className="shrink-0 text-[11px] font-medium text-accent">Lancer →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Actions (exécutables dans le CRM, human-in-the-loop) ── */}
      {tab === "actions" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {proposedActions.length === 0 ? (
            <div className="mx-auto max-w-md pt-8 text-center">
              <p className="text-sm text-slate-500">
                Aucune action proposée pour l&apos;instant. Quand l&apos;agent juge qu&apos;une action concrète est utile
                (relancer des deals, repousser un closing…), il l&apos;ajoute ici — tu la valides, la modifies, puis tu
                l&apos;exécutes réellement dans ton CRM.
              </p>
              <button
                onClick={() => setTab("chat")}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ← Retour à la discussion
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Actions proposées par l&apos;agent. Ajuste les paramètres puis exécute-les dans HubSpot.
              </p>
              {proposedActions.map(({ i, action }) => (
                <div key={i} className="-ml-9">
                  <DealActionCard agentKey={agentKey} action={action} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Alertes (suggestions + alertes activées) ── */}
      {tab === "alerts" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {suggestedAlerts.length === 0 && activatedAlerts.length === 0 ? (
            <div className="mx-auto max-w-md pt-8 text-center">
              <p className="text-sm text-slate-500">
                Aucune alerte pour l&apos;instant. L&apos;agent ajoute ici ses suggestions de suivi, et tes alertes
                activées (depuis une suggestion ou un rapport) s&apos;y retrouvent aussi.
              </p>
              <button
                onClick={() => setTab("chat")}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ← Retour à la discussion
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activatedAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-700">✓ Alertes activées ({activatedAlerts.length})</p>
                  {activatedAlerts.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <span>✓</span>
                      <span className="min-w-0 flex-1 truncate">{a.title}</span>
                      <Link href="/dashboard/alertes" className="shrink-0 text-[11px] font-medium underline hover:text-emerald-900">
                        voir
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {suggestedAlerts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Suggestions d&apos;alerte de cette conversation. Ajuste et active celles qui t&apos;intéressent.
                  </p>
                  {suggestedAlerts.map(({ i, action }) => (
                    <AlertSuggestionCard
                      key={i}
                      agentKey={agentKey}
                      action={action}
                      tools={sources.map((s) => ({ key: s.key, label: s.label, icon: s.icon }))}
                      initialSources={selected}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Discussion ── */}
      {tab === "chat" && (
        <>
          {/* Sélecteur de sources */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--card-border)] px-4 py-3">
            <span className="text-xs font-medium text-slate-500">Sources à croiser :</span>
            {sources.length === 0 && (
              <span className="text-xs text-slate-400">
                Aucune source connectée — connecte Stripe/Pennylane/HubSpot.
              </span>
            )}
            {sources.map((s) => {
              const on = selected.includes(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSource(s.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    on
                      ? "bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 text-slate-800 ring-1 ring-fuchsia-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <span className="mr-1">{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Fil de discussion */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {empty && (
              <div className="mx-auto max-w-md pt-6 text-center">
                {persona ? (
                  <div className="mx-auto mb-3 w-fit">
                    <AgentAvatar name={persona.name} emoji={persona.emoji} image={persona.image} size={56} />
                  </div>
                ) : (
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-lg text-white">
                    ✨
                  </div>
                )}
                <h3 className="text-sm font-semibold text-slate-800">{agentLabel}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Que veux-tu analyser aujourd&apos;hui ? Sélectionne tes sources et pose ta question, ou choisis une
                  suggestion.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" &&
                    (persona ? (
                      <div className="mr-2 mt-0.5">
                        <AgentAvatar name={persona.name} emoji={persona.emoji} image={persona.image} size={28} />
                      </div>
                    ) : (
                      <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
                        ✨
                      </div>
                    ))}
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.role === "user"
                        ? "bg-accent text-white"
                        : "border border-[var(--card-border)] bg-white text-slate-700"
                    }`}
                  >
                    {m.role === "assistant" ? cleanText(m.content) : m.content}
                  </div>
                </div>
                {m.role === "assistant" && (m.report || m.chart) && (
                  <MessageArtifacts
                    agentKey={agentKey}
                    agentLabel={agentLabel}
                    report={m.report}
                    chart={m.chart}
                    sources={selected}
                  />
                )}
                {/* Redirection vers le bon agent (demande hors-scope). */}
                {m.role === "assistant" && m.redirect && (
                  <Link
                    href={`/dashboard/agents/${m.redirect.agentKey}`}
                    className="ml-9 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <span>↪</span> Ouvrir {getAgentPersona(m.redirect.agentKey).name} — {getAgentPersona(m.redirect.agentKey).role}
                  </Link>
                )}
                {/* Action pipeline exécutable → pastille discrète vers l'onglet Actions. */}
                {m.role === "assistant" && m.dealAction && (
                  <button
                    onClick={() => setTab("actions")}
                    className="ml-9 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100"
                  >
                    <span>⚡</span> Action proposée — voir l&apos;onglet Actions →
                  </button>
                )}
                {/* Pastille discrète : une alerte a été suggérée → onglet Alertes.
                    Non-intrusive, préserve le flux de lecture. */}
                {m.role === "assistant" && m.action && (
                  <button
                    onClick={() => setTab("alerts")}
                    className="ml-9 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200 bg-fuchsia-50/70 px-3 py-1 text-[11px] font-medium text-fuchsia-700 transition hover:bg-fuchsia-100"
                  >
                    <span>✨</span> Suggestion d&apos;alerte ajoutée — voir l&apos;onglet Alertes →
                  </button>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                {persona ? (
                  <div className="mr-2 mt-0.5">
                    <AgentAvatar name={persona.name} emoji={persona.emoji} image={persona.image} size={28} />
                  </div>
                ) : (
                  <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
                    ✨
                  </div>
                )}
                <div className="rounded-2xl border border-[var(--card-border)] bg-white px-3.5 py-2.5 text-sm text-slate-400">
                  {persona ? `${persona.name} analyse tes données…` : "L'agent analyse tes données…"}
                </div>
              </div>
            )}

            {sessionEnd === "asking" && (
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3.5">
                <p className="text-sm text-slate-700">Souhaites-tu terminer la séance de coaching du jour ?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => completeSession(false)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Oui, terminer
                  </button>
                  <button
                    onClick={() => {
                      clearSessionTimers();
                      setSessionEnd("none");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Non, continuer
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Sans réponse, la séance sera clôturée automatiquement dans 2 min.</p>
              </div>
            )}
            {sessionEnd === "ended" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm font-medium text-emerald-700">
                ✓ Séance de coaching terminée et enregistrée dans « Coaching réalisé par les agents ».
              </div>
            )}
            {askAnother && !coachingMode && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
                <p className="text-sm text-slate-700">Avez-vous une autre question ?</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Sans activité, cette conversation se fermera automatiquement et repartira à zéro.
                </p>
              </div>
            )}

            {error && <div className="text-sm text-red-500">⚠ {error}</div>}
          </div>

          {/* Suggestions */}
          {empty && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--card-border)] px-4 py-3">
              {activeSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-fuchsia-200 hover:bg-fuchsia-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Zone de saisie */}
          <div className="border-t border-[var(--card-border)] px-4 py-3">
            {attachments.length > 0 && (
              <div className="mb-2">
                <AttachmentChips items={attachments} onRemove={removeAttachment} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <AttachMenu onAdd={addAttachment} disabled={loading} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pose ta question à l'agent…"
                disabled={loading}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:opacity-60"
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </ActivatedAlertsContext.Provider>
  );
}
