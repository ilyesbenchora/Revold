/**
 * Synchronisation des blocs — vue par PAGE REVOLD.
 *
 * Pour chaque page Revold (audit/dashboard/simulation/coaching), on agrège
 * l'état des KPI HubSpot que cette page consomme. La source est
 * snapshot.kpiDiagnostics (mêmes clés que celles trackées par
 * fetchHubSpotSnapshot) — donc parfaitement cohérent avec ce que voit
 * l'utilisateur sur les pages elles-mêmes.
 */

import Link from "next/link";
import type { HubspotSnapshotResult } from "@/lib/supabase/cached";
import type { KpiDiagnosticEntry, KpiStatus } from "@/lib/integrations/hubspot-snapshot";

type RevoldPage = {
  id: string;
  label: string;
  href: string;
  description: string;
  diagKeys: string[];
  /** Si > 0 alors la page a des données (utilisé pour ne pas afficher
   *  "Non observé" quand les counts sont en réalité présents). */
  evidenceCount: number;
};

function buildPages(snapshot: HubspotSnapshotResult): RevoldPage[] {
  return [
    // ── Audit ──
    {
      id: "audit_donnees",
      label: "Données — Propriétés",
      href: "/dashboard/donnees",
      description: "Contacts, entreprises, transactions et qualité de la base CRM",
      diagKeys: [
        "totalContacts",
        "totalCompanies",
        "totalDeals",
        "orphansCount",
        "contactsNoPhone",
        "contactsNoTitle",
        "contactsNoEmail",
        "companiesNoIndustry",
        "companiesNoDomain",
        "companiesNoRevenue",
      ],
      evidenceCount: snapshot.totalContacts + snapshot.totalCompanies + snapshot.totalDeals,
    },
    {
      id: "audit_automatisations",
      label: "Données — Automatisations",
      href: "/dashboard/process",
      description: "Workflows actifs et règles d'automatisation HubSpot",
      diagKeys: [],
      evidenceCount: snapshot.workflowsActiveCount,
    },
    {
      id: "audit_perf_ventes",
      label: "Données — Performances Ventes",
      href: "/dashboard/performances/commerciale",
      description: "Pipeline, deals, closing rate, forecast",
      diagKeys: [
        "totalDeals",
        "wonDeals",
        "lostDeals",
        "totalPipelineAmount",
        "wonAmount",
        "stagnantDeals",
        "dealsAtRisk",
        "dealsNoNextActivity",
        "dealsNoAmount",
        "dealsNoCloseDate",
      ],
      evidenceCount: snapshot.totalDeals,
    },
    {
      id: "audit_perf_marketing",
      label: "Données — Performances Marketing",
      href: "/dashboard/performances/marketing",
      description: "Funnel d'acquisition, formulaires et campagnes marketing",
      diagKeys: ["totalContacts", "forms", "marketing_campaigns", "marketing_events"],
      evidenceCount: snapshot.totalContacts + snapshot.formsCount + snapshot.marketingCampaignsCount,
    },
    {
      id: "audit_paiement_facturation",
      label: "Données — Paiement & Facturation",
      href: "/dashboard/audit/paiement-facturation",
      description: "Invoices, subscriptions, quotes et line items",
      diagKeys: [
        "invoices",
        "subscriptions",
        "quotes",
        "line_items",
        "paidInvoices",
        "unpaidInvoices",
        "activeSubscriptions",
      ],
      evidenceCount:
        snapshot.totalInvoices + snapshot.totalSubscriptions + snapshot.totalQuotes,
    },
    {
      id: "audit_adoption",
      label: "Données — Équipes",
      href: "/dashboard/conduite-changement",
      description: "Owners, équipes, utilisateurs et discipline d'usage",
      diagKeys: ["ownersCount", "users", "goals"],
      evidenceCount: snapshot.ownersCount + snapshot.usersCount + snapshot.teamsCount,
    },

    // ── Dashboard ──
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard/rapports/mes-rapports",
      description: "KPIs en temps réel — vue cross-objet pour le pilotage",
      diagKeys: [
        "totalContacts",
        "totalCompanies",
        "totalDeals",
        "wonDeals",
        "totalPipelineAmount",
      ],
      evidenceCount: snapshot.totalDeals + snapshot.totalContacts,
    },

    // ── Simulations IA ──
    {
      id: "simulation_ia",
      label: "Simulations IA",
      href: "/dashboard/alertes",
      description: "Simulations cycle de vente, revenue et data quality",
      diagKeys: [
        "totalDeals",
        "wonDeals",
        "lostDeals",
        "totalContacts",
        "totalPipelineAmount",
        "stagnantDeals",
      ],
      evidenceCount: snapshot.totalDeals + snapshot.totalContacts,
    },

    // ── Coaching IA ──
    {
      id: "coaching_ia",
      label: "Coaching IA",
      href: "/dashboard/insights-ia",
      description: "Insights IA Ventes / Marketing / Data / Intégrations",
      diagKeys: [
        "totalDeals",
        "totalContacts",
        "totalCompanies",
        "leads",
        "forms",
        "marketing_campaigns",
      ],
      evidenceCount: snapshot.totalDeals + snapshot.totalContacts + snapshot.formsCount,
    },
  ];
}

