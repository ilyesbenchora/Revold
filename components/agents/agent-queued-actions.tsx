"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type QueuedAction = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  createdAt: string | null;
  decidedAt: string | null;
  autoPilot: boolean;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente de validation", cls: "bg-amber-50 text-amber-700" },
  executed: { label: "Exécutée ✓", cls: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Échouée", cls: "bg-rose-50 text-rose-700" },
  dismissed: { label: "Refusée", cls: "bg-slate-100 text-slate-500" },
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

/**
 * B1 — Onglet Actions du chat : les actions de CET agent dans la file Suivi →
 * Actions — planifiées depuis le chat (« Plus tard »), décidées à la main ou
 * exécutées en AUTO-PILOT (badge dédié) — avec leur statut.
 */
export function AgentQueuedActions({ agentKey }: { agentKey: string }) {
  const [items, setItems] = useState<QueuedAction[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/actions/queue?agent_key=${encodeURIComponent(agentKey)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => alive && setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [agentKey]);

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        🗓 Actions planifiées &amp; auto-pilot ({items.length})
        <Link href="/dashboard/mes-alertes/actions" className="ml-auto text-[11px] font-medium text-accent hover:underline">
          Suivi → Actions →
        </Link>
      </p>
      {items.map((a) => {
        const st = STATUS_META[a.status] ?? { label: a.status, cls: "bg-slate-100 text-slate-500" };
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
              <p className="text-[11px] text-slate-400">
                Créée le {fmt(a.createdAt)}
                {a.decidedAt && <> · décidée le {fmt(a.decidedAt)}</>}
              </p>
            </div>
            {a.autoPilot && (
              <span className="shrink-0 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700" title="Décision prise automatiquement par l'automatisation (auto-pilot)">
                🤖 Auto-pilot
              </span>
            )}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
          </div>
        );
      })}
    </div>
  );
}
