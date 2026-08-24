"use client";

import { useState } from "react";
import { updateSavedReport, type SavedReport } from "./saved-reports";
import { PAGE_TREE } from "@/lib/reports/data-table-presets";
import type { ChartQuery } from "@/lib/ai/agents/agent-runtime";

/**
 * Affectation d'un rapport enregistré à une PAGE de la plateforme.
 *
 * Le rapport ne se contente pas d'être « classé » : chacun de ses blocs
 * CÂBLÉS (porteurs d'une requête déterministe entité/regroupement/mesure) est
 * converti en table de données de la page — il hérite alors du recalcul par
 * période, du drill-down, des alertes et du réordonnancement, comme les blocs
 * natifs. Le rapport quitte ensuite « Mes rapports » (page_key renseigné).
 *
 * Sans aucun bloc câblé, l'affectation est refusée plutôt que de ranger un
 * rapport que la page ne saurait pas recalculer.
 */

type WiredBlock = { title: string; query: ChartQuery; view: string; unit?: string | null };

/** Blocs du rapport porteurs d'une requête déterministe (donc convertibles). */
function wiredBlocks(r: SavedReport): WiredBlock[] {
  const out: WiredBlock[] = [];
  const chart = r.chart as { title?: string; query?: ChartQuery; defaultType?: string; unit?: string | null } | null;
  if (chart?.query) {
    out.push({
      title: chart.title || r.title,
      query: chart.query,
      view: chart.defaultType === "line" || chart.defaultType === "donut" ? chart.defaultType : "bar",
      unit: chart.unit ?? null,
    });
  }
  const report = r.report as { blocks?: Array<{ title?: string; label?: string; type?: string; query?: ChartQuery; unit?: string | null }> } | null;
  for (const b of report?.blocks ?? []) {
    if (!b.query) continue;
    out.push({
      title: b.title || b.label || r.title,
      query: b.query,
      view: b.type === "line" ? "line" : b.type === "donut" ? "donut" : b.type === "kpi" ? "bloc" : "bar",
      unit: b.unit ?? null,
    });
  }
  return out;
}

export function AssignReportPage({ report, onDone }: { report: SavedReport; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Page dépliée : montre ses sous-pages (« Ventes → sous-pages au choix »).
  const [expanded, setExpanded] = useState<string | null>(null);
  const blocks = wiredBlocks(report);

  async function assign(pageKey: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let created = 0;
      for (const b of blocks) {
        const res = await fetch("/api/page-tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_key: pageKey,
            title: b.title.slice(0, 200),
            entity: b.query.entity,
            group_by: b.query.groupBy,
            measure: b.query.measure || "count",
            field: b.query.field ?? null,
            unit_mode: b.unit ?? null,
            view: b.view,
            description: `Depuis le rapport « ${report.title} » (${report.agentLabel}).`,
          }),
        });
        if (res.ok) created++;
      }
      if (created === 0) throw new Error("Aucun bloc n'a pu être ajouté à la page.");
      updateSavedReport(report.id, { pageKey });
      window.dispatchEvent(new Event("revold:reload-page-tables"));
      setOpen(false);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Affectation impossible");
    } finally {
      setBusy(false);
    }
  }

  if (blocks.length === 0) {
    return (
      <span
        title="Ce rapport n'a aucun bloc câblé (requête déterministe) : la page ne saurait pas le recalculer. Corrige son câblage depuis le panneau « Câblage » ci-dessous."
        className="text-[11px] text-slate-300"
      >
        Non affectable
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/10"
      >
        Enregistrer sur une page ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-card-border bg-card p-2 shadow-xl">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Ajouter à la page
          </p>
          <p className="px-2 pb-1.5 text-[10px] leading-relaxed text-slate-500">
            {blocks.length === 1 ? "1 bloc câblé sera ajouté" : `${blocks.length} blocs câblés seront ajoutés`} — recalcul
            par période, drill-down et alertes inclus.
          </p>
          {/* Pages principales ; celles qui ont des SOUS-PAGES se déplient pour
              choisir la destination exacte (page principale ou sous-page). */}
          {PAGE_TREE.map((p) => (
            <div key={p.key}>
              <button
                type="button"
                disabled={busy}
                onClick={() => (p.children?.length ? setExpanded(expanded === p.key ? null : p.key) : void assign(p.key))}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {p.label}
                {p.children?.length ? (
                  <span className={`text-[10px] text-slate-400 transition-transform ${expanded === p.key ? "rotate-90" : ""}`}>▶</span>
                ) : null}
              </button>
              {expanded === p.key && p.children?.length ? (
                <div className="ml-2 border-l border-slate-100 pl-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void assign(p.key)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Page principale — {p.label}
                  </button>
                  {p.children.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void assign(c.key)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {error && <p className="px-2 pt-1 text-[10px] text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
