"use client";

import { useRef, useState } from "react";
import { parseCsv } from "@/lib/integrations/csv";
import { buildPreview, type Attachment } from "@/lib/attachments";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

type Props = {
  onAdd: (att: Attachment) => void;
  disabled?: boolean;
  /** Taille du bouton — "sm" pour l'agenda, défaut pour le chat. */
  size?: "sm" | "md";
};

/**
 * Bouton "+" ouvrant un menu pour joindre un tableur : depuis l'ordinateur
 * (CSV/Excel exporté), un Google Sheets (lien), ou Google Drive (bientôt).
 * Parse le CSV et renvoie un Attachment prêt à être injecté dans l'agent.
 */
export function AttachMenu({ onAdd, disabled, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "gsheet">("menu");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setOpen(false);
    setMode("menu");
    setUrl("");
    setErr(null);
    setBusy(false);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.columns.length === 0 || parsed.rows.length === 0) {
        setErr("Fichier vide ou illisible (attendu un .csv).");
        setBusy(false);
        return;
      }
      onAdd({
        id: genId(),
        name: file.name,
        source: "file",
        columns: parsed.columns,
        rowCount: parsed.rows.length,
        preview: buildPreview(parsed),
      });
      reset();
    } catch {
      setErr("Impossible de lire le fichier.");
      setBusy(false);
    }
  }

  async function handleGsheet() {
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/attachments/gsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Échec de l'import.");
        setBusy(false);
        return;
      }
      onAdd({
        id: genId(),
        name: "Google Sheets",
        source: "gsheet",
        columns: data.columns ?? [],
        rowCount: data.rowCount ?? 0,
        preview: data.preview ?? "",
      });
      reset();
    } catch {
      setErr("Erreur réseau.");
      setBusy(false);
    }
  }

  const btnSize = size === "sm" ? "h-7 w-7 text-base" : "h-9 w-9 text-lg";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? reset() : setOpen(true))}
        disabled={disabled}
        aria-label="Joindre un fichier"
        title="Joindre un fichier (Excel, Google Sheets, ordinateur)"
        className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white ${btnSize} text-slate-500 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 disabled:opacity-50`}
      >
        +
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {mode === "menu" ? (
            <div className="space-y-0.5">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Joindre un fichier</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>💻</span> Depuis l&apos;ordinateur
                <span className="ml-auto text-[10px] text-slate-400">CSV / Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("gsheet")}
                disabled={busy}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>🟩</span> Google Sheets
                <span className="ml-auto text-[10px] text-slate-400">lien</span>
              </button>
              <button
                type="button"
                disabled
                title="Bientôt — connexion Google requise"
                className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-400"
              >
                <span>☁️</span> Google Drive
                <span className="ml-auto text-[10px]">bientôt</span>
              </button>
              {err && <p className="px-2.5 py-1 text-[11px] text-red-500">{err}</p>}
              {busy && <p className="px-2.5 py-1 text-[11px] text-slate-400">Lecture du fichier…</p>}
            </div>
          ) : (
            <div className="space-y-2 p-1.5">
              <p className="text-[11px] font-medium text-slate-600">Lien Google Sheets (partagé en lecture)</p>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleGsheet();
                  }
                }}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
              />
              {err && <p className="text-[11px] text-red-500">{err}</p>}
              <div className="flex justify-between gap-2">
                <button type="button" onClick={() => setMode("menu")} className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={handleGsheet}
                  disabled={busy || !url.trim()}
                  className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy ? "Import…" : "Joindre"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Puces d'attachements avec bouton de suppression — réutilisable. */
export function AttachmentChips({
  items,
  onRemove,
}: {
  items: Attachment[];
  onRemove: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800"
        >
          <span>{a.source === "gsheet" ? "🟩" : "📄"}</span>
          <span className="max-w-[160px] truncate font-medium">{a.name}</span>
          <span className="text-emerald-500">· {a.rowCount} l.</span>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            aria-label="Retirer"
            className="ml-0.5 text-emerald-500 hover:text-red-500"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
