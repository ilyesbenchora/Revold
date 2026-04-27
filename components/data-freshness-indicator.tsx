"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function relTime(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export function DataFreshnessIndicator({
  computedAt,
  source = "sync",
}: {
  computedAt: string | null | undefined;
  source?: "sync" | "live" | "bootstrap";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"snapshot" | "delta" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function refresh(mode: "snapshot" | "delta") {
    setBusy(mode);
    setFeedback(null);
    try {
      const res = await fetch(`/api/sync/hubspot/${mode}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setFeedback(
          mode === "snapshot"
            ? "✓ KPIs recalculés depuis le miroir local"
            : `✓ Delta sync terminé — ${data.objects?.upserted ?? 0} records mis à jour`,
        );
        router.refresh();
      } else {
        setFeedback(`Erreur : ${data.error ?? "inconnue"}`);
      }
    } catch (err) {
      setFeedback(`Erreur réseau : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        <span className="text-slate-600">
          Données rafraîchies <strong className="text-slate-900">{relTime(computedAt)}</strong>
          {source === "bootstrap" && (
            <span className="ml-1 text-slate-400">(bootstrap initial)</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {feedback && (
          <span
            className={`text-[11px] ${
              feedback.startsWith("✓") ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {feedback}
          </span>
        )}
        <button
          type="button"
          onClick={() => refresh("snapshot")}
          disabled={busy !== null}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "snapshot" ? "Recalcul…" : "Recalculer KPIs"}
        </button>
        <button
          type="button"
          onClick={() => refresh("delta")}
          disabled={busy !== null}
          className="rounded-lg bg-accent px-3 py-1 text-[11px] font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
        >
          {busy === "delta" ? "Sync delta…" : "Resync HubSpot"}
        </button>
      </div>
    </div>
  );
}
