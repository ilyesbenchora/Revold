"use client";

import { SUPPORTED_LOCALES, setLocale, useLocale } from "@/lib/locale";

/**
 * Mon compte → « Langue & format des dates » : choix de la langue de la
 * plateforme. S'applique IMMÉDIATEMENT (sans rechargement) au format des dates
 * (« Janvier 2026 » au lieu de « 2026-01 ») et des nombres dans les tables de
 * données, graphiques et rapports.
 */
export function LocaleSettings() {
  const locale = useLocale();
  const now = new Date();
  const exampleDate = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const exampleMonth = now.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const exampleNumber = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(1234567);

  return (
    <div className="card p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-500">Langue de la plateforme</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
          >
            {SUPPORTED_LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Appliquée immédiatement aux dates et aux nombres des tables de données, graphiques et rapports — sans
            rechargement.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Aperçu des formats</label>
          <div className="mt-1 space-y-1.5 rounded-lg border border-card-border bg-slate-50 px-3 py-2.5 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Date</span>
              <span className="font-medium capitalize text-slate-800">{exampleDate}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Axe mensuel</span>
              <span className="font-medium capitalize text-slate-800">{exampleMonth}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Montant</span>
              <span className="font-medium tabular-nums text-slate-800">{exampleNumber}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
