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

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
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
  const [tab, setTab] = useState<"notifications" | "alerts">("notifications");
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Lazy-load on first open
  useEffect(() => {
    if (open && alerts === null && !loading) {
      setLoading(true);
      Promise.all([
        fetch("/api/alerts/active").then((r) => (r.ok ? r.json() : { alerts: [] })),
        fetch("/api/notifications").then((r) => (r.ok ? r.json() : { notifications: [], unreadCount: 0 })),
      ])
        .then(([alertData, notifData]) => {
          setAlerts(alertData.alerts ?? []);
          setNotifications(notifData.notifications ?? []);
          setUnreadCount(notifData.unreadCount ?? 0);
        })
        .catch(() => {
          setAlerts([]);
          setNotifications([]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, alerts, loading]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => (prev ?? []).map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  const activeCount = alerts?.length ?? 0;
  const totalBadge = unreadCount + activeCount;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications et alertes"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-card-border text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalBadge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => setTab("notifications")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                tab === "notifications"
                  ? "text-accent border-b-2 border-accent"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("alerts")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                tab === "alerts"
                  ? "text-accent border-b-2 border-accent"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Alertes actives
              {activeCount > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
              </div>
            )}

            {/* Notifications tab */}
            {!loading && tab === "notifications" && (
              <>
                {notifications && notifications.length > 0 && unreadCount > 0 && (
                  <div className="flex justify-end border-b border-slate-50 px-4 py-2">
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  </div>
                )}
                {(!notifications || notifications.length === 0) && (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">Aucune notification</p>
                    <p className="mt-1 text-xs text-slate-400">Les notifications apparaissent quand un objectif est atteint.</p>
                  </div>
                )}
                {notifications && notifications.length > 0 && (
                  <ul className="divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <li key={n.id} className={`px-4 py-3 transition ${n.read ? "opacity-60" : "bg-accent/[0.03]"}`}>
                        <Link
                          href={n.link || "/dashboard/alertes"}
                          onClick={() => {
                            if (!n.read) markRead(n.id);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              n.type === "alert_resolved" ? "bg-emerald-100" : "bg-slate-100"
                            }`}>
                              {n.type === "alert_resolved" ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 16v-4" />
                                  <path d="M12 8h.01" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm ${n.read ? "text-slate-600" : "font-medium text-slate-900"}`}>{n.title}</p>
                                {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                              </div>
                              {n.body && (
                                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.body}</p>
                              )}
                              <span className="mt-1 text-[10px] text-slate-400">
                                {new Date(n.created_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* Alerts tab */}
            {!loading && tab === "alerts" && (
              <>
                {(!alerts || alerts.length === 0) && (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">Aucune alerte active</p>
                    <p className="mt-1 text-xs text-slate-400">Créez une alerte depuis les scénarios de simulation.</p>
                  </div>
                )}
                {alerts && alerts.length > 0 && (
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
                <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                  <Link
                    href="/dashboard/alertes"
                    onClick={() => setOpen(false)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Voir tous les scénarios
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
