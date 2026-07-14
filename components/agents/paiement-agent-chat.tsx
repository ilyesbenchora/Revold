"use client";

import { useEffect, useRef, useState } from "react";
import { MessageArtifacts } from "./message-artifacts";
import { AttachMenu, AttachmentChips } from "./attach-menu";
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
  initialAttachments,
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
  initialAttachments?: Attachment[] | null;
}) {
  const storageKey = `revold:agent:${agentKey}:v1`;
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "history">("chat");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Sources pré-cochées : celles choisies dans l'agenda de coaching (« outils à
  // croiser »), filtrées sur les sources réellement disponibles. Sinon, tout.
  const initialSelected =
    preselectedSources && preselectedSources.length
      ? sources.filter((s) => preselectedSources.includes(s.key)).map((s) => s.key)
      : sources.map((s) => s.key);
  const [selected, setSelected] = useState<string[]>(
    initialSelected.length ? initialSelected : sources.map((s) => s.key),
  );
  const [error, setError] = useState<string | null>(null);
  // Fichiers joints à la conversation (Excel/CSV/Google Sheets) injectés en contexte.
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments ?? []);
  const [sessionEnd, setSessionEnd] = useState<"none" | "asking" | "ended">("none");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inactRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const INACT_MS = 5 * 60 * 1000; // 5 min d'inactivité → propose de terminer
  const AUTO_MS = 2 * 60 * 1000; // 2 min sans réponse → terminaison auto

  function clearSessionTimers() {
    if (inactRef.current) clearTimeout(inactRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
    inactRef.current = null;
    autoRef.current = null;
  }

  async function completeSession(auto: boolean) {
    clearSessionTimers();
    setSessionEnd("ended");
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

  // Hydratation depuis localStorage (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          const latest = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          if (latest) {
            setCurrentId(latest.id);
            setMessages(latest.messages);
            if (latest.sources.length) setSelected(latest.sources);
            if (latest.attachments?.length) setAttachments(latest.attachments);
          }
        }
      }
    } catch {
      /* localStorage indisponible / corrompu → on démarre à vide */
    }
    setHydrated(true);
  }, [storageKey]);

  // Persistance : réécrit localStorage à chaque changement (après hydratation).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
      /* quota / mode privé → on ignore */
    }
  }, [conversations, hydrated, storageKey]);

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
    setAttachments(initialAttachments ?? []);
    setError(null);
    setTab("chat");
  }

  function openConversation(c: Conversation) {
    setCurrentId(c.id);
    setMessages(c.messages);
    setSelected(c.sources.length ? c.sources : sources.map((s) => s.key));
    setAttachments(c.attachments ?? []);
    setError(null);
    setTab("chat");
  }

  function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === currentId) startNew();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);

    const id = currentId ?? newId();
    if (!currentId) setCurrentId(id);

    const next: Msg[] = [...messages, { role: "user", content }];
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
          attachments,
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
  const sortedHistory = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const selectedCats = new Set(sources.filter((s) => selected.includes(s.key)).map((s) => s.category));
  const baseSuggestions = resolveSuggestions(suggestions, suggestionSets ?? null, selectedCats);
  // Agent coach : propose de démarrer la séance (sans la lancer automatiquement).
  const activeSuggestions = coaching
    ? ["Démarrer ma séance de coaching sur mes objectifs et mes pains", ...baseSuggestions]
    : baseSuggestions;

  return (
    <div className="card flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col overflow-hidden">
      {/* Onglets + nouvelle conversation */}
      <div className="flex items-center gap-1 border-b border-[var(--card-border)] px-3 py-2">
        <button
          onClick={() => setTab("chat")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "chat" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Discussion
        </button>
        <button
          onClick={() => setTab("history")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            tab === "history" ? "bg-accent-soft text-accent" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Historique{conversations.length > 0 ? ` (${conversations.length})` : ""}
        </button>
        <div className="flex-1" />
        <button
          onClick={startNew}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-lg text-white">
                  ✨
                </div>
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
                  {m.role === "assistant" && (
                    <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
                      ✨
                    </div>
                  )}
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
                {m.role === "assistant" && (m.report || m.chart || m.action) && (
                  <MessageArtifacts
                    agentKey={agentKey}
                    agentLabel={agentLabel}
                    report={m.report}
                    chart={m.chart}
                    action={m.action}
                  />
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
                  ✨
                </div>
                <div className="rounded-2xl border border-[var(--card-border)] bg-white px-3.5 py-2.5 text-sm text-slate-400">
                  L&apos;agent analyse tes données…
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
  );
}
