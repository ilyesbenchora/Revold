"use client";

import { useCallback, useEffect, useState } from "react";

type HookRow = {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  last_delivery_at: string | null;
  last_status: number | null;
};

const EVENTS: { id: string; label: string }[] = [
  { id: "alert.created", label: "alert.created — alerte déclenchée" },
  { id: "objective.reached", label: "objective.reached — objectif atteint" },
  { id: "sync.completed", label: "sync.completed — synchronisation réussie" },
  { id: "sync.failed", label: "sync.failed — synchronisation en échec" },
];

/**
 * Webhooks sortants — câblé au réel : POST JSON signé HMAC (x-revold-signature)
 * émis par les crons (alertes, objectifs, syncs) + bouton test (test.ping).
 */
export function WebhooksBlock({ isAdmin }: { isAdmin: boolean }) {
  const [hooks, setHooks] = useState<HookRow[] | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["alert.created"]);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testedId, setTestedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/webhooks");
    if (res.ok) {
      const d = await res.json();
      setHooks(Array.isArray(d.webhooks) ? d.webhooks : []);
    } else setHooks([]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function addHook() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), events }),
    }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setSecret(d.secret ?? null);
      setUrl("");
      void refresh();
    } else setError(d?.error ?? "Ajout impossible.");
  }

  async function testHook(id: string) {
    setTestedId(id);
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: id }),
    }).catch(() => {});
    await refresh();
    setTestedId(null);
  }

  async function removeHook(id: string) {
    await fetch(`/api/webhooks?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    void refresh();
  }

  if (!isAdmin) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        La gestion des webhooks est réservée aux admins de l&apos;organisation.
      </div>
    );
  }

  return (
    <div className="card p-6">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      {secret && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-800">
            Webhook créé — son secret de signature (header <code>x-revold-signature</code>, HMAC-SHA256), affiché une seule fois :
          </p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700">{secret}</code>
        </div>
      )}

      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://votre-endpoint.example.com/revold"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          {EVENTS.map((ev) => {
            const on = events.includes(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => setEvents((prev) => (on ? prev.filter((x) => x !== ev.id) : [...prev, ev.id]))}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                  on ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {ev.id}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void addHook()}
            disabled={busy}
            className="ml-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Ajout…" : "Ajouter le webhook"}
          </button>
        </div>
      </div>

      {hooks == null ? (
        <p className="mt-4 text-xs text-slate-400">Chargement…</p>
      ) : hooks.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Aucun webhook configuré.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {hooks.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <code className="break-all font-mono text-[11px] text-slate-700">{h.url}</code>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {h.events.join(" · ")}
                  {h.last_delivery_at && (
                    <>
                      {" — dernier envoi "}
                      {new Date(h.last_delivery_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {h.last_status != null && (
                        <span className={h.last_status >= 200 && h.last_status < 300 ? " text-emerald-600" : " text-rose-600"}>
                          {" "}· HTTP {h.last_status === -1 ? "injoignable" : h.last_status}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void testHook(h.id)}
                  disabled={testedId === h.id}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
                >
                  {testedId === h.id ? "Test…" : "Tester"}
                </button>
                <button
                  type="button"
                  onClick={() => void removeHook(h.id)}
                  className="rounded-lg border border-rose-200 px-2.5 py-1 font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
