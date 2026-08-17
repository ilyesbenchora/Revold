"use client";

import { useState } from "react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { AGENT_TONES } from "@/lib/ai/agents/agent-prefs";

export type AgentPrefRow = {
  agentKey: string;
  label: string;
  role: string;
  personaName: string;
  personaEmoji: string;
  personaImage: string | null;
  tone: string | null;
  personality: string | null;
  insightsEnabled: boolean;
  /** Insights d'usage (conversations de l'utilisateur avec cet agent). */
  insights: {
    conversations: number;
    messages: number;
    /** Profondeur moyenne : messages par conversation. */
    depth: number;
    /** Sujets les plus abordés (titres des dernières conversations). */
    topics: string[];
  };
};

/**
 * Paramètres → Agents : personnalité et ton de CHAQUE agent (injectés dans son
 * system prompt, appliqués à toutes ses réponses) + activation des « insights
 * agent » — sujets les plus abordés, volume et profondeur des échanges.
 */
export function AgentPrefsSettings({ agents }: { agents: AgentPrefRow[] }) {
  const [rows, setRows] = useState(agents);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(agentKey: string, p: Partial<AgentPrefRow>) {
    setRows((r) => r.map((a) => (a.agentKey === agentKey ? { ...a, ...p } : a)));
  }

  async function save(agentKey: string) {
    const row = rows.find((a) => a.agentKey === agentKey);
    if (!row || savingKey) return;
    setSavingKey(agentKey);
    setError(null);
    try {
      const res = await fetch("/api/agent-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: agentKey,
          tone: row.tone,
          personality: row.personality,
          insights_enabled: row.insightsEnabled,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        return;
      }
      setSavedKey(agentKey);
      setTimeout(() => setSavedKey((k) => (k === agentKey ? null : k)), 2500);
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

      {rows.map((a) => (
        <div key={a.agentKey} className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
            <AgentAvatar name={a.personaName} emoji={a.personaEmoji} image={a.personaImage} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{a.personaName} · {a.label}</p>
              <p className="truncate text-[11px] text-slate-400">{a.role}</p>
            </div>
            {savedKey === a.agentKey && <span className="text-[11px] font-semibold text-emerald-600">✓ Enregistré</span>}
            <button
              type="button"
              disabled={savingKey === a.agentKey}
              onClick={() => save(a.agentKey)}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {savingKey === a.agentKey ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ton de l&apos;agent</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => patch(a.agentKey, { tone: null })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      a.tone == null ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Par défaut
                  </button>
                  {AGENT_TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.directive}
                      onClick={() => patch(a.agentKey, { tone: t.id })}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        a.tone === t.id ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Personnalité / consignes</label>
                <textarea
                  value={a.personality ?? ""}
                  onChange={(e) => patch(a.agentKey, { personality: e.target.value })}
                  rows={3}
                  placeholder="Ex : tutoie-moi, réponds en 5 lignes max, cite toujours le benchmark du secteur, termine par une action à faire aujourd'hui…"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
                />
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Injecté dans le prompt de l&apos;agent — appliqué à toutes ses réponses (chat, routines, séances).
                </p>
              </div>
            </div>

            <div>
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <input
                  type="checkbox"
                  checked={a.insightsEnabled}
                  onChange={(e) => patch(a.agentKey, { insightsEnabled: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-fuchsia-500"
                />
                Insights agent
              </label>
              {a.insightsEnabled ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums text-slate-900">{a.insights.conversations}</p>
                      <p className="text-[10px] text-slate-400">Conversations</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-slate-900">{a.insights.messages}</p>
                      <p className="text-[10px] text-slate-400">Messages</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-slate-900">{a.insights.depth}</p>
                      <p className="text-[10px] text-slate-400">Profondeur (msg/conv)</p>
                    </div>
                  </div>
                  {a.insights.topics.length > 0 ? (
                    <div className="mt-2.5 border-t border-slate-200 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sujets les plus abordés</p>
                      <ul className="mt-1 space-y-0.5">
                        {a.insights.topics.map((t, i) => (
                          <li key={i} className="truncate text-xs text-slate-600">· {t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">Aucune conversation pour l&apos;instant.</p>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Active pour voir les sujets les plus abordés avec cet agent, le volume et la profondeur des échanges.
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
