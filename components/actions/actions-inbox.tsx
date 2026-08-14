"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Boîte de réception des ACTIONS (Suivi → Actions) — human-in-the-loop.
 * Les détecteurs Revold (et bientôt les agents) proposent des actions à
 * exécuter DANS les outils ; l'utilisateur valide (exécution réelle, tracée)
 * ou refuse. Rien ne part jamais sans validation.
 */

type ActionItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  source: string;
  created_at: string;
  decided_at: string | null;
  result: { ok?: boolean; detail?: string } | null;
};

const TYPE_META: Record<string, { label: string; domain: string; icon: string }> = {
  hubspot_task: { label: "Tâche HubSpot", domain: "hubspot.com", icon: "🟧" },
  stripe_send_invoice: { label: "Rappel Stripe", domain: "stripe.com", icon: "💳" },
};

function sourceLabel(source: string): string {
  if (source === "detector:silent_deal") return "Détecteur · deals silencieux";
  if (source === "detector:overdue_invoice") return "Détecteur · impayés";
  if (source.startsWith("agent:")) return `Agent · ${source.slice(6)}`;
  return source;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ActionsInbox() {
  const [pending, setPending] = useState<ActionItem[] | null>(null);
  const [history, setHistory] = useState<ActionItem[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/actions");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setNeedsMigration(Boolean(d.needsMigration));
      setPending(Array.isArray(d.pending) ? d.pending : []);
      setHistory(Array.isArray(d.history) ? d.history : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setPending([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Décision impossible");
      if (decision === "approve" && d.status === "failed" && d.detail) {
        setError(`Exécution en échec : ${d.detail}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {needsMigration && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          La table des actions n&apos;existe pas encore — applique la migration <code>action_items</code> pour activer la boîte d&apos;actions.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {/* ── File d'attente : à valider ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          À valider
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{pending?.length ?? 0}</span>
        </h2>
        {pending === null ? (
          <p className="text-xs text-slate-400">Analyse de tes données…</p>
        ) : pending.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Aucune action en attente.</p>
            <p className="mt-1 text-xs text-slate-400">
              Les détecteurs (deals silencieux, impayés) et les agents alimentent cette file — reviens après ta prochaine synchronisation.
            </p>
          </div>
        ) : (
          pending.map((a) => {
            const meta = TYPE_META[a.type];
            return (
              <div key={a.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {meta && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        <BrandLogo domain={meta.domain} alt={meta.label} fallback={meta.icon} size={12} />
                        {meta.label}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{sourceLabel(a.source)}</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{a.title}</p>
                  {a.description && <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => decide(a.id, "reject")}
                    disabled={busyId === a.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => decide(a.id, "approve")}
                    disabled={busyId === a.id || needsMigration}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                  >
                    {busyId === a.id ? "Exécution…" : "✓ Valider — exécuter"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Historique : exécutées / refusées / en échec ── */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Historique</h2>
          <div className="card divide-y divide-slate-100">
            {history.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{a.title}</p>
                  {a.status === "failed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-rose-500">{a.result.detail}</p>
                  )}
                  {a.status === "executed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{a.result.detail}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.status === "executed"
                        ? "bg-emerald-50 text-emerald-700"
                        : a.status === "rejected"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {a.status === "executed" ? "Exécutée" : a.status === "rejected" ? "Refusée" : "Échec"}
                  </span>
                  {a.decided_at && <span className="text-[10px] text-slate-400">{fmtDate(a.decided_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
