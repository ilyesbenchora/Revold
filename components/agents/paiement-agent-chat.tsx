"use client";

import { useRef, useState } from "react";

type SourceOption = { key: string; label: string; icon: string };
type ProposedAction = {
  action_type: string;
  title: string;
  description: string;
  category?: string;
  impact?: string;
};
type Msg = { role: "user" | "assistant"; content: string };

export function PaiementAgentChat({
  sources,
  suggestions,
}: {
  sources: SourceOption[];
  suggestions: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(sources.map((s) => s.key));
  const [pending, setPending] = useState<ProposedAction | null>(null);
  const [actionState, setActionState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function toggleSource(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    setPending(null);
    setActionState("idle");
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));

    try {
      const res = await fetch("/api/agents/paiement-facturation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, sources: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur agent");
      setMessages((m) => [...m, { role: "assistant", content: data.message || "(réponse vide)" }]);
      if (data.proposedAction) setPending(data.proposedAction);
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
      const res = await fetch("/api/agents/paiement-facturation/execute", {
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

  return (
    <div className="card flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col overflow-hidden">
      {/* Sélecteur de sources */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--card-border)] px-4 py-3">
        <span className="text-xs font-medium text-slate-500">Sources à croiser :</span>
        {sources.length === 0 && (
          <span className="text-xs text-slate-400">Aucune source connectée — connecte Stripe/Pennylane/HubSpot.</span>
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
              💳
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Agent Paiement &amp; Facturation</h3>
            <p className="mt-1 text-sm text-slate-500">
              Quelle performance paiement &amp; facturation veux-tu analyser aujourd&apos;hui ? Sélectionne tes
              sources et pose ta question.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
                💳
              </div>
            )}
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : "border border-[var(--card-border)] bg-white text-slate-700"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-xs text-white">
              💳
            </div>
            <div className="rounded-2xl border border-[var(--card-border)] bg-white px-3.5 py-2.5 text-sm text-slate-400">
              L&apos;agent analyse tes données…
            </div>
          </div>
        )}

        {/* Carte d'action confirmable */}
        {pending && (
          <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
              Action proposée · à confirmer
            </div>
            <div className="text-sm font-semibold text-slate-800">{pending.title}</div>
            <p className="mt-0.5 text-sm text-slate-600">{pending.description}</p>
            {pending.impact && (
              <p className="mt-1 text-xs text-slate-500">Impact : {pending.impact}</p>
            )}
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
              {actionState === "error" && (
                <span className="text-xs text-red-500">Échec de la création.</span>
              )}
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
          placeholder="Pose ta question sur le paiement & la facturation…"
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
  );
}
