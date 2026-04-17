"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TEAMS, CATEGORIES_BY_TEAM, type TeamId } from "@/lib/reports/report-catalog";

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

  // Options
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [hsTeams, setHsTeams] = useState<string[]>([]);
  const [lifecycleStages, setLifecycleStages] = useState<Option[]>([]);
  const [sources, setSources] = useState<Option[]>([]);
  const [customProps, setCustomProps] = useState<CustomProp[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

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

  function reset() {
    setStep(1); setTeam(""); setCategoryId(""); setSelectedMetrics([]);
    setSelectedPipelines([]); setHsTeamFilter(""); setOwnerFilter("");
    setLifecycleStage(""); setSelectedSources([]);
    setCustomProp(""); setCustomPropValue("");
    setDatePreset("all_time"); setTitle(""); setIcon("📊");
    setState("idle");
  }

  function selectTeam(t: TeamId) {
    setTeam(t); setCategoryId(""); setSelectedMetrics([]); setStep(2);
  }
  function selectCategory(cid: string) {
    const cat = categories.find((c) => c.id === cid);
    setCategoryId(cid);
    setSelectedMetrics(cat?.metrics.slice(0, 4) ?? []);
    setIcon(cat?.icon ?? "📊");
    setTitle(cat?.label ?? "");
    setStep(3);
  }
  function toggleMetric(m: string) {
    setSelectedMetrics((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
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
        }, 1500);
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
                      Sélectionnez les indicateurs clés pour votre rapport « {category.label} ».
                    </p>
                    <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                      <span className="font-semibold">Objectif métier :</span> {category.objectiveMetier}
                    </div>
                    <div className="mt-4 space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                      {category.metrics.map((m) => {
                        const selected = selectedMetrics.includes(m);
                        return (
                          <label
                            key={m}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:border-accent/30 ${selected ? "border-accent bg-accent/5" : "border-slate-200"}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleMetric(m)}
                              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                            />
                            <span className={`text-xs font-medium ${selected ? "text-accent" : "text-slate-700"}`}>{m}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500">
                      {selectedMetrics.length} KPI{selectedMetrics.length > 1 ? "s" : ""} sélectionné{selectedMetrics.length > 1 ? "s" : ""}
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
