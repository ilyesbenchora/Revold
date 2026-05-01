"use client";

import { useState } from "react";
import type { PlanKey, BillingPeriod } from "@/lib/billing/plans";

export function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanKey, period: BillingPeriod) {
    setBusy(`${plan}-${period}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Erreur lors de la création de la session.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Erreur portail.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {hasSubscription ? (
        <button
          type="button"
          onClick={openPortal}
          disabled={busy !== null}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
        >
          {busy === "portal" ? "Ouverture…" : "Gérer l'abonnement (Stripe Portal)"}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => checkout("starter", "monthly")}
            disabled={busy !== null}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "starter-monthly" ? "Redirection…" : "Démarrer Starter — 79 €/mois"}
          </button>
          <button
            type="button"
            onClick={() => checkout("growth", "monthly")}
            disabled={busy !== null}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "growth-monthly" ? "Redirection…" : "Essayer Growth — 14j gratuits"}
          </button>
          <button
            type="button"
            onClick={() => checkout("scale", "monthly")}
            disabled={busy !== null}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "scale-monthly" ? "Redirection…" : "Démarrer Scale — 699 €/mois"}
          </button>
        </div>
      )}
    </div>
  );
}
