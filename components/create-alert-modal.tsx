"use client";

import { useEffect, useState } from "react";

// ── Team definitions ──
const teams = [
  { id: "sales", label: "Ventes", icon: "💼", description: "Pipeline, deals, closing" },
  { id: "marketing", label: "Marketing", icon: "📣", description: "Leads, conversion, acquisition" },
  { id: "cs", label: "Customer Success", icon: "🤝", description: "Rétention, churn, satisfaction" },
  { id: "revops", label: "Revenue / Finance", icon: "📊", description: "Revenue, données, process" },
];

type KpiDef = {
  id: string;
  label: string;
  description: string;
  defaultUnit: "percent" | "currency" | "count";
  defaultDirection: "above" | "below";
  category: string;
  dealRelated: boolean;
  contactRelated?: boolean;
  sourceRelated?: boolean;
};

const kpisByTeam: Record<string, KpiDef[]> = {
  sales: [
    // ── Performance closing ──
    { id: "closing_rate", label: "Closing rate", description: "% de deals gagnés sur les deals clôturés — le KPI roi de la performance commerciale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "revenue_won", label: "CA signé", description: "Chiffre d'affaires total des deals gagnés sur la période", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_won_count", label: "Deals gagnés", description: "Nombre de deals remportés — volume de closing", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals gagnés — levier de croissance", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Santé du pipeline ──
    { id: "pipeline_value", label: "Valeur pipeline", description: "Montant total des deals ouverts — capacité de projection revenue", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "weighted_pipeline", label: "Pipeline pondéré", description: "Somme des montants × probabilité de gain — forecast réaliste", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "pipeline_coverage", label: "Couverture pipeline", description: "% de deals avec une activité planifiée — discipline commerciale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deal_activation", label: "Activation deals", description: "% de deals en cours avec au moins une activité — pipeline réellement travaillé", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Vélocité & risque ──
    { id: "sales_cycle_days", label: "Cycle de vente moyen", description: "Nombre de jours moyen entre création et closing — indicateur de vélocité", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "stagnant_deals", label: "Deals stagnants", description: "Deals sans activité depuis 7 jours — risque de perte silencieuse", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "deals_at_risk", label: "Deals à risque", description: "Deals flagués à risque — nécessitent une action immédiate", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "deals_no_amount", label: "Deals sans montant", description: "Deals sans montant renseigné — forecast aveugle", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
  ],
  marketing: [
    // ── Conversion funnel ──
    { id: "conversion_rate", label: "Taux de conversion Lead→Opp", description: "% de contacts convertis en opportunités — efficacité du funnel", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "mql_to_sql_rate", label: "Conversion MQL→SQL", description: "% de MQL acceptés par les sales — alignement marketing-ventes", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "deals_count", label: "Deals créés", description: "Volume de deals créés sur la période — contribution marketing au pipeline", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: true },
    // ── Sources d'acquisition ──
    { id: "contacts_by_source", label: "Contacts par source", description: "Volume de contacts acquis via une ou plusieurs sources d'origine", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_lifecycle", label: "Source → Lifecycle", description: "% de contacts d'une source qui atteignent une phase du cycle de vie — ROI par canal", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_deal_created", label: "Source → Deal créé", description: "Contacts d'une source ayant généré un deal — contribution au pipeline par canal", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    { id: "source_to_deal_won", label: "Source → Deal gagné", description: "Contacts d'une source dont le deal a été gagné — ROI revenue par canal", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
    // ── Qualité base contacts ──
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% de contacts sans entreprise associée — risque de segmentation ABM", defaultUnit: "percent", defaultDirection: "below", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Enrichissement tél.", description: "% de contacts avec numéro de téléphone — capacité outbound multicanal", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "dormant_reactivation", label: "Contacts dormants", description: "Contacts sans interaction depuis 6 mois — base à réactiver", defaultUnit: "count", defaultDirection: "below", category: "marketing", dealRelated: false, contactRelated: true },
  ],
  cs: [
    // ── Rétention & risque ──
    { id: "deals_at_risk", label: "Comptes à risque", description: "Deals flagués à risque — action proactive CSM requise", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "stagnant_deals", label: "Deals sans suivi", description: "Deals sans activité depuis 7 jours — engagement client à risque", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "orphan_rate", label: "Contacts non rattachés", description: "% de contacts sans entreprise — visibilité compte incomplète", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    // ── Expansion ──
    { id: "avg_deal_size", label: "Panier moyen", description: "Montant moyen des deals — suivi de l'upsell/cross-sell", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_won_count", label: "Renouvellements gagnés", description: "Nombre de deals gagnés — volume de rétention", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
  ],
  revops: [
    // ── Revenue metrics ──
    { id: "revenue_won", label: "Revenue cumulé", description: "CA total signé — KPI de pilotage N°1 pour le board", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "closing_rate", label: "Closing rate global", description: "Taux de closing tous pipelines — efficacité commerciale globale", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "weighted_pipeline", label: "Forecast pondéré", description: "Pipeline × probabilité — prévision revenue la plus fiable", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "pipeline_value", label: "Pipeline total", description: "Valeur totale du pipeline ouvert — capacité de croissance", defaultUnit: "currency", defaultDirection: "above", category: "sales", dealRelated: true },
    // ── Efficacité process ──
    { id: "sales_cycle_days", label: "Cycle de vente moyen", description: "Jours entre création et closing — vélocité du process", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "conversion_rate", label: "Conversion Lead→Opp", description: "Taux de conversion global — santé du funnel", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "mql_to_sql_rate", label: "MQL→SQL", description: "Taux de handoff marketing→sales — alignement des équipes", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    // ── Data quality ──
    { id: "data_completeness", label: "Complétude deals", description: "% de deals avec montant + date de closing + propriétaire — fiabilité du forecast", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: true },
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% contacts sans entreprise — intégrité de la donnée", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Qualité données", description: "% contacts avec téléphone — capacité opérationnelle", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: false, contactRelated: true },
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

const unitLabels: Record<string, string> = { percent: "%", currency: "€", count: "" };

type Pipeline = { id: string; label: string };
type Owner = { id: string; name: string; email: string; team: string | null };
type ConfiguredChannel = { type: "email" | "slack" | "teams" | "webhook"; enabled: boolean };

const CHANNEL_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  in_app: { label: "Cloche in-app", description: "Notification dans le header + page Alertes", icon: "🔔" },
  email: { label: "Email", description: "Email aux destinataires configurés", icon: "✉️" },
  slack: { label: "Slack", description: "Message dans le canal Slack configuré", icon: "💬" },
  teams: { label: "Microsoft Teams", description: "Card dans le canal Teams configuré", icon: "👥" },
  webhook: { label: "Webhook custom", description: "POST JSON vers votre URL", icon: "🔌" },
};

export function CreateAlertModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<{ currentValue: number | null } | null>(null);

  // Options from HubSpot
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [hsTeams, setHsTeams] = useState<string[]>([]);
  const [lifecycleStages, setLifecycleStages] = useState<Array<{ value: string; label: string }>>([]);
  const [sources, setSources] = useState<Array<{ value: string; label: string }>>([]);
  const [customContactProps, setCustomContactProps] = useState<Array<{ name: string; label: string; type: string }>>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Step 1
  const [team, setTeam] = useState("");
  // Step 2
  const [kpiId, setKpiId] = useState("");
  // Step 3 — main
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [unitMode, setUnitMode] = useState<"percent" | "currency" | "count">("percent");
  const [datePreset, setDatePreset] = useState("all_time");
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  // Step 3 — marketing
  const [lifecycleStage, setLifecycleStage] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  // Step 3 — advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [severity, setSeverity] = useState("info");
  const [frequency, setFrequency] = useState("every_check");
  const [minDealAmount, setMinDealAmount] = useState("");
  const [expiresIn, setExpiresIn] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [hsTeamFilter, setHsTeamFilter] = useState("");
  const [customProp, setCustomProp] = useState("");
  const [customPropValue, setCustomPropValue] = useState("");
  // Step 4 — Notifications
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["in_app"]);
  const [configuredChannels, setConfiguredChannels] = useState<ConfiguredChannel[]>([]);

  const kpiList = kpisByTeam[team] ?? [];
  const kpi = kpiList.find((k) => k.id === kpiId);

  // Load pipelines/owners on first open
  useEffect(() => {
    if (open && !optionsLoaded) {
      Promise.all([
        fetch("/api/alerts/options")
          .then((r) => (r.ok ? r.json() : { pipelines: [], owners: [], teams: [], lifecycleStages: [], sources: [], customContactProps: [] }))
          .catch(() => ({ pipelines: [], owners: [], teams: [], lifecycleStages: [], sources: [], customContactProps: [] })),
        fetch("/api/notifications/channels")
          .then((r) => (r.ok ? r.json() : { channels: [] }))
          .catch(() => ({ channels: [] })),
      ]).then(([options, notifData]) => {
        setPipelines(options.pipelines ?? []);
        setOwners(options.owners ?? []);
        setHsTeams(options.teams ?? []);
        setLifecycleStages(options.lifecycleStages ?? []);
        setSources(options.sources ?? []);
        setCustomContactProps(options.customContactProps ?? []);
        setConfiguredChannels(notifData.channels ?? []);
        setOptionsLoaded(true);
      });
    }
  }, [open, optionsLoaded]);

  function reset() {
    setStep(1); setTeam(""); setKpiId(""); setThreshold(""); setDirection("above");
    setUnitMode("percent"); setDatePreset("all_time"); setSelectedPipelines([]);
    setLifecycleStage(""); setSelectedSources([]);
    setShowAdvanced(false); setSeverity("info"); setFrequency("every_check");
    setMinDealAmount(""); setExpiresIn(""); setOwnerFilter(""); setHsTeamFilter("");
    setCustomProp(""); setCustomPropValue("");
    setSelectedChannels(["in_app"]);
    setState("idle"); setResult(null);
  }

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  function selectTeam(t: string) { setTeam(t); setKpiId(""); setStep(2); }
  function selectKpi(k: KpiDef) { setKpiId(k.id); setDirection(k.defaultDirection); setUnitMode(k.defaultUnit); setStep(3); }

  function togglePipeline(id: string) {
    setSelectedPipelines((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }
  function toggleSource(val: string) {
    setSelectedSources((prev) => prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]);
  }

  // Filter owners by HS team if selected
  const filteredOwners = hsTeamFilter ? owners.filter((o) => o.team === hsTeamFilter) : owners;

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

    // Build description with context
    const parts = [`[${teamLabel}] "${kpi.label}" ${dirLabel} ${threshold}${unit}`];
    if (selectedPipelines.length > 0) {
      const names = selectedPipelines.map((id) => pipelines.find((p) => p.id === id)?.label ?? id);
      parts.push(`Pipeline${names.length > 1 ? "s" : ""} : ${names.join(", ")}`);
    }
    if (ownerFilter) {
      const owner = owners.find((o) => o.id === ownerFilter);
      parts.push(`Propriétaire : ${owner?.name ?? ownerFilter}`);
    } else if (hsTeamFilter) {
      parts.push(`Équipe HubSpot : ${hsTeamFilter}`);
    }
    if (lifecycleStage) {
      const lcLabel = lifecycleStages.find((l) => l.value === lifecycleStage)?.label ?? lifecycleStage;
      parts.push(`Phase du cycle de vie : ${lcLabel}`);
    }
    if (selectedSources.length > 0) {
      const srcNames = selectedSources.map((s) => sources.find((src) => src.value === s)?.label ?? s);
      parts.push(`Source${srcNames.length > 1 ? "s" : ""} : ${srcNames.join(", ")}`);
    }
    if (customProp && customPropValue) {
      const propLabel = customContactProps.find((p) => p.name === customProp)?.label ?? customProp;
      parts.push(`Propriété custom : ${propLabel} = ${customPropValue}`);
    }
    const periodLabel = datePresets.find((d) => d.id === datePreset)?.label ?? "Toujours";
    parts.push(`Période : ${periodLabel}`);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${kpi.label} : objectif ${threshold}${unit}`,
          description: parts.join(". ") + ".",
          impact: `Notification quand l'objectif de ${threshold}${unit} sera atteint`,
          category: kpi.category,
          forecast_type: kpi.id,
          threshold: Number(threshold),
          direction,
          team,
          pipeline_id: selectedPipelines.length === 1 ? selectedPipelines[0] : null,
          owner_filter: ownerFilter || null,
          date_preset: datePreset === "all_time" ? null : datePreset,
          unit_mode: unitMode,
          severity,
          frequency,
          min_deal_amount: minDealAmount ? Number(minDealAmount) : null,
          expires_at: expiresAt,
          lifecycle_stage: lifecycleStage || null,
          source_filters: selectedSources.length > 0 ? selectedSources : null,
          custom_property: customProp || null,
          custom_prop_value: customPropValue || null,
          notification_channels: selectedChannels.length > 0 ? selectedChannels : ["in_app"],
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
      <button type="button" onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" />
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
                {/* Steps indicator */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <button type="button" onClick={() => { if (s < step) setStep(s); }} disabled={s > step}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                          s === step ? "bg-accent text-white" : s < step ? "bg-accent/20 text-accent cursor-pointer" : "bg-slate-100 text-slate-400"
                        }`}>{s}</button>
                      <span className={`text-xs font-medium ${s === step ? "text-slate-900" : "text-slate-400"}`}>
                        {s === 1 ? "Équipe" : s === 2 ? "KPI" : s === 3 ? "Objectif" : "Notifications"}
                      </span>
                      {s < 4 && <span className="mx-1 text-slate-300">→</span>}
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
                        <button key={t.id} type="button" onClick={() => selectTeam(t.id)}
                          className={`rounded-xl border p-4 text-left transition hover:border-accent/30 hover:shadow-sm ${team === t.id ? "border-accent bg-accent/5" : "border-slate-200"}`}>
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
                        <button key={k.id} type="button" onClick={() => selectKpi(k)}
                          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition hover:border-accent/30 ${kpiId === k.id ? "border-accent bg-accent/5" : "border-slate-200"}`}>
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
                    <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-accent">← Changer d&apos;équipe</button>
                  </div>
                )}

                {/* ── Step 3: Configure ── */}
                {step === 3 && kpi && (
                  <form onSubmit={(e) => { e.preventDefault(); if (threshold && (kpiId !== "source_to_lifecycle" || lifecycleStage)) setStep(4); }}>
                    <h2 className="text-lg font-semibold text-slate-900">Paramétrer l&apos;objectif</h2>
                    <p className="mt-1 text-sm text-slate-500">{kpi.label} — {kpi.description}</p>

                    <div className="mt-5 space-y-4">
                      {/* Direction + Unit */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Direction</label>
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                            <button type="button" onClick={() => setDirection("above")}
                              className={`flex-1 px-3 py-2 text-xs font-medium transition ${direction === "above" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>Atteindre ↑</button>
                            <button type="button" onClick={() => setDirection("below")}
                              className={`flex-1 px-3 py-2 text-xs font-medium transition ${direction === "below" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>Descendre ↓</button>
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

                      {/* Threshold */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          Objectif à {direction === "below" ? "descendre sous" : "atteindre"}
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)}
                            placeholder={unitMode === "currency" ? "50000" : unitMode === "percent" ? "35" : "10"}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                          <span className="text-sm font-semibold text-slate-500">{unitLabels[unitMode]}</span>
                        </div>
                      </div>

                      {/* Pipeline selection — only for deal-related KPIs */}
                      {kpi.dealRelated && pipelines.length > 0 && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Pipeline{pipelines.length > 1 ? "s" : ""} à surveiller
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {pipelines.map((p) => {
                              const selected = selectedPipelines.includes(p.id);
                              return (
                                <button key={p.id} type="button" onClick={() => togglePipeline(p.id)}
                                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                    selected ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
                                  }`}>
                                  {selected && <span className="mr-1">✓</span>}
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                          {selectedPipelines.length === 0 && (
                            <p className="mt-1 text-[10px] text-slate-400">Aucune sélection = tous les pipelines</p>
                          )}
                        </div>
                      )}

                      {/* Lifecycle stage — required for source_to_lifecycle, optional for other contact KPIs */}
                      {kpi.contactRelated && lifecycleStages.length > 0 && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            {kpiId === "source_to_lifecycle" ? "Phase cible à atteindre" : "Phase du cycle de vie"}
                            {kpiId === "source_to_lifecycle" && <span className="ml-1 text-red-500">*</span>}
                          </label>
                          <select value={lifecycleStage} onChange={(e) => setLifecycleStage(e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
                              kpiId === "source_to_lifecycle" && !lifecycleStage ? "border-amber-300 bg-amber-50/50" : "border-slate-200"
                            }`}>
                            <option value="">{kpiId === "source_to_lifecycle" ? "Sélectionner la phase cible" : "Toutes les phases"}</option>
                            {lifecycleStages.map((lc) => (
                              <option key={lc.value} value={lc.value}>{lc.label}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {kpiId === "source_to_lifecycle"
                              ? "Quelle phase du lifecycle voulez-vous que vos contacts atteignent ?"
                              : "Filtrer les contacts par leur phase dans le cycle de vie HubSpot"}
                          </p>
                        </div>
                      )}

                      {/* Source selection — for source-related KPIs */}
                      {kpi.sourceRelated && sources.length > 0 && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Source(s) d&apos;origine à tracker</label>
                          <div className="flex flex-wrap gap-1.5">
                            {sources.map((s) => {
                              const selected = selectedSources.includes(s.value);
                              return (
                                <button key={s.value} type="button" onClick={() => toggleSource(s.value)}
                                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                                    selected ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
                                  }`}>
                                  {selected && <span className="mr-1">✓</span>}
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                          {selectedSources.length === 0 && (
                            <p className="mt-1 text-[10px] text-slate-400">Aucune sélection = toutes les sources confondues</p>
                          )}
                        </div>
                      )}

                      {/* Date range */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Période d&apos;analyse</label>
                        <div className="flex flex-wrap gap-1.5">
                          {datePresets.map((d) => (
                            <button key={d.id} type="button" onClick={() => setDatePreset(d.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                datePreset === d.id ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}>{d.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* ── Advanced ── */}
                      <div className="border-t border-slate-100 pt-3">
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700">
                          <span>Paramètres avancés</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform ${showAdvanced ? "" : "-rotate-90"}`}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>

                        {showAdvanced && (
                          <div className="mt-3 space-y-4 rounded-lg bg-slate-50 p-4">
                            {/* Owner / HubSpot team filter — available for all teams */}
                            {(owners.length > 0 || hsTeams.length > 0) && (
                              <div>
                                <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Filtrer par propriétaire ou équipe HubSpot</label>
                                {hsTeams.length > 0 && (
                                  <div className="mb-2">
                                    <select value={hsTeamFilter}
                                      onChange={(e) => { setHsTeamFilter(e.target.value); setOwnerFilter(""); }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none">
                                      <option value="">Toutes les équipes</option>
                                      {hsTeams.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <select value={ownerFilter}
                                  onChange={(e) => setOwnerFilter(e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none">
                                  <option value="">Tous les propriétaires{hsTeamFilter ? ` (${hsTeamFilter})` : ""}</option>
                                  {filteredOwners.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.name}{o.team ? ` — ${o.team}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[10px] text-slate-400">Tracker l&apos;objectif sur un utilisateur ou une équipe HubSpot spécifique</p>
                              </div>
                            )}

                            {/* Custom contact property filter — user-created properties only */}
                            {kpi.contactRelated && customContactProps.length > 0 && (
                              <div>
                                <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Propriété de contact personnalisée</label>
                                <p className="mb-2 text-[10px] text-slate-400">Filtrer par une propriété créée par votre équipe (non native HubSpot)</p>
                                <select value={customProp}
                                  onChange={(e) => { setCustomProp(e.target.value); setCustomPropValue(""); }}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none">
                                  <option value="">Aucune propriété custom</option>
                                  {customContactProps.map((p) => (
                                    <option key={p.name} value={p.name}>{p.label}</option>
                                  ))}
                                </select>
                                {customProp && (
                                  <input
                                    type="text"
                                    value={customPropValue}
                                    onChange={(e) => setCustomPropValue(e.target.value)}
                                    placeholder="Valeur attendue"
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                                  />
                                )}
                              </div>
                            )}

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
                                    }`}>{s.label}</button>
                                ))}
                              </div>
                            </div>

                            {/* Frequency */}
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Fréquence de vérification</label>
                              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none">
                                <option value="every_check">À chaque sync (toutes les 6h)</option>
                                <option value="daily">Quotidien (1x/jour)</option>
                                <option value="weekly">Hebdomadaire (1x/semaine)</option>
                              </select>
                            </div>

                            {/* Min deal amount */}
                            {kpi.dealRelated && (
                              <div>
                                <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Montant minimum par deal</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" value={minDealAmount} onChange={(e) => setMinDealAmount(e.target.value)} placeholder="Ex: 5000"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-accent focus:outline-none" />
                                  <span className="text-xs text-slate-400">€</span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">Exclure les petits deals du calcul du KPI</p>
                              </div>
                            )}

                            {/* Expiration */}
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Expiration automatique</label>
                              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none">
                                <option value="">Jamais (jusqu&apos;à objectif atteint)</option>
                                <option value="30">Dans 30 jours</option>
                                <option value="60">Dans 60 jours</option>
                                <option value="90">Dans 90 jours</option>
                                <option value="180">Dans 6 mois</option>
                                <option value="365">Dans 1 an</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-between">
                      <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-accent">← Changer de KPI</button>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setOpen(false); reset(); }}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Annuler</button>
                        <button type="submit" disabled={!threshold || (kpiId === "source_to_lifecycle" && !lifecycleStage)}
                          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50">
                          Suivant : Notifications →
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* ── Step 4: Notifications ── */}
                {step === 4 && kpi && (
                  <form onSubmit={handleSubmit}>
                    <h2 className="text-lg font-semibold text-slate-900">Comment être notifié ?</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choisissez les canaux qui recevront l&apos;alerte quand l&apos;objectif est atteint.
                    </p>

                    <div className="mt-5 space-y-2">
                      {(["in_app", "email", "slack", "teams", "webhook"] as const).map((ch) => {
                        const isInApp = ch === "in_app";
                        const isConfigured = isInApp || configuredChannels.some((c) => c.type === ch && c.enabled);
                        const meta = CHANNEL_LABELS[ch];
                        const isSelected = selectedChannels.includes(ch);

                        return (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => isConfigured && toggleChannel(ch)}
                            disabled={!isConfigured}
                            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                              isSelected
                                ? "border-accent bg-accent/5"
                                : isConfigured
                                ? "border-slate-200 hover:border-slate-300"
                                : "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <span className="text-xl shrink-0">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                                {isInApp && (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                    Toujours actif
                                  </span>
                                )}
                                {!isConfigured && !isInApp && (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                    Non configuré
                                  </span>
                                )}
                                {isSelected && !isInApp && (
                                  <span className="rounded-full bg-accent text-white px-1.5 py-0.5 text-[9px] font-bold">
                                    ✓ Sélectionné
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">{meta.description}</p>
                              {!isConfigured && !isInApp && (
                                <p className="mt-1 text-[10px] text-amber-700">
                                  <a href="/dashboard/parametres/notifications" target="_blank" className="underline">
                                    Configurer ce canal →
                                  </a>
                                </p>
                              )}
                            </div>
                            <div
                              className={`mt-1 h-5 w-5 shrink-0 rounded border-2 transition ${
                                isSelected ? "border-accent bg-accent" : "border-slate-300"
                              } ${!isConfigured ? "opacity-50" : ""}`}
                            >
                              {isSelected && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-full w-full">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedChannels.length === 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        ⚠ Au moins un canal doit être sélectionné. La cloche in-app est sélectionnée par défaut.
                      </p>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                      <button type="button" onClick={() => setStep(3)} className="text-xs text-slate-400 hover:text-accent">
                        ← Modifier l&apos;objectif
                      </button>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setOpen(false); reset(); }}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition">Annuler</button>
                        <button type="submit" disabled={state === "loading" || selectedChannels.length === 0}
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
