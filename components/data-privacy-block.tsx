"use client";

import { useState } from "react";

/**
 * Bloc « Données & conformité RGPD » (Paramètres → Sécurité) — câblé au réel :
 *  - export JSON immédiat des données de l'organisation ;
 *  - demande de suppression tracée (annulable), traitée sous 30 jours.
 */
export function DataPrivacyBlock({ pendingDeletionSince }: { pendingDeletionSince: string | null }) {
  const [pendingSince, setPendingSince] = useState<string | null>(pendingDeletionSince);
  const [busy, setBusy] = useState<"export" | "delete" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function exportData() {
    setBusy("export");
    // Téléchargement direct (Content-Disposition attachment).
    window.location.href = "/api/account/data-export";
    setTimeout(() => setBusy(null), 3000);
  }

  async function requestDeletion() {
    if (busy) return;
    if (!window.confirm("Demander la suppression de TOUTES les données de l'organisation ? La suppression sera opérée sous 30 jours (annulable d'ici là).")) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/account/data-deletion", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Demande impossible");
      setPendingSince(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  }

  async function cancelDeletion() {
    if (busy) return;
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch("/api/account/data-deletion", { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Annulation impossible");
      setPendingSince(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-6">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Exporter mes données</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Téléchargement JSON immédiat des données canoniques de l&apos;organisation (entreprises, contacts,
              deals, factures, abonnements, alertes, objectifs, actions) — la réversibilité, en un clic.
            </p>
          </div>
          <button
            onClick={exportData}
            disabled={busy === "export"}
            className="shrink-0 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "export" ? "Génération…" : "⬇ Exporter (JSON)"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Suppression des données</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {pendingSince
                ? `Demande enregistrée le ${new Date(pendingSince).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} — suppression opérée sous 30 jours.`
                : "Demande tracée, suppression opérée sous 30 jours — annulable à tout moment d'ici là."}
            </p>
          </div>
          {pendingSince ? (
            <button
              onClick={cancelDeletion}
              disabled={busy === "cancel"}
              className="shrink-0 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "cancel" ? "Annulation…" : "Annuler la demande"}
            </button>
          ) : (
            <button
              onClick={requestDeletion}
              disabled={busy === "delete"}
              className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {busy === "delete" ? "Enregistrement…" : "Demander la suppression"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
