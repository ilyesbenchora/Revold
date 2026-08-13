export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { loadSourceLinkStats } from "@/lib/integrations/source-link-stats";
import { BrandLogo } from "@/components/brand-logo";
import { BlockDataTable, type BlockTableRow } from "@/components/data-tables/block-data-table";
import { PageSourcesGate } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { BlocksManager } from "@/components/data-tables/blocks-manager";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { HBarChart } from "@/components/charts/hbar-chart";
// Conservé pour les cartes de synthèse par objet — ce n'est pas une vignette de titre de bloc.
import { BlockHeaderIcon } from "@/components/ventes-ui";
import Link from "next/link";

// Identifiants entreprise pilotés par les règles cochées dans Paramètres →
// Modèle de données → « Règles de résolution d'entités ». Une règle décochée
// fait disparaître sa métrique d'enrichissement du bloc Entreprises.
const COMPANY_RULE_IDENTIFIERS: Array<{
  ruleId: string;
  canonical: string;
  label: string;
  defaultEnabled: boolean;
  defaultField: string;
}> = [
  { ruleId: "siren_match", canonical: "siren", label: "SIREN", defaultEnabled: true, defaultField: "siren" },
  { ruleId: "siret_match", canonical: "siret", label: "SIRET", defaultEnabled: true, defaultField: "siret" },
  { ruleId: "vat_match", canonical: "vat_number", label: "N° TVA", defaultEnabled: true, defaultField: "vat_number" },
  { ruleId: "name_match", canonical: "company_name", label: "Nom", defaultEnabled: false, defaultField: "name" },
];

type SummaryMetric = { label: string; pct: number; missing?: boolean };

