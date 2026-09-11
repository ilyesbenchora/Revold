"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportPeriodBar, type AppliedPeriod } from "@/components/agents/report-period-bar";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { computePeriod, presetLabel } from "@/lib/reports/periods";

/**
 * Travail téléphonique des deals — MÊME consultation que les tables de
 * données : barre de période complète (presets, exercice, dates custom),
 * recalcul serveur à chaque changement. Ouvre par défaut sur « Ce mois-ci »
 * (recalculé à l'instant T), jamais une fenêtre figée en dur.
 */

type PhoneWorkDeal = {
  id: string;
  name: string;
  amount: number | null;
  contactName: string;
  lastCrmAt: string | null;
  createdAt: string | null;
  calls: { n: number; last: number; minutes: number };
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDay = (v: string | number | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
};

export function PhoneWorkBlock() {
  const [period, setPeriod] = useState<AppliedPeriod | null>(null);
  const [data, setData] = useState<{ worked: PhoneWorkDeal[]; neverCalled: PhoneWorkDeal[]; dealsSansContact: number; totalLinked: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: AppliedPeriod | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!p || p.preset === "all") params.set("all", "1");
      else {
        params.set("from", p.from);
        params.set("to", p.to);
      }
      const res = await fetch(`/api/appels/phone-work?${params.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) setData({ worked: d.worked ?? [], neverCalled: d.neverCalled ?? [], dealsSansContact: d.dealsSansContact ?? 0, totalLinked: d.totalLinked ?? 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Ouverture sur « Ce mois-ci » (recalculé) — même esprit que les tables.
  useEffect(() => {
    const { from, to } = computePeriod("this_month", new Date());
    const p: AppliedPeriod = { preset: "this_month", from, to, label: presetLabel("this_month") };
    setPeriod(p);
    void load(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPeriod(p: AppliedPeriod) {
    const normalized = p.preset === "all" ? null : p;
    setPeriod(normalized);
    void load(normalized);
  }

  const periodTxt = period?.label ?? "Toutes périodes";

  return (
    <div className="space-y-4">
      <ReportPeriodBar
        onApply={applyPeriod}
        loading={loading}
        activeLabel={periodTxt}
        applied={period ?? { preset: "all", from: "", to: "", label: "Toutes les données" }}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BlockDataTable
          title="Deals bien travaillés au téléphone"
          subtitle={`≥ 2 appels · ${periodTxt.toLowerCase()}`}
          team="sales"
          unit="count"
          nameLabel="Deal"
          valueLabel="Appels"
          extraColumns={["Montant", "Temps en ligne", "Dernier appel", "Contact"]}
          rows={(data?.worked ?? []).map((d) => ({
            name: d.name,
            value: d.calls.n,
            unit: "count" as const,
            tone: "pos" as const,
            cells: [
              d.amount != null ? fmtEur(d.amount) : "—",
              d.calls.minutes > 0 ? `${d.calls.minutes.toLocaleString("fr-FR")} min` : "—",
              d.calls.last > 0 ? fmtDay(d.calls.last) : "—",
              d.contactName,
            ],
          }))}
          emptyLabel={loading ? "Recalcul…" : `Aucun deal ouvert avec au moins 2 appels (${periodTxt.toLowerCase()}).`}
          footnote="Appels rattachés via le contact primaire du deal — volume, temps en ligne et dernier appel sur la période choisie."
        />
        <BlockDataTable
          title="Deals ouverts jamais appelés"
          subtitle={`0 appel · ${periodTxt.toLowerCase()}`}
          team="sales"
          unit="currency"
          nameLabel="Deal"
          valueLabel="Montant"
          extraColumns={["Contact", "Dernier contact CRM", "Créé le"]}
          rows={(data?.neverCalled ?? []).map((d) => ({
            name: d.name,
            value: d.amount,
            unit: "currency" as const,
            tone: "neg" as const,
            cells: [d.contactName, fmtDay(d.lastCrmAt), fmtDay(d.createdAt)],
          }))}
          emptyLabel={loading ? "Recalcul…" : `Tous les deals ouverts (avec contact lié) ont été appelés (${periodTxt.toLowerCase()}).`}
          footnote={`Triés par montant décroissant — l'argent sans effort téléphonique sur la période.${(data?.dealsSansContact ?? 0) > 0 ? ` ${(data?.dealsSansContact ?? 0).toLocaleString("fr-FR")} deal${(data?.dealsSansContact ?? 0) > 1 ? "s" : ""} sans contact lié : non croisables (associer un contact dans HubSpot).` : ""}`}
        />
      </div>
    </div>
  );
}
