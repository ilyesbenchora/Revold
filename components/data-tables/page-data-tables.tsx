"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableCard, type SavedTable } from "./data-table-card";
import { DataPreview } from "./blocks-manager";
import { usePageEditMode } from "./page-edit-mode";
import {
  ENTITY_DIMS,
  ENTITY_FIELDS,
  entityLabel,
  dimLabel,
  presetsForPage,
  filterPresetsBySources,
  PAGE_AGENT_KEY,
  type SourceTool,
  type TablePreset,
  type TableView,
} from "@/lib/reports/data-table-presets";
import { getAgentPersona, agentIsFeminine } from "@/lib/ai/agents/coach-personas";
import { InfoHint } from "@/components/info-hint";
import { WiredToolsRow } from "@/components/wired-tools-row";
import { BrandLogo } from "../brand-logo";
import { toolDomain } from "@/lib/integrations/tool-domains";
import {
  PERIOD_PRESETS,
  PERIOD_FROM_DESCRIPTION,
  parseStoredPeriod,
  serializeCustomPeriod,
} from "@/lib/reports/periods";

// Un KPI est déterministe (câblé précisément, sans agent) uniquement pour la
// projection pondérée, les échéances fiscales et les recettes réconciliées
// (forecastType). Tous les autres presets passent par l'agent pour être câblés
// sur la vraie donnée enrichie.
function isDeterministicPreset(p: { measure: string; entity: string; forecastType?: string }): boolean {
  return p.measure === "weighted" || p.entity === "fiscal" || !!p.forecastType;
}

// Catégories d'outils qui portent des DONNÉES à croiser. La communication
// (Slack, Teams, Gmail…) est un canal de notification, pas une source d'analyse.
const CROSSABLE_CATEGORIES = new Set(["crm", "billing", "support", "phone", "conv_intel", "files", "ads"]);

