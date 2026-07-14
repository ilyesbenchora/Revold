"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

/**
 * Formulaire d'import tableur : bascule entre « Fichier CSV » et « Google Sheets ».
 * Le champ caché `mode` pilote le traitement côté server action.
 */
export function ImportSpreadsheetForm({ action }: Props) {
  const [mode, setMode] = useState<"csv" | "gsheet">("csv");
  const [fileName, setFileName] = useState<string>("");

  const tab = (active: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
      active ? "border-accent bg-accent/5 text-accent" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;
  const field =
    "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="mode" value={mode} />

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("csv")} className={tab(mode === "csv")}>
          📄 Fichier CSV / Excel
        </button>
        <button type="button" onClick={() => setMode("gsheet")} className={tab(mode === "gsheet")}>
          🟩 Google Sheets
        </button>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nom du jeu de données
        </label>
        <input id="name" name="name" type="text" placeholder="Ex : Comptes clients 2026" className={field} />
      </div>

      {mode === "csv" ? (
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-slate-700">
            Fichier .csv
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            {fileName ? `Sélectionné : ${fileName}` : "Depuis Excel : Fichier, Enregistrer sous, CSV UTF-8."}
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="sheet_url" className="block text-sm font-medium text-slate-700">
            Lien Google Sheets
          </label>
          <input
            id="sheet_url"
            name="sheet_url"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            required
            className={field}
          />
          <p className="mt-1 text-xs text-slate-500">
            Partage requis : « toute personne disposant du lien » (lecture). Onglet ciblé via le paramètre gid de l&apos;URL.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Importer dans Revold
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </form>
  );
}
