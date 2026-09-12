"use client";

import { useMemo, useState } from "react";

/**
 * Sélecteur d'UTILISATEURS CRM (owners HubSpot) — partagé entre la création
 * d'alerte et la création d'objectif. Liste GLOBALE par défaut, filtrable par
 * équipe CRM, avec recherche. Multi-sélection : une alerte/un objectif est
 * créé PAR utilisateur sélectionné (indexé sur son hubspot_owner_id).
 */

export type CrmOwner = { id: string; name: string; email: string; team: string | null };

export function CrmUserPicker({
  owners,
  teams,
  selected,
  onChange,
}: {
  owners: CrmOwner[];
  teams: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return owners.filter((o) => {
      if (teamFilter && o.team !== teamFilter) return false;
      if (q && !`${o.name} ${o.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [owners, teamFilter, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  function toggleAllFiltered() {
    if (allFilteredSelected) {
      const ids = new Set(filtered.map((o) => o.id));
      onChange(selected.filter((x) => !ids.has(x)));
    } else {
      onChange(Array.from(new Set([...selected, ...filtered.map((o) => o.id)])));
    }
  }

  if (owners.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Aucun utilisateur CRM trouvé — vérifie la connexion HubSpot.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Filtres : équipe CRM (ou liste globale) + recherche */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-accent"
        >
          <option value="">Toutes les équipes</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={toggleAllFiltered}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:text-accent"
        >
          {allFilteredSelected ? "Tout désélectionner" : `Tout sélectionner (${filtered.length})`}
        </button>
      </div>

      {/* Liste des utilisateurs */}
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">Aucun utilisateur ne correspond.</p>
        )}
        {filtered.map((o) => {
          const checked = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${checked ? "bg-accent/5" : "hover:bg-slate-50"}`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-accent bg-accent text-white" : "border-slate-300 bg-white"}`}>
                {checked && (
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-800">{o.name || o.email}</span>
                <span className="block truncate text-[10px] text-slate-400">{o.email}</span>
              </span>
              {o.team && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{o.team}</span>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          {selected.length === 1
            ? "1 utilisateur ciblé — le suivi sera calculé sur SES données."
            : `${selected.length} utilisateurs ciblés — un suivi sera créé PAR utilisateur.`}
        </p>
      )}
    </div>
  );
}
