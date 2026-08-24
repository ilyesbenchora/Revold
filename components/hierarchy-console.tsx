"use client";

import { useEffect, useState } from "react";

/**
 * Console HIÉRARCHIE DE COMPTES — met en avant les rapprochements
 * parent/enfant détectés par Revold (correspondance de montant deal↔facture
 * entre deux entités, jamais le nom). Même source de vérité que la boîte
 * Actions (action_items / detector:declare_group) : valider ici ou là-bas est
 * strictement équivalent, aucune duplication.
 */

type ActionRow = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  source: string;
  created_at: string;
  decided_at: string | null;
  result: { ok?: boolean; detail?: string } | null;
  payload?: Record<string, unknown> | null;
  auto?: boolean;
};

// GET /api/actions ne détecte et ne renvoie QUE la famille declare_group :
// toutes les autres familles du catalogue sont passées en skip (perf).
const OTHER_FAMILIES = [
  "silent_deal", "overdue_invoice", "duplicate_merge", "link_company",
  "renewal_deal", "revenue_leakage", "billing_contact", "won_stage_mapping",
  "duplicate_deals", "forecast_pipeline",
].join(",");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function payloadStr(p: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = p?.[key];
  return typeof v === "string" && v.trim() ? v : null;
}

export function HierarchyConsole() {
  const [pending, setPending] = useState<ActionRow[] | null>(null);
  const [history, setHistory] = useState<ActionRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/actions?skip=${OTHER_FAMILIES}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      const only = (rows: unknown): ActionRow[] =>
        (Array.isArray(rows) ? (rows as ActionRow[]) : []).filter((r) => r.source === "detector:declare_group");
      setPending(only(d.pending));
      setHistory(only(d.history));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setPending([]);
    }
  }
  useEffect(() => { void load(); }, []);

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
      } else if (decision === "approve") {
        setDoneId(id);
        await new Promise((r) => setTimeout(r, 1400));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
      setDoneId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {/* ── Suggestions à valider ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          Hiérarchies à valider
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
            {pending?.length ?? "…"}
          </span>
        </h2>

        {pending === null ? (
          <p className="text-sm text-slate-400">Analyse des correspondances deal↔facture…</p>
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucune hiérarchie à déclarer pour l&apos;instant. Revold propose un lien parent/enfant quand un deal
            signé sur une entité est facturé, au montant exact, sur une autre société sans lien de groupe déclaré.
          </p>
        ) : (
          pending.map((a) => {
            const parent = payloadStr(a.payload, "parentCompanyName") ?? "Entité de facturation";
            const child = payloadStr(a.payload, "childCompanyName") ?? "Entité signataire";
            const busy = busyId === a.id;
            const done = doneId === a.id;
            return (
              <article key={a.id} className="card space-y-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                  {a.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{a.description}</p>}
                </div>

                {/* Éléments de validation : ce que la validation écrit, exactement. */}
                <div className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-xs md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Entreprise parente</p>
                    <p className="mt-0.5 font-medium text-slate-800">{parent}</p>
                    <p className="text-[10px] text-slate-400">celle qui facture</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Entreprise enfant</p>
                    <p className="mt-0.5 font-medium text-slate-800">{child}</p>
                    <p className="text-[10px] text-slate-400">celle qui a signé le deal</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Association écrite</p>
                    <p className="mt-0.5 text-slate-600">
                      Parent / enfant HubSpot (le miroir « enfant » est créé automatiquement côté parent). Ensuite,
                      le deal se rapproche de la facture de l&apos;autre entité et le garde-fou inter-entités surveille
                      la bonne société de facturation — automatiquement.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Déduit d&apos;une correspondance de montant deal↔facture — jamais du nom. Si le sens parent/enfant
                  est inverse, ou s&apos;il ne s&apos;agit pas du même groupe, refuse et corrige dans HubSpot.
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(a.id, "reject")}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(a.id, "approve")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60 ${done ? "bg-emerald-500" : "bg-accent hover:bg-indigo-500"}`}
                  >
                    {done ? "✓ Hiérarchie déclarée" : busy ? "Écriture…" : "Valider la hiérarchie"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ── Historique des validations ── */}
      {history.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            className="flex w-full items-center gap-2 text-left text-base font-semibold text-slate-900 transition hover:text-indigo-700"
          >
            <span className={`text-xs text-slate-400 transition-transform ${historyOpen ? "rotate-90" : ""}`}>▶</span>
            Historique
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{history.length}</span>
          </button>
          {historyOpen && (
            <div className="card divide-y divide-slate-100">
              {history.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{a.title}</p>
                    {a.result?.detail && (
                      <p className={`mt-0.5 text-[11px] ${a.status === "failed" ? "text-rose-500" : "text-slate-400"}`}>{a.result.detail}</p>
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
                      {a.status === "executed" ? "Déclarée" : a.status === "rejected" ? "Refusée" : "Échec"}
                    </span>
                    {a.decided_at && <span className="text-[10px] text-slate-400">{fmtDate(a.decided_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
