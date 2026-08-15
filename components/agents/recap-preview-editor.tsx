"use client";

import { useState } from "react";
import { ReportChart } from "./agent-report";
import { entityLabel, dimLabel, ENTITY_SOURCE_CATEGORY } from "@/lib/reports/data-table-presets";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";
import type { ReportSpec, ReportBlock } from "@/lib/ai/agents/agent-runtime";

/**
 * Éditeur de l'APERÇU d'un récap de routine, avant enregistrement :
 *  - chaque tuile KPI est retirable individuellement (✕) ;
 *  - les blocs (graphiques / tables) se réordonnent en glisser-déposer et se
 *    retirent d'un ✕ ;
 *  - « ＋ Ajouter un KPI » passe par le FUNNEL DE CÂBLAGE (proposition d'agent
 *    vérifiée sur la vraie donnée, volumes à l'appui) — aucun bloc ajouté à
 *    l'aveugle.
 */

// Page « tables de données » de référence pour le funnel de câblage par agent.
const AGENT_PAGE_KEY: Record<string, string> = {
  performance: "perf_ventes",
  "service-client": "audit_service_client",
  "paiement-facturation": "audit_paiement_facturation",
};

type Proposal = {
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string;
  pipeline?: string | null;
  title: string | null;
  rowCount: number;
  agent: string;
};

const ADD_VIEWS: { id: "kpi" | "bar" | "line" | "donut" | "table"; label: string }[] = [
  { id: "kpi", label: "Tuile KPI" },
  { id: "bar", label: "Barres" },
  { id: "line", label: "Courbe" },
  { id: "donut", label: "Anneau" },
  { id: "table", label: "Table" },
];

function fmtVal(v: number, unit: string | null | undefined): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