function aggregateStatus(
  diag: Record<string, KpiDiagnosticEntry>,
  keys: string[],
): {
  status: "ok" | "partial" | "blocked" | "rate_limited" | "unknown";
  entries: Array<[string, KpiDiagnosticEntry]>;
} {
  const entries = keys
    .map((k) => [k, diag[k]] as const)
    .filter(([, e]) => e !== undefined) as Array<[string, KpiDiagnosticEntry]>;
  if (entries.length === 0) return { status: "unknown", entries };
  const okCount = entries.filter(([, e]) => e.status === "ok").length;
  const blocked = entries.filter(([, e]) => e.status !== "ok");
  const rateLimited = blocked.filter(([, e]) => e.httpCode === 429);
  if (blocked.length === 0) return { status: "ok", entries };
  // Si la majorité des erreurs sont des 429, on flag spécifiquement
  if (rateLimited.length > 0 && rateLimited.length === blocked.length) {
    return { status: "rate_limited", entries };
  }
  if (okCount === 0) return { status: "blocked", entries };
  return { status: "partial", entries };
}

function statusLabel(s: KpiStatus, httpCode?: number): string {
  if (httpCode === 429) return "Rate limit HubSpot (429)";
  switch (s) {
    case "ok":
      return "Synchronisé";
    case "no_scope":
      return "Scope manquant";
    case "addon_missing":
      return "Addon HubSpot non activé";
    case "bad_property":
      return "Propriété introuvable";
    case "endpoint_error":
      return "Erreur endpoint";
    case "network_error":
      return "Erreur réseau";
  }
}

export function SyncBlocksStatus({ snapshot }: { snapshot: HubspotSnapshotResult }) {
  const pages = buildPages(snapshot);
  const diag = snapshot.kpiDiagnostics ?? {};

  // Détecte si AU MOINS un KPI est en 429 → on affiche un encart d'aide
  const has429 = Object.values(diag).some((e) => e?.httpCode === 429);

  return (
    <div className="space-y-4">
      {has429 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-bold">⚠ Rate limit HubSpot atteint (HTTP 429)</p>
          <p className="mt-1">
            HubSpot limite les apps OAuth à <strong>100 requêtes / 10 secondes</strong>{" "}
            (250k/jour Pro, 500k/jour Enterprise). Revold sature ce quota
            ponctuellement quand plusieurs pages sont chargées en parallèle.
          </p>
          <p className="mt-2 font-semibold">Pour résoudre :</p>
          <ul className="ml-4 mt-1 list-disc space-y-0.5">
            <li>
              Recharger la page dans 10–30 secondes : le cache request-scope
              se vide et HubSpot reset son compteur.
            </li>
            <li>
              Ne pas ouvrir plusieurs onglets Revold simultanément sur le même
              portail HubSpot.
            </li>
            <li>
              Si la limite est atteinte plusieurs fois par jour : passer le
              snapshot en cache persistant (Supabase) avec TTL 5–15 min, ou
              installer un proxy HubSpot avec throttling (max 8 requêtes
              concurrentes + retry exponentiel sur 429 via le header{" "}
              <code className="rounded bg-amber-100 px-1">Retry-After</code>).
            </li>
            <li>
              Vérifier dans{" "}
              <a
                href="https://app.hubspot.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                HubSpot &rarr; API usage
              </a>{" "}
              le quota quotidien restant.
            </li>
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-card-border bg-slate-50 px-5 py-3">
          <p className="text-xs text-slate-500">
            État live de la synchronisation par <strong>page Revold</strong> —
            calculé à chaque chargement de cette page.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => {
            const agg = aggregateStatus(diag, p.diagKeys);
            // Si on n'a pas de diag entries pour cette page mais qu'on a des
            // données réelles (ex: workflows compté hors diag map) → on
            // considère "ok" plutôt que "non observé".
            const effective =
              agg.status === "unknown" && p.evidenceCount > 0 ? "ok" : agg.status;
            const dotColor =
              effective === "ok"
                ? "bg-emerald-500"
                : effective === "partial"
                  ? "bg-amber-500"
                  : effective === "rate_limited"
                    ? "bg-amber-500"
                    : effective === "blocked"
                      ? "bg-red-500"
                      : "bg-slate-300";
            const badgeBg =
              effective === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : effective === "partial"
                  ? "bg-amber-50 text-amber-700"
                  : effective === "rate_limited"
                    ? "bg-amber-50 text-amber-700"
                    : effective === "blocked"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-500";
            const badgeText =
              effective === "ok"
                ? "Synchronisé"
                : effective === "partial"
                  ? "Partiel"
                  : effective === "rate_limited"
                    ? "Rate limit"
                    : effective === "blocked"
                      ? "Bloqué"
                      : "Non observé";

            const issue = agg.entries.find(([, e]) => e.status !== "ok")?.[1];

            return (
              <article key={p.id} className="bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                      <Link
                        href={p.href}
                        className="text-sm font-semibold text-slate-900 hover:text-accent"
                      >
                        {p.label}
                      </Link>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{p.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeBg}`}
                  >
                    {badgeText}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Volume détecté
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {p.evidenceCount > 0
                        ? p.evidenceCount.toLocaleString("fr-FR")
                        : "—"}
                    </p>
                  </div>
                  {issue && (
                    <p className="max-w-[60%] text-right text-[10px] text-slate-500">
                      {statusLabel(issue.status, issue.httpCode)}
                      {issue.httpCode && issue.httpCode !== 429
                        ? ` (HTTP ${issue.httpCode})`
                        : ""}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
