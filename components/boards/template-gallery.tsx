"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BoardTemplateGalleryItem } from "@/lib/boards/board-templates";
import { TemplatePreview } from "@/components/boards/template-preview";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Galerie des templates de tableaux de bord (Dashboard → Tableaux de bord →
 * Templates). Chaque carte montre la composition (tuiles + tables) dérivée des
 * pages de données existantes ; « Utiliser ce template » crée un tableau seedé
 * avec cette composition. Les templates dont les entités n'ont aucune donnée
 * synchronisée restent visibles mais désactivés (ils montrent ce que
 * débloquerait la connexion d'un outil).
 */

const ENTITY_LABELS: Record<string, string> = {
  deals: "Deals",
  invoices: "Factures",
  subscriptions: "Abonnements",
  transactions: "Transactions",
  tickets: "Tickets",
  contacts: "Contacts",
  companies: "Entreprises",
};

export function TemplateGallery({ items }: { items: BoardTemplateGalleryItem[] }) {
  const router = useRouter();
  const [using, setUsing] = useState<BoardTemplateGalleryItem | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!using || busy) return;
    const n = (name.trim() || using.label).slice(0, 60);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, template: using.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.board?.id) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      router.push(`/dashboard/tableaux-de-bord/${d.board.id}`);
      router.refresh();
    } catch {
      setError("Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  // ── Regroupement PAR ÉQUIPE, propositions croisées (multi-outils) en tête
  //    de chaque groupe. Ordre des équipes fixe, groupes vides masqués. ──
  const TEAM_ORDER = ["Ventes", "Marketing", "Trésorerie", "Service client", "Qualité de données"] as const;
  const groups = TEAM_ORDER.map((team) => ({
    team,
    items: items.filter((t) => t.team === team).sort((a, b) => Number(b.cross) - Number(a.cross)),
  })).filter((g) => g.items.length > 0);

  const renderCard = (t: BoardTemplateGalleryItem) => (
    <div
      key={t.id}
      className={`flex flex-col rounded-2xl border bg-white p-5 ${
        t.available ? "border-slate-200" : "border-dashed border-slate-200 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{t.label}</h3>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {t.cross && (
            <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
              Outils croisés
            </span>
          )}
          {t.entities.map((e) => (
            <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {ENTITY_LABELS[e] ?? e}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{t.description}</p>

      {/* Les OUTILS dont les données alimentent ce template (logos). */}
      {t.tools.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Données</span>
          {t.tools.map((tool) => (
            <span
              key={tool.key}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              title={`Données ${tool.label} dans ce template`}
            >
              <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={12} />
              {tool.label}
            </span>
          ))}
        </div>
      )}

      {/* Aperçu visuel : le mini-dashboard que ce template installe. */}
      <div className="mt-3">
        <TemplatePreview id={t.id} tiles={t.previewTiles} tables={t.previewTables} />
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        {t.tileTitles.length} tuile{t.tileTitles.length > 1 ? "s" : ""}
        {t.tableTitles.length > 0 && (
          <> · {t.tableTitles.length} visualisation{t.tableTitles.length > 1 ? "s" : ""}</>
        )}{" "}
        — aperçu illustratif, tes vraies données au premier affichage.
      </p>

      <div className="mt-3 flex flex-1 items-end">
        {t.available ? (
          <button
            type="button"
            onClick={() => { setUsing(t); setName(t.label); setError(null); }}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          >
            Utiliser ce template
          </button>
        ) : (
          <p className="text-[11px] text-slate-400">
            Aucune donnée synchronisée pour {t.entities.map((e) => ENTITY_LABELS[e] ?? e).join(" + ")} — connecte un
            outil qui les porte pour l&apos;activer.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.team}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              {g.team}
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                proposé selon tes outils connectés
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map(renderCard)}
            </div>
          </section>
        ))}
      </div>

      {/* ── Modal : nom du tableau créé depuis le template ── */}
      {using && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setUsing(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">Créer « {using.label} »</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Le tableau arrive prêt : {using.tileTitles.length} tuile{using.tileTitles.length > 1 ? "s" : ""}
              {using.tableTitles.length > 0 && <> + {using.tableTitles.length} table{using.tableTitles.length > 1 ? "s" : ""}</>} —
              tout reste modifiable ensuite.
            </p>
            <label className="mt-4 block text-[11px] font-medium text-slate-500">
              Nom du tableau
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-accent focus:outline-none"
              />
            </label>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setUsing(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={create}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer le tableau"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
