"use client";

/**
 * Carrousel d'analyse exhaustive des workflows actifs HubSpot.
 *
 * Navigation flèches gauche/droite (clavier + boutons). Pour chaque
 * workflow on affiche TOUTES les infos transparentes :
 *   - Nom du workflow (exact, depuis HubSpot API)
 *   - ID HubSpot brut (pour vérification)
 *   - Source API : v3 (classic legacy) ou v4 (Workflows 2.0)
 *   - Lien direct "Voir dans HubSpot"
 *   - Nombre de records enrôlés (actifs + lifetime)
 *   - Déclencheur, actions complètes, re-enrollment, goal
 *   - Analyse contextuelle par profil + recommandations CRO
 *
 * Aucune donnée inventée : tout vient de l'API HubSpot.
 */

import { useState, useEffect, useCallback } from "react";
import type { WorkflowDetail } from "@/lib/integrations/hubspot-workflows";

const SEV_STYLE: Record<"critical" | "warning" | "info", { bg: string; text: string; border: string; emoji: string }> = {
  critical: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", emoji: "🔴" },
  warning: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", emoji: "🟠" },
  info: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", emoji: "🔵" },
};

const ACTION_COLOR: Record<string, string> = {
  set_property: "bg-indigo-100 text-indigo-700",
  send_email: "bg-blue-100 text-blue-700",
  create_task: "bg-amber-100 text-amber-800",
  webhook: "bg-fuchsia-100 text-fuchsia-700",
  branch: "bg-violet-100 text-violet-700",
  delay: "bg-slate-100 text-slate-600",
  create_engagement: "bg-emerald-100 text-emerald-700",
  update_owner: "bg-orange-100 text-orange-700",
  other: "bg-slate-100 text-slate-600",
};

const OBJECT_LABEL: Record<string, string> = {
  contact: "Contact", company: "Entreprise", deal: "Transaction",
  ticket: "Ticket", lead: "Lead", custom: "Custom Object", unknown: "Inconnu",
};

const OBJECT_PLURAL: Record<string, string> = {
  contact: "contacts", company: "entreprises", deal: "transactions",
  ticket: "tickets", lead: "leads", custom: "records", unknown: "records",
};

