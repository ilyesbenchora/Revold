"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTableCard, type SavedTable } from "./data-table-card";
import {
  ENTITY_DIMS,
  presetsForPage,
  filterPresetsBySources,
  PAGE_AGENT_KEY,
  type SourceTool,
  type TablePreset,
  type TableView,
} from "@/lib/reports/data-table-presets";
import { getAgentPersona, agentIsFeminine } from "@/lib/ai/agents/coach-personas";
import { PERIOD_PRESETS, type PeriodPreset } from "@/lib/reports/periods";

// Un KPI est déterministe (câblé précisément, sans agent) uniquement pour la
// projection pondérée et les échéances fiscales. Tous les autres presets passent
// par l'agent pour être câblés sur la vraie donnée enrichie.
function isDeterministicPreset(p: { measure: string; entity: string }): boolean {
  return p.measure === "weighted" || p.entity === "fiscal";
}

// Catégories d'outils qui portent des DONNÉES à croiser. La communication
// (Slack, Teams, Gmail…) est un canal de notification, pas une source d'analyse.
const CROSSABLE_CATEGORIES = new Set(["crm", "billing", "support", "phone", "conv_intel", "files", "ads"]);

const VIEWS: { id: TableView; label: string; icon: string }[] = [
  { id: "table", label: "Tableau", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" },
  { id: "bar", label: "Barres", icon: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
  { id: "line", label: "Courbe", icon: "M3 3v18h18M6 14l4-4 3 3 5-6" },
  { id: "donut", label: "Anneau", icon: "M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6" },
];

// Libellés lisibles des catégories d'outils source, pour regrouper le sélecteur.
const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  billing: "Facturation & compta",
  support: "Service client",
  phone: "Téléphonie",
  communication: "Communication",
  conv_intel: "Conversation Intelligence",
  files: "Fichiers & tableurs",
  ads: "Publicité & web",
};

type Draft = {
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: TableView;
  title: string;
  /** Vrai = KPI personnalisé construit par l'agent (entité/dimension décidées en back). */
  custom?: boolean;
  customKpi?: string;
  description?: string;
};

// Équipe/catégorie d'alerte associée à chaque page de tables de données.
const PAGE_ALERT_TEAM: Record<string, string> = {
  perf_ventes: "sales",
  perf_marketing: "marketing",
  audit_automatisations: "revops",
  audit_service_client: "csm",
  audit_paiement_facturation: "finance",
};

export function PageDataTables({ pageKey }: { pageKey: string }) {
  const allPresets = useMemo(() => presetsForPage(pageKey), [pageKey]);
  const alertTeam = PAGE_ALERT_TEAM[pageKey] ?? "revops";
  const agentName = getAgentPersona(PAGE_AGENT_KEY[pageKey]).name;
  const agentPronoun = agentIsFeminine(PAGE_AGENT_KEY[pageKey]) ? "Elle" : "Il";
  const [tables, setTables] = useState<SavedTable[]>([]);
  const [open, setOpen] = useState(false);
  // 1 = Sources à croiser · 2 = KPI · 3 = Affichage
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customKpi, setCustomKpi] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Id de la table en cours d'édition (null = création).
  const [editingId, setEditingId] = useState<string | null>(null);
  // Outils réellement connectés (sources de données croisables) + sélection.
  const [sources, setSources] = useState<SourceTool[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // Période par défaut appliquée à l'ouverture de la table (étape Affichage).
  const [period, setPeriod] = useState<PeriodPreset>("all");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/page-tables?page_key=${encodeURIComponent(pageKey)}`);
    if (res.ok) {
      const d = await res.json();
      setTables(Array.isArray(d.tables) ? d.tables : []);
    }
  }, [pageKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // Charge les outils connectés une fois (sélecteur « données à croiser »).
  useEffect(() => {
    let alive = true;
    fetch("/api/integrations/connected")
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => {
        // On ne garde que les outils porteurs de données à croiser : la
        // communication (Slack, Teams, Gmail…) est exclue (canal de notif).
        const tools: SourceTool[] = Array.isArray(d.tools) ? d.tools : [];
        if (alive) setSources(tools.filter((t) => CROSSABLE_CATEGORIES.has(t.category)));
      })
      .catch(() => { /* pas bloquant : funnel utilisable sans filtre */ });
    return () => { alive = false; };
  }, []);

  // Outils sélectionnés (objets) → KPIs proposés, filtrés dynamiquement.
  const selectedTools = sources.filter((s) => selected.includes(s.key));
  const presets = filterPresetsBySources(allPresets, selectedTools);

  // Regroupe les outils connectés par catégorie pour le sélecteur de sources.
  const sourcesByCategory = sources.reduce<Record<string, SourceTool[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  function reset() {
    setStep(1);
    setDraft(null);
    setCustomKpi("");
    setDescription("");
    setError(null);
    setEditingId(null);
    setSelected([]);
    setPeriod("all");
  }

  function toggleSource(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  // Ouvre le panneau d'ÉDITION (agent uniquement : KPI + affichage).
  // Le KPI est pré-rempli avec le texte source, ou à défaut le titre actuel.
  function openEdit(table: SavedTable) {
    setError(null);
    setEditingId(table.id);
    setCustomKpi(table.custom_kpi || table.title);
    setDescription(table.description || "");
    setPeriod((table.period_preset as PeriodPreset) || "all");
    setDraft({
      entity: table.entity,
      group_by: table.group_by,
      measure: table.measure,
      field: table.field,
      unit_mode: table.unit_mode,
      view: (table.view as TableView) || "table",
      title: table.title,
      custom: true,
      customKpi: table.custom_kpi || table.title,
    });
    setOpen(true);
  }

  // Les CTA « Créer une table de données » des blocs ouvrent ce builder.
  useEffect(() => {
    function onOpen() { reset(); setOpen(true); }
    window.addEventListener("revold:open-data-table", onOpen);
    return () => window.removeEventListener("revold:open-data-table", onOpen);
  }, []);

  function pickPreset(p: TablePreset) {
    setError(null);
    setDescription("");
    // Projection pondérée + échéances fiscales = KPIs déterministes précis (pas d'agent).
    // Tous les autres presets sont (re)câblés par l'agent sur la vraie donnée enrichie.
    if (isDeterministicPreset(p)) {
      setDraft({
        entity: p.entity,
        group_by: p.groupBy,
        measure: p.measure,
        field: p.field ?? null,
        unit_mode: p.unit,
        view: p.view ?? "table",
        title: p.label,
      });
    } else {
      setDraft({
        entity: p.entity,
        group_by: p.groupBy,
        measure: p.measure,
        field: p.field ?? null,
        unit_mode: p.unit,
        view: p.view ?? "table",
        title: p.label,
        custom: true,
        customKpi: p.label,
      });
    }
    setStep(3);
  }

  function startCustom() {
    if (!customKpi.trim()) return;
    setError(null);
    const kpi = customKpi.trim();
    // En édition : on conserve titre + affichage existants, on met à jour le KPI.
    // En création : le titre reprend le KPI écrit ; l'agent choisit la donnée en back.
    setDraft((prev) =>
      editingId && prev
        ? { ...prev, custom: true, customKpi: kpi }
        : { entity: "", group_by: "", measure: "count", field: null, unit_mode: null, view: "table", title: kpi, custom: true, customKpi: kpi },
    );
    setStep(3);
  }

  async function create() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);

    // ── ÉDITION (agent : KPI + affichage ; le titre se renomme en ligne) ──
    if (editingId) {
      const res = await fetch(`/api/page-tables/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          view: draft.view,
          period_preset: period,
          // Réécriture du KPI / description : le back ne relance l'agent que si l'un des textes change.
          custom_kpi: customKpi.trim(),
          description: description.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      setSaving(false);
      if (res.ok && d.table) {
        setTables((t) => t.map((x) => (x.id === d.table.id ? d.table : x)));
        setOpen(false);
        reset();
      } else {
        setError(d.error || "Modification impossible.");
      }
      return;
    }

    // ── CRÉATION ────────────────────────────────────────────────────────
    const endpoint = draft.custom ? "/api/page-tables/agent-create" : "/api/page-tables";
    const payload = draft.custom
      ? { page_key: pageKey, custom_kpi: draft.customKpi, description: description.trim() || undefined, view: draft.view, title: draft.title || undefined, period_preset: period }
      : { page_key: pageKey, ...draft, period_preset: period };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && d.table) {
      setTables((t) => [...t, d.table]);
      setOpen(false);
      reset();
    } else {
      setError(d.error || "Création impossible.");
    }
  }

  const dims = draft ? ENTITY_DIMS[draft.entity] ?? [] : [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Tables de données
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Construisez vos visualisations à partir de vos données réelles.</p>
        </div>
        <button
          onClick={() => { reset(); setOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Créer une table de données
        </button>
      </div>

      {tables.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">Aucune table de données pour l&apos;instant.</p>
          <p className="text-xs text-slate-400">Cliquez sur « Créer une table de données » pour visualiser un KPI de cette page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tables.map((t) => (
            <DataTableCard
              key={t.id}
              table={t}
              team={alertTeam}
              onEdit={openEdit}
              onUpdated={(nt) => setTables((prev) => prev.map((x) => (x.id === nt.id ? nt : x)))}
              onDeleted={(id) => setTables((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Builder */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {editingId && draft ? (
              /* ── ÉDITION : agent uniquement (KPI + affichage) ── */
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Modifier la table</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {agentName} met à jour la donnée selon ton KPI. Le titre se renomme directement sur la table.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    KPI à suivre
                  </label>
                  <textarea
                    value={customKpi}
                    onChange={(e) => setCustomKpi(e.target.value)}
                    rows={2}
                    placeholder="Ex : montant moyen des deals gagnés par mois"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Description (optionnel)</label>
                  <p className="mt-0.5 text-[11px] text-slate-400">Ajoute du contexte pour aider {agentName} à mieux interpréter ton KPI.</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Ex : ne compter que les deals gagnés, exclure les renouvellements"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500">Affichage</label>
                  <div className="mt-1 grid grid-cols-4 gap-2">
                    {VIEWS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDraft({ ...draft, view: v.id })}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] transition ${
                          draft.view === v.id ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={v.icon} /></svg>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.entity !== "fiscal" && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Période</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      {PERIOD_PRESETS.filter((p) => p.id !== "custom").map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-slate-400 hover:text-accent">Annuler</button>
                  <button
                    onClick={create}
                    disabled={saving || !customKpi.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {!saving && <span aria-hidden>✨</span>}
                    {saving ? `${agentName} peaufine…` : `Mettre à jour via ${agentName}`}
                  </button>
                </div>
              </div>
            ) : (
            <>
            <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
              <span className={step === 1 ? "font-semibold text-accent" : ""}>1. Sources</span>
              <span>→</span>
              <span className={step === 2 ? "font-semibold text-accent" : ""}>2. KPI</span>
              <span>→</span>
              <span className={step === 3 ? "font-semibold text-accent" : ""}>3. Affichage</span>
            </div>

            {/* ── ÉTAPE 1 : Sources de données à croiser ── */}
            {step === 1 && (
              <div>
                <h3 className="text-base font-semibold text-slate-900">Quelles données croiser ?</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Choisis les outils à croiser — les KPIs proposés s&apos;ajustent automatiquement aux sources connectées.
                </p>

                {sources.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <p className="text-xs text-slate-500">
                      Aucun outil connecté détecté. Connecte une source dans{" "}
                      <a href="/dashboard/integration/mes-outils" className="font-medium text-accent hover:underline">Intégrations</a>{" "}
                      pour croiser des données, ou continue avec tous les KPIs de la page.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
                    {Object.entries(sourcesByCategory).map(([cat, tools]) => (
                      <div key={cat}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {tools.map((t) => {
                            const on = selected.includes(t.key);
                            return (
                              <button
                                key={t.key}
                                onClick={() => toggleSource(t.key)}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                                  on ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                <span className="text-base leading-none">{t.icon}</span>
                                <span className="min-w-0 flex-1 truncate font-medium">{t.label}</span>
                                {on && (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {selected.length > 0
                      ? `${presets.length} KPI${presets.length > 1 ? "s" : ""} disponible${presets.length > 1 ? "s" : ""}`
                      : "Aucun filtre : tous les KPIs de la page"}
                  </span>
                  <button
                    onClick={() => { setError(null); setStep(2); }}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 2 : KPI ── */}
            {step === 2 && (
              <div>
                <h3 className="text-base font-semibold text-slate-900">Quelle donnée visualiser ?</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedTools.length > 0
                    ? `KPIs calculables à partir de : ${selectedTools.map((t) => t.label).join(" · ")}.`
                    : "Choisis un KPI proposé, ou décris le tien."}
                </p>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickPreset(p)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-accent hover:bg-indigo-50/40"
                    >
                      <span className="font-medium">{p.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  ))}
                  {presets.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Aucun KPI proposé pour ces sources. Reviens en arrière pour ajuster ta sélection, ou décris un KPI personnalisé ci-dessous.
                    </p>
                  )}
                </div>

                {/* KPI personnalisé — construit sur mesure par l'agent de la page. */}
                <div className="mt-4 rounded-xl border border-dashed border-accent/40 bg-indigo-50/30 p-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    KPI personnalisé
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">Décris précisément la donnée voulue — {agentName} construira la table sur mesure.</p>
                  <textarea
                    value={customKpi}
                    onChange={(e) => setCustomKpi(e.target.value)}
                    rows={2}
                    placeholder="Ex : montant moyen des deals gagnés par mois"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                  <label className="mt-3 block text-[11px] font-medium text-slate-500">Description (optionnel)</label>
                  <p className="mt-0.5 text-[11px] text-slate-400">Précise le contexte — {agentName} en tiendra compte pour construire la table.</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Ex : ne compter que les deals gagnés, exclure les renouvellements"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={startCustom}
                      disabled={!customKpi.trim()}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Continuer →
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <button onClick={() => { setStep(1); setError(null); }} className="text-xs text-slate-400 hover:text-accent">← Changer de sources</button>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 3 : Affichage ── */}
            {step === 3 && draft && (
              <div className="space-y-4">
                {draft.custom && (
                  <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-indigo-50/40 p-3 text-xs text-slate-600">
                    <span className="text-base leading-none">✨</span>
                    <span>
                      <span className="font-semibold text-accent">{agentName}</span> va construire la table à partir de :
                      <span className="mt-1 block italic text-slate-500">« {draft.customKpi} »</span>
                      {agentPronoun} choisit automatiquement la donnée la plus fiable et calculable.
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500">{draft.custom ? "Titre (repris de ton KPI)" : "Titre"}</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                {/* Description pour l'agent — le KPI est câblé par l'agent sur la vraie donnée. */}
                {draft.custom && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Description pour {agentName} (optionnel)
                    </label>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Précise la donnée voulue. Si vide, {agentName} câble automatiquement le KPI sur la donnée la plus fiable, réelle et enrichie.
                    </p>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Ex : ne compter que les deals gagnés, exclure les renouvellements"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
                    />
                  </div>
                )}

                {!draft.custom && dims.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Grouper par</label>
                    <select
                      value={draft.group_by}
                      onChange={(e) => setDraft({ ...draft, group_by: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      {dims.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500">Affichage</label>
                  <div className="mt-1 grid grid-cols-4 gap-2">
                    {VIEWS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDraft({ ...draft, view: v.id })}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] transition ${
                          draft.view === v.id ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={v.icon} /></svg>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Période par défaut à l'ouverture de la table (hors échéances fiscales). */}
                {draft.entity !== "fiscal" && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Période</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      {PERIOD_PRESETS.filter((p) => p.id !== "custom").map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-[11px] text-slate-400">La table s&apos;ouvre sur cette période (modifiable ensuite sur la table).</p>
                  </div>
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setStep(2); setError(null); }} className="text-xs text-slate-400 hover:text-accent">
                    {draft.custom ? "← Réécrire le KPI" : "← Changer de KPI"}
                  </button>
                  <button
                    onClick={create}
                    disabled={saving || (!draft.custom && !draft.title.trim())}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {draft.custom && !saving && <span aria-hidden>✨</span>}
                    {saving
                      ? draft.custom ? `${agentName} peaufine…` : "Création…"
                      : draft.custom ? `Créer via ${agentName}` : "Créer la table"}
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
