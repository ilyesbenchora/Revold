/**
 * Bloc "Synchronisation des blocs" — remplace l'ancien historique de
 * synchronisation. Affiche, pour chaque grande famille de données HubSpot,
 * l'état de synchronisation observé en live :
 *   - ok      : la donnée est lisible et synchronisée
 *   - vide    : ok mais 0 record (parfois normal — addon non utilisé)
 *   - bloqué  : scope manquant, addon HubSpot manquant, ou erreur réseau
 *
 * Les statuts proviennent du snapshot.kpiDiagnostics calculé par
 * fetchHubSpotSnapshot — c'est la même source que celle utilisée par les
 * cartes KPI du dashboard, donc parfaitement cohérent.
 */

import type { HubspotSnapshotResult } from "@/lib/supabase/cached";
import type { KpiDiagnosticEntry, KpiStatus } from "@/lib/integrations/hubspot-snapshot";

type Block = {
  id: string;
  label: string;
  description: string;
  count: number;
  diagKeys: string[]; // tous les KPI diagnostics qui contribuent à ce bloc
};

function buildBlocks(snapshot: HubspotSnapshotResult): Block[] {
  return [
    {
      id: "contacts",
      label: "Contacts",
      description: "Personnes synchronisées depuis HubSpot",
      count: snapshot.totalContacts,
      diagKeys: ["totalContacts"],
    },
    {
      id: "companies",
      label: "Entreprises",
      description: "Comptes / sociétés synchronisées",
      count: snapshot.totalCompanies,
      diagKeys: ["totalCompanies"],
    },
    {
      id: "deals",
      label: "Deals & pipelines",
      description: "Opportunités, étapes et pipelines de vente",
      count: snapshot.totalDeals,
      diagKeys: ["totalDeals", "wonDeals", "lostDeals"],
    },
    {
      id: "tickets",
      label: "Tickets",
      description: "Service Hub — tickets de support",
      count: snapshot.totalTickets,
      diagKeys: ["totalTickets"],
    },
    {
      id: "billing",
      label: "Paiement & facturation",
      description: "Invoices, subscriptions et quotes",
      count:
        snapshot.totalInvoices + snapshot.totalSubscriptions + snapshot.totalQuotes,
      diagKeys: ["totalInvoices", "totalSubscriptions", "totalQuotes"],
    },
    {
      id: "marketing",
      label: "Marketing",
      description: "Forms, lists, campaigns, events",
      count:
        snapshot.formsCount +
        snapshot.listsCount +
        snapshot.marketingCampaignsCount +
        snapshot.marketingEventsCount,
      diagKeys: ["formsCount", "listsCount", "marketingCampaignsCount", "marketingEventsCount"],
    },
    {
      id: "automations",
      label: "Automatisations",
      description: "Workflows actifs et goals",
      count: snapshot.workflowsActiveCount + snapshot.goalsCount,
      diagKeys: ["workflowsCount", "workflowsActiveCount", "goalsCount"],
    },
    {
      id: "engagements",
      label: "Activités commerciales",
      description: "Appels, emails, meetings, notes, tasks",
      count: 0,
      diagKeys: ["calls", "emails", "meetings", "notes", "tasks"],
    },
    {
      id: "custom",
      label: "Custom objects",
      description: "Objets personnalisés détectés sur le portail",
      count: snapshot.customObjectsCount,
      diagKeys: ["customObjectsCount"],
    },
    {
      id: "users",
      label: "Utilisateurs & équipes",
      description: "Owners, teams et adoption interne",
      count: snapshot.usersCount + snapshot.teamsCount,
      diagKeys: ["ownersCount", "usersCount", "teamsCount"],
    },
  ];
}

function aggregateStatus(
  diag: Record<string, KpiDiagnosticEntry>,
  keys: string[],
): { status: "ok" | "partial" | "blocked" | "unknown"; entries: Array<[string, KpiDiagnosticEntry]> } {
  const entries = keys
    .map((k) => [k, diag[k]] as const)
    .filter(([, e]) => e !== undefined) as Array<[string, KpiDiagnosticEntry]>;
  if (entries.length === 0) return { status: "unknown", entries };
  const okCount = entries.filter(([, e]) => e.status === "ok").length;
  const blockedCount = entries.filter(([, e]) => e.status !== "ok").length;
  if (blockedCount === 0) return { status: "ok", entries };
  if (okCount === 0) return { status: "blocked", entries };
  return { status: "partial", entries };
}

function statusLabel(status: KpiStatus): string {
  switch (status) {
    case "ok":
      return "Synchronisé";
    case "no_scope":
      return "Scope manquant";
    case "addon_missing":
      return "Addon HubSpot manquant";
    case "bad_property":
      return "Propriété introuvable";
    case "endpoint_error":
      return "Erreur endpoint";
    case "network_error":
      return "Erreur réseau";
  }
}

export function SyncBlocksStatus({ snapshot }: { snapshot: HubspotSnapshotResult }) {
  const blocks = buildBlocks(snapshot);
  const diag = snapshot.kpiDiagnostics ?? {};

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-card-border bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          État live de la synchronisation par bloc — calculé à chaque chargement de cette page.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => {
          const agg = aggregateStatus(diag, b.diagKeys);
          const dotColor =
            agg.status === "ok"
              ? "bg-emerald-500"
              : agg.status === "partial"
                ? "bg-amber-500"
                : agg.status === "blocked"
                  ? "bg-red-500"
                  : "bg-slate-300";
          const badgeBg =
            agg.status === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : agg.status === "partial"
                ? "bg-amber-50 text-amber-700"
                : agg.status === "blocked"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-500";
          const badgeText =
            agg.status === "ok"
              ? "Synchronisé"
              : agg.status === "partial"
                ? "Partiel"
                : agg.status === "blocked"
                  ? "Bloqué"
                  : "Non observé";

          // Premier statut non-ok pour expliquer la cause si bloqué/partiel
          const issue = agg.entries.find(([, e]) => e.status !== "ok")?.[1];

          return (
            <article key={b.id} className="bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    <p className="text-sm font-semibold text-slate-900">{b.label}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{b.description}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeBg}`}
                >
                  {badgeText}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Records détectés</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {b.count > 0 ? b.count.toLocaleString("fr-FR") : "—"}
                  </p>
                </div>
                {issue && (
                  <p className="max-w-[60%] text-right text-[10px] text-slate-500">
                    {statusLabel(issue.status)}
                    {issue.httpCode ? ` (HTTP ${issue.httpCode})` : ""}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
