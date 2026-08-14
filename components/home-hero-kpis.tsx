"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type HomeKpi = {
  id: string;
  label: string;
  /** Valeur déjà formatée côté serveur. */
  value: string;
  /** Sous-texte optionnel (ex : « Gérer → »). */
  hint?: string;
  href: string;
  /** Classe de couleur de la valeur (ex : text-fuchsia-600). */
  color: string;
};

/** Suggestion personnalisée du catalogue complet (« ＋ Plus de KPIs »). */
export type HomeKpiSuggestion = {
  id: string;
  label: string;
  description?: string;
  group: string;
};

const MAX_KPIS = 5;

const GROUP_LABELS: Record<string, string> = {
  sales: "💼 Ventes",
  marketing: "📣 Marketing",
  cs: "🤝 Service client",
  revops: "🎯 RevOps",
  ops: "🗄️ Données",
  billing: "💳 Facturation & trésorerie",
  support: "🎧 Support",
};

/**
 * Bloc héro de la home : KPIs essentiels PERSONNALISABLES — « Personnaliser »
 * permet de retirer des tuiles et d'en ajouter, soit depuis le catalogue
 * rapide (volumes réels), soit depuis la LISTE EXHAUSTIVE des suggestions par
 * pôle (« ＋ Plus de KPIs »), avec un plafond de 5 affichées. Sélection
 * persistée par organisation (page_tiles, page_key « home_hero »).
 */
export function HomeHeroKpis({
  kpis,
  initialSelected,
  suggestions = [],
}: {
  kpis: HomeKpi[];
  initialSelected: string[];
  suggestions?: HomeKpiSuggestion[];
}) {
  const router = useRouter();
  const byId = new Map(kpis.map((k) => [k.id, k]));
  const sugById = new Map(suggestions.map((s) => [s.id, s]));
  const [selected, setSelected] = useState<string[]>(
    initialSelected.filter((id) => byId.has(id) || sugById.has(id)).slice(0, MAX_KPIS),
  );
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tuile affichée : valeur résolue côté serveur, ou placeholder « … » le temps
  // du refresh pour une suggestion tout juste ajoutée.
  const shown = selected
    .map((id) => byId.get(id) ?? (sugById.has(id) ? { id, label: sugById.get(id)!.label, value: "…", href: "#", color: "text-indigo-600" } : null))
    .filter((k): k is HomeKpi => Boolean(k));
  const availableQuick = kpis.filter((k) => !selected.includes(k.id) && !k.id.startsWith("sug:"));
  const availableSuggestions = suggestions.filter((s) => !selected.includes(s.id));
  const full = selected.length >= MAX_KPIS;

  function persist(next: string[]) {
    setSelected(next);
    setError(null);
    void fetch("/api/page-tiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_key: "home_hero", kind: "tile_order", order: next }),
    }).then(async (res) => {
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
      } else {
        // Résout côté serveur la valeur des suggestions ajoutées.
        router.refresh();
      }
    });
  }

  const remove = (id: string) => persist(selected.filter((s) => s !== id));
  const add = (id: string) => !full && persist([...selected, id]);

  const groups = [...new Set(availableSuggestions.map((s) => s.group))];

  return (
    <div className="p-6">
      <div className="mb-2 flex items-center justify-end gap-2">
        {editing && (
          <span className="text-[11px] text-slate-400">
            {selected.length}/{MAX_KPIS} KPIs affichés
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e);
            setShowAll(false);
          }}
          className={`text-xs font-medium hover:underline ${editing ? "text-slate-500" : "text-accent"}`}
        >
          {editing ? "Terminer" : "Personnaliser"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
        {shown.map((k) =>
          editing ? (
            <div key={k.id} className="relative -m-2 rounded-lg border border-dashed border-slate-200 p-2">
              <button
                type="button"
                title="Retirer ce KPI"
                onClick={() => remove(k.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 transition hover:bg-rose-100 hover:text-rose-600"
              >
                ✕
              </button>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              {k.hint && <p className="mt-1 text-[11px] text-slate-500">{k.hint}</p>}
            </div>
          ) : (
            <Link key={k.id} href={k.href} className="group block">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums transition group-hover:opacity-80 ${k.color}`}>{k.value}</p>
              {k.hint && <p className="mt-1 text-[11px] text-slate-500 group-hover:text-slate-700">{k.hint}</p>}
            </Link>
          ),
        )}
        {shown.length === 0 && (
          <p className="col-span-full text-center text-xs text-slate-400">
            Aucun KPI affiché — clique sur «&nbsp;Personnaliser&nbsp;» pour en ajouter.
          </p>
        )}
      </div>

      {/* Catalogue rapide : volumes réels + accès à la liste exhaustive */}
      {editing && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <span className="text-[11px] font-medium text-slate-500">Ajouter :</span>
            {availableQuick.map((k) => (
              <button
                key={k.id}
                type="button"
                disabled={full}
                title={full ? `Maximum ${MAX_KPIS} KPIs — retire-en un d'abord` : `Afficher « ${k.label} »`}
                onClick={() => add(k.id)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                ＋ {k.label} · {k.value}
              </button>
            ))}
            {availableSuggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  showAll
                    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                    : "border-fuchsia-200 bg-white text-fuchsia-600 hover:bg-fuchsia-50"
                }`}
              >
                ＋ Plus de KPIs ({availableSuggestions.length})
              </button>
            )}
            {full && (
              <span className="ml-auto text-[11px] text-amber-600">
                Maximum {MAX_KPIS} — retire un KPI pour en ajouter un autre.
              </span>
            )}
          </div>

          {/* Liste EXHAUSTIVE : suggestions personnalisées par pôle */}
          {showAll && (
            <div className="space-y-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/30 p-3">
              <p className="text-[11px] text-slate-500">
                Suggestions personnalisées par pôle — la valeur se calcule dès l&apos;ajout (mêmes KPIs que les tuiles
                des pages et les alertes).
              </p>
              {groups.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {GROUP_LABELS[g] ?? g}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSuggestions
                      .filter((s) => s.group === g)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={full}
                          title={full ? `Maximum ${MAX_KPIS} KPIs` : s.description ?? s.label}
                          onClick={() => add(s.id)}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ＋ {s.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
