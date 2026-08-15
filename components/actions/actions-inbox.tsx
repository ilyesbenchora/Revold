"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Boîte de réception des ACTIONS (Suivi → Actions) — human-in-the-loop.
 * Les détecteurs Revold (et bientôt les agents) proposent des actions à
 * exécuter DANS les outils ; l'utilisateur valide (exécution réelle, tracée)
 * ou refuse. Rien ne part jamais sans validation.
 */

type ActionItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  source: string;
  created_at: string;
  decided_at: string | null;
  result: { ok?: boolean; detail?: string } | null;
};

const TYPE_META: Record<string, { label: string; domain: string; icon: string; tool: string; toolLabel: string }> = {
  hubspot_task: { label: "Tâche HubSpot", domain: "hubspot.com", icon: "🟧", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_merge: { label: "Fusion de doublons", domain: "hubspot.com", icon: "🔀", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_company_update: { label: "Enrichissement CRM", domain: "hubspot.com", icon: "🪪", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_create_deal: { label: "Deal de renouvellement", domain: "hubspot.com", icon: "🔁", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_create_contact: { label: "Contact facturation", domain: "hubspot.com", icon: "👤", tool: "hubspot", toolLabel: "HubSpot" },
  link_company: { label: "Rattachement de fiches", domain: "revold.io", icon: "🔗", tool: "revold", toolLabel: "Revold" },
  stripe_send_invoice: { label: "Rappel Stripe", domain: "stripe.com", icon: "💳", tool: "stripe", toolLabel: "Stripe" },
};

/**
 * Catalogue des actions : chaque famille de détecteur est activable — les
 * familles masquées ne sont ni détectées ni affichées (préférence locale).
 */
export const ACTION_CATALOG: Array<{ key: string; icon: string; label: string; description: string }> = [
  { key: "silent_deal", icon: "😶", label: "Deals silencieux à relancer", description: "Deal ouvert sans contact depuis 21 jours → tâche de relance pour le propriétaire." },
  { key: "overdue_invoice", icon: "⏰", label: "Impayés à relancer", description: "Facture échue avec reste dû → rappel officiel Stripe ou tâche de relance CRM. Alimente « Cash récupéré »." },
  { key: "duplicate_merge", icon: "🔀", label: "Doublons à fusionner", description: "Contacts (même email) et entreprises (même domaine) en doublon, selon les règles de déduplication activées → fusion HubSpot validée fiche par fiche." },
  { key: "crm_enrich", icon: "🪪", label: "SIREN / TVA à reporter dans le CRM", description: "L'identifiant est connu via la facturation mais absent de la fiche HubSpot → écrit en un clic. Chaque report rend les rapprochements suivants automatiques." },
  { key: "link_company", icon: "🔗", label: "Fiches facturation à relier au CRM", description: "Entreprise vue côté facturation sans lien CRM alors qu'une fiche correspond (nom/domaine) → rattachement : le CA devient attribuable compte par compte." },
  { key: "renewal_deal", icon: "🔁", label: "Deals de renouvellement manquants", description: "Abonnement actif se terminant sous 60 jours sans deal ouvert → crée le deal de renouvellement (MRR × 12) : le forecast intègre le récurrent." },
  { key: "revenue_leakage", icon: "💸", label: "Écarts signé vs facturé (leakage)", description: "Deal gagné dont les factures couvrent moins de 90 % du montant signé → tâche chiffrée pour l'owner : du cash vendu jamais facturé." },
  { key: "billing_contact", icon: "👤", label: "Contacts facturation à créer", description: "Email de facturation présent côté Stripe/Pennylane mais absent du CRM → crée le contact rattaché à l'entreprise (débloque la règle « email exact »)." },
];

const HIDDEN_KEY = "revold:actions-hidden";
const PAGESIZE_KEY = "revold:actions-pagesize";
const PAGE_SIZES = [15, 20, 50] as const;

function readHidden(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function sourceLabel(source: string): string {
  if (source === "detector:silent_deal") return "Détecteur · deals silencieux";
  if (source === "detector:overdue_invoice") return "Détecteur · impayés";
  if (source === "detector:duplicate_merge") return "Règles de déduplication";
  if (source === "detector:crm_enrich") return "Détecteur · enrichissement CRM";
  if (source === "detector:link_company") return "Détecteur · rapprochement";
  if (source === "detector:renewal_deal") return "Détecteur · renouvellements";
  if (source === "detector:revenue_leakage") return "Détecteur · revenue leakage";
  if (source === "detector:billing_contact") return "Détecteur · contacts facturation";
  if (source.startsWith("agent:")) return `Agent · ${source.slice(6)}`;
  return source;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ActionsInbox() {
  const [pending, setPending] = useState<ActionItem[] | null>(null);
  const [history, setHistory] = useState<ActionItem[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Filtres : type d'action + outil ("" = tous) — appliqués à la file ET à l'historique.
  const [typeFilter, setTypeFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  // Catalogue : familles de détecteurs masquées (préférence locale).
  const [hidden, setHidden] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Pagination : 15 (défaut) / 20 / 50 lignes, préférence mémorisée.
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(0);

  async function load(hiddenKeys?: string[]) {
    try {
      const skip = (hiddenKeys ?? readHidden()).join(",");
      const res = await fetch(`/api/actions${skip ? `?skip=${encodeURIComponent(skip)}` : ""}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setNeedsMigration(Boolean(d.needsMigration));
      setPending(Array.isArray(d.pending) ? d.pending : []);
      setHistory(Array.isArray(d.history) ? d.history : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setPending([]);
    }
  }

  useEffect(() => {
    setHidden(readHidden());
    try {
      const v = Number(localStorage.getItem(PAGESIZE_KEY));
      if ((PAGE_SIZES as readonly number[]).includes(v)) setPageSize(v);
    } catch {}
    void load();
  }, []);

  function toggleCatalog(key: string) {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch {}
    setPage(0);
    void load(next);
  }

  function changePageSize(n: number) {
    setPageSize(n);
    setPage(0);
    try { localStorage.setItem(PAGESIZE_KEY, String(n)); } catch {}
  }

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
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  }

  // Types & outils réellement présents (file + historique) → options des filtres.
  const all = [...(pending ?? []), ...history];
  const presentTypes = [...new Set(all.map((a) => a.type))];
  const presentTools = [...new Set(all.map((a) => TYPE_META[a.type]?.tool).filter((t): t is string => !!t))];
  const matches = (a: ActionItem) =>
    (!typeFilter || a.type === typeFilter) && (!toolFilter || TYPE_META[a.type]?.tool === toolFilter);
  const shownPending = (pending ?? []).filter(matches);
  const shownHistory = history.filter(matches);

  // Pagination de la file (la préférence 15/20/50 s'applique aussi à l'historique).
  const pageCount = Math.max(1, Math.ceil(shownPending.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedPending = shownPending.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pagedHistory = shownHistory.slice(0, pageSize);

  return (
    <div className="space-y-6">
      {needsMigration && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          La table des actions n&apos;existe pas encore — applique la migration <code>action_items</code> pour activer la boîte d&apos;actions.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {/* ── Barre outils : catalogue des actions + lignes par page ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
        >
          📚 Catalogue des actions
          {hidden.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {ACTION_CATALOG.length - hidden.length}/{ACTION_CATALOG.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span>Lignes :</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changePageSize(n)}
              className={`rounded-md px-1.5 py-0.5 font-medium transition ${pageSize === n ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Catalogue : choisir les familles d'actions affichées ── */}
      {catalogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setCatalogOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-card-border bg-slate-50/70 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Catalogue des actions</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Choisis les familles d&apos;actions affichées dans la file — les familles masquées ne sont plus détectées.
                  Chaque action reste validée par toi avant exécution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                aria-label="Fermer"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-black/5 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {ACTION_CATALOG.map((c) => {
                const on = !hidden.includes(c.key);
                return (
                  <div key={c.key} className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${on ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-lg" aria-hidden>{c.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{c.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{c.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={c.label}
                      onClick={() => toggleCatalog(c.key)}
                      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? "bg-indigo-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${on ? "translate-x-[1.15rem]" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Filtres : par action et par outil ── */}
      {(presentTypes.length > 1 || presentTools.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500">Action :</span>
            <button
              type="button"
              onClick={() => setTypeFilter("")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!typeFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Toutes
            </button>
            {presentTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${typeFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {TYPE_META[t]?.icon} {TYPE_META[t]?.label ?? t}
              </button>
            ))}
          </div>
          {presentTools.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Outil :</span>
              <button
                type="button"
                onClick={() => setToolFilter("")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!toolFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Tous
              </button>
              {presentTools.map((t) => {
                const meta = Object.values(TYPE_META).find((m) => m.tool === t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToolFilter(toolFilter === t ? "" : t)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${toolFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {meta && <BrandLogo domain={meta.domain} alt={meta.toolLabel} fallback={meta.icon} size={12} />}
                    {meta?.toolLabel ?? t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── File d'attente : à valider ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          À valider
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{shownPending.length}</span>
        </h2>
        {pending === null ? (
          <p className="text-xs text-slate-400">Analyse de tes données…</p>
        ) : shownPending.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {pending.length === 0 ? "Aucune action en attente." : "Aucune action ne correspond aux filtres."}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Les détecteurs (deals silencieux, impayés, doublons à fusionner) et les agents alimentent cette file — reviens après ta prochaine synchronisation.
            </p>
          </div>
        ) : (
          pagedPending.map((a) => {
            const meta = TYPE_META[a.type];
            return (
              <div key={a.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {meta && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        <BrandLogo domain={meta.domain} alt={meta.label} fallback={meta.icon} size={12} />
                        {meta.label}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{sourceLabel(a.source)}</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{a.title}</p>
                  {a.description && <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => decide(a.id, "reject")}
                    disabled={busyId === a.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => decide(a.id, "approve")}
                    disabled={busyId === a.id || needsMigration}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                  >
                    {busyId === a.id ? "Exécution…" : "✓ Valider — exécuter"}
                  </button>
                </div>
              </div>
            );
          })
        )}
        {/* Pager de la file (quand elle dépasse une page) */}
        {shownPending.length > pageSize && (
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500">
            <span>
              {safePage * pageSize + 1}–{Math.min(shownPending.length, (safePage + 1) * pageSize)} sur {shownPending.length}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Page précédente"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Page suivante"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </section>

      {/* ── Historique : exécutées / refusées / en échec ── */}
      {shownHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            Historique
            {shownHistory.length > pageSize && (
              <span className="text-[11px] font-normal text-slate-400">({pageSize} dernières sur {shownHistory.length})</span>
            )}
          </h2>
          <div className="card divide-y divide-slate-100">
            {pagedHistory.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{a.title}</p>
                  {a.status === "failed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-rose-500">{a.result.detail}</p>
                  )}
                  {a.status === "executed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{a.result.detail}</p>
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
                    {a.status === "executed" ? "Exécutée" : a.status === "rejected" ? "Refusée" : "Échec"}
                  </span>
                  {a.decided_at && <span className="text-[10px] text-slate-400">{fmtDate(a.decided_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
