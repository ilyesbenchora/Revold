"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

type ToolOption = { key: string; label: string; icon: string; category?: string };

// ── Team definitions ──
const teams = [
  { id: "sales", label: "Ventes", icon: "💼", description: "Pipeline, deals, closing" },
  { id: "marketing", label: "Marketing", icon: "📣", description: "Leads, conversion, acquisition" },
  { id: "cs", label: "Service client", icon: "🤝", description: "Rétention, churn, satisfaction" },
  { id: "revops", label: "Finance", icon: "📊", description: "Pilotage revenue, données & process" },
  { id: "ops", label: "Opération", icon: "⚙️", description: "Data quality, doublons, intégrité" },
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
    { id: "pipeline_stage_conversion", label: "Conversion étape→étape", description: "% de deals qui passent d'une étape à la suivante — détecte les goulots d'étranglement du pipeline", defaultUnit: "percent", defaultDirection: "above", category: "sales", dealRelated: true },
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
    { id: "deals_won_count", label: "Deals gagnés", description: "Volume de deals signés — base pour réconciliation forecast vs facturation", defaultUnit: "count", defaultDirection: "above", category: "sales", dealRelated: true },
    { id: "deals_at_risk", label: "Comptes à risque", description: "Deals/comptes flagués à risque — proxy churn signal", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    // ── Efficacité process ──
    { id: "sales_cycle_days", label: "Cycle de vente moyen", description: "Jours entre création et closing — vélocité du process", defaultUnit: "count", defaultDirection: "below", category: "sales", dealRelated: true },
    { id: "conversion_rate", label: "Conversion Lead→Opp", description: "Taux de conversion global — santé du funnel", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    { id: "mql_to_sql_rate", label: "MQL→SQL", description: "Taux de handoff marketing→sales — alignement des équipes", defaultUnit: "percent", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true },
    // ── Data quality ──
    { id: "data_completeness", label: "Complétude deals", description: "% de deals avec montant + date de closing + propriétaire — fiabilité du forecast", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: true },
    { id: "orphan_rate", label: "Taux d'orphelins", description: "% contacts sans entreprise — intégrité de la donnée", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Qualité données", description: "% contacts avec téléphone — capacité opérationnelle", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: false, contactRelated: true },
    { id: "contacts_by_source", label: "Contacts par source", description: "Volume de contacts par source d'origine — base attribution multi-canal", defaultUnit: "count", defaultDirection: "above", category: "marketing", dealRelated: false, contactRelated: true, sourceRelated: true },
  ],
  ops: [
    // ── Qualité & intégrité des données ──
    { id: "duplicate_rate", label: "Taux de doublons", description: "% de contacts en doublon (même email) — hygiène et déduplication de la base", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "data_completeness", label: "Complétude des données", description: "% de deals avec montant + date de closing + propriétaire — fiabilité des analyses", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: true },
    { id: "orphan_rate", label: "Contacts orphelins", description: "% de contacts sans entreprise associée — intégrité du rattachement", defaultUnit: "percent", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
    { id: "phone_enrichment", label: "Enrichissement téléphone", description: "% de contacts avec numéro renseigné — complétude pour l'outbound", defaultUnit: "percent", defaultDirection: "above", category: "data", dealRelated: false, contactRelated: true },
    { id: "deals_no_amount", label: "Deals sans montant", description: "Deals ouverts sans montant renseigné — forecast aveugle", defaultUnit: "count", defaultDirection: "below", category: "data", dealRelated: true },
    { id: "dormant_reactivation", label: "Contacts dormants", description: "Contacts sans interaction depuis 6 mois — base à nettoyer ou réactiver", defaultUnit: "count", defaultDirection: "below", category: "data", dealRelated: false, contactRelated: true },
  ],
};

const unitLabels: Record<string, string> = { percent: "%", currency: "€", count: "" };

type Pipeline = { id: string; label: string };
type Owner = { id: string; name: string; email: string; team: string | null };
type ConfiguredChannel = { type: "email" | "slack" | "teams" | "webhook"; enabled: boolean };

// Pour les canaux qui correspondent à un produit (Slack, Teams, HubSpot), on
// utilise le logo de marque via Google s2 favicons (BrandLogo). Pour les
// canaux génériques (in_app, email, webhook) on garde une icône emoji.
const CHANNEL_LABELS: Record<
  string,
  { label: string; description: string; icon: string; brandDomain?: string }
> = {
  in_app: { label: "Cloche in-app", description: "Notification dans le header + page Alertes", icon: "🔔" },
  email: { label: "Email", description: "Email aux destinataires configurés", icon: "✉️" },
  slack: { label: "Slack", description: "Message dans le canal Slack configuré", icon: "💬", brandDomain: "slack.com" },
  teams: { label: "Microsoft Teams", description: "Card dans le canal Teams configuré", icon: "👥", brandDomain: "microsoft.com" },
  hubspot: { label: "HubSpot CRM", description: "Notification interne HubSpot (cloche du propriétaire) — task assignée", icon: "🔶", brandDomain: "hubspot.com" },
  webhook: { label: "Webhook custom", description: "POST JSON vers votre URL", icon: "🔌" },
};

export function CreateAlertModal({ hideTrigger = false }: { hideTrigger?: boolean } = {}) {
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
  // Outils connectés — données à croiser (hors communication) + un KPI par source.
  const [connectedTools, setConnectedTools] = useState<ToolOption[]>([]);
  const [crossSources, setCrossSources] = useState<string[]>([]);
  const [sourceKpis, setSourceKpis] = useState<Record<string, { value: string; unit: "percent" | "currency" | "count" }>>({});

  // Step 1
  const [team, setTeam] = useState("");
  // Équipe verrouillée par la page (Ventes/Marketing) → on saute l'étape 1.
  const [teamLocked, setTeamLocked] = useState(false);
  // Step 2
  const [kpiId, setKpiId] = useState("");
  // Step 3 — évaluation
  const [alertTitle, setAlertTitle] = useState("");
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [unitMode, setUnitMode] = useState<"percent" | "currency" | "count">("percent");
  const [priority, setPriority] = useState<"faible" | "moyen" | "urgent">("moyen");
  const [continuous, setContinuous] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customKpi, setCustomKpi] = useState("");
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  // Contexte libre transmis à l'agent qui crée l'alerte (rapproche les vraies données).
  const [agentContext, setAgentContext] = useState("");
  // Step 3 — marketing
  const [lifecycleStage, setLifecycleStage] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  // Filtres non exposés dans le formulaire (valeurs par défaut envoyées au back).
  const frequency = "every_check";
  const minDealAmount = "";
  const expiresIn = "";
  const ownerFilter = "";
  const hsTeamFilter = "";
  const customProp = "";
  const customPropValue = "";
  // Step 4 — Notifications
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["in_app"]);
  const [configuredChannels, setConfiguredChannels] = useState<ConfiguredChannel[]>([]);

  const kpiList = kpisByTeam[team] ?? [];
  const kpi =
    kpiId === "custom"
      ? { id: "custom", label: customKpi.trim() || "KPI personnalisé", description: "", defaultUnit: unitMode, defaultDirection: direction, category: team || "revops", dealRelated: false, contactRelated: false, sourceRelated: false }
      : kpiList.find((k) => k.id === kpiId);

  // ── Écoute l'event global "revold:open-alert-modal" pour ouvrir la modal
  // depuis n'importe quel CreateAlertCta avec un preset (équipe + KPI + seuil)
  useEffect(() => {
    function onPreset(e: Event) {
      const detail = (e as CustomEvent).detail as {
        team?: string;
        kpiId?: string;
        defaultThreshold?: number;
        defaultDirection?: "above" | "below";
        defaultUnit?: "percent" | "currency" | "count";
        defaultPipelineIds?: string[];
        startStep?: number;
        lockTeam?: boolean;
      } | undefined;
      if (!detail) return;
      reset();

      // Résout team + kpiId. Si l'un manque ou n'est pas dans le catalogue,
      // on fallback à un step antérieur pour que l'utilisateur choisisse,
      // au lieu d'afficher une étape vide (step 3 demande `kpi` valide).
      const teamOk = detail.team && (detail.team in kpisByTeam);
      const kpisForTeam = teamOk ? kpisByTeam[detail.team!] : [];
      const kpiOk = detail.kpiId && kpisForTeam.some((k) => k.id === detail.kpiId);

      if (teamOk) setTeam(detail.team!);
      if (kpiOk) {
        setKpiId(detail.kpiId!);
        setAlertTitle(kpisForTeam.find((k) => k.id === detail.kpiId)?.label ?? "");
      }
      setTeamLocked(!!detail.lockTeam && !!teamOk);

      if (detail.defaultThreshold !== undefined) setThreshold(String(detail.defaultThreshold));
      if (detail.defaultDirection) setDirection(detail.defaultDirection);
      if (detail.defaultUnit) setUnitMode(detail.defaultUnit);
      if (detail.defaultPipelineIds && detail.defaultPipelineIds.length > 0)
        setSelectedPipelines(detail.defaultPipelineIds);

      // Step demandé OU step minimal possible selon ce qui est résolu
      const requestedStep = detail.startStep ?? 3;
      const safeStep = !teamOk ? 1 : !kpiOk ? 2 : requestedStep;
      setStep(safeStep);
      setOpen(true);
    }
    window.addEventListener("revold:open-alert-modal", onPreset as EventListener);
    return () => window.removeEventListener("revold:open-alert-modal", onPreset as EventListener);
  }, []);

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
        fetch("/api/integrations/connected")
          .then((r) => (r.ok ? r.json() : { tools: [] }))
          .catch(() => ({ tools: [] })),
      ]).then(([options, notifData, connData]) => {
        setPipelines(options.pipelines ?? []);
        setOwners(options.owners ?? []);
        setHsTeams(options.teams ?? []);
        setLifecycleStages(options.lifecycleStages ?? []);
        setSources(options.sources ?? []);
        setCustomContactProps(options.customContactProps ?? []);
        setConfiguredChannels(notifData.channels ?? []);
        setConnectedTools(connData.tools ?? []);
        setOptionsLoaded(true);
      });
    }
  }, [open, optionsLoaded]);

  function reset() {
    setStep(1); setTeam(""); setKpiId(""); setAlertTitle(""); setThreshold(""); setDirection("above");
    setUnitMode("percent"); setPriority("moyen"); setContinuous(false);
    setDateFrom(""); setDateTo(""); setCustomKpi(""); setSelectedPipelines([]); setAgentContext("");
    setLifecycleStage(""); setSelectedSources([]);
    setSelectedChannels(["in_app"]);
    setCrossSources([]); setSourceKpis({});
    setTeamLocked(false);
    setState("idle"); setResult(null);
  }

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  function selectTeam(t: string) { setTeam(t); setKpiId(""); setStep(2); }
  function selectKpi(k: KpiDef) { setKpiId(k.id); setAlertTitle(k.label); setDirection(k.defaultDirection); setUnitMode(k.defaultUnit); setStep(3); }

  function togglePipeline(id: string) {
    setSelectedPipelines((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }
  function toggleSource(val: string) {
    setSelectedSources((prev) => prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]);
  }

  // ── Données à croiser (hors outils de communication type Slack/Teams) ──
  const dataSources = connectedTools.filter((t) => t.category !== "communication");
  const hubspotSelected = crossSources.includes("hubspot");
  function toggleCrossSource(key: string) {
    setCrossSources((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function setSourceKpi(key: string, patch: Partial<{ value: string; unit: "percent" | "currency" | "count" }>) {
    setSourceKpis((prev) => ({ ...prev, [key]: { value: prev[key]?.value ?? "", unit: prev[key]?.unit ?? "percent", ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kpi || !threshold) return;

    setState("loading");
    const unit = unitLabels[unitMode];
    const dirLabel = direction === "below" ? "descendre sous" : "atteindre";
    const teamLabel = teams.find((t) => t.id === team)?.label ?? team;
    // Priorité (faible/moyen/urgent) → sévérité stockée (info/warning/critical).
    const severity = priority === "faible" ? "info" : priority === "urgent" ? "critical" : "warning";

    // Build description with context
    const parts = [`[${teamLabel}] "${kpi.label}" ${dirLabel} ${threshold}${unit}`];
    parts.push(`Priorité : ${priority}`);
    if (selectedPipelines.length > 0) {
      const names = selectedPipelines.map((id) => pipelines.find((p) => p.id === id)?.label ?? id);
      parts.push(`Pipeline${names.length > 1 ? "s" : ""} : ${names.join(", ")}`);
    }
    if (lifecycleStage) {
      const lcLabel = lifecycleStages.find((l) => l.value === lifecycleStage)?.label ?? lifecycleStage;
      parts.push(`Phase cible : ${lcLabel}`);
    }
    if (selectedSources.length > 0) {
      const srcNames = selectedSources.map((s) => sources.find((src) => src.value === s)?.label ?? s);
      parts.push(`Source${srcNames.length > 1 ? "s" : ""} : ${srcNames.join(", ")}`);
    }
    const periodLabel = continuous ? "En continu" : dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : "Toute la période";
    parts.push(`Période d'analyse : ${periodLabel}`);

    // KPI par source croisée (hors communication), ex : un pour le CRM, un pour Stripe.
    const secondaryKpis = crossSources
      .map((key) => {
        const k = sourceKpis[key];
        if (!k || !k.value) return null;
        return { source: key, value: Number(k.value), unit_mode: k.unit };
      })
      .filter((x): x is { source: string; value: number; unit_mode: "percent" | "currency" | "count" } => x != null);
    if (crossSources.length > 0) {
      const names = crossSources.map((key) => dataSources.find((t) => t.key === key)?.label ?? key);
      parts.push(`Données à croiser : ${names.join(", ")}`);
      for (const sk of secondaryKpis) {
        const label = dataSources.find((t) => t.key === sk.source)?.label ?? sk.source;
        const u = sk.unit_mode === "count" ? "" : sk.unit_mode === "currency" ? " €" : " %";
        parts.push(`KPI ${label} : ${sk.value}${u}`);
      }
    }
    if (agentContext.trim()) parts.push(`Contexte : ${agentContext.trim()}`);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alertTitle.trim() || `${kpi.label} : ${threshold}${unit}`,
          description: parts.join(". ") + ".",
          impact: `Notification quand le KPI ${dirLabel} ${threshold}${unit}`,
          category: kpi.category,
          forecast_type: kpiId === "custom" ? null : kpi.id,
          threshold: Number(threshold),
          direction,
          team,
          pipeline_id: selectedPipelines.length === 1 ? selectedPipelines[0] : null,
          owner_filter: ownerFilter || null,
          date_preset: null,
          date_from: continuous ? null : dateFrom || null,
          date_to: continuous ? null : dateTo || null,
          unit_mode: unitMode,
          severity,
          priority,
          continuous,
          frequency,
          min_deal_amount: minDealAmount ? Number(minDealAmount) : null,
          expires_at: null,
          lifecycle_stage: lifecycleStage || null,
          source_filters: selectedSources.length > 0 ? selectedSources : null,
          custom_property: customProp || null,
          custom_prop_value: customPropValue || null,
          user_context: agentContext.trim() || null,
          notification_channels: selectedChannels.length > 0 ? selectedChannels : ["in_app"],
          cross_sources: crossSources.length ? crossSources : null,
          secondary_kpis: secondaryKpis.length ? secondaryKpis : null,
          threshold_secondary: secondaryKpis.length ? secondaryKpis[0].value : null,
          unit_mode_secondary: secondaryKpis.length ? secondaryKpis[0].unit_mode : null,
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
      {!hideTrigger && (
        <button type="button" onClick={() => { reset(); setOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/20 transition hover:from-fuchsia-500 hover:to-indigo-500 hover:shadow-md hover:shadow-fuchsia-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" />
          </svg>
          Créer une alerte
        </button>
      )}

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
                  {(teamLocked ? [2, 3, 4] : [1, 2, 3, 4]).map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <button type="button" onClick={() => { if (s < step) setStep(s); }} disabled={s > step}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                          s === step ? "bg-accent text-white" : s < step ? "bg-accent/20 text-accent cursor-pointer" : "bg-slate-100 text-slate-400"
                        }`}>{s}</button>
                      <span className={`text-xs font-medium ${s === step ? "text-slate-900" : "text-slate-400"}`}>
                        {s === 1 ? "Équipe" : s === 2 ? "KPI" : s === 3 ? "Évaluation" : "Notifications"}
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
                          <p className="text-sm font-semibold text-slate-900">{t.label}</p>
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
                      {/* KPI personnalisé (en premier) */}
                      <div className={`rounded-lg border px-4 py-3 transition ${kpiId === "custom" ? "border-accent bg-accent/5" : "border-dashed border-slate-300"}`}>
                        <button
                          type="button"
                          onClick={() => setKpiId("custom")}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div>
                            <p className={`text-sm font-medium ${kpiId === "custom" ? "text-accent" : "text-slate-900"}`}>✏️ Alerte personnalisée</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">Une alerte qui n&apos;est pas dans la liste.</p>
                          </div>
                        </button>
                        {kpiId === "custom" && (
                          <div className="mt-2 flex gap-2">
                            <input
                              value={customKpi}
                              onChange={(e) => setCustomKpi(e.target.value)}
                              placeholder="Ex : taux de no-show démo, NPS…"
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                            />
                            <button
                              type="button"
                              onClick={() => { if (customKpi.trim()) { setAlertTitle(customKpi.trim()); setStep(3); } }}
                              disabled={!customKpi.trim()}
                              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                              Continuer
                            </button>
                          </div>
                        )}
                      </div>
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
                    {!teamLocked && (
                      <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-accent">← Changer d&apos;équipe</button>
                    )}
                  </div>
                )}

                {/* ── Step 3: Configure ── */}
                {step === 3 && kpi && (
                  <form onSubmit={(e) => { e.preventDefault(); if (threshold && (kpiId !== "source_to_lifecycle" || lifecycleStage)) setStep(4); }}>
                    <h2 className="text-lg font-semibold text-slate-900">Évaluation</h2>
                    <p className="mt-1 text-sm text-slate-500">{kpi.label} — {kpi.description}</p>

                    <div className="mt-5 space-y-4">
                      {/* Titre de l'alerte — éditable */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Titre de l&apos;alerte</label>
                        <input type="text" value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)}
                          placeholder="Nom de l'alerte"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                      </div>

                      {/* Évolution + Unité */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Évolution</label>
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                            <button type="button" onClick={() => setDirection("above")}
                              className={`flex-1 px-3 py-2 text-sm font-medium transition ${direction === "above" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>↑</button>
                            <button type="button" onClick={() => setDirection("below")}
                              className={`flex-1 px-3 py-2 text-sm font-medium transition ${direction === "below" ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>↓</button>
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

                      {/* KPI à surveiller (seuil) — = KPI de la 1ʳᵉ source croisée */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">
                          KPI à surveiller{crossSources.length > 0 ? ` — ${dataSources.find((t) => t.key === crossSources[0])?.label ?? "1ʳᵉ source"}` : ""}
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)}
                            placeholder={unitMode === "currency" ? "50000" : unitMode === "percent" ? "35" : "10"}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
                          <span className="text-sm font-semibold text-slate-500">{unitLabels[unitMode]}</span>
                        </div>
                      </div>

                      {/* Données à croiser (hors communication) + un KPI par source */}
                      {dataSources.length > 0 && (
                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Données à croiser</label>
                          <div className="flex flex-wrap gap-1.5">
                            {dataSources.map((t) => {
                              const on = crossSources.includes(t.key);
                              return (
                                <button key={t.key} type="button" onClick={() => toggleCrossSource(t.key)}
                                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                                    on ? "border-accent bg-accent/10 text-accent" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  }`}>
                                  <span>{t.icon}</span>{t.label}{on && <span className="text-[10px]">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">
                            1 outil = 1 KPI. Le KPI principal ci-dessus suit ta 1ʳᵉ source ; chaque source supplémentaire ajoute un KPI à croiser.
                          </p>
                          {crossSources.length > 1 && (
                            <div className="mt-3 space-y-2.5">
                              {crossSources.slice(1).map((key) => {
                                const label = dataSources.find((t) => t.key === key)?.label ?? key;
                                const icon = dataSources.find((t) => t.key === key)?.icon ?? "🔗";
                                const sk = sourceKpis[key] ?? { value: "", unit: "percent" as const };
                                return (
                                  <div key={key}>
                                    <label className="mb-1 block text-[11px] font-medium text-slate-500">KPI {icon} {label}</label>
                                    <div className="flex items-center gap-1.5">
                                      <input type="number" step="any" value={sk.value}
                                        onChange={(e) => setSourceKpi(key, { value: e.target.value })}
                                        placeholder="Ex : 20"
                                        className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                                      <div className="flex overflow-hidden rounded-lg border border-slate-200">
                                        {(["percent", "currency", "count"] as const).map((u) => (
                                          <button key={u} type="button" onClick={() => setSourceKpi(key, { unit: u })}
                                            className={`px-2.5 py-1.5 text-xs font-medium transition ${sk.unit === u ? "bg-accent text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                                            {u === "percent" ? "%" : u === "currency" ? "€" : "#"}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pipelines — propre à HubSpot & aux alertes Ventes uniquement */}
                      {team === "sales" && hubspotSelected && pipelines.length > 0 && (
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

                      {/* Phase cible — uniquement pour le KPI source → lifecycle */}
                      {kpiId === "source_to_lifecycle" && lifecycleStages.length > 0 && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">
                            Phase cible à atteindre<span className="ml-1 text-red-500">*</span>
                          </label>
                          <select value={lifecycleStage} onChange={(e) => setLifecycleStage(e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
                              !lifecycleStage ? "border-amber-300 bg-amber-50/50" : "border-slate-200"
                            }`}>
                            <option value="">Sélectionner la phase cible</option>
                            {lifecycleStages.map((lc) => (
                              <option key={lc.value} value={lc.value}>{lc.label}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-slate-400">Quelle phase du lifecycle voulez-vous que vos contacts atteignent ?</p>
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

                      {/* Priorité de l'alerte */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Priorité de l&apos;alerte</label>
                        <div className="flex gap-2">
                          {([
                            { id: "faible", label: "Faible", color: "bg-slate-200 text-slate-700" },
                            { id: "moyen", label: "Moyen", color: "bg-amber-100 text-amber-700" },
                            { id: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
                          ] as const).map((p) => (
                            <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                priority === p.id ? p.color : "bg-white border border-slate-200 text-slate-500"
                              }`}>{p.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Période d'analyse : en continu OU plage de dates */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Période d&apos;analyse</label>
                        <div className="mb-2 flex rounded-lg border border-slate-200 overflow-hidden">
                          <button type="button" onClick={() => setContinuous(true)}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition ${continuous ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>En continu</button>
                          <button type="button" onClick={() => setContinuous(false)}
                            className={`flex-1 px-3 py-2 text-xs font-medium transition ${!continuous ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-50"}`}>Plage de dates</button>
                        </div>
                        {continuous ? (
                          <p className="text-[10px] text-slate-400">L&apos;alerte surveille le KPI en continu, sans borne de dates.</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-slate-400">Date de début</span>
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400">Date de fin</span>
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                              </div>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">Laisse vide pour analyser toute la période.</p>
                          </>
                        )}
                      </div>

                      {/* Description transmise à l'agent qui crée l'alerte */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Description (optionnel)</label>
                        <p className="mb-1.5 text-[10px] text-slate-400">
                          Ce contexte aide l&apos;agent de l&apos;équipe {teams.find((t) => t.id === team)?.label ?? ""} à créer l&apos;alerte et à rapprocher les vraies données.
                        </p>
                        <textarea value={agentContext} onChange={(e) => setAgentContext(e.target.value)} rows={3}
                          placeholder="Ex : croiser le CA CRM et les paiements Stripe, alerter si l'écart dépasse 10 %."
                          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
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
                      {(["in_app", "email", "slack", "teams", "hubspot", "webhook"] as const).map((ch) => {
                        const isInApp = ch === "in_app";
                        const isHubspot = ch === "hubspot";
                        // HubSpot ne demande pas de config user-level : utilise le token OAuth de l'org.
                        // Le canal est dispo dès qu'une intégration HubSpot est active (vérif côté serveur).
                        const isConfigured = isInApp || isHubspot || configuredChannels.some((c) => c.type === ch && c.enabled);
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
                            <span className="shrink-0">
                              {meta.brandDomain ? (
                                <BrandLogo
                                  domain={meta.brandDomain}
                                  alt={meta.label}
                                  fallback={meta.icon}
                                  size={22}
                                />
                              ) : (
                                <span className="text-xl">{meta.icon}</span>
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                                {isInApp && (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                    Toujours actif
                                  </span>
                                )}
                                {isHubspot && (
                                  <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">
                                    OAuth org
                                  </span>
                                )}
                                {!isConfigured && !isInApp && !isHubspot && (
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
                        ← Modifier l&apos;évaluation
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
