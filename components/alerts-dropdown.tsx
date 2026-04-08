"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Alert = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  impact: string | null;
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Commercial",
  marketing: "Marketing",
  data: "Data",
  process: "Process",
};

const CATEGORY_DOTS: Record<string, string> = {
  sales: "bg-blue-500",
  marketing: "bg-amber-500",
  data: "bg-emerald-500",
  process: "bg-indigo-500",
};

export function AlertsDropdown() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Lazy-load alerts on first open
  useEffect(() => {
    if (open && alerts === null && !loading) {
      setLoading(true);
      fetch("/api/alerts/active")
        .then((r) => (r.ok ? r.json() : { alerts: [] }))
        .then((data) => setAlerts(data.alerts ?? []))
        .catch(() => setAlerts([]))
        .finally(() => setLoading(false));
    }
  }, [open, alerts, loading]);

  const activeCount = alerts?.length ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Alertes"
        title="Alertes actives"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-card-border text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Alertes actives</p>
            <Link
              href="/dashboard/alertes"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Tout voir
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
              </div>
            )}
            {!loading && alerts && alerts.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-700">Aucune alerte active</p>
                <p className="mt-1 text-xs text-slate-400">Vous êtes à jour.</p>
              </div>
            )}
            {!loading && alerts && alerts.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {alerts.map((a) => {
                  const cat = a.category || "process";
                  const dot = CATEGORY_DOTS[cat] || "bg-slate-400";
                  const label = CATEGORY_LABELS[cat] || cat;
                  return (
                    <li key={a.id} className="px-4 py-3 hover:bg-slate-50">
                      <Link href="/dashboard/alertes" onClick={() => setOpen(false)} className="block">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{a.title}</p>
                            {a.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.description}</p>
                            )}
                            <div className="mt-1 flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(a.created_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