export function RecapPreviewEditor({
  spec,
  onChange,
  agentKey,
  sourceKeys,
}: {
  spec: ReportSpec;
  onChange: (spec: ReportSpec) => void;
  agentKey: string;
  sourceKeys: string[];
}) {
  const kpis = spec.blocks.filter((b) => b.type === "kpi");
  const blocks = spec.blocks.filter((b) => b.type !== "kpi");

  const commit = (nextKpis: ReportBlock[], nextBlocks: ReportBlock[]) =>
    onChange({ ...spec, blocks: [...nextKpis, ...nextBlocks] });

  const removeKpi = (i: number) => commit(kpis.filter((_, idx) => idx !== i), blocks);
  const removeBlock = (i: number) => commit(kpis, blocks.filter((_, idx) => idx !== i));

  // ── Réordonnancement en glisser-déposer (HTML5, sans lib) ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  function drop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    commit(kpis, next);
    setDragIndex(null);
    setOverIndex(null);
  }

  // ── Ajout d'un bloc via le funnel de câblage ──
  const [adding, setAdding] = useState(false);
  const [addKpi, setAddKpi] = useState("");
  const [addView, setAddView] = useState<(typeof ADD_VIEWS)[number]["id"]>("bar");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalRows, setProposalRows] = useState<{ name: string; value: number }[] | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function resetAdd() {
    setAdding(false);
    setAddKpi("");
    setProposal(null);
    setProposalRows(null);
    setAddError(null);
  }

  /** Étape 1 : l'agent propose un câblage vérifié (volumes réels à l'appui). */
  async function requestProposal() {
    if (addLoading || !addKpi.trim()) return;
    setAddLoading(true);
    setAddError(null);
    setProposal(null);
    setProposalRows(null);
    try {
      const res = await fetch("/api/page-tables/agent-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: AGENT_PAGE_KEY[agentKey] ?? "audit_donnees",
          custom_kpi: addKpi.trim(),
          sources: sourceKeys,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.proposal) throw new Error(d.error || "Câblage impossible — reformule le KPI.");
      const p = d.proposal as Proposal;
      // Recalcul déterministe immédiat : la preuve chiffrée avant l'ajout.
      const rec = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { entity: p.entity, groupBy: p.group_by, measure: p.measure, field: p.field, pipeline: p.pipeline ?? null },
          sources: sourceKeys,
          all: true,
        }),
      });
      const rd = await rec.json().catch(() => ({}));
      if (!rec.ok || !Array.isArray(rd.data)) throw new Error(rd.error || "Recalcul impossible.");
      setProposal(p);
      setProposalRows(rd.data);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAddLoading(false);
    }
  }

  /** Étape 2 : ajout du bloc câblé (avec sa query pour le recalcul futur). */
  function confirmAdd() {
    if (!proposal || !proposalRows) return;
    const title = proposal.title || addKpi.trim();
    const query = {
      entity: proposal.entity,
      groupBy: proposal.group_by,
      measure: proposal.measure,
      field: proposal.field ?? undefined,
    };
    if (addView === "kpi") {
      const total = proposalRows.reduce((s, r) => s + (Number(r.value) || 0), 0);
      commit([...kpis, { type: "kpi", label: title, value: fmtVal(total, proposal.unit_mode), query } as ReportBlock], blocks);
    } else if (addView === "table") {
      commit(kpis, [
        ...blocks,
        {
          type: "table",
          title,
          columns: [dimLabel(proposal.entity, proposal.group_by), "Valeur"],
          rows: proposalRows.map((r) => [r.name, fmtVal(Number(r.value) || 0, proposal.unit_mode)]),
          query,
        } as ReportBlock,
      ]);
    } else {
      commit(kpis, [...blocks, { type: addView, title, data: proposalRows, query } as ReportBlock]);
    }
    resetAdd();
  }

  const chip = "rounded-full border px-2.5 py-1 text-[11px] font-medium transition";

  return (
    <div className="space-y-3">
      {/* Tuiles KPI — retirables individuellement */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((b, i) => (
            <div key={i} className="group relative rounded-lg border border-slate-100 bg-slate-50 p-3">
              <button
                type="button"
                onClick={() => removeKpi(i)}
                title="Retirer ce KPI du rapport"
                className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-slate-400 shadow ring-1 ring-slate-200 transition hover:text-rose-600 group-hover:flex"
              >
                ✕
              </button>
              <div className="text-[11px] text-slate-500">{b.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{b.value}</div>
              {b.hint && <div className="text-[11px] text-slate-400">{b.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Blocs — drag & drop pour l'ordre, ✕ pour retirer */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {blocks.map((b, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
            onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={() => drop(i)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            className={`group relative min-w-0 cursor-grab rounded-xl border bg-white p-4 transition active:cursor-grabbing ${
              overIndex === i && dragIndex !== null && dragIndex !== i
                ? "border-fuchsia-400 ring-2 ring-fuchsia-100"
                : "border-slate-200"
            } ${dragIndex === i ? "opacity-50" : ""}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title="Glisser pour réordonner" className="shrink-0 select-none text-slate-300">⠿</span>
                {b.title && <div className="truncate text-xs font-semibold text-slate-700">{b.title}</div>}
              </div>
              <button
                type="button"
                onClick={() => removeBlock(i)}
                title="Retirer ce bloc du rapport"
                className="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 group-hover:block"
              >
                ✕ Retirer
              </button>
            </div>
            {b.type === "table" ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                      {(b.columns ?? []).map((c, ci) => <th key={ci} className="px-2.5 py-2 font-semibold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(b.rows ?? []).map((r, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0">
                        {r.map((cell, ci) => <td key={ci} className="px-2.5 py-1.5 text-slate-700">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ReportChart block={b} showTotal={b.type === "donut"} />
            )}
          </div>
        ))}
      </div>

      {/* ＋ Ajouter un KPI via le funnel de câblage */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-fuchsia-300/70 bg-fuchsia-50/30 px-3 py-2.5 text-xs font-semibold text-fuchsia-600 transition hover:bg-fuchsia-50"
        >
          ＋ Ajouter un KPI au rapport (câblage vérifié)
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-fuchsia-300/70 bg-fuchsia-50/30 p-3">
          <p className="text-xs font-semibold text-fuchsia-600">Ajouter un KPI câblé</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Décris le KPI — le câblage est vérifié sur tes données réelles avant l&apos;ajout.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={addKpi}
              onChange={(e) => setAddKpi(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") requestProposal(); }}
              placeholder="Ex : montant moyen des deals gagnés par mois"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
            />
            <button
              type="button"
              onClick={requestProposal}
              disabled={addLoading || !addKpi.trim()}
              className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {addLoading ? "Câblage…" : "Vérifier le câblage"}
            </button>
            <button type="button" onClick={resetAdd} className="text-[11px] text-slate-400 hover:text-slate-600">
              Annuler
            </button>
          </div>
          {addError && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{addError}</p>}

          {proposal && proposalRows && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-indigo-50/40 p-3">
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Source de données</dt>
                  <dd className="font-semibold text-slate-900">{entityLabel(proposal.entity)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Regroupement</dt>
                  <dd className="font-medium text-slate-700">{dimLabel(proposal.entity, proposal.group_by)}</dd>
                </div>
                {(() => {
                  // Outil(s) de câblage : les outils sources de l'agent qui alimentent l'entité.
                  const cat = ENTITY_SOURCE_CATEGORY[proposal.entity];
                  const wired = sourceKeys
                    .map((k) => getConnectableTool(k))
                    .filter((t): t is NonNullable<typeof t> => !!t && t.category === cat);
                  return wired.length > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Câblé sur</dt>
                      <dd className="font-medium text-slate-700">{wired.map((t) => t.label).join(" · ")}</dd>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Données trouvées</dt>
                  <dd className={`font-semibold ${proposalRows.length > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {proposalRows.length} ligne{proposalRows.length > 1 ? "s" : ""} · total{" "}
                    {fmtVal(proposalRows.reduce((s, r) => s + (Number(r.value) || 0), 0), proposal.unit_mode)}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ADD_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setAddView(v.id)}
                    className={`${chip} ${
                      addView === v.id
                        ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={proposalRows.length === 0}
                  className="ml-auto rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  ＋ Ajouter au rapport
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
