"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * RECHERCHE GLOBALE de la home : un champ unique pour retrouver n'importe quel
 * asset de l'app — pages, agents, rapports sauvegardés, alertes, objectifs,
 * tableaux de bord. Débounce 200 ms, résultats groupés par type, fermeture au
 * clic extérieur / Échap, Entrée = premier résultat.
 */

type Result = { type: string; label: string; href: string; sub?: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fermeture au clic extérieur / Échap.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function search(value: string) {
    setQ(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
        const d = await res.json().catch(() => ({}));
        setResults(Array.isArray(d.results) ? d.results : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  // Groupes ordonnés par type (l'API renvoie déjà plafonné).
  const groups: Array<[string, Result[]]> = [];
  for (const r of results) {
    const g = groups.find(([t]) => t === r.type);
    if (g) g[1].push(r);
    else groups.push([r.type, [r]]);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) window.location.href = results[0].href;
          }}
          placeholder="Rechercher une page, un rapport, une alerte, un agent…"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          aria-label="Recherche globale"
        />
        {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />}
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-400">Aucun résultat pour « {q} ».</p>
          ) : (
            groups.map(([type, items]) => (
              <div key={type}>
                <p className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{type}</p>
                {items.map((r) => (
                  <Link
                    key={`${r.type}-${r.href}-${r.label}`}
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-indigo-50/60 hover:text-slate-900"
                  >
                    {r.label}
                    {r.sub && <span className="ml-1.5 text-[11px] text-slate-400">{r.sub}</span>}
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
