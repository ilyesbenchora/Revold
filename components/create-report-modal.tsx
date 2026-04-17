"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TEAMS, CATEGORIES_BY_TEAM, type TeamId } from "@/lib/reports/report-catalog";
import { IMPLEMENTED_KPIS, MAX_KPIS_PER_REPORT } from "@/lib/reports/implemented-kpis";

const DATE_PRESETS = [
  { id: "this_month", label: "Ce mois" },
  { id: "this_quarter", label: "Ce trimestre" },
  { id: "this_year", label: "Cette année" },
  { id: "last_30d", label: "30 derniers jours" },
  { id: "last_90d", label: "90 derniers jours" },
  { id: "all_time", label: "Depuis toujours" },
];

const ICONS = ["📊", "📈", "💰", "🚀", "⏱️", "🔮", "📞", "🎯", "🔄", "📡", "💎", "🛡️", "🎟️", "⚠️", "🔍", "🔁", "⚙️", "💼", "📣", "🤝"];

type Pipeline = { id: string; label: string };
type Owner = { id: string; name: string; email: string; team: string | null };
type Option = { value: string; label: string };
type CustomProp = { name: string; label: string; type: string };

export function CreateReportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Options
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [hsTeams, setHsTeams] = useState<string[]>([]);
  const [lifecycleStages, setLifecycleStages] = useState<Option[]>([]);
  const [sources, setSources] = useState<Option[]>([]);
  const [customProps, setCustomProps] = useState<CustomProp[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // KPI availability — pre-computed per CRM (which implemented KPIs actually have data)
  const [withDataSet, setWithDataSet] = useState<Set<string> | null>(null);
  const [hasHubspotToken, setHasHubspotToken] = useState<boolean>(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Step 1: team
  const [team, setTeam] = useState<TeamId | "">("");
  // Step 2: category
  const [categoryId, setCategoryId] = useState("");
  // Step 3: KPIs multi-select
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  // Step 4: filters + titre + icône
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [hsTeamFilter, setHsTeamFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [lifecycleStage, setLifecycleStage] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [customProp, setCustomProp] = useState("");
  const [customPropValue, setCustomPropValue] = useState("");
  const [datePreset, setDatePreset] = useState("all_time");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📊");

  const categories = team ? CATEGORIES_BY_TEAM[team] : [];
  const category = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);

  // Three buckets per category:
  //   withDataMetrics    → ✅ implemented + your CRM has the data
  //   noDataMetrics      → 🟠 implemented but your CRM has 0 records
  //   upcomingMetrics    → 🔒 not yet implemented (Stripe / Pennylane / etc.)
  const { withDataMetrics, noDataMetrics, upcomingMetrics } = useMemo(() => {
    const all = category?.metrics ?? [];
    const withD: string[] = [];
    const without: string[] = [];
    const soon: string[] = [];
    for (const m of all) {
      if (!IMPLEMENTED_KPIS.has(m)) {
        soon.push(m);
      } else if (withDataSet === null) {
        // availability not yet loaded → treat all implemented as potentially available
        withD.push(m);
      } else if (withDataSet.has(m)) {
        withD.push(m);
      } else {
        without.push(m);
      }
    }
    return { withDataMetrics: withD, noDataMetrics: without, upcomingMetrics: soon };
  }, [category, withDataSet]);

  const reachedLimit = selectedMetrics.length >= MAX_KPIS_PER_REPORT;

  useEffect(() => {
    if (open && !optionsLoaded) {
      fetch("/api/alerts/options")
        .then((r) => r.ok ? r.json() : { pipelines: [], owners: [], teams: [], lifecycleStages: [], sources: [], customContactProps: [] })
        .then((data) => {
          setPipelines(data.pipelines ?? []);
          setOwners(data.owners ?? []);
          setHsTeams(data.teams ?? []);
          setLifecycleStages(data.lifecycleStages ?? []);
          setSources(data.sources ?? []);
          setCustomProps(data.customContactProps ?? []);
          setOptionsLoaded(true);
        })
        .catch(() => setOptionsLoaded(true));
    }
  }, [open, optionsLoaded]);

  // Load KPI availability (which implemented KPIs actually return data for this CRM)
  useEffect(() => {
    if (!open || withDataSet !== null || availabilityLoading) return;
    setAvailabilityLoading(true);
    fetch("/api/reports/kpi-availability")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { withData?: string[]; hasToken?: boolean } | null) => {
        if (data && Array.isArray(data.withData)) {
          setWithDataSet(new Set(data.withData));
          setHasHubspotToken(data.hasToken !== false);
        } else {
          // Fallback : treat all implemented as available so the user is never blocked
          setWithDataSet(new Set(IMPLEMENTED_KPIS));
        }
      })
      .catch(() => setWithDataSet(new Set(IMPLEMENTED_KPIS)))
      .finally(() => setAvailabilityLoading(false));
  }, [open, withDataSet, availabilityLoading]);

  function reset() {
    setStep(1); setTeam(""); setCategoryId(""); setSelectedMetrics([]);
    setSelectedPipelines([]); setHsTeamFilter(""); setOwnerFilter("");
    setLifecycleStage(""); setSelectedSources([]);
    setCustomProp(""); setCustomPropValue("");
    setDatePreset("all_time"); setTitle(""); setIcon("📊");
    setState("idle"); setErrorMsg(null);
  }

  function selectTeam(t: TeamId) {
    setTeam(t); setCategoryId(""); setSelectedMetrics([]); setStep(2);
  }
  function selectCategory(cid: string) {
    const cat = categories.find((c) => c.id === cid);
    setCategoryId(cid);
    // Pre-select up to 4 KPIs : implemented AND with data in the CRM
    const preselect = (cat?.metrics ?? [])
      .filter((m) => IMPLEMENTED_KPIS.has(m))
      .filter((m) => (withDataSet ? withDataSet.has(m) : true))
      .slice(0, 4);
    setSelectedMetrics(preselect);
    setIcon(cat?.icon ?? "📊");
    setTitle(cat?.label ?? "");
    setStep(3);
  }
  function toggleMetric(m: string) {
    setSelectedMetrics((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= MAX_KPIS_PER_REPORT) return prev; // hard cap
      return [...prev, m];
    });
  }
  function togglePipeline(id: string) {
    setSelectedPipelines((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }
  function toggleSource(val: string) {
    setSelectedSources((prev) => prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]);
  }

  const filteredOwners = hsTeamFilter ? owners.filter((o) => o.team === hsTeamFilter) : owners;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!team || !category || selectedMetrics.length === 0 || !title.trim()) return;
    setState("loading");

    const ownerIds: string[] = [];
    if (ownerFilter) ownerIds.push(ownerFilter);
    else if (hsTeamFilter) filteredOwners.forEach((o) => ownerIds.push(o.id));

    const filters = {
      dateFilter: datePreset === "all_time" ? null : datePreset,
      pipelineIds: selectedPipelines.length > 0 ? selectedPipelines : null,
      ownerIds: ownerIds.length > 0 ? ownerIds : null,
      lifecycleStage: lifecycleStage || null,
      sources: selectedSources.length > 0 ? selectedSources : null,
      customProperty: customProp && customPropValue ? { name: customProp, value: customPropValue } : null,
    };

    try {
      const res = await fetch("/api/reports/create-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team,
          categoryId,
          displayCategory: categoryId,
          title: title.trim(),
          description: category.description,
          expectedValue: category.objectiveMetier,
          metrics: selectedMetrics,
          icon,
          filters,
        }),
      });
      if (res.ok) {
        setState("done");
        setTimeout(() => {
          setOpen(false);
          reset();
          router.refresh();
          router.push("/dashboard/rapports/mes-rapports");
        }, 1200);
      } else {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(payload?.error ?? `Échec de la création (${res.status}).`);
        setState("idle");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur réseau. Réessayez.");
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
          <circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" />
        </svg>
        Créer un rapport
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { if (state !== "loading") { setOpen(false); reset(); } }}
        >
          <div
            className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "done" ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Rapport créé</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Les KPIs sont calculés avec vos filtres.
                </p>
              </div>
            ) : (
              <>
                {/* Steps indicator */}
                <div className="mb-6 flex items-center gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { if (s < step) setStep(s); }}
                        disabled={s > step}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                          s === step ? "bg-accent text-white" : s < step ? "bg-accent/20 text-accent cursor-pointer" : "bg-slate-100 text-slate-400"
                        }`}
                      >{s}</button>
                      <span className={`text-xs font-medium ${s === step ? "text-slate-900" : "text-slate-400"}`}>
                        {s === 1 ? "Équipe" : s === 2 ? "Catégorie" : s === 3 ? "KPIs" : "Filtres"}
                      </span>
                      {s < 4 && <span className="mx-1 text-slate-300">→</span>}
                    </div>
                  ))}
                </div>

                {/* ── Step 1 : Team ── */}
                {step === 1 && (
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Pour quelle équipe ?</h2>
                    <p className="mt-1 text-sm text-slate-500">Le choix de l&apos;équipe définit les catégories de rapport proposées.</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {TEAMS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTeam(t.id)}
                          className={`rounded-xl border p-4 text-left transition hover:border-accent/30 hover:shadow-sm ${team === t.id ? "border-accent bg-accent/5" : "border-slate-200"}`}
                        >
                          <span className="text-2xl">{t.icon}</span>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{t.label}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 2 : Category ── */}
                {step === 2 && team && (
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Quelle catégorie de rapport ?</h2>
                    <p className="mt-1 text-sm text-slate-500">Catégories pour l&apos;équipe {TEAMS.find((t) => t.id === team)?.label}.</p>
                    <div className="mt-4 space-y-2">
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCategory(c.id)}
                          className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition hover:border-accent/30 ${categoryId === c.id ? "border-accent bg-accent/5" : "border-slate-200"}`}
                        >
                          <span className="text-xl shrink-0 mt-0.5">{c.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${categoryId === c.id ? "text-accent" : "text-slate-900"}`}>{c.label}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{c.description}</p>
                            <p className="mt-1 text-[10px] italic text-slate-400">
                              <span className="font-medium text-slate-500">Objectif :</span> {c.objectiveMetier}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {c.metrics.length} KPIs
                          </span>
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs text-slate-400 hover:text-accent">← Changer d&apos;équipe</button>
                  </div>
                )}

                {/* ── Step 3 : KPIs ── */}
                {step === 3 && category && (
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Quels KPIs suivre ?</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Sélectionnez jusqu&apos;à {MAX_KPIS_PER_REPORT} indicateurs pour votre rapport « {category.label} ».
                    </p>
                    <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                      <span className="font-semibold">Objectif métier :</span> {category.objectiveMetier}
                    </div>
                    <p className="mt-2 text-[10px] italic text-slate-500">
                      💡 Pour une analyse CRO exploitable, privilégiez 3 à 5 KPIs cohérents (un par dimension : volume, taux, vélocité, montant).
                    </p>

                    {availabilityLoading && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-accent" />
                        Analyse de la disponibilité dans votre CRM...
                      </div>
                    )}

                    {!hasHubspotToken && !availabilityLoading && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        Token HubSpot manquant : impossible de vérifier les données disponibles. Tous les KPIs implémentés sont proposés mais peuvent retourner « Données absentes ».
                      </div>
                    )}

                    {!availabilityLoading && withDataMetrics.length === 0 && noDataMetrics.length === 0 && upcomingMetrics.length === 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        Aucun KPI dans cette catégorie.
                      </p>
                    )}

                    {!availabilityLoading && withDataMetrics.length === 0 && noDataMetrics.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        Cette catégorie n&apos;a aucune donnée dans votre CRM actuellement. Vous pouvez quand même créer le rapport — il s&apos;activera dès l&apos;arrivée de données.
                      </div>
                    )}

                    <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                      {/* Bucket 1 : ✅ With data */}
                      {withDataMetrics.length > 0 && (
                        <div>
                          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            ✅ Disponible — données présentes ({withDataMetrics.length})
                          </p>
                          <div className="space-y-1.5">
                            {withDataMetrics.map((m) => {
                              const selected = selectedMetrics.includes(m);
                              const disabled = !selected && reachedLimit;
                              return (
                                <label
                                  key={m}
                                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                                    selected
                                      ? "cursor-pointer border-accent bg-accent/5"
                                      : disabled
                                        ? "cursor-not-allowed border-slate-200 opacity-50"
                                        : "cursor-pointer border-slate-200 hover:border-accent/30"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={disabled}
                                    onChange={() => toggleMetric(m)}
                                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent disabled:cursor-not-allowed"
                                  />
                                  <span className={`flex-1 text-xs font-medium ${selected ? "text-accent" : "text-slate-700"}`}>{m}</span>
                                  <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500" title="Données présentes dans votre CRM" />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Bucket 2 : 🟠 Implemented but no data */}
                      {noDataMetrics.length > 0 && (
                        <div>
                          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            🟠 Implémenté — votre CRM n&apos;a pas encore les données ({noDataMetrics.length})
                          </p>
                          <div className="space-y-1.5">
                            {noDataMetrics.map((m) => {
                              const selected = selectedMetrics.includes(m);
                              const disabled = !selected && reachedLimit;
                              return (
                                <label
                                  key={m}
                                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                                    selected
                                      ? "cursor-pointer border-amber-400 bg-amber-50"
                                      : disabled
                                        ? "cursor-not-allowed border-amber-100 opacity-50"
                                        : "cursor-pointer border-amber-100 bg-amber-50/30 hover:border-amber-300"
                                  }`}
                                  title="Aucune donnée chez vous pour ce KPI — il s'affichera 'Données absentes' tant que votre CRM n'a rien."
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={disabled}
                                    onChange={() => toggleMetric(m)}
                                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
                                  />
                                  <span className={`flex-1 text-xs font-medium ${selected ? "text-amber-900" : "text-slate-600"}`}>{m}</span>
                                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">Vide</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Bucket 3 : 🔒 Coming soon */}
                      {upcomingMetrics.length > 0 && (
                        <div>
                          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            🔒 Bientôt — nécessite intégration supplémentaire ({upcomingMetrics.length})
                          </p>
                          <div className="space-y-1">
                            {upcomingMetrics.map((m) => (
                              <div
                                key={m}
                                className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-left opacity-60"
                                title="Indicateur non encore branché — Stripe / Pennylane / historique souscriptions requis"
                              >
                                <span className="h-4 w-4 shrink-0 rounded border border-slate-300 bg-slate-100" />
                                <span className="flex-1 text-xs font-medium text-slate-500">{m}</span>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">Bientôt</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className={selectedMetrics.length > 0 ? "text-slate-600" : "text-slate-400"}>
                        {selectedMetrics.length} / {MAX_KPIS_PER_REPORT} KPI{selectedMetrics.length > 1 ? "s" : ""} sélectionné{selectedMetrics.length > 1 ? "s" : ""}
                      </span>
                      {reachedLimit && (
                        <span className="text-amber-600">Limite atteinte — désélectionnez pour en ajouter d&apos;autres</span>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-accent">← Changer de catégorie</button>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        disabled={selectedMetrics.length === 0}
                        className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                      >Suivant →</button>
                    </div>
                  </div>
                )}

                {/* ── Step 4 : Filters + title ── */}
                {step === 4 && category && (
                  <form onSubmit={handleSubmit}>
                    <h2 className="text-lg font-semibold text-slate-900">Filtres de précision</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Affinez le calcul des KPIs. Laissez vide pour inclure toutes les données.
                    </p>

                    <div className="mt-4 space-y-4">
                      {/* Titre + icône */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600">Titre du rapport</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-lg focus:border-accent focus:outline-none"
                          >
                            {ICONS.map((i) => (<option key={i} value={i}>{i}</option>))}
                          </select>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: CA Enterprise Q1 2026"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Période */}
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Période d&apos;analyse</label>
                        <div className="flex flex-wrap gap-1.5">
                          {DATE_PRESETS.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setDatePreset(d.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                datePreset === d.id ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >{d.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Pipelines */}
                      {pipelines.length > 0 && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Pipeline(s) à inclure</label>
                          <div className="flex flex-wrap gap-2">
                            {pipelines.map((p) => {
                              const selected = selectedPipelines.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => togglePipeline(p.id)}
                                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                    selected ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
                                  }`}
                                >
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

                      {/* Owner / équipe HS */}
                      {(owners.length > 0 || hsTeams.length > 0) && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Propriétaire ou équipe HubSpot</label>
                          <div className="grid grid-cols-2 gap-2">
                            {hsTeams.length > 0 && (
                              <select
                                value={hsTeamFilter}
                                onChange={(e) => { setHsTeamFilter(e.target.value); setOwnerFilter(""); }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                              >
                                <option value="">Toutes les équipes</option>
                                {hsTeams.map((t) => (<option key={t} value={t}>{t}</option>))}
                              </select>
                            )}
                            <select
                              value={ownerFilter}
                              onChange={(e) => setOwnerFilter(e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                            >
                              <option value="">Tous les propriétaires</option>
                              {filteredOwners.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}{o.team ? ` — ${o.team}` : ""}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Lifecycle stage */}
                      {lifecycleStages.length > 0 && (team === "marketing" || team === "cs" || team === "revops") && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Phase du cycle de vie (contacts)</label>
                          <select
                            value={lifecycleStage}
                            onChange={(e) => setLifecycleStage(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                          >
                            <option value="">Toutes les phases</option>
                            {lifecycleStages.map((lc) => (<option key={lc.value} value={lc.value}>{lc.label}</option>))}
                          </select>
                        </div>
                      )}

                      {/* Sources */}
                      {sources.length > 0 && (team === "marketing" || team === "sales") && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Source(s) d&apos;origine</label>
                          <div className="flex flex-wrap gap-1.5">
                            {sources.map((s) => {
                              const selected = selectedSources.includes(s.value);
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => toggleSource(s.value)}
                                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                                    selected ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
                                  }`}
                                >
                                  {selected && <span className="mr-1">✓</span>}
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Custom prop */}
                      {customProps.length > 0 && (team === "marketing" || team === "cs") && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-600">Propriété de contact personnalisée</label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={customProp}
                              onChange={(e) => { setCustomProp(e.target.value); setCustomPropValue(""); }}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-accent focus:outline-none"
                            >
                              <option value="">Aucune</option>
                              {customProps.map((p) => (<option key={p.name} value={p.name}>{p.label}</option>))}
                            </select>
                            {customProp && (
                              <input
                                type="text"
                                value={customPropValue}
                                onChange={(e) => setCustomPropValue(e.target.value)}
                                placeholder="Valeur attendue"
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-accent focus:outline-none"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {errorMsg && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                        <span className="font-semibold">Erreur :</span> {errorMsg}
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                      <button type="button" onClick={() => setStep(3)} className="text-xs text-slate-400 hover:text-accent">← Changer de KPIs</button>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => { setOpen(false); reset(); }}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                        >Annuler</button>
                        <button
                          type="submit"
                          disabled={!title.trim() || state === "loading"}
                          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                        >
                          {state === "loading" ? "Création..." : "Créer le rapport"}
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
