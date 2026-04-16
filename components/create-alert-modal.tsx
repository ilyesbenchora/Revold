"use client";

import { useState } from "react";

// ── Team definitions ──
const teams = [
  { id: "sales", label: "Commercial", icon: "💼", description: "Pipeline, deals, closing" },
  { id: "marketing", label: "Marketing", icon: "📣", description: "Leads, conversion, acquisition" },
  { id: "cs", label: "Customer Success", icon: "🤝", description: "Rétention, churn, satisfaction" },
  { id: "revops", label: "RevOps / Finance", icon: "📊", description: "Revenue, données, process" },
];

// ── KPIs per team ──
type KpiDef = {
  id: string;
  label: string;
  description: string;
  defaultUnit: "percent" | "currency" | "count";
  defaultDirection: "above" | "below";
  category: string;
};

const kpisByTeam: Record<string, KpiDef[]> = {
  sales: [
    { id: "closing_rate", label: "Closing rate", description: "% de deals gagnés sur les deals clôturés", defaultUnit: "percent", defaultDirection: "above", category: "sales" },
    { id: "pipeline_coverage", label: "Couverture pipeline", description: "% de deals avec une prochaine activité planifiée", defaultUnit: "percent", defaultDirection: "above", category: "sales" },
    { id: "deal_activation", label: "Activation deals", description: "% de deals en cours avec au moins une activité", defaultUnit: "percent", defaultDirection: "above", category: "sales" },
    { id: "pipeline_value", label: "Valeur pipeline", description: "Montant total des deals ouverts", defaultUnit: "currency", defaultDirection: "above", category: "sales" },
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals gagnés", defaultUnit: "currency", defaultDirection: "above", category: "sales" },
    { id: "deals_won_count", label: "Deals gagnés", description: "Nombre de deals remportés sur la période", defaultUnit: "count", defaultDirection: "above", category: "sales" },
    { id: "revenue_won", label: "CA signé", description: "Chiffre d'affaires total des deals gagnés", defaultUnit: "currency", defaultDirection: "above", category: "sales" },
    { id: "stagnant_deals", label: "Deals stagnants", description: "Deals sans activité depuis 7 jours", defaultUnit: "count", defaultDirection: "below", category: "sales" },
    { id: "deals_at_risk", label: "Deals à risque", description: "Nombre de deals flagués à risque", defaultUnit: "count", defaultDirection: "below", category: "sales" },
  ],
  marketing: [
    { id: "conversion_rate", label: "Taux de conversion", description: "% de contacts convertis en opportunités", defaultUnit: "percent", defaultDirection: "above", category: "marketing" },
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% de contacts sans entreprise associée", defaultUnit: "percent", defaultDirection: "below", category: "marketing" },
    { id: "phone_enrichment", label: "Enrichissement tél.", description: "% de contacts avec numéro de téléphone", defaultUnit: "percent", defaultDirection: "above", category: "marketing" },
    { id: "dormant_reactivation", label: "Contacts dormants", description: "Contacts sans interaction depuis 6 mois", defaultUnit: "count", defaultDirection: "below", category: "marketing" },
    { id: "deals_count", label: "Deals créés", description: "Volume de deals créés sur la période", defaultUnit: "count", defaultDirection: "above", category: "marketing" },
  ],
  cs: [
    { id: "deals_at_risk", label: "Comptes à risque", description: "Nombre de deals flagués à risque", defaultUnit: "count", defaultDirection: "below", category: "sales" },
    { id: "stagnant_deals", label: "Deals sans suivi", description: "Deals sans activité depuis 7 jours", defaultUnit: "count", defaultDirection: "below", category: "sales" },
    { id: "orphan_rate", label: "Contacts non rattachés", description: "% de contacts sans entreprise", defaultUnit: "percent", defaultDirection: "below", category: "data" },
  ],
  revops: [
    { id: "closing_rate", label: "Closing rate global", description: "Taux de closing tous pipelines confondus", defaultUnit: "percent", defaultDirection: "above", category: "sales" },
    { id: "revenue_won", label: "Revenue cumulé", description: "CA total signé sur la période", defaultUnit: "currency", defaultDirection: "above", category: "sales" },
    { id: "pipeline_value", label: "Pipeline total", description: "Valeur totale du pipeline ouvert", defaultUnit: "currency", defaultDirection: "above", category: "sales" },
    { id: "conversion_rate", label: "Conversion globale", description: "Taux Lead→Opportunité", defaultUnit: "percent", defaultDirection: "above", category: "marketing" },
    { id: "phone_enrichment", label: "Qualité données", description: "% contacts avec téléphone", defaultUnit: "percent", defaultDirection: "above", category: "data" },
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% contacts sans entreprise", defaultUnit: "percent", defaultDirection: "below", category: "data" },
  ],
};