/** Libellés utilisateur des méthodes de rapprochement (match_method). */
const MATCH_METHOD_LABELS: Record<string, string> = {
  siren: "SIREN",
  siret: "SIRET",
  vat_number: "N° TVA",
  exact_email: "Email exact",
  domain: "Domaine",
  name: "Nom d'entreprise",
  existing_link: "Lien existant",
  created: "Créé sans correspondance",
};

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // ── Tout depuis HubSpot (snapshot) ──
  // Pour les "with X" on dérive depuis les "no X" du snapshot (total - noX)
  const contactsTotal = snapshot.totalContacts;
  const contactsPhone = Math.max(0, contactsTotal - snapshot.contactsNoPhone);
  const contactsCompany = Math.max(0, contactsTotal - snapshot.orphansCount);
  const contactsTitle = Math.max(0, contactsTotal - snapshot.contactsNoTitle);

  const companiesTotal = snapshot.totalCompanies;
  const companiesDomain = Math.max(0, companiesTotal - snapshot.companiesNoDomain);
  const companiesIndustry = Math.max(0, companiesTotal - snapshot.companiesNoIndustry);
  const companiesRevenue = Math.max(0, companiesTotal - snapshot.companiesNoRevenue);

  const dealsTotal = snapshot.totalDeals;
  const dealsAmount = Math.max(0, dealsTotal - snapshot.dealsNoAmount);
  const dealsCloseDate = Math.max(0, dealsTotal - snapshot.dealsNoCloseDate);

  // dealsWithOwner non dans snapshot — fetch direct rapide
  let dealsOwner = 0;
  if (hubspotToken) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        dealsOwner = d.total ?? 0;
      }
    } catch {}
  }

  const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);

  // ── Enrichissement Entreprises selon les règles de résolution cochées ──
  // On lit l'état des règles (entity_resolution_config) et le mapping des
  // propriétés HubSpot (identifier_field_mapping), puis on compte en live les
  // entreprises dont la propriété est renseignée (HAS_PROPERTY).
  let identifierMetrics: SummaryMetric[] = [];
  if (companiesTotal > 0) {
    let savedRules: Array<{ rule_id: string; enabled: boolean }> = [];
    let hubspotFieldMap: Record<string, string> = {};
    try {
      const [rulesRes, mappingRes] = await Promise.all([
        supabase.from("entity_resolution_config").select("rule_id, enabled").eq("organization_id", orgId),
        supabase.from("identifier_field_mapping").select("canonical_field, provider_field").eq("organization_id", orgId).eq("provider", "hubspot"),
      ]);
      savedRules = (rulesRes.data ?? []) as typeof savedRules;
      hubspotFieldMap = Object.fromEntries(
        ((mappingRes.data ?? []) as Array<{ canonical_field: string; provider_field: string }>).map((m) => [m.canonical_field, m.provider_field]),
      );
    } catch {}

    const activeIdentifiers = COMPANY_RULE_IDENTIFIERS.filter((def) => {
      const saved = savedRules.find((r) => r.rule_id === def.ruleId);
      return saved ? saved.enabled : def.defaultEnabled;
    });

    if (hubspotToken && activeIdentifiers.length > 0) {
      const results = await Promise.all(
        activeIdentifiers.map(async (def): Promise<SummaryMetric | null> => {
          const propName = (hubspotFieldMap[def.canonical] ?? def.defaultField).trim();
          if (!propName) return null;
          try {
            const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: propName, operator: "HAS_PROPERTY" }] }],
                limit: 1,
              }),
            });
            if (res.ok) {
              const d = await res.json();
              return { label: def.label, pct: pct(d.total ?? 0, companiesTotal) };
            }
            // 400 = propriété inexistante dans le portail (mapping à créer côté CRM).
            if (res.status === 400) return { label: def.label, pct: 0, missing: true };
            return null;
          } catch {
            return null;
          }
        }),
      );
      identifierMetrics = results.filter((m): m is SummaryMetric => m !== null);
    }
  }

  // ── Rapprochement inter-outils : stats RÉELLES mesurées sur source_links.
  //    (Les volumes bruts par outil vivent désormais dans les onglets dédiés
  //    par outil — la vue d'ensemble analyse le CROISEMENT des données.) ──
  const [connectedTools, linkStats] = await Promise.all([
    getConnectedTools(supabase, orgId),
    loadSourceLinkStats(supabase, orgId),
  ]);
  const reconTools = connectedTools.filter((t) => {
    const def = CONNECTABLE_TOOLS[t.key];
    return t.key !== "hubspot" && def && def.category !== "communication";
  });
  // Taux CRM × outil — un outil connecté sans donnée rapprochée apparaît
  // quand même, à 0, avec l'invite de sync (même règle que les Paramètres).
  const toolRates = reconTools.map((t) => {
    const rate = linkStats.providerRates.find((pr) => pr.provider === t.key);
    return {
      provider: t.key,
      label: t.label,
      icon: t.icon,
      domain: t.domain,
      total: rate?.total ?? 0,
      matched: rate?.matched ?? 0,
      pct: rate?.pct ?? 0,
    };
  });
  const ratedTools = toolRates.filter((t) => t.total > 0);
  const globalTotal = ratedTools.reduce((s, t) => s + t.total, 0);
  const globalMatched = ratedTools.reduce((s, t) => s + t.matched, 0);
  const globalRate = globalTotal > 0
    ? { total: globalTotal, matched: globalMatched, pct: Math.round((globalMatched / globalTotal) * 100) }
    : null;
  const methodItems = Object.entries(linkStats.methodStats)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: MATCH_METHOD_LABELS[k] ?? k, value: v }));

  const summaries: Array<{
    label: string;
    href: string;
    count: number;
    icon: "users" | "building" | "briefcase";
    tone: "blue" | "violet" | "orange";
    metrics: SummaryMetric[];
  }> = [
    {
      label: "Contacts",
      href: "/dashboard/donnees/onboarding",
      count: contactsTotal,
      icon: "users",
      tone: "blue",
      metrics: [
        { label: "Téléphone", pct: pct(contactsPhone, contactsTotal) },
        { label: "Entreprise liée", pct: pct(contactsCompany, contactsTotal) },
        { label: "Poste", pct: pct(contactsTitle, contactsTotal) },
      ],
    },
    {
      label: "Entreprises",
      href: "/dashboard/donnees/onboarding",
      count: companiesTotal,
      icon: "building",
      tone: "violet",
      metrics: [
        { label: "Domaine", pct: pct(companiesDomain, companiesTotal) },
        { label: "Secteur", pct: pct(companiesIndustry, companiesTotal) },
        { label: "CA", pct: pct(companiesRevenue, companiesTotal) },
        // Identifiants issus des règles de résolution cochées (SIREN, SIRET, TVA…).
        ...identifierMetrics,
      ],
    },
    {
      label: "Transactions",
      href: "/dashboard/donnees/outils/hubspot",
      count: dealsTotal,
      icon: "briefcase",
      tone: "orange",
      metrics: [
        { label: "Montant", pct: pct(dealsAmount, dealsTotal) },
        { label: "Date closing", pct: pct(dealsCloseDate, dealsTotal) },
        { label: "Propriétaire", pct: pct(dealsOwner, dealsTotal) },
      ],
    },
  ];

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_donnees");

  // Tuiles par défaut (mêmes valeurs qu'avant — désormais masquables/remplaçables).
  const allMetrics = summaries.flatMap((s) => s.metrics.map((m) => m.pct));
  const avgFill = allMetrics.length > 0 ? Math.round(allMetrics.reduce((n, p) => n + p, 0) / allMetrics.length) : null;
  // Code couleur des tuiles : vert ≥ 80 %, indigo ≥ 50 %, rouge en dessous.
  const toneForPct = (p: number): DefaultTile["tone"] => (p >= 80 ? "pos" : p >= 50 ? "accent" : "neg");
  const contactsPct = pct(contactsCompany, contactsTotal);
  const companiesPct = pct(companiesDomain, companiesTotal);
  const dealsPct = pct(dealsAmount, dealsTotal);
  const defaultTiles: DefaultTile[] = (contactsTotal > 0 || companiesTotal > 0 || dealsTotal > 0)
    ? [
        { key: "contacts", label: "Contacts", value: contactsTotal.toLocaleString("fr-FR"), tone: toneForPct(contactsPct), sub: `${contactsPct} % liés à une entreprise` },
        { key: "entreprises", label: "Entreprises", value: companiesTotal.toLocaleString("fr-FR"), tone: toneForPct(companiesPct), sub: `${companiesPct} % avec domaine` },
        { key: "transactions", label: "Transactions", value: dealsTotal.toLocaleString("fr-FR"), tone: toneForPct(dealsPct), sub: `${dealsPct} % avec montant` },
        {
          key: "completude",
          label: "Complétude moyenne",
          value: avgFill != null ? `${avgFill} %` : "—",
          tone: avgFill == null ? "neutral" : avgFill >= 80 ? "pos" : avgFill >= 50 ? "accent" : "neg",
          sub: `${allMetrics.length} propriétés clés confondues`,
          verdict: avgFill == null ? undefined
            : avgFill >= 80 ? { label: "Base saine (> 80 %)", tone: "pos" }
            : avgFill >= 50 ? { label: "À enrichir", tone: "warn" }
            : { label: "Base incomplète (< 50 %)", tone: "neg" },
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ── BANDEAU DIAGNOSTIC SNAPSHOT (si erreur) ── */}
      {snapshot.status === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-900">⚠ Erreur de récupération des données HubSpot</p>
          <p className="mt-1 text-xs text-rose-800">
            Le snapshot n&apos;a pas pu être chargé : {snapshot.error ?? "erreur inconnue"}.
            Les compteurs HubSpot sont à 0 par défaut. Vérifiez la connexion HubSpot dans
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations</Link>.
          </p>
        </div>
      )}
      {snapshot.status === "no-token" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">🔌 HubSpot non connecté</p>
          <p className="mt-1 text-xs text-amber-800">
            Connectez votre portail HubSpot via OAuth pour alimenter cette page.
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations →</Link>
          </p>
        </div>
      )}

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_donnees" categories={["crm", "billing", "support"]}>

      {/* Lecture cockpit en un coup d'œil : tuiles KPI configurables */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="audit_donnees"
        defaults={defaultTiles}
        customization={custom}
      />

      {/* ── RAPPROCHEMENT INTER-OUTILS : la donnée croisée, pas les volumes
             bruts (les hubs par outil vivent dans leurs onglets dédiés). ── */}
      {toolRates.length > 0 && !custom.hiddenBlocks.has("crm_match_rate") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="crm_match_rate" label="Taux de rapprochement réel avec le CRM">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Taux de rapprochement réel avec le CRM
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Part des enregistrements de chaque outil connecté reliés à une entité HubSpot —
                  règles configurables dans{" "}
                  <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
                    Paramètres → Modèle de données
                  </Link>
                  .
                </p>
              </div>
              {/* Taux global — tous outils confondus */}
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${globalRate == null ? "text-slate-400" : "text-slate-900"}`}>
                  {globalRate ? `${globalRate.pct} %` : "—"}
                </p>
                <p className="text-[10px] text-slate-400">
                  global{globalRate ? ` (${globalRate.matched}/${globalRate.total})` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {toolRates.map((t) => (
                <div key={t.provider} className="flex items-center gap-3">
                  <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={24} />
                  <div className="min-w-0 flex-1">
                    {t.total === 0 ? (
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                        <span className="text-[11px] text-slate-400">
                          Aucun enregistrement rapproché — lance une synchronisation depuis Intégrations
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                          <span className="font-bold tabular-nums text-slate-900">
                            {t.pct} % <span className="font-normal text-slate-400">({t.matched}/{t.total})</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${t.pct >= 70 ? "bg-emerald-500" : t.pct >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${t.pct}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* KPIs de détail : santé du croisement inter-outils */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {linkStats.multiSourcePct != null ? `${linkStats.multiSourcePct} %` : "—"}
                </p>
                <p className="text-[10px] text-slate-400">entités multi-sources (≥ 2 outils)</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {linkStats.totalLinks.toLocaleString("fr-FR")}
                </p>
                <p className="text-[10px] text-slate-400">liens de rapprochement mesurés</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {methodItems[0]?.label ?? "—"}
                </p>
                <p className="text-[10px] text-slate-400">méthode de rapprochement dominante</p>
              </div>
            </div>
          </div>
        </RemovableBlock>
      )}

      {/* Répartition des rapprochements par méthode (SIREN, TVA, email…) */}
      {methodItems.length > 0 && !custom.hiddenBlocks.has("match_methods") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="match_methods" label="Méthodes de rapprochement">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-800">Méthodes de rapprochement</p>
            <p className="mb-3 text-[10px] text-slate-400">
              Comment les enregistrements des outils ont été reliés entre eux — mesuré sur les liens réels
            </p>
            <HBarChart unit="count" colorize items={methodItems} />
          </div>
        </RemovableBlock>
      )}

      {/* Object summary cards */}
      {!custom.hiddenBlocks.has("objets_cards") && (
      <RemovableBlock pageKey="audit_donnees" blockKey="objets_cards" label="Synthèse par objet — cartes">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaries.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:shadow-md group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BlockHeaderIcon icon={s.icon} tone={s.tone} />
                <span className="text-sm font-semibold text-slate-900 group-hover:text-accent">{s.label}</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{s.count.toLocaleString("fr-FR")}</span>
            </div>
            <div className="mt-3 space-y-2">
              {s.metrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {m.label}
                      {m.missing && (
                        <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700" title="Créez la propriété dans HubSpot puis mappez-la dans Paramètres → Modèle de données">
                          propriété absente du CRM
                        </span>
                      )}
                    </span>
                    <span className={`font-semibold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.pct} %</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${getBarColor(m.pct)}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 group-hover:text-accent">Voir le détail →</p>
          </Link>
        ))}
      </div>
      </RemovableBlock>
      )}

      {/* ── Complétude des propriétés clés : barres horizontales cockpit ── */}
      {summaries.some((s) => s.count > 0) && !custom.hiddenBlocks.has("completude_bars") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="completude_bars" label="Complétude des propriétés clés">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-800">Complétude des propriétés clés</p>
            <p className="mb-3 text-[10px] text-slate-400">
              % de fiches renseignées par propriété — vert ≥ 80 %, orange ≥ 50 %, rouge en dessous
            </p>
            <HBarChart
              unit="percent"
              items={summaries
                .filter((s) => s.count > 0)
                .flatMap((s) =>
                  s.metrics.map((m) => ({
                    label: `${s.label} · ${m.label}`,
                    value: m.pct,
                    color: m.pct >= 80 ? "#10b981" : m.pct >= 50 ? "#f59e0b" : "#f43f5e",
                  })),
                )}
            />
          </div>
        </RemovableBlock>
      )}

      {/* Mêmes données que le bloc ci-dessus, en table normalisée + alerte chirurgicale. */}
      {!custom.hiddenBlocks.has("synthese_objets") && (
      <RemovableBlock pageKey="audit_donnees" blockKey="synthese_objets" label="Synthèse par objet CRM">
      <div className="mt-4">
        <BlockDataTable
          title="Synthèse par objet CRM"
          subtitle="volumes et complétude"
          team="revops"
          unit="count"
          nameLabel="Donnée"
          valueLabel="Valeur"
          rows={summaries.flatMap<BlockTableRow>((s) => [
            { name: s.label, value: s.count, unit: "count" },
            ...s.metrics.map<BlockTableRow>((m) => ({
              name: `${s.label} — ${m.label}`,
              value: m.pct,
              unit: "percent" as const,
            })),
          ])}
        />
      </div>
      </RemovableBlock>
      )}

      {/* Ajouter un bloc : réafficher un bloc masqué ou créer depuis les suggestions. */}
      <BlocksManager pageKey="audit_donnees" tablesPageKey="audit_donnees" hiddenBlocks={hiddenBlockList(custom)} />

      </PageSourcesGate>

      <PageDataTables pageKey="audit_donnees" />

    </div>
  );
}
