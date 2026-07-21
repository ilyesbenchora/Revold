export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Audit qualité → Audit onboarding.
 *
 * Tout ce que Revold détecte quand un outil est branché, outil par outil :
 * volumes importés, méthodes de rapprochement réellement utilisées, couverture
 * des identifiants (SIREN, TVA, email…) et manques bloquants — puis un plan
 * d'action IA activable en coaching, incluant les optimisations de process
 * internes côté client (ex. renseigner le SIREN dans l'outil de facturation).
 *
 * Par défaut : 0 source = invite à connecter. Tout est dynamique dès qu'un
 * outil est branché — y compris un outil jamais testé, grâce au mapping
 * configurable (Paramètres → Modèle de données).
 */

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { BrandLogo } from "@/components/brand-logo";
import { RecommendationCard } from "@/components/recommendation-card";
import {
  loadToolAudits,
  buildOnboardingRecommendations,
  MATCH_LABELS,
  IDENTIFIER_LABELS,
  type ToolAuditData,
} from "@/lib/audit/onboarding-audit";

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

function ToolAuditCard({ tool }: { tool: ToolAuditData }) {
  const r = tool.report;
  const entityEntries = Object.entries(tool.entityCounts);
  const matchEntries = r ? Object.entries(r.contact_match ?? {}) : [];
  const companyMatchEntries = r ? Object.entries(r.company_match ?? {}) : [];
  const coverageEntries = r
    ? Object.entries(r.identifier_coverage ?? {}).filter(([field]) => field !== "external_id")
    : [];

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
                  tool.lastSync.status === "completed"
                    ? "bg-emerald-50 text-emerald-700"
                    : tool.lastSync.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {tool.lastSync.status === "completed" ? "Synchronisé" : tool.lastSync.status === "failed" ? "Échec" : "En attente"}
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

        {/* Couverture des identifiants */}
        {coverageEntries.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Identifiants détectés dans {tool.label}
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

export default async function OnboardingAuditPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const connected = (await getConnectedTools(supabase, orgId)).filter((t) => t.category !== "communication");

  // 0 source par défaut : rien d'autre qu'une invite claire.
  if (connected.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Aucun outil connecté pour l&apos;instant</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          L&apos;audit d&apos;onboarding démarre dès votre premier outil branché : Revold analyse ce qu&apos;il
          détecte (volumes, identifiants, rapprochements) et vous dit exactement quoi optimiser — dans
          Revold comme dans vos outils.
        </p>
        <Link
          href="/dashboard/parametres/integrations"
          className="mt-5 inline-block rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg"
        >
          Connecter un premier outil →
        </Link>
      </div>
    );
  }

  const audits = await loadToolAudits(supabase, orgId, connected);
  const recommendations = buildOnboardingRecommendations(audits);

  return (
    <div className="space-y-8">
      {/* Bandeau explicatif */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-fuchsia-50/40 p-4">
        <p className="text-sm font-semibold text-indigo-900">
          Ce que Revold a détecté en branchant vos outils, un par un
        </p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800">
          Volumes importés, méthodes de rapprochement réellement utilisées et couverture de vos identifiants
          (SIREN, N° TVA, email). Le mapping des champs est configurable dans{" "}
          <Link href="/dashboard/parametres/modele-donnees" className="font-medium underline">
            Paramètres → Modèle de données
          </Link>{" "}
          — c&apos;est la source de vérité : corrigez un chemin, relancez la sync, l&apos;audit se met à jour.
        </p>
      </div>

      {/* Audit par outil */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {audits.map((tool) => (
          <ToolAuditCard key={tool.key} tool={tool} />
        ))}
      </div>

      {/* Plan d'action IA */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Plan d&apos;action IA</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Les actions détectées par l&apos;audit — configuration Revold ET optimisations de process internes
            dans vos outils. Activez une action pour la transformer en coaching IA suivi.
          </p>
        </div>
        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
            <p className="text-sm font-semibold text-emerald-800">Rien à signaler 🎉</p>
            <p className="mt-1 text-xs text-emerald-700">
              Vos outils sont synchronisés, rapprochés et alimentent la plateforme. L&apos;audit se met à jour
              à chaque synchronisation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recommendations.map((reco) => (
              <RecommendationCard key={reco.id} reco={reco} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
