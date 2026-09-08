"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Console « Contacts sans entreprise » — l'association en masse que HubSpot
 * n'offre pas.
 *
 *  1. Suggestions automatiques : contacts groupés par domaine email quand une
 *     entreprise de la base porte ce domaine → validation par groupe, en un clic.
 *  2. Mode manuel : sélection de contacts dans la table (recherche incluse) +
 *     recherche d'une entreprise cible → association du lot.
 *
 * Aucune écriture sans clic : la validation écrit les associations dans
 * HubSpot (batch v4) puis répercute company_id en canonique.
 */

type Orphan = {
  id: string;
  hubspot_id: string;
  email: string | null;
  full_name: string | null;
  title: string | null;
  lifecycle_stage: string | null;
};

type Suggestion = {
  company: { id: string; name: string | null; domain: string | null };
  contactIds: string[];
  domain: string;
};

type CompanyHit = { id: string; name: string | null; domain: string | null };

const PAGE_SIZE = 25;

export function OrphanContactsConsole() {
  const [orphans, setOrphans] = useState<Orphan[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Table manuelle : recherche contact, sélection, pagination.
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Recherche d'entreprise cible (mode manuel).
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyHits, setCompanyHits] = useState<CompanyHit[]>([]);
  const [targetCompany, setTargetCompany] = useState<CompanyHit | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/orphan-contacts");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setOrphans(Array.isArray(d.orphans) ? d.orphans : []);
      setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setOrphans([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Recherche d'entreprise : débouncée, jamais pendant une association.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = companyQuery.trim();
    if (q.length < 2) {
      setCompanyHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/orphan-contacts/companies?q=${encodeURIComponent(q)}`);
        const d = await res.json().catch(() => ({}));
        setCompanyHits(Array.isArray(d.companies) ? d.companies : []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [companyQuery]);

  async function associate(companyId: string, contactIds: string[], busy: string) {
    if (busyKey) return;
    setBusyKey(busy);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/orphan-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contactIds }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Association impossible");
      setResult(
        `${d.associated} contact${d.associated > 1 ? "s" : ""} associé${d.associated > 1 ? "s" : ""} à ${d.company ?? "l'entreprise"} — écrit dans HubSpot.${d.warning ? ` ⚠ ${d.warning}` : ""}`,
      );
      setTargetCompany(null);
      setCompanyQuery("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyKey(null);
    }
  }

  // Table filtrée + pagination.
  const q = search.trim().toLowerCase();
  const visible = (orphans ?? []).filter(
    (c) => !q || [c.full_name, c.email, c.title].some((v) => v && v.toLowerCase().includes(q)),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages - 1);
  const pageItems = visible.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);
  const allSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((c) => c.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nameByIdForSuggestion = new Map((orphans ?? []).map((c) => [c.id, c.full_name || c.email || c.id]));

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>}

      {/* ── 1. Suggestions automatiques par domaine email ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          Suggestions automatiques
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
            {orphans === null ? "…" : suggestions.length}
          </span>
        </h2>
        {orphans === null ? (
          <p className="text-sm text-slate-400">Analyse des domaines email…</p>
        ) : suggestions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            Aucune correspondance domaine email ↔ domaine d&apos;entreprise. Utilise le mode manuel ci-dessous.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((s) => (
              <div key={s.company.id} className="card space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.company.name ?? s.domain}</p>
                    <p className="text-[11px] text-slate-400">
                      @{s.domain} · {s.contactIds.length} contact{s.contactIds.length > 1 ? "s" : ""} avec cet email
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void associate(s.company.id, s.contactIds, `sugg:${s.company.id}`)}
                    disabled={busyKey !== null}
                    className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                  >
                    {busyKey === `sugg:${s.company.id}` ? "Association…" : `Associer les ${s.contactIds.length}`}
                  </button>
                </div>
                <details className="text-[11px] text-slate-500">
                  <summary className="cursor-pointer select-none text-slate-400 transition hover:text-slate-600">
                    Voir les contacts
                  </summary>
                  <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto pl-1">
                    {s.contactIds.map((id) => (
                      <li key={id} className="truncate">{nameByIdForSuggestion.get(id) ?? id}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Association manuelle en masse ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          Association manuelle
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {orphans === null ? "…" : `${visible.length} contact${visible.length > 1 ? "s" : ""} sans entreprise`}
          </span>
        </h2>

        {/* Cible + action : choisir l'entreprise puis associer la sélection. */}
        <div className="card space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <input
                type="search"
                value={targetCompany ? (targetCompany.name ?? targetCompany.domain ?? "") : companyQuery}
                onChange={(e) => {
                  setTargetCompany(null);
                  setCompanyQuery(e.target.value);
                }}
                placeholder="Entreprise cible (nom ou domaine)…"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
              {!targetCompany && companyQuery.trim().length >= 2 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {searching && <p className="px-2.5 py-1.5 text-[11px] text-slate-400">Recherche…</p>}
                  {!searching && companyHits.length === 0 && (
                    <p className="px-2.5 py-1.5 text-[11px] text-slate-400">Aucune entreprise HubSpot trouvée.</p>
                  )}
                  {companyHits.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTargetCompany(c)}
                      className="block w-full px-2.5 py-1.5 text-left text-xs text-slate-700 transition hover:bg-indigo-50"
                    >
                      <span className="font-medium">{c.name ?? "(sans nom)"}</span>
                      {c.domain && <span className="ml-1.5 text-[10px] text-slate-400">{c.domain}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!targetCompany || selected.size === 0 || busyKey !== null}
              onClick={() => targetCompany && void associate(targetCompany.id, [...selected], "manual")}
              className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
            >
              {busyKey === "manual"
                ? "Association…"
                : `Associer ${selected.size || "la sélection"}${selected.size > 0 ? ` contact${selected.size > 1 ? "s" : ""}` : ""}${targetCompany ? ` → ${targetCompany.name ?? targetCompany.domain}` : ""}`}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Coche des contacts ci-dessous, choisis l&apos;entreprise cible, puis valide : l&apos;association est écrite
            dans HubSpot (entreprise principale) et répercutée dans Revold. Rien ne part sans ce clic.
          </p>
        </div>

        {/* Table des orphelins : recherche + sélection en masse + pagination. */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Rechercher un contact (nom, email, poste)…"
              className="w-full max-w-sm rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            {q && (
              <span className="text-[11px] tabular-nums text-slate-400">
                {visible.length} résultat{visible.length > 1 ? "s" : ""} sur {orphans?.length ?? 0}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-2.5 py-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[var(--accent)]" title="Tout sélectionner (file filtrée)" />
                  </th>
                  <th className="px-2.5 py-2 font-semibold">Contact</th>
                  <th className="px-2.5 py-2 font-semibold">Email</th>
                  <th className="px-2.5 py-2 font-semibold">Poste</th>
                  <th className="px-2.5 py-2 font-semibold">Cycle de vie</th>
                </tr>
              </thead>
              <tbody>
                {orphans === null && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">Chargement…</td></tr>
                )}
                {orphans !== null && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">
                      {q ? `Aucun contact ne correspond à « ${search} ».` : "Aucun contact sans entreprise — tout est associé. 👌"}
                    </td>
                  </tr>
                )}
                {pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                    <td className="px-2.5 py-2">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="accent-[var(--accent)]" />
                    </td>
                    <td className="px-2.5 py-2 font-medium text-slate-800">{c.full_name ?? "—"}</td>
                    <td className="px-2.5 py-2 text-slate-600">{c.email ?? "—"}</td>
                    <td className="px-2.5 py-2 text-slate-600">{c.title ?? "—"}</td>
                    <td className="px-2.5 py-2 text-slate-500">{c.lifecycle_stage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span className="tabular-nums">
                {curPage * PAGE_SIZE + 1}–{Math.min((curPage + 1) * PAGE_SIZE, visible.length)} sur {visible.length}
              </span>
              <span className="flex items-center gap-1">
                <button type="button" disabled={curPage === 0} onClick={() => setPage(curPage - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-medium transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40">← Précédent</button>
                <span className="tabular-nums">Page {curPage + 1}/{totalPages}</span>
                <button type="button" disabled={curPage >= totalPages - 1} onClick={() => setPage(curPage + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-medium transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40">Suivant →</button>
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
