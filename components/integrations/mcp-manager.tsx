"use client";

import { useEffect, useState } from "react";

type McpServer = { id: string; name: string; url: string; is_active: boolean; created_at: string };

/** Gestion des serveurs MCP distants (POC connecteur MCP agents). */
export function McpManager() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/integrations/mcp");
      const data = await res.json();
      setServers(data.servers ?? []);
      setMigrationNeeded(Boolean(data.migrationNeeded));
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), auth_token: token.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'ajout.");
        return;
      }
      setName("");
      setUrl("");
      setToken("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ce serveur MCP ?")) return;
    await fetch(`/api/integrations/mcp/${id}`, { method: "DELETE" });
    refresh();
  }

  const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div className="space-y-6">
      {migrationNeeded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Table <code>mcp_servers</code> absente — applique la migration Supabase{" "}
          <code>20260716000003_mcp_servers.sql</code> pour activer cette fonctionnalité.
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <form onSubmit={add} className="card space-y-3 p-5">
        <p className="text-sm font-semibold text-slate-900">Connecter un serveur MCP</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="hubspot-mcp" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">URL du serveur (https)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.exemple.com/sse" className={field} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Bearer token (optionnel)</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token d'authentification si requis" className={field} />
          <p className="mt-1 text-[10px] text-slate-400">🔒 Transmis au serveur MCP comme authorization_token, stocké chiffré côté org (RLS).</p>
        </div>
        <button
          type="submit"
          disabled={busy || !name.trim() || !/^https?:\/\//.test(url.trim())}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? "Ajout…" : "Connecter le serveur MCP"}
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-card-border bg-slate-50 px-6 py-3">
          <p className="text-sm font-semibold text-slate-900">Serveurs MCP connectés ({servers.length})</p>
        </div>
        {loaded && servers.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-slate-400">
            Aucun serveur MCP connecté. Ajoute-en un ci-dessus : ses outils seront proposés aux agents, en plus des données
            croisées via API.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {servers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{s.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Actif</span>
                  <button onClick={() => remove(s.id)} className="text-[11px] font-medium text-rose-600 hover:underline">
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
