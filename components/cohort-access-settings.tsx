"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COHORT_TEAMS, cohortAccessHref, type CohortTeamId } from "@/lib/settings/cohort-teams";

/**
 * Paramètres → Utilisateurs & équipes : matrice d'accès aux COHORTES par
 * équipe. Ligne = groupe de cohortes (celles de l'équipe Ventes, Marketing…),
 * colonne = équipe du membre, droits = Visualisation / Modification / Création
 * (de cohortes custom). Stockée dans page_access sous des pseudo-hrefs
 * (/dashboard/parametres/cohortes#sales…) — enregistrement immédiat, comme la
 * matrice d'accès aux pages.
 *
 * Défaut sans réglage : chaque équipe a tous les droits sur SES cohortes,
 * aucun sur celles des autres — une personne marketing ne voit pas les
 * cohortes de vente. L'admin voit et gère toujours tout.
 */

const RIGHTS: { id: "view" | "edit" | "create"; label: string; icon: string }[] = [
  { id: "view", label: "Visualisation", icon: "👁" },
  { id: "edit", label: "Modification", icon: "✏️" },
  { id: "create", label: "Création", icon: "＋" },
];

type Access = Record<string, Record<string, boolean>>; // équipe → droit → autorisé

/** Défaut : tous les droits sur son propre groupe, aucun sur les autres. */
function defaultAccess(group: CohortTeamId): Access {
  const out: Access = {};
  for (const t of COHORT_TEAMS) {
    const own = t.id === group;
    out[t.id] = { view: own, edit: own, create: own };
  }
  return out;
}

export function CohortAccessSettings({ initialRules }: { initialRules: Record<string, Access> }) {
  const router = useRouter();
  const [rules, setRules] = useState<Record<string, Access>>(initialRules);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function accessFor(group: CohortTeamId): Access {
    const saved = rules[cohortAccessHref(group)];
    const def = defaultAccess(group);
    if (!saved) return def;
    const out: Access = {};
    for (const t of COHORT_TEAMS) {
      out[t.id] = { ...def[t.id], ...(saved[t.id] ?? {}) };
    }
    return out;
  }

  function toggle(group: CohortTeamId, team: string, right: "view" | "edit" | "create") {
    const href = cohortAccessHref(group);
    const cur = accessFor(group);
    const next: Access = JSON.parse(JSON.stringify(cur));
    const on = !next[team][right];
    next[team][right] = on;
    // Cohérence : sans Visualisation, pas de Modification ni de Création ;
    // activer Modification/Création réactive la Visualisation.
    if (right === "view" && !on) {
      next[team].edit = false;
      next[team].create = false;
    }
    if ((right === "edit" || right === "create") && on) next[team].view = true;

    setRules((r) => ({ ...r, [href]: next }));
    setPendingHref(href);
    setError(null);
    void fetch("/api/page-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_href: href, access: next }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Enregistrement impossible.");
        } else {
          router.refresh();
        }
      })
      .catch(() => setError("Enregistrement impossible."))
      .finally(() => setPendingHref(null));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">Droits :</span>
        {RIGHTS.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1">
            <span aria-hidden>{r.icon}</span> {r.label}
          </span>
        ))}
        <span className="ml-auto text-slate-400">
          Sans réglage, chaque équipe gère uniquement ses cohortes. L&apos;admin voit tout.
        </span>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Groupe de cohortes</th>
                {COHORT_TEAMS.map((t) => (
                  <th key={t.id} className="px-3 py-2 text-center font-medium">
                    <span aria-hidden>{t.icon}</span> {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COHORT_TEAMS.map((g) => {
                const access = accessFor(g.id);
                const pending = pendingHref === cohortAccessHref(g.id);
                return (
                  <tr key={g.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      <span aria-hidden className="mr-1.5">{g.icon}</span>
                      Cohortes {g.label}
                    </td>
                    {COHORT_TEAMS.map((t) => (
                      <td key={t.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {RIGHTS.map((r) => {
                            const on = access[t.id][r.id];
                            return (
                              <button
                                key={r.id}
                                type="button"
                                disabled={pending}
                                title={`${r.label} — ${t.label} ${on ? "(autorisé)" : "(refusé)"}`}
                                aria-pressed={on}
                                onClick={() => toggle(g.id, t.id, r.id)}
                                className={`flex h-6 w-6 items-center justify-center rounded-md border text-[11px] transition disabled:opacity-50 ${
                                  on
                                    ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                                    : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-500"
                                }`}
                              >
                                <span aria-hidden>{r.icon}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