const VIEWS: { id: TableView; label: string; icon: string }[] = [
  { id: "table", label: "Tableau", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" },
  { id: "bar", label: "Barres", icon: "M3 3v18h18M8 17V9M13 17V5M18 17v-6" },
  { id: "line", label: "Courbe", icon: "M3 3v18h18M6 14l4-4 3 3 5-6" },
  { id: "donut", label: "Anneau", icon: "M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6" },
  // Bloc cockpit (style prévisionnel Trésorerie) : chiffre en héros + ventilation.
  { id: "bloc", label: "Bloc", icon: "M4 4h16v16H4zM8 9h8M8 13h5" },
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

// CTA du funnel de création / modification — dégradé fuchsia moderne.
const CTA_FUCHSIA =
  "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500";

type Draft = {
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: TableView;
  title: string;
  /** Fréquence des dimensions temporelles (day/week/month/quarter/semester/year). */
  granularity?: string;
  /** Deals · regroupement par étape : pipeline ciblé (évite les étapes homonymes). */
  pipeline?: string | null;
  /** Vrai = KPI personnalisé construit par l'agent (entité/dimension décidées en back). */
  custom?: boolean;
  customKpi?: string;
  description?: string;
  /** Recette réconciliée (délai médian cross-source) — TUILE uniquement, résolue par resolveKpiValue. */
  forecastType?: string | null;
};

/** Fréquences d'affichage des regroupements temporels (month_*). */
const GRANULARITY_OPTIONS: { id: string; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "quarter", label: "Trimestre" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Année" },
];

/** Câblage proposé par l'agent à l'étape « Vérification » (aucune table créée). */
type Proposal = {
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string;
  /** Deals uniquement : pipeline ciblé (nom ou id) — évite les étapes homonymes. */
  pipeline?: string | null;
  title: string | null;
  date_from: string | null;
  date_to: string | null;
  rowCount: number;
  agent: string;
  /** KPI en TAUX câblé par l'agent : valeur = 100 × ligne cible / total. */
  target?: string | null;
  percent_of_total?: boolean;
};

function fmtTotal(v: number, unit: string | null): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

/**
 * Évolution en POURCENTAGE (dernière période vs précédente) pour les KPIs à
 * dimension temporelle (month_*) — la preuve chiffrée qu'un KPI « Évolution
 * de … » évolue vraiment, affichée dès l'aperçu de vérification.
 */
function EvolutionBadge({ rows, groupBy }: { rows: { name: string; value: number }[]; groupBy: string }) {
  if (!groupBy.startsWith("month_") || rows.length < 2) return null;
  const prev = Number(rows[rows.length - 2]?.value) || 0;
  const last = Number(rows[rows.length - 1]?.value) || 0;
  if (prev === 0) return null;
  const pct = Math.round(((last - prev) / prev) * 1000) / 10;
  const up = pct >= 0;
  return (
    <p className={`mt-1 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {pct.toLocaleString("fr-FR")} %{" "}
      <span className="font-normal text-slate-400">
        {rows[rows.length - 1]?.name} vs {rows[rows.length - 2]?.name}
      </span>
    </p>
  );
}

/**
 * Champ « Période » du funnel (création + édition) :
 *  - « Déjà précisée dans la description » → l'agent applique la période telle
 *    que décrite dans le texte du KPI, la table n'ajoute aucun re-filtre ;
 *  - presets type HubSpot ;
 *  - « Plage de dates personnalisée » → deux dates figées (du / au).
 */
function PeriodField({
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  showDescriptionOption,
  invalid,
}: {
  period: string;
  setPeriod: (v: string) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  /** Vrai quand le KPI a une description (parcours agent). */
  showDescriptionOption: boolean;
  invalid: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">Période</label>
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
      >
        {showDescriptionOption && (
          <option value={PERIOD_FROM_DESCRIPTION}>✨ Déjà précisée dans la description</option>
        )}
        {PERIOD_PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
        <option value="custom">Plage de dates personnalisée</option>
      </select>

      {period === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-slate-400">Du</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Au</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {invalid ? (
        <p className="mt-1 text-[11px] text-rose-500">Renseigne une date de début et une date de fin (début ≤ fin).</p>
      ) : period === PERIOD_FROM_DESCRIPTION ? (
        <p className="mt-0.5 text-[11px] text-slate-400">
          L&apos;agent applique la période telle que décrite dans le KPI — aucun filtre de date supplémentaire à l&apos;ouverture.
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-slate-400">La table s&apos;ouvre sur cette période (modifiable ensuite sur la table).</p>
      )}
    </div>
  );
}

// Équipe/catégorie d'alerte associée à chaque page de tables de données.
const PAGE_ALERT_TEAM: Record<string, string> = {
  perf_ventes: "sales",
  perf_marketing: "marketing",
  audit_service_client: "csm",
  audit_paiement_facturation: "finance",
  audit_adoption: "revops",
  audit_donnees: "revops",
};

export function PageDataTables({ pageKey }: { pageKey: string }) {
  const router = useRouter();
  const allPresets = useMemo(() => presetsForPage(pageKey), [pageKey]);
  const alertTeam = PAGE_ALERT_TEAM[pageKey] ?? "revops";
  const agentName = getAgentPersona(PAGE_AGENT_KEY[pageKey]).name;
  const agentPronoun = agentIsFeminine(PAGE_AGENT_KEY[pageKey]) ? "Elle" : "Il";
  const [tables, setTables] = useState<SavedTable[]>([]);
  // ── Drag & drop des tables (mode « Personnaliser les KPIs ») : réordonner en
  // glissant, positions persistées (page_data_tables.position), optimiste. ──
  const editing = usePageEditMode();
  const [dragTableId, setDragTableId] = useState<string | null>(null);
  const [overTableId, setOverTableId] = useState<string | null>(null);
  function moveTable(fromId: string, toId: string) {
    if (fromId === toId) return;
    setTables((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((t) => t.id === fromId);
      const to = arr.findIndex((t) => t.id === toId);
      if (from < 0 || to < 0) return prev;
      arr.splice(to, 0, ...arr.splice(from, 1));
      // Persistance best-effort : position = index de chaque table.
      arr.forEach((t, i) => {
        void fetch(`/api/page-tables/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: i }),
        }).catch(() => {});
      });
      return arr;
    });
  }
  const [open, setOpen] = useState(false);
  // 1 = Sources à croiser + KPI (fusionnés sur la même étape) · 2 = Affichage
  const [step, setStep] = useState<1 | 2>(1);
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
  // Valeurs possibles : preset, "description" (déjà précisée dans la
  // description du KPI) ou "custom" (plage de dates ci-dessous).
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Étape « Vérification » : câblage proposé par l'agent + volumes par entité.
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [proposalLoading, setProposalLoading] = useState(false);
  // Total réel du câblage affiché (toutes périodes) — recalculé à chaque ajustement.
  const [verifTotal, setVerifTotal] = useState<number | null>(null);
  // Lignes du recalcul — pour l'évolution en % des câblages temporels (month_*).
  const [verifRows, setVerifRows] = useState<{ name: string; value: number }[] | null>(null);
  const [verifLoading, setVerifLoading] = useState(false);
  // Destination du KPI : tuile (rejoint la ligne de tuiles en haut de page,
  // période + pipeline conservés) ou visualisation (table/graphique/bloc,
  // section « Tables de données » à la suite des blocs).
  const [asTile, setAsTile] = useState(false);
  // Valeur de la tuile pour les SUGGESTIONS (presets) : nombre total, ou
  // POURCENTAGE d'une ligne sur le total (ex : % de contacts MQL). Les KPIs
  // personnalisés passent par l'agent, qui câble le taux lui-même.
  const [tileMode, setTileMode] = useState<"total" | "percent">("total");
  const [tileTarget, setTileTarget] = useState<string>("");
  const [tileTargetOpts, setTileTargetOpts] = useState<{ name: string; value: number }[] | null>(null);
  // Aperçu optionnel sur données réelles (presets déterministes — les KPIs
  // personnalisés ont déjà leur preuve chiffrée à l'étape Vérification).
  const [previewRows, setPreviewRows] = useState<{ name: string; value: number }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Plage personnalisée incomplète ou inversée → on bloque la sauvegarde.
  const periodInvalid =
    period === "custom" && (!customFrom || !customTo || customFrom > customTo);
  // Valeur réellement persistée dans period_preset.
  const periodValue = () =>
    period === "custom" && customFrom && customTo ? serializeCustomPeriod(customFrom, customTo) : period;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/page-tables?page_key=${encodeURIComponent(pageKey)}`);
    if (res.ok) {
      const d = await res.json();
      setTables(Array.isArray(d.tables) ? d.tables : []);
    }
  }, [pageKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // « ＋ Ajouter un bloc » (BlocksManager) crée des tables ici : on recharge.
  useEffect(() => {
    function onReload() { refresh(); }
    window.addEventListener("revold:reload-page-tables", onReload);
    return () => window.removeEventListener("revold:reload-page-tables", onReload);
  }, [refresh]);

  // Charge les outils croisables de CETTE page. Source de vérité : le mapping
  // « Outil source par page » (Paramètres → Intégrations) — l'API filtre par
  // page_key et exclut d'office la communication (Slack, Teams, Gmail…).
  // Ajouter/retirer un outil dans les paramètres se reflète ici automatiquement.
  useEffect(() => {
    let alive = true;
    fetch(`/api/integrations/connected?page_key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => {
        const tools: SourceTool[] = Array.isArray(d.tools) ? d.tools : [];
        // Double sécurité côté client sur les catégories croisables.
        if (alive) setSources(tools.filter((t) => CROSSABLE_CATEGORIES.has(t.category)));
      })
      .catch(() => { /* pas bloquant : funnel utilisable sans filtre */ });
    return () => { alive = false; };
  }, [pageKey]);

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
    setCustomFrom("");
    setCustomTo("");
    setProposal(null);
    setEntityCounts({});
    setProposalLoading(false);
    setVerifTotal(null);
    setVerifRows(null);
    setVerifLoading(false);
    setPreviewRows(null);
    setPreviewLoading(false);
    setAsTile(false);
    setTileMode("total");
    setTileTarget("");
    setTileTargetOpts(null);
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
    // Les outils croisés choisis à la création sont retrouvés tels quels.
    setSelected(table.sources ?? []);
    const stored = parseStoredPeriod(table.period_preset);
    if (stored.kind === "custom") {
      setPeriod("custom");
      setCustomFrom(stored.from);
      setCustomTo(stored.to);
    } else {
      setPeriod(stored.kind === "description" ? PERIOD_FROM_DESCRIPTION : stored.preset);
      setCustomFrom("");
      setCustomTo("");
    }
    setDraft({
      entity: table.entity,
      group_by: table.group_by,
      measure: table.measure,
      field: table.field,
      unit_mode: table.unit_mode,
      view: (table.view as TableView) || "table",
      title: table.title,
      granularity: table.granularity ?? undefined,
      pipeline: table.pipeline ?? null,
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
    setPreviewRows(null);
    // Les lignes du mode « % d'une ligne » dépendent du KPI choisi.
    setTileTarget("");
    setTileTargetOpts(null);
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
        forecastType: p.forecastType ?? null,
      });
      // Recette réconciliée = valeur unique (délai médian) → tuile imposée.
      if (p.tileOnly || p.forecastType) setAsTile(true);
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
    setStep(2);
  }

  function startCustom() {
    if (!customKpi.trim()) return;
    setError(null);
    setPreviewRows(null);
    const kpi = customKpi.trim();
    // En édition : on conserve titre + affichage existants, on met à jour le KPI.
    // En création : le titre reprend le KPI écrit ; l'agent choisit la donnée en back.
    setDraft((prev) =>
      editingId && prev
        ? { ...prev, custom: true, customKpi: kpi }
        : { entity: "", group_by: "", measure: "count", field: null, unit_mode: null, view: "table", title: kpi, custom: true, customKpi: kpi },
    );
    setStep(2);
  }

  /** Texte du KPI courant (édition : textarea ; création : draft du funnel). */
  const kpiText = () => (editingId ? customKpi : draft?.customKpi ?? customKpi).trim();

  /**
   * Étape « Vérification » : demande à l'agent une PROPOSITION de câblage
   * (aucune table créée). `preferredEntity` = l'utilisateur impose la source
   * de données depuis les alternatives affichées.
   */
  async function requestProposal(preferredEntity?: string) {
    if (proposalLoading || !kpiText()) return;
    setProposalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/page-tables/agent-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: pageKey,
          custom_kpi: kpiText(),
          description: description.trim() || undefined,
          sources: selected,
          entity: preferredEntity,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.counts) setEntityCounts(d.counts);
      if (res.ok && d.proposal) {
        setProposal(d.proposal);
        refreshVerif(d.proposal);
      } else setError(d.error || "Prévisualisation impossible.");
    } catch {
      setError("Prévisualisation impossible.");
    } finally {
      setProposalLoading(false);
    }
  }

  /**
   * Recalcule DÉTERMINISTE (toutes périodes) du câblage affiché : total réel +
   * volume de lignes. Appelé à chaque ajustement manuel (regroupement, mesure)
   * — la preuve chiffrée avant de confirmer, sans repasser par l'agent.
   */
  async function refreshVerif(p: Proposal) {
    setVerifLoading(true);
    try {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { entity: p.entity, groupBy: p.group_by, measure: p.measure, field: p.field, pipeline: p.pipeline ?? null },
          sources: selected,
          all: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.data)) {
        const total = d.data.reduce((s: number, r: { value?: number }) => s + (Number(r.value) || 0), 0);
        // KPI en taux : la preuve chiffrée est le POURCENTAGE réel (cible/total),
        // pas la somme des lignes.
        if (p.percent_of_total && p.target) {
          const tv = d.data.find((r: { name?: string }) => String(r.name ?? "").toLowerCase() === p.target!.toLowerCase());
          setVerifTotal(total > 0 ? Math.round(((Number(tv?.value) || 0) / total) * 1000) / 10 : null);
        } else {
          setVerifTotal(total);
        }
        setVerifRows(d.data);
        setProposal((prev) => (prev ? { ...prev, rowCount: Number(d.totalRows) || 0 } : prev));
      } else {
        setVerifTotal(null);
        setVerifRows(null);
      }
    } catch {
      setVerifTotal(null);
      setVerifRows(null);
    } finally {
      setVerifLoading(false);
    }
  }

  /** Ajustement manuel du câblage proposé (regroupement / mesure) → recalcul immédiat. */
  function adjustProposal(patch: Partial<Proposal>) {
    if (!proposal) return;
    const np = { ...proposal, ...patch };
    setProposal(np);
    refreshVerif(np);
  }

  /** Aperçu optionnel : recalcul réel de la spec du draft (presets déterministes). */
  async function togglePreview() {
    if (previewRows) { setPreviewRows(null); return; }
    if (!draft || previewLoading) return;
    setPreviewLoading(true);
    // ── Recette réconciliée : valeur unique (délai médian) via l'API tracking. ──
    if (draft.forecastType) {
      try {
        const res = await fetch("/api/tracking/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recon_recipe: draft.forecastType }),
        });
        const d = await res.json().catch(() => ({}));
        const v = res.ok ? d?.resolution?.current_value : null;
        setPreviewRows(typeof v === "number" ? [{ name: "Délai médian (jours)", value: v }] : []);
      } catch {
        setPreviewRows([]);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: {
            entity: draft.entity,
            groupBy: draft.group_by,
            measure: draft.measure,
            field: draft.field ?? undefined,
            pipeline: draft.pipeline ?? null,
            granularity: draft.granularity ?? null,
          },
          sources: selected,
          all: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      setPreviewRows(res.ok && Array.isArray(d.data) ? d.data : []);
    } catch {
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function create() {
    if (!draft || saving) return;

    // ── KPI personnalisé : passage obligatoire par l'étape Vérification ──
    if (draft.custom && !proposal) {
      await requestProposal();
      return;
    }

    // ── TUILE KPI : créée dans page_tiles → elle rejoint la ligne de tuiles en
    //    haut de page (« ＋ Ajouter un KPI »). La période choisie (preset relatif
    //    recalculé en continu, ou plage figée) et le pipeline ciblé sont
    //    embarqués dans l'agg_spec et rappelés sur la tuile. ──
    if (asTile && !editingId) {
      setSaving(true);
      setError(null);

      // ── Recette réconciliée (délai médian cross-source) : tuile résolue par
      //    forecast_type — pas d'agg_spec ni de période (médiane historique). ──
      if (draft.forecastType) {
        const res = await fetch("/api/page-tiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_key: pageKey,
            kind: "kpi",
            title: draft.title.trim() || "KPI",
            forecast_type: draft.forecastType,
            unit_mode: draft.unit_mode ?? "count",
          }),
        });
        const d = await res.json().catch(() => ({}));
        setSaving(false);
        if (res.ok) {
          setOpen(false);
          reset();
          router.refresh();
        } else {
          setError(d.error || "Création impossible.");
        }
        return;
      }
      const storedPeriod = periodValue();
      const tilePeriod = storedPeriod && storedPeriod !== "all" && storedPeriod !== PERIOD_FROM_DESCRIPTION ? storedPeriod : null;
      const pipelineId = draft.custom && proposal ? proposal.pipeline ?? null : draft.pipeline ?? null;
      const pipelineLabel = pipelineId
        ? (pipelineOpts ?? []).find((p) => p.id === pipelineId || p.name === pipelineId)?.name ?? pipelineId
        : null;
      const base = draft.custom && proposal
        ? {
            entity: proposal.entity, groupBy: proposal.group_by, measure: proposal.measure, field: proposal.field,
            pipeline: pipelineId, sources: selected,
            // KPI en taux câblé par l'agent : la tuile affiche le vrai pourcentage.
            ...(proposal.percent_of_total && proposal.target ? { target: proposal.target, percent_of_total: true } : {}),
          }
        : {
            entity: draft.entity, groupBy: draft.group_by, measure: draft.measure, field: draft.field,
            pipeline: pipelineId, sources: selected,
            // Suggestion en mode « % d'une ligne » : la tuile affiche le vrai taux.
            ...(tileMode === "percent" && tileTarget ? { target: tileTarget, percent_of_total: true } : {}),
          };
      const spec = {
        ...base,
        ...(tilePeriod ? { period_preset: tilePeriod } : {}),
        ...(pipelineLabel ? { pipeline_label: pipelineLabel } : {}),
      };
      const tileUnit = draft.custom && proposal
        ? proposal.unit_mode
        : tileMode === "percent" && tileTarget ? "percent" : draft.unit_mode;
      const res = await fetch("/api/page-tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_key: pageKey,
          kind: "kpi",
          title: draft.title.trim() || proposal?.title || kpiText() || "KPI",
          agg_spec: spec,
          unit_mode: tileUnit ?? "count",
        }),
      });
      const d = await res.json().catch(() => ({}));
      setSaving(false);
      if (res.ok) {
        setOpen(false);
        reset();
        // Les tuiles sont rendues côté serveur (ConfigurableKpiTiles) : refresh.
        router.refresh();
      } else {
        setError(d.error || "Création impossible.");
      }
      return;
    }

    setSaving(true);
    setError(null);

    // Période « déjà précisée dans la description » : si l'agent a extrait des
    // dates absolues, on les fige en plage personnalisée (comportement identique
    // à l'ancien agent-create).
    let periodPreset = periodValue();
    if (periodPreset === PERIOD_FROM_DESCRIPTION && proposal?.date_from && proposal?.date_to) {
      periodPreset = serializeCustomPeriod(proposal.date_from, proposal.date_to);
    }

    // ── ÉDITION : la spec confirmée est appliquée telle quelle (pas d'agent) ──
    if (editingId) {
      const res = await fetch(`/api/page-tables/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          view: draft.view,
          period_preset: periodPreset,
          custom_kpi: customKpi.trim(),
          description: description.trim(),
          sources: selected,
          granularity: draft.granularity ?? null,
          spec: proposal
            ? { entity: proposal.entity, group_by: proposal.group_by, measure: proposal.measure, field: proposal.field, unit_mode: proposal.unit_mode, pipeline: proposal.pipeline ?? null }
            : undefined,
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
    // KPI personnalisé confirmé : la spec validée à l'écran est créée telle
    // quelle. Presets déterministes : payload direct (comme avant).
    const payload = draft.custom && proposal
      ? {
          page_key: pageKey,
          title: draft.title.trim() || proposal.title || kpiText(),
          entity: proposal.entity,
          group_by: proposal.group_by,
          measure: proposal.measure,
          field: proposal.field,
          unit_mode: proposal.unit_mode,
          pipeline: proposal.pipeline ?? null,
          granularity: draft.granularity ?? null,
          view: draft.view,
          period_preset: periodPreset,
          sources: selected,
          custom_kpi: kpiText(),
          description: description.trim() || undefined,
        }
      : { page_key: pageKey, ...draft, period_preset: periodPreset, sources: selected };
    const res = await fetch("/api/page-tables", {
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

  // ── Lignes réelles du regroupement (mode « % d'une ligne » des tuiles) :
  //    chargées à la demande pour choisir la ligne cible du taux. ──
  useEffect(() => {
    if (!asTile || tileMode !== "percent" || !draft || draft.custom || tileTargetOpts !== null) return;
    let alive = true;
    fetch("/api/reports/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { entity: draft.entity, groupBy: draft.group_by, measure: draft.measure, field: draft.field ?? undefined, pipeline: draft.pipeline ?? null },
        sources: selected,
        all: true,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        const rows = ok && Array.isArray(d.data) ? (d.data as { name: string; value: number }[]).filter((r) => r.name) : [];
        setTileTargetOpts(rows);
        if (rows.length > 0) setTileTarget((prev) => (prev && rows.some((r) => r.name === prev) ? prev : rows[0].name));
      })
      .catch(() => alive && setTileTargetOpts([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asTile, tileMode, draft?.entity, draft?.group_by, draft?.measure, draft?.field, draft?.pipeline, tileTargetOpts]);

  // ── Pipelines de deals (sélecteur « Pipeline » du regroupement par étape) :
  //    chargés à la demande dès qu'un regroupement par étape est en jeu. ──
  const [pipelineOpts, setPipelineOpts] = useState<{ id: string; name: string }[] | null>(null);
  const needsPipeline =
    (draft?.entity === "deals" && draft.group_by === "stage") ||
    (proposal?.entity === "deals" && proposal.group_by === "stage");
  useEffect(() => {
    if (!needsPipeline || pipelineOpts !== null) return;
    let alive = true;
    fetch("/api/pipelines")
      .then((r) => (r.ok ? r.json() : { pipelines: [] }))
      .then((d) => alive && setPipelineOpts(Array.isArray(d.pipelines) ? d.pipelines : []))
      .catch(() => alive && setPipelineOpts([]));
    return () => { alive = false; };
  }, [needsPipeline, pipelineOpts]);

  return (
    <section className="space-y-4">
      {/* Pas d'en-tête de section : les visualisations créées s'enchaînent
          directement avec les graphiques du haut de page — seul le CTA de
          création vit en bas de page. */}
      {editing && tables.length > 1 && (
        <p className="text-right text-[11px] text-slate-400">⠿ Glisse les tables pour choisir leur ordre.</p>
      )}
      {tables.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tables.map((t) => (
            <div
              key={t.id}
              draggable={editing}
              onDragStart={(e) => {
                setDragTableId(t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (editing && dragTableId && dragTableId !== t.id) {
                  e.preventDefault();
                  setOverTableId(t.id);
                }
              }}
              onDragLeave={() => setOverTableId((k) => (k === t.id ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragTableId) moveTable(dragTableId, t.id);
                setDragTableId(null);
                setOverTableId(null);
              }}
              onDragEnd={() => {
                setDragTableId(null);
                setOverTableId(null);
              }}
              className={
                editing
                  ? `rounded-2xl ring-2 transition ${
                      overTableId === t.id && dragTableId && dragTableId !== t.id
                        ? "ring-fuchsia-300"
                        : dragTableId === t.id
                          ? "opacity-60 ring-fuchsia-200"
                          : "ring-transparent"
                    } cursor-grab active:cursor-grabbing`
                  : undefined
              }
            >
              <DataTableCard
                table={t}
                team={alertTeam}
                onEdit={openEdit}
                onUpdated={(nt) => setTables((prev) => prev.map((x) => (x.id === nt.id ? nt : x)))}
                onDeleted={(id) => setTables((prev) => prev.filter((x) => x.id !== id))}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={() => { reset(); setOpen(true); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${CTA_FUCHSIA}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Créer une table de données
        </button>
      </div>

      {/* Builder */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {proposal && draft ? (
              /* ── VÉRIFICATION : l'agent propose, l'utilisateur confirme ou corrige la source ── */
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                    <span aria-hidden>✨</span> Vérification du câblage
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {proposal.agent} propose la donnée ci-dessous pour « {kpiText()} ». Confirme, ou choisis une autre source de données.
                  </p>
                </div>

                <div className="rounded-xl border border-accent/30 bg-indigo-50/40 p-4">
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">Source de données</dt>
                      <dd className="font-semibold text-slate-900">{entityLabel(proposal.entity)}</dd>
                    </div>
                    {/* Outil(s) connecté(s) qui alimentent cette entité. */}
                    <WiredToolsRow entity={proposal.entity} sourceKeys={selected} />
                    {(proposal.pipeline || (proposal.entity === "deals" && proposal.group_by === "stage")) && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-1 text-xs text-slate-500">
                          Pipeline
                          <InfoHint text="La table est restreinte à CE pipeline : les étapes affichées sont uniquement les siennes (pas de mélange avec les étapes homonymes des autres pipelines)." />
                        </dt>
                        <dd className="min-w-0">
                          <select
                            value={proposal.pipeline ?? ""}
                            disabled={proposalLoading || verifLoading}
                            onChange={(e) => adjustProposal({ pipeline: e.target.value || null })}
                            className="w-full max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                          >
                            <option value="">Tous les pipelines (étapes mélangées)</option>
                            {(pipelineOpts ?? []).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            {proposal.pipeline && !(pipelineOpts ?? []).some((p) => p.id === proposal.pipeline) && (
                              <option value={proposal.pipeline}>{proposal.pipeline}</option>
                            )}
                          </select>
                        </dd>
                      </div>
                    )}
                    {/* Regroupement temporel → fréquence de l'axe (persistée sur la table). */}
                    {proposal.group_by.startsWith("month_") && draft && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-1 text-xs text-slate-500">
                          Fréquence
                          <InfoHint text="Granularité de l'axe temporel : jour, semaine, mois, trimestre, semestre ou année. Modifiable ensuite directement sur le rapport, à côté de la période." />
                        </dt>
                        <dd className="min-w-0">
                          <select
                            value={draft.granularity ?? "month"}
                            disabled={proposalLoading || verifLoading}
                            onChange={(e) => setDraft({ ...draft, granularity: e.target.value })}
                            className="w-full max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                          >
                            {GRANULARITY_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                        </dd>
                      </div>
                    )}
                    {/* Regroupement et mesure ÉDITABLES : si le KPI est ambigu
                        (« paiements » = encaissements ? flux net ?), l'utilisateur
                        corrige ici — le total se recalcule immédiatement. */}
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                        Regroupement
                        <InfoHint text="Définit les LIGNES de ta table (ou l'axe horizontal du graphique) : une ligne par mois, par statut, par catégorie… C'est la 1ʳᵉ colonne de la table." />
                      </dt>
                      <dd className="min-w-0">
                        {(() => {
                          const dims = ENTITY_DIMS[proposal.entity] ?? [];
                          const opts = dims.some((d) => d.id === proposal.group_by)
                            ? dims
                            : [{ id: proposal.group_by, label: dimLabel(proposal.entity, proposal.group_by) }, ...dims];
                          return (
                            <select
                              value={proposal.group_by}
                              disabled={proposalLoading || verifLoading}
                              onChange={(e) => adjustProposal({ group_by: e.target.value })}
                              className="w-full max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                            >
                              {opts.map((d) => (
                                <option key={d.id} value={d.id}>{d.label}</option>
                              ))}
                            </select>
                          );
                        })()}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                        Mesure
                        <InfoHint text="Définit la colonne « Valeur » : le chiffre calculé pour chaque ligne (nombre d'éléments, ou somme/moyenne du champ choisi). C'est la hauteur des barres / points de la courbe." />
                      </dt>
                      <dd className="min-w-0">
                        {(() => {
                          const fields = ENTITY_FIELDS[proposal.entity] ?? [];
                          const cur = `${proposal.measure}:${proposal.field ?? ""}`;
                          return (
                            <select
                              value={cur}
                              disabled={proposalLoading || verifLoading}
                              onChange={(e) => {
                                const [measure, field] = e.target.value.split(":");
                                const f = field || null;
                                const unit = measure === "count" ? "count" : fields.find((x) => x.id === f)?.unit ?? proposal.unit_mode;
                                adjustProposal({ measure, field: f, unit_mode: unit });
                              }}
                              className="w-full max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-accent"
                            >
                              <option value="count:">Nombre de lignes</option>
                              {fields.map((f) => (
                                <optgroup key={f.id} label={f.label}>
                                  <option value={`sum:${f.id}`}>Somme · {f.label}</option>
                                  <option value={`avg:${f.id}`}>Moyenne · {f.label}</option>
                                </optgroup>
                              ))}
                              {proposal.measure === "weighted" && (
                                <option value={cur}>Projection pondérée</option>
                              )}
                            </select>
                          );
                        })()}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">Données trouvées</dt>
                      <dd className={`font-semibold ${proposal.rowCount > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {verifLoading ? "…" : proposal.rowCount > 0 ? `${new Intl.NumberFormat("fr-FR").format(proposal.rowCount)} ligne${proposal.rowCount > 1 ? "s" : ""}` : "0 ligne"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-slate-500">
                        {proposal.percent_of_total ? `Taux calculé (${proposal.target ?? "cible"} / total)` : "Total calculé (toutes périodes)"}
                      </dt>
                      <dd className={`font-semibold ${verifTotal != null && verifTotal !== 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {verifLoading ? "…" : verifTotal != null ? fmtTotal(verifTotal, proposal.unit_mode) : "—"}
                      </dd>
                    </div>
                    {/* Câblage temporel : l'évolution en % — la preuve qu'on suit bien une évolution. */}
                    {!verifLoading && proposal.group_by.startsWith("month_") && verifRows && verifRows.length > 1 && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-slate-500">Évolution</dt>
                        <dd>
                          <EvolutionBadge rows={verifRows} groupBy={proposal.group_by} />
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {proposal.rowCount === 0 && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    Aucune donnée sur cette source pour tes outils sélectionnés — la table serait vide. Choisis une autre source ci-dessous, ou vérifie tes synchronisations.
                  </p>
                )}

                {Object.keys(entityCounts).filter((e) => e !== proposal.entity).length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Autres sources de données possibles</label>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      En choisir une impose la source : {proposal.agent} recâble le KPI dessus.
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(entityCounts)
                        .filter(([e]) => e !== proposal.entity)
                        .sort(([, a], [, b]) => b - a)
                        .map(([e, n]) => (
                          <button
                            key={e}
                            type="button"
                            disabled={proposalLoading}
                            onClick={() => requestProposal(e)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                              n > 0
                                ? "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                                : "border-slate-100 bg-slate-50 text-slate-400"
                            }`}
                          >
                            {entityLabel(e)} · {new Intl.NumberFormat("fr-FR").format(n)}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setProposal(null); setError(null); }}
                    className="text-xs text-slate-400 hover:text-fuchsia-600"
                  >
                    ← Réécrire le KPI
                  </button>
                  <button
                    onClick={create}
                    disabled={saving || proposalLoading}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${CTA_FUCHSIA} disabled:opacity-50`}
                  >
                    {saving
                      ? "Enregistrement…"
                      : proposalLoading
                        ? `${proposal.agent} recâble…`
                        : editingId ? "Confirmer la mise à jour" : "Confirmer et créer"}
                  </button>
                </div>
              </div>
            ) : editingId && draft ? (
              /* ── ÉDITION : agent uniquement (KPI + affichage) ── */
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Modifier la table</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {agentName} met à jour la donnée selon ton KPI. Le titre se renomme directement sur la table.
                  </p>
                </div>

                {/* Outils croisés — retrouvés depuis la création, modifiables ici.
                    Un changement relance l'agent pour recâbler la donnée. */}
                {sources.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">Outils croisés</label>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Les données de la table sont limitées à ces outils. Modifier la sélection recâble la donnée.
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {sources.map((t) => {
                        const on = selected.includes(t.key);
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => toggleSource(t.key)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                              on
                                ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <BrandLogo domain={toolDomain(t.key)} alt={t.label} fallback={t.icon} size={13} />
                            {t.label}
                            {on && <span className="text-fuchsia-500">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  <PeriodField
                    period={period}
                    setPeriod={setPeriod}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                    showDescriptionOption
                    invalid={periodInvalid}
                  />
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-slate-400 hover:text-accent">Annuler</button>
                  <button
                    onClick={create}
                    disabled={saving || proposalLoading || !customKpi.trim() || periodInvalid}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${CTA_FUCHSIA} disabled:opacity-50`}
                  >
                    {!saving && !proposalLoading && <span aria-hidden>✨</span>}
                    {proposalLoading ? `${agentName} analyse…` : saving ? "Enregistrement…" : `Vérifier via ${agentName}`}
                  </button>
                </div>
              </div>
            ) : (
            <>
            <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
              <span className={step === 1 ? "font-semibold text-fuchsia-600" : ""}>1. Données &amp; KPI</span>
              <span>→</span>
              <span className={step === 2 ? "font-semibold text-fuchsia-600" : ""}>2. Affichage</span>
            </div>

            {/* ── ÉTAPE 1 : Données à croiser (haut) + KPI (bas) ── */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Données à croiser — thème fuchsia */}
                <div className="rounded-2xl border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50/70 via-white to-white p-4">
                  <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                    <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500" />
                    Quelles données croiser ?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Choisis les outils à croiser — les KPIs proposés ci-dessous s&apos;ajustent automatiquement aux sources connectées.{" "}
                    <a href="/dashboard/parametres/integrations" className="font-medium text-fuchsia-600 hover:underline">
                      Gérer les outils de cette page →
                    </a>
                  </p>

                  {sources.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-fuchsia-300/70 bg-fuchsia-50/40 p-4 text-center">
                      <p className="text-xs text-slate-500">
                        Aucun outil connecté détecté. Connecte une source dans{" "}
                        <a href="/dashboard/integration/mes-outils" className="font-medium text-fuchsia-600 hover:underline">Intégrations</a>{" "}
                        pour croiser des données, ou choisis un KPI ci-dessous.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 max-h-52 space-y-4 overflow-y-auto pr-1">
                      {Object.entries(sourcesByCategory).map(([cat, tools]) => (
                        <div key={cat}>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-500/80">
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
                                    on ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                                  }`}
                                >
                                  <BrandLogo domain={toolDomain(t.key)} alt={t.label} fallback={t.icon} size={16} />
                                  <span className="min-w-0 flex-1 truncate font-medium">{t.label}</span>
                                  {on && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-600"><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 text-[11px] font-medium text-fuchsia-600/90">
                    {selected.length > 0
                      ? `${selectedTools.map((t) => t.label).join(" · ")} — ${presets.length} KPI${presets.length > 1 ? "s" : ""} adapté${presets.length > 1 ? "s" : ""}`
                      : "Aucun filtre : tous les KPIs de la page sont proposés"}
                  </p>
                </div>

                {/* Suggestions de KPI — en dessous des données à croiser */}
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Quelle donnée visualiser ?</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedTools.length > 0
                      ? `KPIs calculables à partir de : ${selectedTools.map((t) => t.label).join(" · ")}.`
                      : "Choisis un KPI proposé, ou décris le tien."}
                  </p>

                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => pickPreset(p)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-fuchsia-400 hover:bg-fuchsia-50/40"
                      >
                        <span className="font-medium">{p.label}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))}
                    {presets.length === 0 && (
                      <p className="text-xs text-slate-400">
                        Aucun KPI proposé pour ces sources. Ajuste ta sélection ci-dessus, ou décris un KPI personnalisé ci-dessous.
                      </p>
                    )}
                  </div>

                  {/* KPI personnalisé — construit sur mesure par l'agent de la page. */}
                  <div className="mt-4 rounded-xl border border-dashed border-fuchsia-300/60 bg-fuchsia-50/30 p-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      KPI personnalisé
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">Décris précisément la donnée voulue — {agentName} construira la table sur mesure.</p>
                    <textarea
                      value={customKpi}
                      onChange={(e) => setCustomKpi(e.target.value)}
                      rows={2}
                      placeholder="Ex : montant moyen des deals gagnés par mois"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-fuchsia-400"
                    />
                    <label className="mt-3 block text-[11px] font-medium text-slate-500">Description (optionnel)</label>
                    <p className="mt-0.5 text-[11px] text-slate-400">Précise le contexte — {agentName} en tiendra compte pour construire la table.</p>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Ex : ne compter que les deals gagnés, exclure les renouvellements"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-fuchsia-400"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={startCustom}
                        disabled={!customKpi.trim()}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${CTA_FUCHSIA} disabled:opacity-50`}
                      >
                        Continuer →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 2 : Affichage ── */}
            {step === 2 && draft && (
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
                      onChange={(e) => { setDraft({ ...draft, group_by: e.target.value, pipeline: e.target.value === "stage" ? draft.pipeline : null }); setTileTarget(""); setTileTargetOpts(null); }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      {dims.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Regroupement par étape → CHOIX DU PIPELINE : sans lui, les
                    étapes homonymes de tous les pipelines seraient mélangées. */}
                {!draft.custom && draft.entity === "deals" && draft.group_by === "stage" && (
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      Pipeline
                      <InfoHint text="Restreint la table à CE pipeline : les étapes affichées sont uniquement les siennes. « Tous » mélange les étapes homonymes de tous les pipelines." />
                    </label>
                    <select
                      value={draft.pipeline ?? ""}
                      onChange={(e) => setDraft({ ...draft, pipeline: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      <option value="">Tous les pipelines (étapes mélangées)</option>
                      {(pipelineOpts ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Regroupement temporel → FRÉQUENCE de l'axe (jour, semaine,
                    mois, trimestre, semestre, année). */}
                {!draft.custom && draft.group_by.startsWith("month_") && (
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      Fréquence
                      <InfoHint text="Granularité de l'axe temporel : une barre / un point par jour, semaine, mois, trimestre, semestre ou année. Modifiable ensuite directement sur le rapport, à côté de la période." />
                    </label>
                    <select
                      value={draft.granularity ?? "month"}
                      onChange={(e) => setDraft({ ...draft, granularity: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
                    >
                      {GRANULARITY_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-500">Affichage</label>
                  {draft.forecastType ? (
                    // Recette réconciliée = une valeur unique (délai médian) : tuile imposée.
                    <p className="mt-0.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      Délai médian mesuré par le moteur de rapprochement (jointures réelles entre tes outils) —
                      ce KPI s&apos;ajoute en <span className="font-semibold">tuile</span>, à la ligne de KPIs en haut de page.
                    </p>
                  ) : (
                  <>
                  {/* Tuile KPI = chiffre simple, ajoutée À LA SUITE DES TUILES du haut
                      (là où « ＋ Ajouter un KPI »). Le Bloc, plus riche (chiffre héros
                      + ventilation), et les autres visualisations s'ajoutent à la
                      suite des blocs de la page, dans « Tables de données ». */}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Tuile KPI = rejoint la ligne de tuiles en haut de page. Les autres visualisations s&apos;ajoutent à la suite des blocs.
                  </p>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAsTile(true)}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] transition ${
                        asTile ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M8 11h5M8 14h8" /></svg>
                      Tuile KPI
                    </button>
                    {VIEWS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => { setAsTile(false); setDraft({ ...draft, view: v.id }); }}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] transition ${
                          !asTile && draft.view === v.id ? "border-accent bg-indigo-50/60 text-accent" : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={v.icon} /></svg>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  </>
                  )}
                  {asTile && !draft.forecastType && (
                    <div className="mt-1.5 space-y-2 rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">
                        La tuile garde la période et le pipeline choisis : ils sont rappelés dessus, et un preset
                        (« ce trimestre »…) suit automatiquement la période courante.
                      </p>
                      {/* Suggestions (presets) : valeur en NOMBRE total ou en % d'une
                          ligne sur le total — l'évolution suit la même unité. */}
                      {!draft.custom && (
                        <div className="space-y-1.5">
                          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                            {([
                              { id: "total", label: "Nombre (total)" },
                              { id: "percent", label: "% d'une ligne" },
                            ] as const).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setTileMode(m.id)}
                                className={`flex-1 py-1.5 text-[11px] font-medium transition ${
                                  tileMode === m.id ? "bg-accent text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          {tileMode === "percent" && (
                            tileTargetOpts === null ? (
                              <p className="text-[11px] text-slate-400">Chargement des lignes…</p>
                            ) : tileTargetOpts.length === 0 ? (
                              <p className="text-[11px] text-rose-500">Aucune ligne disponible pour ce regroupement.</p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={tileTarget}
                                  onChange={(e) => setTileTarget(e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-accent"
                                >
                                  {tileTargetOpts.map((r) => (
                                    <option key={r.name} value={r.name}>{r.name}</option>
                                  ))}
                                </select>
                                {(() => {
                                  const totalAll = tileTargetOpts.reduce((s, r) => s + (Number(r.value) || 0), 0);
                                  const tv = tileTargetOpts.find((r) => r.name === tileTarget)?.value ?? 0;
                                  const pct = totalAll > 0 ? Math.round((tv / totalAll) * 1000) / 10 : null;
                                  return (
                                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-800">
                                      {pct != null ? `${pct.toLocaleString("fr-FR")} %` : "—"}
                                    </span>
                                  );
                                })()}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Aperçu OPTIONNEL sur données réelles (presets déterministes — les
                    KPIs personnalisés ont leur preuve chiffrée à la Vérification). */}
                {!draft.custom && (
                  <div>
                    <button
                      type="button"
                      onClick={togglePreview}
                      disabled={previewLoading}
                      className="text-xs font-medium text-fuchsia-600 hover:underline disabled:opacity-50"
                    >
                      {previewLoading ? "Calcul de l'aperçu…" : previewRows ? "Masquer l'aperçu" : "👁 Aperçu sur tes données (optionnel)"}
                    </button>
                    {previewRows && previewRows.length === 0 && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                        Aucune donnée pour ce KPI pour le moment.
                      </p>
                    )}
                    {previewRows && previewRows.length > 0 && (
                      asTile ? (
                        <div className="mt-2 w-56 rounded-xl border border-slate-200 bg-white p-4">
                          <p className="truncate text-[11px] font-medium text-slate-500">{draft.title || "Tuile KPI"}</p>
                          <p className="mt-1 text-xl font-bold tabular-nums text-indigo-600">
                            {fmtTotal(previewRows.reduce((s, r) => s + (Number(r.value) || 0), 0), draft.unit_mode)}
                          </p>
                          <EvolutionBadge rows={previewRows} groupBy={draft.group_by} />
                        </div>
                      ) : (
                        <div className="mt-2 rounded-xl border border-slate-100 p-3">
                          <EvolutionBadge rows={previewRows} groupBy={draft.group_by} />
                          <DataPreview rows={previewRows} view={draft.view} unit={draft.unit_mode ?? "count"} />
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Période par défaut à l'ouverture de la table (hors échéances
                    fiscales et recettes réconciliées : médiane historique). */}
                {draft.entity !== "fiscal" && !draft.forecastType && (
                  <PeriodField
                    period={period}
                    setPeriod={setPeriod}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                    showDescriptionOption={!!draft.custom}
                    invalid={periodInvalid}
                  />
                )}

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setStep(1); setError(null); }} className="text-xs text-slate-400 hover:text-fuchsia-600">
                    {draft.custom ? "← Réécrire le KPI" : "← Changer de KPI / sources"}
                  </button>
                  <button
                    onClick={create}
                    disabled={saving || proposalLoading || (!draft.custom && !draft.title.trim()) || periodInvalid}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${CTA_FUCHSIA} disabled:opacity-50`}
                  >
                    {draft.custom && !saving && !proposalLoading && <span aria-hidden>✨</span>}
                    {proposalLoading
                      ? `${agentName} analyse…`
                      : saving
                        ? "Création…"
                        : draft.custom && !proposal ? `Vérifier via ${agentName}` : asTile ? "Créer la tuile" : "Créer la table"}
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