export function WorkflowCarousel({ details }: { details: WorkflowDetail[] }) {
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | "v3" | "v4">("all");

  const filtered = details.filter((d) => {
    if (filter === "v3") return d.apiSource === "v3";
    if (filter === "v4") return d.apiSource === "v4";
    return true;
  });

  useEffect(() => { setIndex(0); }, [filter]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(filtered.length - 1, i + 1)), [filtered.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500">
          {filter === "all" ? "Aucun workflow actif détaillé." : `Aucun workflow ${filter} dans la liste.`}
        </p>
      </div>
    );
  }

  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const w = filtered[safeIndex];
  const v3Count = details.filter((d) => d.apiSource === "v3").length;
  const v4Count = details.filter((d) => d.apiSource === "v4").length;

  return (
    <div className="space-y-4">
      {/* Filter source + navigation + position */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-1 text-xs">
          <span className="mr-2 font-semibold text-slate-700">Filtrer par source API :</span>
          {([
            ["all", `Tous (${details.length})`],
            ["v3", `v3 Classic (${v3Count})`],
            ["v4", `v4 Workflows 2.0 (${v4Count})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                filter === key ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={goPrev}
            disabled={safeIndex === 0}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
            aria-label="Précédent"
          >
            ← Précédent
          </button>
          <span className="text-slate-500">
            <span className="font-bold text-slate-900">{safeIndex + 1}</span> / {filtered.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={safeIndex === filtered.length - 1}
            className="rounded-md bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
            aria-label="Suivant"
          >
            Suivant →
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-400">
        💡 Astuce : utilisez les flèches ← / → du clavier pour naviguer.
      </p>

      <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <div className="p-5 space-y-4">
          {/* Header avec transparence */}
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                {OBJECT_LABEL[w.objectType] ?? w.objectType}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                w.apiSource === "v4" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
              }`}>
                API {w.apiSource}
              </span>
              {w.enabled && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  ✓ Actif
                </span>
              )}
              {w.isMultiPurpose && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  ⚠ Multi-purpose
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">{w.name}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>
                <span className="font-medium text-slate-700">ID HubSpot :</span>{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{w.id}</code>
              </span>
              {w.hubspotUrl && (
                <a
                  href={w.hubspotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  Voir le workflow dans HubSpot
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </header>

          {/* Records enrôlés */}
          {(typeof w.currentlyEnrolledCount === "number" || typeof w.lifetimeEnrolledCount === "number") && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Actuellement inscrits
                </p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">
                  {typeof w.currentlyEnrolledCount === "number" ? w.currentlyEnrolledCount.toLocaleString("fr-FR") : "—"}
                </p>
                <p className="text-[10px] text-slate-500">
                  {OBJECT_PLURAL[w.objectType] ?? "records"} dans le workflow
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Lifetime (depuis création)
                </p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">
                  {typeof w.lifetimeEnrolledCount === "number" ? w.lifetimeEnrolledCount.toLocaleString("fr-FR") : "—"}
                </p>
                <p className="text-[10px] text-slate-500">
                  Total {OBJECT_PLURAL[w.objectType] ?? "records"} jamais enrôlés
                </p>
              </div>
            </div>
          )}

          {/* Configuration */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Déclencheur</p>
              <p className="mt-1 text-xs text-slate-800">{w.triggerDescription}</p>
              {w.triggerCriteriaCount > 0 && (
                <p className="mt-1 text-[10px] text-slate-400">{w.triggerCriteriaCount} critère{w.triggerCriteriaCount > 1 ? "s" : ""}</p>
              )}
            </div>
            <div className={`rounded-lg border p-3 ${w.reenrollmentEnabled ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Re-enrollment</p>
              <p className={`mt-1 text-sm font-bold ${w.reenrollmentEnabled ? "text-emerald-700" : "text-amber-700"}`}>
                {w.reenrollmentEnabled ? "✓ Activé" : "✗ Désactivé"}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {w.reenrollmentEnabled ? "Les records peuvent re-passer" : "Un record ne peut pas re-passer"}
              </p>
            </div>
            <div className={`rounded-lg border p-3 ${w.hasGoal ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Objectif (goal)</p>
              <p className={`mt-1 text-sm font-bold ${w.hasGoal ? "text-emerald-700" : "text-amber-700"}`}>
                {w.hasGoal ? "🎯 Défini" : "✗ Aucun"}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {w.goalDescription ?? "Sortie automatique non paramétrée"}
              </p>
            </div>
          </div>

          {/* Séquence d'actions */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Séquence d&apos;actions ({w.actions.length})
            </p>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <ol className="divide-y divide-slate-100">
                {w.actions.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${ACTION_COLOR[a.category] ?? ACTION_COLOR.other}`}>
                      {a.category}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-700">{a.description}</p>
                  </li>
                ))}
                {w.actions.length === 0 && (
                  <li className="px-3 py-3 text-xs text-slate-400">
                    L&apos;API HubSpot n&apos;a renvoyé aucune action pour ce workflow.
                  </li>
                )}
              </ol>
            </div>
          </div>

          {/* Analyse du workflow */}
          {w.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">
                ✨ Analyse du workflow
              </p>
              {w.recommendations.map((r, i) => {
                const sev = SEV_STYLE[r.severity];
                return (
                  <div key={i} className={`rounded-lg border ${sev.border} ${sev.bg} p-3`}>
                    <p className={`text-xs font-bold ${sev.text}`}>
                      {sev.emoji} {r.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{r.body}</p>
                    {r.recommendation && (
                      <p className="mt-1.5 text-[11px] font-medium text-slate-900">
                        → {r.recommendation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
