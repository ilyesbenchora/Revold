"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockHeaderIcon } from "./ventes-ui";

export type ParityRow = {
  object_type: string;
  records_in_supabase: number;
  records_in_hubspot: number | null;
  parity_drift: number | null;
  parity_status: "ok" | "drift" | "syncing" | "error" | "unknown" | "no_scope";
  last_full_sync_at: string | null;
  last_delta_sync_at: string | null;
  last_error: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  contacts: "Contacts",
  companies: "Entreprises",
  deals: "Deals",
  tickets: "Tickets",
  pipelines: "Pipelines",
  owners: "Propriétaires",
  workflows: "Workflows",
  forms: "Formulaires",
  lists: "Listes",
  marketing_campaigns: "Campagnes marketing",
  marketing_events: "Événements marketing",
  goals: "Objectifs",
  leads: "Leads",
  invoices: "Factures",
  subscriptions: "Abonnements",
  quotes: "Devis",
  line_items: "Lignes produits",
};

const STATUS_META: Record<string, { label: string; bg: string; dot: string }> = {
  ok: { label: "Synchronisé", bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  drift: { label: "Drift", bg: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  syncing: { label: "Sync en cours…", bg: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  error: { label: "Erreur", bg: "bg-red-50 text-red-700", dot: "bg-red-500" },
  no_scope: { label: "Scope manquant", bg: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
  unknown: { label: "Non observé", bg: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

function relTime(iso: string | null): string {
  if (!iso) return "jamais";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export function SyncParityBlock({ rows }: { rows: ParityRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"delta" | "full" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function trigger(mode: "delta" | "full") {
    setBusy(mode);
    setLastResult(null);
    try {
      const res = await fetch(`/api/sync/hubspot/${mode}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const cleanedSuffix = data.objects.cleaned
          ? ` · ${data.objects.cleaned} orphelins purgés`
          : "";
        setLastResult(
          `✓ ${mode.toUpperCase()} terminé en ${Math.round(data.durationMs / 1000)} s — ` +
          `${data.objects.upserted} records mis à jour sur ${data.objects.total} object types${cleanedSuffix}.`,
        );
        router.refresh();
      } else {
        setLastResult(`Erreur : ${data.error ?? "inconnue"}`);
      }
    } catch (err) {
      setLastResult(`Erreur réseau : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setBusy(null);
    }
  }

  // Tri : drift en haut, puis error, puis no_scope, puis ok
  const sorted = [...rows].sort((a, b) => {
    const order: Record<string, number> = { drift: 0, error: 1, syncing: 2, no_scope: 3, unknown: 4, ok: 5 };
    return (order[a.parity_status] ?? 9) - (order[b.parity_status] ?? 9);
  });

  const counts = {
    ok: rows.filter((r) => r.parity_status === "ok").length,
    drift: rows.filter((r) => r.parity_status === "drift").length,
    error: rows.filter((r) => r.parity_status === "error").length,
    noScope: rows.filter((r) => r.parity_status === "no_scope").length,
    unknown: rows.filter((r) => r.parity_status === "unknown").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <BlockHeaderIcon icon="shield" tone="emerald" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Parité HubSpot ↔ Revold</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {counts.ok} ok · {counts.drift} drift · {counts.error} erreur ·{" "}
              {counts.noScope} scope manquant · {counts.unknown} non observé
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => trigger("delta")}
            disabled={busy !== null}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "delta" ? "Sync delta…" : "Sync delta maintenant"}
          </button>
          <button
            type="button"
            onClick={() => trigger("full")}
            disabled={busy !== null}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "full" ? "Sync full…" : "Réconciliation complète"}
          </button>
        </div>
      </div>

      {lastResult && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs ${
            lastResult.startsWith("✓")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {lastResult}
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60">
            <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
              <th className="px-5 py-2">Object type</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2 text-right">HubSpot</th>
              <th className="px-3 py-2 text-right">Supabase</th>
              <th className="px-3 py-2 text-right">Δ</th>
              <th className="px-5 py-2">Dernière sync</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                  Aucune donnée de parité encore — lance « Réconciliation complète » pour
                  initialiser le miroir Supabase.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const meta = STATUS_META[r.parity_status] ?? STATUS_META.unknown;
                const drift = r.parity_drift ?? 0;
                return (
                  <tr key={r.object_type} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2 font-medium text-slate-700">
                      {TYPE_LABELS[r.object_type] ?? r.object_type}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      {r.last_error && (
                        <p className="mt-0.5 max-w-[300px] truncate text-[10px] text-red-500" title={r.last_error}>
                          {r.last_error}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {r.records_in_hubspot !== null ? r.records_in_hubspot.toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {r.records_in_supabase.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-semibold ${
                          drift === 0
                            ? "text-emerald-700"
                            : Math.abs(drift) <= 5
                              ? "text-amber-700"
                              : "text-red-700"
                        }`}
                      >
                        {drift > 0 ? `+${drift}` : drift}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-slate-500">
                      {relTime(r.last_delta_sync_at ?? r.last_full_sync_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
