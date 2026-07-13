"use client";

import { useEffect, useRef, useState } from "react";
import { AgentReport } from "./agent-report";
import type { ReportSpec } from "@/lib/ai/agents/agent-runtime";

type SourceOption = { key: string; label: string; icon: string };
type ProposedAction = {
  action_type: string;
  title: string;
  description: string;
  category?: string;
  impact?: string;
};
type Msg = { role: "user" | "assistant"; content: string };
type Conversation = {
  id: string;
  title: string;
  sources: string[];
  messages: Msg[];
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
}: {
  agentKey: string;
  agentLabel: string;
  sources: SourceOption[];
  suggestions: string[];
}) {
  const storageKey = `revold:agent:${agentKey}:v1`;
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "history">("chat");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(sources.map((s) => s.key));
  const [pending, setPending] = useState<ProposedAction | null>(null);
  const [report, setReport] = useState<ReportSpec | null>(null);
  const [actionState, setActionState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydratation depuis localStorage (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          // Restaure la conversation la plus récente.
          const latest = [...parsed].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          if (latest) {
            setCurrentId(latest.id);
            setMessages(latest.messages);
            if (latest.sources.length) setSelected(latest.sources);
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

  function upsertConversation(id: string, msgs: Msg[], srcs: string[]) {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      const conv: Conversation = {
        id,
        title: titleFrom(msgs),
        sources: srcs,
        messages: msgs,
        updatedAt: Date.now(),
      };
      return [conv, ...rest];
    });
  }

  function toggleSource(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setPending(null);
    setReport(null);
    setActionState("idle");
    setError(null);
    setTab("chat");
  }

  function openConversation(c: Conversation) {
    setCurrentId(c.id);
    setMessages(c.messages);
    setSelected(c.sources.length ? c.sources : sources.map((s) => s.key));
    setPending(null);
    setReport(null);
    setActionState("idle");
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
    setPending(null);
    setReport(null);
    setActionState("idle");

    const id = currentId ?? newId();
    if (!currentId) setCurrentId(id);

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    upsertConversation(id, next, selected);
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));

    try {
      const res = await fetch(`/api/agents/${agentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sources: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur agent");
      const finalMsgs = [...next, { role: "assistant" as const, content: data.message || "(réponse vide)" }];
      setMessages(finalMsgs);
      upsertConversation(id, finalMsgs, selected);
      if (data.proposedAction) setPending(data.proposedAction);
      if (data.report) setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));
    }
  }

  async function confirmAction() {
    if (!pending) return;
    setActionState("saving");
    try {
      const res = await fetch(`/api/agents/${agentKey}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setActionState("done");
    } catch {
      setActionState("error");
    }
  }

  const empty = messages.length === 0;
  const sortedHistory = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

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
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

            {/* Rapport rendu par l'agent (Dashboard/Reporting) */}
            {report && <AgentReport spec={report} />}

            {/* Carte d'action confirmable */}
            {pending && (
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3.5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
                  Action proposée · à confirmer
                </div>
                <div className="text-sm font-semibold text-slate-800">{pending.title}</div>
                <p className="mt-0.5 text-sm text-slate-600">{pending.description}</p>
                {pending.impact && <p className="mt-1 text-xs text-slate-500">Impact : {pending.impact}</p>}
                <div className="mt-3 flex items-center gap-2">
                  {actionState === "done" ? (
                    <span className="text-sm font-medium text-emerald-600">✓ Alerte créée</span>
                  ) : (
                    <>
                      <button
                        onClick={confirmAction}
                        disabled={actionState === "saving"}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        {actionState === "saving" ? "Création…" : "Confirmer et créer l'alerte"}
                      </button>
                      <button
                        onClick={() => setPending(null)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Ignorer
                      </button>
                    </>
                  )}
                  {actionState === "error" && <span className="text-xs text-red-500">Échec de la création.</span>}
                </div>
              </div>
            )}

            {error && <div className="text-sm text-red-500">⚠ {error}</div>}
          </div>

          {/* Suggestions */}
          {empty && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--card-border)] px-4 py-3">
              {suggestions.map((s) => (
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
          <div className="flex items-center gap-2 border-t border-[var(--card-border)] px-4 py-3">
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
        </>
      )}
    </div>
  );
}
