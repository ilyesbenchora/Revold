"use client";

import { useCallback, useEffect, useState } from "react";

type KeyRow = {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Clés d'API Revold — câblé au réel : création (clé affichée UNE fois),
 * révocation, dernier usage. Auth des appels /api/v1 par Bearer rvk_….
 */
export function ApiKeysBlock({ isAdmin }: { isAdmin: boolean }) {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      const d = await res.json();
      setKeys(Array.isArray(d.keys) ? d.keys : []);
    } else setKeys([]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function createKey() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() || "Clé API" }),
    }).catch(() => null);
    setCreating(false);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok && d.key) {
      setFreshKey(d.key);
      setLabel("");
      void refresh();
    } else setError(d?.error ?? "Création impossible.");
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    void refresh();
  }

  if (!isAdmin) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        La gestion des clés d&apos;API est réservée aux admins de l&apos;organisation.
      </div>
    );
  }

  return (
    <div className="card p-6">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

      {/* Clé fraîchement créée : visible UNE seule fois. */}
      {freshKey && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-800">
            Clé créée — copie-la maintenant, elle ne sera plus jamais affichée :
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700">{freshKey}</code>
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(freshKey).then(() => setCopied(true)); }}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              {copied ? "✓ Copiée" : "Copier"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom de la clé (ex : Script BI)"
          className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void createKey()}
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Création…" : "Générer une nouvelle clé"}
        </button>
      </div>

      {keys == null ? (
        <p className="mt-4 text-xs text-slate-400">Chargement…</p>
      ) : keys.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Aucune clé pour l&apos;instant.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">{k.label}</span>
                <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{k.key_prefix}</code>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <span>créée le {dateFr(k.created_at)}</span>
                <span>dernier usage : {dateFr(k.last_used_at)}</span>
                {k.revoked_at ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">Révoquée</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void revoke(k.id)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
        <p className="text-[10px] font-semibold uppercase text-slate-500">Endpoints (Authorization: Bearer rvk_…)</p>
        <p className="mt-1">GET https://revold.ai/api/v1/ping — teste la clé</p>
        <p>GET https://revold.ai/api/v1/kpis — volumes du modèle + alertes actives</p>
      </div>
    </div>
  );
}
