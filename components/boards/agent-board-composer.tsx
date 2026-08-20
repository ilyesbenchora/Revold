"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BoardComposition } from "@/lib/boards/board-templates";
import { DictationButton } from "@/components/voice/dictation-button";

/**
 * « Compose ton tableau avec l'agent » (page Templates) : l'utilisateur décrit
 * son besoin, l'agent PROPOSE une composition (tuiles + tables) construite sur
 * le catalogue canonique + les champs métier des connecteurs sur mesure —
 * specs déterministes sanitisées côté serveur. La proposition est AFFICHÉE
 * avant création : ce que tu vois est exactement ce qui est créé.
 */

type Proposal = { name: string; composition: BoardComposition; dropped: number };

const VIEW_LABELS: Record<string, string> = { table: "tableau", bar: "barres", line: "courbe", donut: "anneau" };

export function AgentBoardComposer() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [name, setName] = useState("");
  const [composing, setComposing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compose() {
    const b = brief.trim();
    if (!b || composing) return;
    setComposing(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/boards/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: b }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.proposal) {
        setError(d.error ?? "Composition impossible.");
        return;
      }
      setProposal(d.proposal as Proposal);
      setName((d.proposal as Proposal).name);
    } catch {
      setError("Composition impossible.");
    } finally {
      setComposing(false);
    }
  }

  async function create() {
    if (!proposal || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: (name.trim() || proposal.name).slice(0, 60), composition: proposal.composition }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.board?.id) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      router.push(`/dashboard/tableaux-de-bord/${d.board.id}`);
      router.refresh();
    } catch {
      setError("Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/70 via-white to-white p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        ✨ Compose ton tableau avec l&apos;agent
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Décris ton besoin — l&apos;agent propose des tuiles et des tables câblées sur tes données réelles (outils
        connectés, y compris les champs métier de tes connecteurs sur mesure). Tu vois la proposition avant de créer.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && compose()}
          placeholder="Ex : suivi de ma facturation ERP — CA, impayés, marge par mois…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
        />
        <DictationButton onText={(t) => setBrief((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} label="Dicter le besoin au micro" />
        <button
          type="button"
          disabled={composing || !brief.trim()}
          onClick={compose}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {composing ? "Composition par l'agent…" : "Composer ✨"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {proposal && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-emerald-800">✓ Proposition de l&apos;agent :</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400"
            />
          </div>

          {proposal.composition.tiles.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tuiles KPI</p>
              <ul className="mt-1 space-y-1">
                {proposal.composition.tiles.map((t, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-slate-400">
                      {" "}— {t.agg.measure === "count" ? "comptage" : `${t.agg.measure} de ${t.agg.field}`} · {t.agg.entity}
                      {t.agg.target ? ` · cible « ${t.agg.target} »${t.agg.percent_of_total ? " (taux)" : ""}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proposal.composition.tables.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tables & graphiques</p>
              <ul className="mt-1 space-y-1">
                {proposal.composition.tables.map((t, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-slate-400">
                      {" "}— {VIEW_LABELS[t.view] ?? t.view} · {t.entity} par {t.group_by}
                      {t.measure !== "count" ? ` (${t.measure} de ${t.field})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {proposal.dropped > 0 && (
            <p className="mt-2 text-[11px] text-amber-700">
              {proposal.dropped} élément{proposal.dropped > 1 ? "s" : ""} proposé{proposal.dropped > 1 ? "s" : ""} par
              l&apos;agent écarté{proposal.dropped > 1 ? "s" : ""} (non calculable{proposal.dropped > 1 ? "s" : ""} de
              façon fiable).
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={create}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? "Création…" : "Créer ce tableau"}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => setProposal(null)}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              Reformuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
