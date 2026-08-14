/**
 * Carte d'audit d'un outil connecté (volumes importés, méthodes de
 * rapprochement, couverture des identifiants, statut de sync) — affichée sur
 * Audit données → Vue d'ensemble. Serveur, zéro état.
 */

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { MATCH_LABELS, IDENTIFIER_LABELS, type ToolAuditData } from "@/lib/audit/onboarding-audit";

const ENTITY_LABELS: Record<string, string> = {
  contact: "Contacts",
  company: "Entreprises",
  deal: "Deals",
  invoice: "Factures",
  supplier_invoice: "Factures fournisseurs",
  subscription: "Abonnements",
  payment: "Paiements",
  ticket: "Tickets",
};

const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  billing: "Facturation & paiement",
  support: "Support",
  phone: "Téléphonie",
  conv_intel: "Conversation intelligence",
  files: "Fichiers",
  ads: "Publicité",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function pctOf(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

export function ToolAuditCard({ tool }: { tool: ToolAuditData }) {
  const r = tool.report;
  const entityEntries = Object.entries(tool.entityCounts);
  const matchEntries = r ? Object.entries(r.contact_match ?? {}) : [];
  const companyMatchEntries = r ? Object.entries(r.company_match ?? {}) : [];
  // Couverture LIMITÉE aux identifiants mappés dans Paramètres → Modèle de
  // données : on suit l'enrichissement des champs CHOISIS, comparables entre
  // outils — pas tout le catalogue.
  const mapped = new Set(tool.mappedIdentifierFields);
  const coverageEntries = r
    ? Object.entries(r.identifier_coverage ?? {}).filter(([field]) => mapped.has(field))
    : [];
  const syncOk = tool.lastSync != null && tool.lastSync.status !== "failed" && tool.lastSync.status !== "pending";

  return (
    <article className="card overflow-hidden">
      {/* Header outil */}
      <div className="flex items-center gap-3 border-b border-card-border bg-slate-50/60 px-5 py-4">
        <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={28} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{tool.label}</p>
          <p className="text-[11px] text-slate-500">{CATEGORY_LABELS[tool.category] ?? tool.category}</p>
        </div>
        <div className="ml-auto text-right">
          {tool.lastSync ? (
            <>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  syncOk
                    ? "bg-emerald-50 text-emerald-700"
                    : tool.lastSync.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {syncOk ? "Synchronisé" : tool.lastSync.status === "failed" ? "Échec" : "En attente"}
              </span>
              <p className="mt-0.5 text-[10px] text-slate-400">{fmtDate(tool.lastSync.at)}</p>
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Jamais synchronisé
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Volumes rapprochés */}
        {entityEntries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entityEntries.map(([type, count]) => (
              <span key={type} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">{count.toLocaleString("fr-FR")}</span>{" "}
                {ENTITY_LABELS[type] ?? type}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Aucune entité rapprochée pour l&apos;instant — lancez une synchronisation depuis{" "}
            <Link href="/dashboard/parametres/integrations" className="font-medium text-accent hover:underline">
              Paramètres → Intégrations
            </Link>
            .
          </p>
        )}

        {/* Méthodes de rapprochement */}
        {r && (companyMatchEntries.length > 0 || matchEntries.length > 0) && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Rapprochements ({companyMatchEntries.length > 0 ? "entreprises" : "contacts"})
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(companyMatchEntries.length > 0 ? companyMatchEntries : matchEntries).map(([method, count]) => (
                <span
                  key={method}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    ["siren", "vat_number", "siret", "existing_link", "exact_email"].includes(method)
                      ? "bg-emerald-50 text-emerald-700"
                      : method === "created"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {MATCH_LABELS[method] ?? method} · {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Couverture des identifiants MAPPÉS (Paramètres → Modèle de données) */}
        {coverageEntries.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Aucun identifiant mappé pour {tool.label} — mappe SIREN, N° TVA… dans{" "}
            <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
              Paramètres → Modèle de données → Mapping des identifiants
            </Link>{" "}
            pour suivre leur enrichissement ici, outil par outil.
          </p>
        )}
        {coverageEntries.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Enrichissement des identifiants mappés · {tool.label}
            </p>
            <div className="mt-1.5 space-y-1">
              {coverageEntries.map(([field, cov]) => {
                const p = pctOf(cov.present, cov.total);
                return (
                  <div key={field} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-slate-600">{IDENTIFIER_LABELS[field] ?? field}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${p >= 70 ? "bg-emerald-500" : p >= 30 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right font-medium text-slate-700">{p}%</span>
                    <code className="hidden w-40 shrink-0 truncate text-[10px] text-slate-400 md:block" title={cov.path}>
                      {cov.path}
                      {cov.overridden ? " (custom)" : ""}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Records ignorés */}
        {r && Object.keys(r.unmatched ?? {}).length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800">
            {Object.entries(r.unmatched).map(([kind, count]) => (
              <p key={kind}>
                {count} record{count > 1 ? "s" : ""} ignoré{count > 1 ? "s" : ""} : {kind.replaceAll("_", " ")}
              </p>
            ))}
          </div>
        )}

        {/* Pages alimentées */}
        <p className="text-[11px] text-slate-400">
          {tool.mappedPages > 0
            ? `Alimente ${tool.mappedPages} page${tool.mappedPages > 1 ? "s" : ""} de la plateforme.`
            : "N'alimente encore aucune page — à activer dans Paramètres → Intégrations → Outil source par page."}
        </p>
      </div>
    </article>
  );
}
