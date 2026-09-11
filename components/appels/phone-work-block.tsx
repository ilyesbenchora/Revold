"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppliedPeriod } from "@/components/agents/report-period-bar";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

/**
 * Travail téléphonique des deals — EXACTEMENT la même consultation que les
 * autres tables de données : la barre (période + cohortes enregistrées +
 * icône entonnoir pour replier) est INTÉGRÉE à chaque table (externalConsult),
 * et le recalcul se fait côté serveur (/api/appels/phone-work) à chaque
 * changement de filtre. Ouverture sur « Toutes les données », comme partout.
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

type PhoneWorkData = { worked: PhoneWorkDeal[]; neverCalled: PhoneWorkDeal[]; dealsSansContact: number; totalLinked: number };

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtDay = (v: string | number | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
};

function usePhoneWork() {
  const [data, setData] = useState<PhoneWorkData | null>(null);
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
      const res = await fetch(`/api/appels/phone-work?${params.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) setData({ worked: d.worked ?? [], neverCalled: d.neverCalled ?? [], dealsSansContact: d.dealsSansContact ?? 0, totalLinked: d.totalLinked ?? 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, null);
  }, [load]);

  return { data, loading, load };
}

export function PhoneWorkBlock() {
  // Deux tables INDÉPENDANTES (chacune sa barre, comme deux tables de données
  // côte à côte) — chacune recalcule son croisement sur ses propres filtres.
  const worked = usePhoneWork();
  const never = usePhoneWork();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <BlockDataTable
        title="Deals bien travaillés au téléphone"
        subtitle="≥ 2 appels sur la période"
        team="sales"
        unit="count"
        nameLabel="Deal"
        valueLabel="Appels"
        extraColumns={["Montant", "Temps en ligne", "Dernier appel", "Contact"]}
        externalConsult={{ onChange: (p, co) => void worked.load(p, co), loading: worked.loading }}
        rows={(worked.data?.worked ?? []).map((d) => ({
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
        emptyLabel={worked.loading ? "Recalcul…" : "Aucun deal ouvert avec au moins 2 appels sur la période choisie."}
        footnote="Appels rattachés via le contact primaire du deal — volume, temps en ligne et dernier appel recalculés sur la période et la cohorte choisies."
      />
      <BlockDataTable
        title="Deals ouverts jamais appelés"
        subtitle="0 appel sur la période"
        team="sales"
        unit="currency"
        nameLabel="Deal"
        valueLabel="Montant"
        extraColumns={["Contact", "Dernier contact CRM", "Créé le"]}
        externalConsult={{ onChange: (p, co) => void never.load(p, co), loading: never.loading }}
        rows={(never.data?.neverCalled ?? []).map((d) => ({
          name: d.name,
          value: d.amount,
          unit: "currency" as const,
          tone: "neg" as const,
          cells: [d.contactName, fmtDay(d.lastCrmAt), fmtDay(d.createdAt)],
        }))}
        emptyLabel={never.loading ? "Recalcul…" : "Tous les deals ouverts (avec contact lié) ont été appelés sur la période choisie."}
        footnote={`Triés par montant décroissant — l'argent sans effort téléphonique sur la période.${(never.data?.dealsSansContact ?? 0) > 0 ? ` ${(never.data?.dealsSansContact ?? 0).toLocaleString("fr-FR")} deal${(never.data?.dealsSansContact ?? 0) > 1 ? "s" : ""} sans contact lié : non croisables (associer un contact dans HubSpot).` : ""}`}
      />
    </div>
  );
}
