export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot, getDetectedIntegrations } from "@/lib/supabase/cached";
import Link from "next/link";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { AgentsFamily } from "@/components/agents/agents-family";
import { RevoldControlTower, RevoldControlTowerLocked } from "@/components/voice/revold-orb";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";
import { getConnectedTools, connectedCategoriesSet } from "@/lib/integrations/connected-tools";
import {
  buildContext,
  buildScenarios,
  fetchDismissals,
  fetchCrossSourceInsights,
  fetchDataModelInsights,
  selectInsights,
} from "./insights-ia/context";
import { buildIntegrationInsights } from "@/lib/audit/build-integration-insights";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { getOnboardingState, shouldShowOnboarding, onboardingProgress } from "@/lib/onboarding/state";
import { getPageCustomization, formatTileValue } from "@/lib/kpi/page-tiles";
import { allTileSuggestions } from "@/lib/kpi/tile-catalog";
import { resolveKpiValue } from "@/lib/alerts/kpi-resolver";
import { valueFromAggSpec } from "@/lib/alerts/agg-value";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { HomeHeroKpis, type HomeKpi, type HomeKpiSuggestion } from "@/components/home-hero-kpis";

export default async function DashboardOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // Onboarding : si pas complete et pas skipped, on affiche un banner d'invitation
  const onboardingState = await getOnboardingState(supabase, orgId);
  const showOnboardingBanner = shouldShowOnboarding(onboardingState);
  const onboardingPct = onboardingProgress(onboardingState);

  // Connexion HubSpot OAuth réelle (refresh_token + portal_id présents).
  // Source de vérité pour décider si on affiche le bandeau "Connectez HubSpot".
  const { data: hubspotRow } = await supabase
    .from("integrations")
    .select("refresh_token, portal_id")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .eq("is_active", true)
    .maybeSingle();
  const hubspotConnected = Boolean(hubspotRow?.refresh_token && hubspotRow?.portal_id);

  const [snapshot, connectedTools, ctx, dismissals, detectedIntegrations, tabCounts] = await Promise.all([
    getHubspotSnapshot(),
    getConnectedTools(supabase, orgId),
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    getDetectedIntegrations(), // request-cached, partagé avec les autres pages
    getTabCounts(supabase, orgId),
  ]);

  const connectedCats = connectedCategoriesSet(connectedTools);
  const { dismissedKeys } = dismissals;
  // Tour de contrôle vocale : réservée aux plans Growth et Scale.
  const controlTowerLocked = featureLocked(await getOrgPlan(supabase, orgId), "voice_control_tower");
  const integrationInsights = buildIntegrationInsights(detectedIntegrations);

  // ── Compteurs dashboard ──
  // Coaching à faire : insights ouverts (non dismissés) toutes catégories.
  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));
  const [crossSourceInsights, dataModelInsights] = await Promise.all([
    fetchCrossSourceInsights(supabase, orgId, dismissedKeys, connectedCats),
    fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys),
  ]);
  const coachingTotal =
    insightsByCategory.commercial.length +
    insightsByCategory.marketing.length +
    insightsByCategory.data.length +
    visibleIntegrationInsights.length +
    crossSourceInsights.length +
    dataModelInsights.length;

  // Simulations IA : nb de scenarios après gating par outil connecté.
  const simulationsTotal = buildScenarios(ctx, connectedCats).length;

  // Rapports actionnables : activés + suggestions disponibles.
  const reportsTotal = tabCounts.myCount + tabCounts.singleCount + tabCounts.multiCount;

  // Données Revenue analysées : volume total d'entités revenue traitées.
  // Deals (HubSpot) + factures + abonnements (Stripe/Pennylane si connecté).
  const revenueRecordsTotal =
    (ctx.totalDeals ?? 0) +
    (ctx.invoicesCount ?? 0) +
    (ctx.subscriptionsCount ?? 0);

  const activeIntegrations = connectedTools.length;

  // ── Bloc héro personnalisable : catalogue de KPIs + sélection persistée
  // (page_tiles, page_key « home_hero ») — 5 affichés maximum. ──
  // Volumes RÉELS comptés sur les tables canoniques (le contexte insights peut
  // sous-compter → plus de suggestions à 0 quand la donnée existe).
  const countRows = async (table: string): Promise<number | null> => {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId);
      return error ? null : count ?? 0;
    } catch {
      return null;
    }
  };
  const [dealsCount, invoicesCount, subsCount, contactsCount, companiesCount, ticketsCount, txCount] =
    await Promise.all([
      countRows("deals"),
      countRows("invoices"),
      countRows("subscriptions"),
      countRows("contacts"),
      countRows("companies"),
      countRows("tickets"),
      countRows("bank_transactions"),
    ]);

  const HOME_KPIS: HomeKpi[] = [
    {
      id: "integrations",
      label: "Intégrations actives",
      value: String(activeIntegrations),
      hint: activeIntegrations === 0 ? "Connecter mes outils" : "Gérer →",
      href: "/dashboard/integration",
      color: "text-accent",
    },
    { id: "coaching", label: "Coachings à faire", value: coachingTotal.toLocaleString("fr-FR"), href: "/dashboard/insights-ia", color: "text-fuchsia-600" },
    { id: "previsions", label: "Prévisions", value: simulationsTotal.toLocaleString("fr-FR"), href: "/dashboard/simulations", color: "text-amber-600" },
    { id: "rapports", label: "Rapports actionnables", value: reportsTotal.toLocaleString("fr-FR"), href: "/dashboard/rapports", color: "text-emerald-600" },
    { id: "revenue", label: "Données Revenue analysées", value: revenueRecordsTotal.toLocaleString("fr-FR"), href: "/dashboard/performances", color: "text-teal-600" },
    { id: "deals", label: "Deals analysés", value: (dealsCount ?? ctx.totalDeals ?? 0).toLocaleString("fr-FR"), href: "/dashboard/performances", color: "text-indigo-600" },
    { id: "invoices", label: "Factures analysées", value: (invoicesCount ?? ctx.invoicesCount ?? 0).toLocaleString("fr-FR"), href: "/dashboard/audit/paiement-facturation", color: "text-sky-600" },
    { id: "subscriptions", label: "Abonnements suivis", value: (subsCount ?? ctx.subscriptionsCount ?? 0).toLocaleString("fr-FR"), href: "/dashboard/audit/paiement-facturation", color: "text-violet-600" },
    { id: "contacts", label: "Contacts", value: (contactsCount ?? snapshot.totalContacts).toLocaleString("fr-FR"), href: "/dashboard/performances/marketing", color: "text-rose-600" },
    { id: "companies", label: "Entreprises", value: (companiesCount ?? snapshot.totalCompanies).toLocaleString("fr-FR"), href: "/dashboard/donnees", color: "text-cyan-600" },
    { id: "tickets", label: "Tickets support", value: (ticketsCount ?? 0).toLocaleString("fr-FR"), href: "/dashboard/audit/service-client", color: "text-orange-600" },
    { id: "transactions", label: "Transactions bancaires", value: (txCount ?? 0).toLocaleString("fr-FR"), href: "/dashboard/audit/paiement-facturation", color: "text-lime-600" },
  ];
  const DEFAULT_HOME_KPIS = ["integrations", "coaching", "previsions", "rapports", "revenue"];
  const homeCust = await getPageCustomization(supabase, orgId, "home_hero");

  // ── Suggestions PERSONNALISÉES (catalogue complet des KPIs par pôle) :
  // celles sélectionnées sont résolues ici (forecast_type ou agg_spec), les
  // autres sont proposées dans la liste exhaustive « ＋ Plus de KPIs ». ──
  const allSuggestions = allTileSuggestions();
  const TEAM_HREF: Record<string, string> = {
    sales: "/dashboard/performances",
    marketing: "/dashboard/performances/marketing",
    cs: "/dashboard/audit/service-client",
    revops: "/dashboard/reporting",
    ops: "/dashboard/donnees",
    billing: "/dashboard/audit/paiement-facturation",
    support: "/dashboard/audit/service-client",
  };
  const storedIds = homeCust.tileOrder.filter(
    (id) => HOME_KPIS.some((k) => k.id === id) || (id.startsWith("sug:") && allSuggestions.some((s) => `sug:${s.id}` === id)),
  );
  const selectedHomeKpis = (storedIds.length > 0 ? storedIds : DEFAULT_HOME_KPIS).slice(0, 5);
  // Résolution des suggestions sélectionnées (5 max → coût borné).
  const pickedSuggestions = selectedHomeKpis
    .filter((id) => id.startsWith("sug:"))
    .map((id) => allSuggestions.find((s) => `sug:${s.id}` === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (pickedSuggestions.length > 0) {
    const token = pickedSuggestions.some((s) => s.aggSpec) ? await getHubSpotToken(supabase, orgId) : null;
    await Promise.all(
      pickedSuggestions.map(async (s) => {
        let value: number | null = null;
        try {
          if (s.forecastType) value = await resolveKpiValue(supabase, orgId, s.forecastType);
          else if (s.aggSpec) value = await valueFromAggSpec(supabase, orgId, token, s.aggSpec);
        } catch {}
        HOME_KPIS.push({
          id: `sug:${s.id}`,
          label: s.label,
          value: formatTileValue(value, s.unit),
          href: TEAM_HREF[s.team] ?? "/dashboard/reporting",
          color: "text-indigo-600",
        });
      }),
    );
  }
  const homeSuggestions: HomeKpiSuggestion[] = allSuggestions.map((s) => ({
    id: `sug:${s.id}`,
    label: s.label,
    description: s.description,
    group: s.team,
  }));

  // ── Cards des sections principales — actionables, sans badge score ──
  const sections = [
    {
      label: "Données",
      description: "Diagnostiquez la santé de toute votre stack connectée : CRM, facturation, publicité, support — qualité, process, performances, adoption.",
      href: "/dashboard/audit",
      cta: "Lancer le diagnostic",
      gradient: "from-blue-500 to-indigo-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      label: "Coaching IA",
      description: "Transformez vos données en plans d'action concrets pour vos équipes.",
      href: "/dashboard/insights-ia",
      cta: "Voir les coachings",
      gradient: "from-fuchsia-500 to-pink-500",
      ai: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
        </svg>
      ),
    },
    {
      label: "Rapports",
      description: "Construisez des rapports sur mesure pour piloter ce qui compte vraiment.",
      href: "/dashboard/rapports",
      cta: "Créer un rapport",
      gradient: "from-emerald-500 to-teal-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      ),
    },
    {
      label: "Prévisions",
      description: "Projetez votre closing, votre revenue et votre pipeline en scénarios bas / base / haut.",
      href: "/dashboard/simulations",
      cta: "Lancer une prévision",
      gradient: "from-amber-500 to-orange-500",
      ai: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
    {
      label: "Intégrations",
      description: "Connectez votre CRM, facturation, publicité (Google, Meta, LinkedIn), téléphonie et service client.",
      href: "/dashboard/integration",
      cta: activeIntegrations > 0 ? "Gérer les intégrations" : "Connecter mes outils",
      gradient: "from-violet-500 to-fuchsia-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
    },
    {
      label: "Suivi",
      description: "Alertes, objectifs et calendrier : surveillez vos seuils et soyez prévenu dès qu'un KPI décroche.",
      href: "/dashboard/mes-alertes",
      cta: "Voir mes alertes",
      gradient: "from-rose-500 to-red-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
  ];

  return (
    <section className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-500">
          {hubspotConnected
            ? "Synthèse globale de votre intelligence revenue."
            : "Bienvenue sur Revold. Connectez votre stack revenue pour démarrer."}
        </p>
      </header>

      {/* Onboarding banner — visible tant que l'org n'a pas terminé le wizard */}
      {showOnboardingBanner && (
        <Link
          href="/dashboard/onboarding"
          className="block rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-white to-indigo-50 p-5 transition hover:border-fuchsia-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">
                Onboarding {onboardingPct}% terminé
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Activez votre Revenue Intelligence en moins de 5 minutes
              </p>
              <p className="mt-1 text-xs text-slate-500">
                4 étapes : connecter HubSpot, choisir vos équipes, lancer le sync, voir votre 1er insight.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white">
              Continuer →
            </span>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500"
              style={{ width: `${onboardingPct}%` }}
            />
          </div>
        </Link>
      )}

      {/* Bandeau erreur snapshot (panne API HubSpot, token expiré, etc.) */}
      {snapshot.status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-medium">⚠ Erreur de synchronisation HubSpot</p>
          <p className="mt-1 text-xs">
            Les chiffres affichés peuvent être incomplets : {snapshot.error ?? "panne réseau"}.
            <Link href="/dashboard/parametres/integrations" className="ml-1 font-medium underline">
              Vérifier la connexion
            </Link>.
          </p>
        </div>
      )}

      {/* Photo de famille des agents IA + tour de contrôle vocale « Jarvis » :
          l'orbe route une demande dictée vers le bon agent, chat pré-exécuté.
          Réservée aux plans Growth et Scale — verrouillée sur Starter. */}
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AgentsFamily />
        </div>
        {controlTowerLocked ? <RevoldControlTowerLocked /> : <RevoldControlTower />}
      </div>

      {/* Hero — KPIs essentiels PERSONNALISABLES (retrait/ajout, 5 max) */}
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-indigo-500 to-fuchsia-500" />
        <HomeHeroKpis kpis={HOME_KPIS} initialSelected={selectedHomeKpis} suggestions={homeSuggestions} />
        {!hubspotConnected && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-amber-800">
                HubSpot non connecté. <Link href="/dashboard/integration" className="font-medium underline hover:no-underline">Connectez HubSpot via OAuth</Link> pour démarrer.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cards d'accès aux sections principales — sans badge score, force de proposition */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card group relative overflow-hidden p-5 transition hover:shadow-md hover:border-accent/30"
          >
            {/* Halo gradient au hover */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.gradient}`} />

            <div className="flex items-start gap-3">
              <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient} text-white shadow-sm`}>
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent transition">
                    {s.label}
                  </h3>
                  {s.ai && (
                    <span className="rounded-full bg-gradient-to-r from-amber-100 to-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-fuchsia-700">
                      IA
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{s.description}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-accent group-hover:underline">
                {s.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* AI Insight — Locked / Upgrade required */}
      <InsightLockedBlock
        previewTitle="Analyse stratégique de votre pipeline RevOps"
        previewBody="L'IA Revold analyse en continu vos données CRM pour identifier les opportunités cachées, les risques émergents et les actions prioritaires à mener."
      />
    </section>
  );
}
