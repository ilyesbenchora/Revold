"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppliedPeriod } from "@/components/agents/report-period-bar";
import { useBlockConsult } from "@/components/data-tables/block-data-table";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { CALL_KEYWORD_GROUPS } from "@/lib/integrations/call-keywords";

/**
 * Conversations à signaux — EXACTEMENT la même consultation que les tables de
 * données (hook canonique useBlockConsult : barre période + cohortes
 * enregistrées + icône entonnoir repliable) ; le contenu est recalculé côté
 * serveur (/api/appels/call-insights) à chaque changement de filtre. Ouverture
 * sur « Toutes les données », comme partout.
 */

type Insight = {
  id: string;
  contactName: string | null;
  occurredAt: string | null;
  keywords: string[];
  snippet: string | null;
};

type InsightsData = { insights: Insight[]; transcriptsChecked: number; transcriptsAvailable: number };

const KEYWORD_LABELS = Object.fromEntries(CALL_KEYWORD_GROUPS.map((g) => [g.key, g.label]));

const fmtDay = (v: string | null): string => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export function CallInsightsBlock() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: AppliedPeriod | null, cohort: { key: string; value: string } | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!p || p.preset === "all") params.set("all", "1");
      else {
        params.set("from", p.from);
        params.set("to", p.to);
      }
      if (cohort) {
        params.set("cohortKey", cohort.key);
        params.set("cohortValue", cohort.value);
      }
      const res = await fetch(`/api/appels/call-insights?${params.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) setData({ insights: d.insights ?? [], transcriptsChecked: d.transcriptsChecked ?? 0, transcriptsAvailable: d.transcriptsAvailable ?? 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, null);
  }, [load]);

  const consult = useBlockConsult({
    storageId: "conversations-signaux",
    loading,
    onChange: (p, co) => void load(p, co),
  });

  const insights = data?.insights ?? [];
  const keywordCounts = CALL_KEYWORD_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    n: insights.filter((i) => i.keywords.includes(g.key)).length,
  })).filter((k) => k.n > 0);

  const emptyLabel = data === null
    ? "Chargement des conversations…"
    : data.transcriptsChecked === 0
      ? consult.filtersActive
        ? "Aucun appel analysé sur la période et la cohorte choisies."
        : "Les transcriptions s'analysent au fil des synchronisations (10 appels par passage) — reviens après le prochain passage."
      : data.transcriptsAvailable === 0
        ? "Aucune transcription disponible sur les appels analysés — la transcription nécessite l'add-on Aircall AI (conversation intelligence) sur ton compte Aircall."
        : "Aucun mot-clé business détecté dans les conversations transcrites sur la période choisie.";

  return (
    <CollapsibleBlock
      title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Conversations à signaux
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
            {consult.period?.label ?? "Toutes les données"}
          </span>
        </h2>
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">
          La mine d&apos;or des conversations : les appels dont la transcription mentionne un sujet business —
          devis, facturation, prix, contrat, résiliation — rattachés au contact CRM. Détection déterministe
          par mots-clés, aucun contenu inventé.
        </p>
        {consult.toggleButton}
      </div>
      {consult.bar && <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">{consult.bar}</div>}
      {keywordCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {keywordCounts.map((k) => (
            <span key={k.key} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600">
              {k.label} · {k.n}
            </span>
          ))}
        </div>
      )}
      {insights.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {insights.map((i) => (
            <li key={i.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {i.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                    {KEYWORD_LABELS[k] ?? k}
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-slate-400">
                  {i.contactName ?? "Contact non relié"}
                  {fmtDay(i.occurredAt) ? ` · ${fmtDay(i.occurredAt)}` : ""}
                </span>
              </div>
              {i.snippet && <p className="mt-1.5 text-xs italic leading-relaxed text-slate-600">« {i.snippet} »</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {loading ? "Recalcul…" : emptyLabel}
        </p>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        {(data?.transcriptsChecked ?? 0) > 0
          ? `${(data?.transcriptsAvailable ?? 0).toLocaleString("fr-FR")} conversation${(data?.transcriptsAvailable ?? 0) > 1 ? "s" : ""} transcrite${(data?.transcriptsAvailable ?? 0) > 1 ? "s" : ""} sur ${(data?.transcriptsChecked ?? 0).toLocaleString("fr-FR")} appel${(data?.transcriptsChecked ?? 0) > 1 ? "s" : ""} analysé${(data?.transcriptsChecked ?? 0) > 1 ? "s" : ""} (${consult.period?.label?.toLowerCase() ?? "toutes les données"}${consult.cohort ? ", cohorte filtrée" : ""}). `
          : ""}
        Mots-clés surveillés : {CALL_KEYWORD_GROUPS.map((g) => g.label.toLowerCase()).join(", ")}.
      </p>
    </CollapsibleBlock>
  );
}
