"use client";

import { useState } from "react";
import Link from "next/link";
import { SpreadsheetLogo } from "./spreadsheet-logo";

type LastImport = { name: string; source_type: string; row_count: number; created_at: string } | null;

/**
 * Bouton « Import » (dropdown) dans la page Intégrations. Regroupe l'import de
 * fichiers Excel / Google Sheets et renvoie vers la sous-page dédiée où
 * s'affiche l'historique daté de chaque import.
 */
export function IntegrationImportDropdown({ datasetCount, lastImport }: { datasetCount: number; lastImport: LastImport }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
      >
        <SpreadsheetLogo size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Import de fichiers · Excel / Google Sheets</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {datasetCount > 0 ? `${datasetCount} jeu(x) de données importé(s)` : "Aucun import pour le moment"}
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <SpreadsheetLogo size={32} />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Excel / Google Sheets</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Déposez un fichier .csv (export Excel) ou collez un lien Google Sheets. Revold parse les données et les
                rend disponibles pour vos agents.
              </p>
            </div>
            <Link
              href="/dashboard/integration/import-fichier"
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              Ajouter un fichier
            </Link>
          </div>

          {lastImport && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Dernier import : <span className="font-medium text-slate-700">{lastImport.name}</span> ·{" "}
              {lastImport.source_type === "gsheet" ? "Google Sheets" : "CSV"} · {lastImport.row_count} lignes ·{" "}
              {new Date(lastImport.created_at).toLocaleDateString("fr-FR")}
            </div>
          )}

          <Link
            href="/dashboard/integration/import-fichier"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Voir l&apos;historique des imports →
          </Link>
        </div>
      )}
    </div>
  );
}
