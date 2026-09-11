"use client";

/**
 * Calculateurs gratuits des pages /outils/* — 100 % côté client, aucune
 * donnée envoyée. Valeurs d'exemple préremplies (marquées comme telles) pour
 * que la page montre son résultat dès l'ouverture.
 */

import { useMemo, useState } from "react";
import type { ToolId } from "@/lib/seo/tools";

const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;

function Field({ label, value, onChange, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60 [font-variant-numeric:tabular-nums]"
        />
        {suffix && <span className="shrink-0 text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}

function Result({ items }: { items: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className={`rounded-xl border p-4 ${i.strong ? "border-fuchsia-400/40 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.03]"}`}>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{i.label}</dt>
          <dd className={`mt-1 text-2xl font-semibold [font-variant-numeric:tabular-nums] ${i.strong ? "text-white" : "text-slate-200"}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MrrCalculator() {
  const [customers, setCustomers] = useState(120);
  const [arpa, setArpa] = useState(250);
  const [newMrr, setNewMrr] = useState(4000);
  const [expansion, setExpansion] = useState(1500);
  const [contraction, setContraction] = useState(600);
  const [churned, setChurned] = useState(1800);
  const mrr = customers * arpa;
  const net = newMrr + expansion - contraction - churned;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <Field label="Abonnements actifs" value={customers} onChange={setCustomers} />
        <Field label="Revenu mensuel moyen par abonnement" value={arpa} onChange={setArpa} suffix="€" />
        <Field label="Nouveau MRR du mois" value={newMrr} onChange={setNewMrr} suffix="€" />
        <Field label="Expansion (upsell) du mois" value={expansion} onChange={setExpansion} suffix="€" />
        <Field label="Contraction (downgrade) du mois" value={contraction} onChange={setContraction} suffix="€" />
        <Field label="MRR churné du mois" value={churned} onChange={setChurned} suffix="€" />
      </div>
      <Result
        items={[
          { label: "MRR", value: eur(mrr), strong: true },
          { label: "ARR (MRR × 12)", value: eur(mrr * 12) },
          { label: "Net New MRR", value: `${net >= 0 ? "+" : ""}${eur(net)}` },
          { label: "Croissance mensuelle", value: mrr > 0 ? pct((net / mrr) * 100) : "—" },
        ]}
      />
    </div>
  );
}

function ChurnCalculator() {
  const [startCustomers, setStartCustomers] = useState(200);
  const [lostCustomers, setLostCustomers] = useState(7);
  const [startMrr, setStartMrr] = useState(50000);
  const [lostMrr, setLostMrr] = useState(1400);
  const [expansion, setExpansion] = useState(2100);
  const [contraction, setContraction] = useState(500);
  const churnC = startCustomers > 0 ? (lostCustomers / startCustomers) * 100 : 0;
  const churnR = startMrr > 0 ? (lostMrr / startMrr) * 100 : 0;
  const nrr = startMrr > 0 ? ((startMrr + expansion - contraction - lostMrr) / startMrr) * 100 : 0;
  const ltvMonths = churnC > 0 ? 100 / churnC : 0;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <Field label="Clients en début de période" value={startCustomers} onChange={setStartCustomers} />
        <Field label="Clients perdus sur la période" value={lostCustomers} onChange={setLostCustomers} />
        <Field label="MRR en début de période" value={startMrr} onChange={setStartMrr} suffix="€" />
        <Field label="MRR perdu (résiliations)" value={lostMrr} onChange={setLostMrr} suffix="€" />
        <Field label="Expansion sur la période" value={expansion} onChange={setExpansion} suffix="€" />
        <Field label="Contraction sur la période" value={contraction} onChange={setContraction} suffix="€" />
      </div>
      <Result
        items={[
          { label: "Churn client", value: pct(churnC), strong: true },
          { label: "Churn revenu (MRR)", value: pct(churnR) },
          { label: "Rétention nette (NRR)", value: pct(nrr) },
          { label: "Durée de vie moyenne", value: ltvMonths > 0 ? `${ltvMonths.toFixed(0)} mois` : "—" },
        ]}
      />
    </div>
  );
}

type StageRow = { name: string; amount: number; probability: number };
function ForecastCalculator() {
  const [rows, setRows] = useState<StageRow[]>([
    { name: "Qualification", amount: 120000, probability: 10 },
    { name: "Démo réalisée", amount: 95000, probability: 30 },
    { name: "Proposition envoyée", amount: 70000, probability: 55 },
    { name: "Négociation", amount: 40000, probability: 80 },
  ]);
  const update = (i: number, patch: Partial<StageRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const gross = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const weighted = rows.reduce((s, r) => s + ((r.amount || 0) * (r.probability || 0)) / 100, 0);
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Une ligne par étape : montant total des deals ouverts dont la date de fermeture tombe dans la période, et probabilité de l&apos;étape.</p>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
            <tr><th className="px-3 py-2">Étape</th><th className="px-3 py-2">Montant ouvert (€)</th><th className="px-3 py-2">Probabilité (%)</th><th className="px-3 py-2 text-right">Pondéré</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-white" /></td>
                <td className="px-3 py-2"><input type="number" value={r.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-white [font-variant-numeric:tabular-nums]" /></td>
                <td className="px-3 py-2"><input type="number" min={0} max={100} value={r.probability} onChange={(e) => update(i, { probability: Number(e.target.value) })} className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-white [font-variant-numeric:tabular-nums]" /></td>
                <td className="px-3 py-2 text-right text-slate-200 [font-variant-numeric:tabular-nums]">{eur(((r.amount || 0) * (r.probability || 0)) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows((r) => [...r, { name: `Étape ${r.length + 1}`, amount: 0, probability: 50 }])} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">+ Ajouter une étape</button>
        {rows.length > 1 && <button type="button" onClick={() => setRows((r) => r.slice(0, -1))} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10">Retirer la dernière</button>}
      </div>
      <Result
        items={[
          { label: "Forecast pondéré", value: eur(weighted), strong: true },
          { label: "Pipeline brut", value: eur(gross) },
          { label: "Taux de pondération moyen", value: gross > 0 ? pct((weighted / gross) * 100) : "—" },
          { label: "Écart brut − pondéré", value: eur(gross - weighted) },
        ]}
      />
    </div>
  );
}

function LeakageCalculator() {
  const [signed, setSigned] = useState(480000);
  const [invoiced, setInvoiced] = useState(452000);
  const [collected, setCollected] = useState(431000);
  const [deals, setDeals] = useState(64);
  const toInvoice = Math.max(0, signed - invoiced);
  const toCollect = Math.max(0, invoiced - collected);
  const leak = toInvoice + toCollect;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <Field label="Revenu signé sur la période (CRM)" value={signed} onChange={setSigned} suffix="€" />
        <Field label="Revenu facturé sur la période" value={invoiced} onChange={setInvoiced} suffix="€" />
        <Field label="Revenu encaissé sur la période" value={collected} onChange={setCollected} suffix="€" />
        <Field label="Nombre de deals signés" value={deals} onChange={setDeals} />
      </div>
      <Result
        items={[
          { label: "Fuite estimée", value: eur(leak), strong: true },
          { label: "En % du signé", value: signed > 0 ? pct((leak / signed) * 100) : "—" },
          { label: "À facturer (signé − facturé)", value: eur(toInvoice) },
          { label: "À recouvrer (facturé − encaissé)", value: eur(toCollect) },
          { label: "Fuite moyenne par deal", value: deals > 0 ? eur(leak / deals) : "—" },
          { label: "Taux d'encaissement", value: signed > 0 ? pct((collected / signed) * 100) : "—" },
        ]}
      />
    </div>
  );
}

export function Calculator({ tool }: { tool: ToolId }) {
  const body = useMemo(() => {
    switch (tool) {
      case "calculateur-mrr": return <MrrCalculator />;
      case "calculateur-churn": return <ChurnCalculator />;
      case "calculateur-forecast-pondere": return <ForecastCalculator />;
      case "calculateur-fuite-de-revenus": return <LeakageCalculator />;
    }
  }, [tool]);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:p-8">
      <p className="mb-4 text-xs text-slate-500">Valeurs d&apos;exemple préremplies — remplacez-les par les vôtres. Rien n&apos;est envoyé : le calcul se fait dans votre navigateur.</p>
      {body}
    </div>
  );
}
