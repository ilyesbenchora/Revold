"use client";

import { useEffect, useState } from "react";
import { endOfDay, startOfDay } from "@/lib/alerts/deadline";

function fmtShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Compte à rebours vivant : « 3j 04:12:38 ». */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "échue";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days > 0 ? `${days}j ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Échéance d'une alerte, en TEMPS RÉEL : date de début, et soit un compte à
 * rebours live jusqu'à la date de fin (avec mini-timeline de progression), soit
 * un badge « En continu ». Se met à jour chaque seconde.
 */
export function AlertDeadline({
  dateFrom,
  dateTo,
  compact = false,
}: {
  dateFrom?: string | null;
  dateTo?: string | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = dateTo ? endOfDay(dateTo) : null;
  const start = dateFrom ? startOfDay(dateFrom) : null;
  const remaining = end != null && now != null ? end - now : null;
  const overdue = remaining != null && remaining <= 0;
  const urgent = remaining != null && remaining > 0 && remaining < 3 * 86_400_000;

  // Progression de la timeline (début → fin).
  let pct = 0;
  if (start != null && end != null && now != null && end > start) {
    pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }

  const chip =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold";

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1.5" : "space-y-1.5"}>
      <div className="flex flex-wrap items-center gap-1.5">
        {dateFrom && (
          <span className={`${chip} bg-slate-100 text-slate-600`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            Début {fmtShort(dateFrom)}
          </span>
        )}
        {!dateTo ? (
          <span className={`${chip} bg-emerald-50 text-emerald-700`}>♾ En continu</span>
        ) : overdue ? (
          <span className={`${chip} bg-rose-50 text-rose-700`}>⏱ Échue le {fmtShort(dateTo)}</span>
        ) : (
          <span className={`${chip} ${urgent ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-700"}`}>
            ⏳ Fin {fmtShort(dateTo)} · {remaining != null ? formatRemaining(remaining) : "…"}
          </span>
        )}
      </div>

      {/* Mini-timeline live (uniquement si début + fin) */}
      {!compact && start != null && end != null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${overdue ? "bg-rose-400" : urgent ? "bg-amber-400" : "bg-indigo-400"}`}
            style={{ width: `${overdue ? 100 : pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