const datePresets = [
  { id: "this_month", label: "Ce mois" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "this_year", label: "Cette année" },
  { id: "last_30d", label: "30 derniers jours" },
  { id: "last_90d", label: "90 derniers jours" },
  { id: "all_time", label: "Depuis toujours" },
];

const unitLabels: Record<string, string> = {
  percent: "%",
  currency: "€",
  count: "",
};

export function CreateAlertModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: team, 2: kpi, 3: config
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<{ currentValue: number | null } | null>(null);

  // Step 1
  const [team, setTeam] = useState("");
  // Step 2
  const [kpiId, setKpiId] = useState("");
  // Step 3 — main
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [unitMode, setUnitMode] = useState<"percent" | "currency" | "count">("percent");
  const [datePreset, setDatePreset] = useState("all_time");
  // Step 3 — advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [severity, setSeverity] = useState("info");
  const [frequency, setFrequency] = useState("every_check");
  const [minDealAmount, setMinDealAmount] = useState("");
  const [expiresIn, setExpiresIn] = useState("");

  const kpiList = kpisByTeam[team] ?? [];
  const kpi = kpiList.find((k) => k.id === kpiId);

  function reset() {
    setStep(1);
    setTeam("");
    setKpiId("");
    setThreshold("");
    setDirection("above");
    setUnitMode("percent");
    setDatePreset("all_time");
    setShowAdvanced(false);
    setSeverity("info");
    setFrequency("every_check");
    setMinDealAmount("");
    setExpiresIn("");
    setState("idle");
    setResult(null);
  }

  function selectTeam(t: string) {
    setTeam(t);
    setKpiId("");
    setStep(2);
  }

  function selectKpi(k: KpiDef) {
    setKpiId(k.id);
    setDirection(k.defaultDirection);
    setUnitMode(k.defaultUnit);
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kpi || !threshold) return;

    setState("loading");
    const unit = unitLabels[unitMode];
    const dirLabel = direction === "below" ? "descendre sous" : "atteindre";
    const teamLabel = teams.find((t) => t.id === team)?.label ?? team;

    let expiresAt: string | null = null;
    if (expiresIn) {
      const days = parseInt(expiresIn);
      if (days > 0) expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    }

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${kpi.label} : objectif ${threshold}${unit}`,
          description: `[${teamLabel}] Alerte quand "${kpi.label}" va ${dirLabel} ${threshold}${unit}. ${kpi.description}. Période : ${datePresets.find((d) => d.id === datePreset)?.label ?? "Toujours"}.`,
          impact: `Notification automatique quand l'objectif de ${threshold}${unit} sera atteint`,
          category: kpi.category,
          forecast_type: kpi.id,
          threshold: Number(threshold),
          direction,
          team,
          date_preset: datePreset === "all_time" ? null : datePreset,
          unit_mode: unitMode,
          severity,
          frequency,
          min_deal_amount: minDealAmount ? Number(minDealAmount) : null,
          expires_at: expiresAt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ currentValue: data.current_value });
        setState("done");
        setTimeout(() => { setOpen(false); reset(); }, 3000);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
        Créer une alerte
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (state !== "loading") { setOpen(false); reset(); } }}>
          <div className="mx-4 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* ── Success ── */}
            {state === "done" && result ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Alerte SMART créée</h2>
                <p className="mt-2 text-sm text-slate-500">Revold surveille ce KPI en continu.</p>
                {result.currentValue != null && kpi && (
                  <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Valeur actuelle</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{result.currentValue.toLocaleString("fr-FR")}{unitLabels[unitMode]}</p>
                    <p className="mt-1 text-xs text-slate-400">Objectif : {direction === "below" ? "< " : ""}{threshold}{unitLabels[unitMode]}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ── Steps indicator ── */}
                <div className="flex items-center gap-2 mb-6">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { if (s < step) setStep(s); }}
                        disabled={s > step}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                          s === step ? "bg-accent text-white" : s < step ? "bg-accent/20 text-accent cursor-pointer" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {s}
                      </button>
                      <span className={`text-xs font-medium ${s === step ? "text-slate-900" : "text-slate-400"}`}>
                        {s === 1 ? "Équipe" : s === 2 ? "KPI" : "Objectif"}
                      </span>
                      {s < 3 && <span className="mx-1 text-slate-300">→</span>}
                    </div>
                  ))}
                </div>

                {/* ── Step 1: Team ── */}
                {step === 1 && (
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Pour quelle équipe ?</h2>
                    <p className="mt-1 text-sm text-slate-500">Sélectionnez le département concerné par cette alerte.</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTeam(t.id)}
                          className={`rounded-xl border p-4 text-left transition hover:border-accent/30 hover:shadow-sm ${
                            team === t.id ? "border-accent bg-accent/5" : "border-slate-200"
                          }`}
                        >
                          <span className="text-2xl">{t.icon}</span>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{t.label}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 2: KPI ── */}
                {step === 2 && (
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Quel KPI surveiller ?</h2>
                    <p className="mt-1 text-sm text-slate-500">KPIs disponibles pour l&apos;équipe {teams.find((t) => t.id === team)?.label}.</p>
                    <div className="mt-4 space-y-2">
                      {kpiList.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => selectKpi(k)}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition hover:border-accent/30 ${
                            kpiId === k.id ? "border-accent bg-accent/5" : "border-slate-200"
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-medium ${kpiId === k.id ? "text-accent" : "text-slate-900"}`}>{k.label}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{k.description}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {k.defaultUnit === "percent" ? "%" : k.defaultUnit === "currency" ? "€" : "#"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-accent">
                      ← Changer d&apos;équipe
                    </button>
                  </div>
                )}

                {/* ── Step 3: Configure ── */}
                {step === 3 && kpi && (
                  <form onSubmit={handleSubmit}>
                    <h2 className="text-lg font-semibold text-slate-900">Paramétrer l&apos;objectif</h2>
                    <p className="mt-1 text-sm text-slate-500">{kpi.label} — {kpi.description}</p>

                    <div className="mt-5 space-y-4">
                      {/* Direction + Threshold */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Direction</label>
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                            <button type="button" onClick={() => setDirection("above")}
                              className={`flex-1 px-3 py-2 text-xs font-medium transition ${direction === "above" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                              Atteindre ↑
                            </button>
                            <button type="button" onClick={() => setDirection("below")}
                              className={`flex-1 px-3 py-2 text-xs font-medium transition ${direction === "below" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                              Descendre ↓
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Unité</label>
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                            {(["percent", "currency", "count"] as const).map((u) => (
                              <button key={u} type="button" onClick={() => setUnitMode(u)}
                                className={`flex-1 px-3 py-2 text-xs font-medium transition ${unitMode === u ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                                {u === "percent" ? "%" : u === "currency" ? "€" : "#"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Threshold input */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          Objectif à {direction === "below" ? "descendre sous" : "atteindre"}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            placeholder={unitMode === "currency" ? "50000" : unitMode === "percent" ? "35" : "10"}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <span className="text-sm font-semibold text-slate-500">{unitLabels[unitMode]}</span>
                        </div>
                      </div>

                      {/* Date range */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Période d&apos;analyse</label>
                        <div className="flex flex-wrap gap-1.5">
                          {datePresets.map((d) => (
                            <button key={d.id} type="button" onClick={() => setDatePreset(d.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                datePreset === d.id ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ── Advanced section ── */}
                      <div className="border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
                        >
                          <span>Paramètres avancés</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform ${showAdvanced ? "" : "-rotate-90"}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {showAdvanced && (
                          <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-4">
                            {/* Severity */}
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Sévérité de l&apos;alerte</label>
                              <div className="flex gap-2">
                                {[
                                  { id: "info", label: "Info", color: "bg-blue-100 text-blue-700" },
                                  { id: "warning", label: "Important", color: "bg-amber-100 text-amber-700" },
                                  { id: "critical", label: "Critique", color: "bg-red-100 text-red-700" },
                                ].map((s) => (
                                  <button key={s.id} type="button" onClick={() => setSeverity(s.id)}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                      severity === s.id ? s.color : "bg-white border border-slate-200 text-slate-500"
                                    }`}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Frequency */}
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Fréquence de vérification</label>
                              <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                              >
                                <option value="every_check">À chaque sync (toutes les 6h)</option>
                                <option value="daily">Quotidien (1x/jour)</option>
                                <option value="weekly">Hebdomadaire (1x/semaine)</option>
                              </select>
                            </div>

                            {/* Min deal amount filter */}
                            {["sales", "revops"].includes(team) && (
                              <div>
                                <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Montant minimum par deal</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={minDealAmount}
                                    onChange={(e) => setMinDealAmount(e.target.value)}
                                    placeholder="Ex: 5000"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                                  />
                                  <span className="text-xs text-slate-400">€</span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">Exclure les petits deals du calcul du KPI</p>
                              </div>
                            )}

                            {/* Expiration */}
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Expiration automatique</label>
                              <select
                                value={expiresIn}
                                onChange={(e) => setExpiresIn(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                              >
                                <option value="">Jamais (jusqu&apos;à objectif atteint)</option>
                                <option value="30">Dans 30 jours</option>
                                <option value="60">Dans 60 jours</option>
                                <option value="90">Dans 90 jours (fin de trimestre)</option>
                                <option value="180">Dans 6 mois</option>
                                <option value="365">Dans 1 an</option>
                              </select>
                              <p className="mt-1 text-[10px] text-slate-400">L&apos;alerte sera automatiquement retirée après cette date si l&apos;objectif n&apos;est pas atteint</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-between">
                      <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-accent">
                        ← Changer de KPI
                      </button>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setOpen(false); reset(); }}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                          Annuler
                        </button>
                        <button type="submit" disabled={!threshold || state === "loading"}
                          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50">
                          {state === "loading" ? "Création..." : "Créer l'alerte"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
