export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { fetchStripeLiveCounts } from "@/lib/integrations/sources/stripe";
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

type ToolEntityCount = {
  label: string;
  count: number;
  enrichmentPct?: number;
  enrichmentLabel?: string;
};

type ToolHub = {
  key: string;
  label: string;
  domain: string;
  icon: string;
  category: string;
  entities: ToolEntityCount[];
  /** Champs / hubs critiques manquants (low enrichment ou compteur à 0). */
  gaps: Array<{ entity: string; field: string; pct: number; severity: "critical" | "warning" }>;
};

async function countCanonicalForProvider(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  provider: string,
  entityType: string,
): Promise<number> {
  try {
    const { count } = await supabase
      .from("source_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .eq("entity_type", entityType);
    return count ?? 0;
  } catch {
    return 0;
  }
}

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

  // ── Hubs synchronisés : HubSpot + outils tiers connectés à Revold ──
  const connectedTools = await getConnectedTools(supabase, orgId);
  const hubs: ToolHub[] = [];

  // HubSpot hub : on l'affiche dès que le snapshot est OK ou qu'on a au moins
  // une métrique HubSpot non nulle. NE PAS dépendre uniquement de hubspotToken
  // (qui peut renvoyer null si le refresh échoue, alors que le snapshot est
  // déjà mis en cache request-scope plus tôt — c'est ce qui faisait
  // disparaître la carte HubSpot pendant que la page Settings continuait à
  // afficher les données live).
  const hubspotConnected =
    snapshot.status === "ok" ||
    (snapshot.totalContacts + snapshot.totalCompanies + snapshot.totalDeals) > 0;
  if (hubspotConnected) {
    const hsGaps: ToolHub["gaps"] = [];
    const phonePct = pct(contactsPhone, contactsTotal);
    const companyPct = pct(contactsCompany, contactsTotal);
    const titlePct = pct(contactsTitle, contactsTotal);
    const domainPct = pct(companiesDomain, companiesTotal);
    const industryPct = pct(companiesIndustry, companiesTotal);
    const revenuePct = pct(companiesRevenue, companiesTotal);
    const amountPct = pct(dealsAmount, dealsTotal);
    const closeDatePct = pct(dealsCloseDate, dealsTotal);
    const ownerPct = pct(dealsOwner, dealsTotal);

    if (contactsTotal > 0 && phonePct < 50) hsGaps.push({ entity: "Contacts", field: "Téléphone", pct: phonePct, severity: phonePct < 20 ? "critical" : "warning" });
    if (contactsTotal > 0 && companyPct < 70) hsGaps.push({ entity: "Contacts", field: "Entreprise liée", pct: companyPct, severity: companyPct < 40 ? "critical" : "warning" });
    if (contactsTotal > 0 && titlePct < 50) hsGaps.push({ entity: "Contacts", field: "Poste", pct: titlePct, severity: titlePct < 20 ? "critical" : "warning" });
    if (companiesTotal > 0 && domainPct < 70) hsGaps.push({ entity: "Entreprises", field: "Domaine", pct: domainPct, severity: domainPct < 40 ? "critical" : "warning" });
    if (companiesTotal > 0 && industryPct < 50) hsGaps.push({ entity: "Entreprises", field: "Secteur", pct: industryPct, severity: industryPct < 20 ? "critical" : "warning" });
    if (companiesTotal > 0 && revenuePct < 30) hsGaps.push({ entity: "Entreprises", field: "CA", pct: revenuePct, severity: revenuePct < 10 ? "critical" : "warning" });
    if (dealsTotal > 0 && amountPct < 80) hsGaps.push({ entity: "Deals", field: "Montant", pct: amountPct, severity: amountPct < 50 ? "critical" : "warning" });
    if (dealsTotal > 0 && closeDatePct < 80) hsGaps.push({ entity: "Deals", field: "Date closing", pct: closeDatePct, severity: closeDatePct < 50 ? "critical" : "warning" });
    if (dealsTotal > 0 && ownerPct < 80) hsGaps.push({ entity: "Deals", field: "Propriétaire", pct: ownerPct, severity: ownerPct < 50 ? "critical" : "warning" });

    // Helper qui transforme un statut diagnostic en label utilisateur
    const diag = snapshot.kpiDiagnostics ?? {};
    const labelFromDiag = (key: string, fallback?: string): string | undefined => {
      const d = diag[key];
      if (!d || d.status === "ok") return fallback;
      if (d.status === "no_scope") return "Scope OAuth manquant";
      if (d.status === "addon_missing") return "Hub HubSpot non activé";
      if (d.status === "bad_property") return "Propriété inexistante";
      if (d.status === "endpoint_error") return `Erreur HubSpot (${d.httpCode ?? "?"})`;
      if (d.status === "network_error") return "Erreur réseau";
      return fallback;
    };

    hubs.push({
      key: "hubspot",
      label: "HubSpot",
      domain: "hubspot.com",
      icon: "🟧",
      category: "CRM",
      entities: [
        { label: "Contacts", count: contactsTotal, enrichmentPct: Math.round((phonePct + companyPct + titlePct) / 3), enrichmentLabel: labelFromDiag("totalContacts", "champs clés") },
        { label: "Entreprises", count: companiesTotal, enrichmentPct: Math.round((domainPct + industryPct + revenuePct) / 3), enrichmentLabel: labelFromDiag("totalCompanies", "champs clés") },
        { label: "Deals", count: dealsTotal, enrichmentPct: Math.round((amountPct + closeDatePct + ownerPct) / 3), enrichmentLabel: labelFromDiag("totalDeals", "champs clés") },
        { label: "Tickets", count: snapshot.totalTickets, enrichmentLabel: labelFromDiag("tickets", snapshot.totalTickets === 0 ? "Service Hub désactivé ou sans tickets" : undefined) },
        { label: "Conversations", count: snapshot.totalConversations, enrichmentLabel: labelFromDiag("conversations") },
        { label: "Quotes", count: snapshot.totalQuotes, enrichmentLabel: labelFromDiag("quotes") },
        { label: "Forms", count: snapshot.formsCount, enrichmentLabel: labelFromDiag("forms") },
        { label: "Workflows", count: snapshot.workflowsCount, enrichmentLabel: snapshot.workflowsActiveCount > 0 ? `${snapshot.workflowsActiveCount} actifs` : labelFromDiag("workflows") },
        { label: "Listes", count: snapshot.listsCount, enrichmentLabel: labelFromDiag("lists") },
        { label: "Custom Objects", count: snapshot.customObjectsCount, enrichmentLabel: labelFromDiag("custom_objects") },
      ].filter((e) => e.count > 0 || ["Contacts", "Entreprises", "Deals", "Tickets"].includes(e.label) || e.enrichmentLabel), // garde aussi les 0 avec un label diag
      gaps: hsGaps,
    });
  }

  // Stripe (et autres outils non-CRM) : entités synchronisées via source_links
  for (const tool of connectedTools) {
    if (tool.key === "hubspot") continue; // déjà traité au-dessus
    const def = CONNECTABLE_TOOLS[tool.key];
    if (!def) continue;
    // Outils de communication (Slack, Teams…) : canaux de notification,
    // pas des sources de données — hors périmètre de l'audit données.
    if (def.category === "communication") continue;

    const entities: ToolEntityCount[] = [];
    const gaps: ToolHub["gaps"] = [];

    if (tool.key === "stripe") {
      // 1. On lit d'abord ce qu'on a en local (source_links) — rapide.
      // Wrappé en try/catch global : aucune erreur Stripe ne doit casser
      // la page Propriétés.
      let stripeContacts = 0;
      let stripeInvoices = 0;
      let stripeSubs = 0;
      let liveCounts: { customers: number; invoices: number; subscriptions: number; truncated: boolean; error?: string } | null = null;
      let stripeBlockError: string | null = null;

      try {
        [stripeContacts, stripeInvoices, stripeSubs] = await Promise.all([
          countCanonicalForProvider(supabase, orgId, "stripe", "contact"),
          countCanonicalForProvider(supabase, orgId, "stripe", "invoice"),
          countCanonicalForProvider(supabase, orgId, "stripe", "subscription"),
        ]);

        // 2. Si la sync n'a rien produit en local (source_links vide) MAIS
        //    qu'on a une clé Stripe valide, on lit LIVE chez Stripe.
        const localTotal = stripeContacts + stripeInvoices + stripeSubs;
        if (localTotal === 0) {
          const { data: stripeRow } = await supabase
            .from("integrations")
            .select("access_token")
            .eq("organization_id", orgId)
            .eq("provider", "stripe")
            .eq("is_active", true)
            .maybeSingle();
          if (stripeRow?.access_token) {
            liveCounts = await fetchStripeLiveCounts(stripeRow.access_token as string);
          }
        }
      } catch (err) {
        stripeBlockError = err instanceof Error ? err.message.slice(0, 200) : "Erreur Stripe";
      }

      // 3. On combine : la valeur live l'emporte sur la valeur locale (0)
      const customersCount = liveCounts ? liveCounts.customers : stripeContacts;
      const invoicesCount = liveCounts ? liveCounts.invoices : stripeInvoices;
      const subsCount = liveCounts ? liveCounts.subscriptions : stripeSubs;

      // Contacts Stripe sans lien HubSpot — gap critique (uniquement si on a
      // synchronisé localement, sinon pas de notion d'orphelin)
      let orphanCount = 0;
      let linkedPct = 0;
      if (stripeContacts > 0) {
        try {
          const { data: links } = await supabase
            .from("source_links")
            .select("internal_id")
            .eq("organization_id", orgId)
            .eq("provider", "stripe")
            .eq("entity_type", "contact")
            .limit(1000);
          const ids = (links ?? []).map((l) => l.internal_id as string);
          for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200);
            const { count } = await supabase
              .from("contacts")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", orgId)
              .in("id", chunk)
              .is("hubspot_id", null);
            orphanCount += count ?? 0;
          }
        } catch {}
        linkedPct = Math.round(((stripeContacts - orphanCount) / stripeContacts) * 100);
      }

      const liveSuffix = liveCounts ? " (live Stripe)" : "";
      entities.push(
        {
          label: "Customers",
          count: customersCount,
          enrichmentPct: stripeContacts > 0 ? linkedPct : undefined,
          enrichmentLabel: stripeContacts > 0
            ? "liés à HubSpot"
            : liveCounts
              ? "lecture directe Stripe — sync à relancer pour matcher avec HubSpot"
              : undefined,
        },
        { label: "Invoices", count: invoicesCount, enrichmentLabel: liveCounts ? `live Stripe${liveCounts.truncated ? " (≥)" : ""}` : undefined },
        { label: "Subscriptions", count: subsCount, enrichmentLabel: liveCounts ? `live Stripe${liveCounts.truncated ? " (≥)" : ""}` : undefined },
      );

      if (stripeContacts > 0 && linkedPct < 70) {
        gaps.push({
          entity: "Customers",
          field: `${orphanCount} sans contact HubSpot`,
          pct: linkedPct,
          severity: linkedPct < 40 ? "critical" : "warning",
        });
      }
      if (stripeBlockError) {
        gaps.push({
          entity: "Stripe",
          field: `Erreur lecture Stripe : ${stripeBlockError.slice(0, 80)}`,
          pct: 0,
          severity: "critical",
        });
      } else if (liveCounts?.error) {
        gaps.push({
          entity: "Stripe",
          field: `Erreur API Stripe : ${liveCounts.error.slice(0, 80)}`,
          pct: 0,
          severity: "critical",
        });
      } else if (
        customersCount === 0 &&
        invoicesCount === 0 &&
        subsCount === 0
      ) {
        gaps.push({
          entity: "Stripe",
          field: "Aucune donnée détectée dans Stripe — vérifiez la clé secrète",
          pct: 0,
          severity: "critical",
        });
      } else if (stripeContacts + stripeInvoices + stripeSubs === 0 && liveCounts) {
        // Live OK mais sync locale jamais lancée → pas un gap critique,
        // juste une suggestion de relancer la sync pour activer les
        // analyses cross-source.
        gaps.push({
          entity: "Sync locale",
          field: `${liveSuffix.trim()} détectée — relancez la sync pour activer les analyses cross-source HubSpot`,
          pct: 0,
          severity: "warning",
        });
      }
    } else if (tool.key === "pennylane") {
      // Pennylane ne pose des source_links que sur les factures (invoice /
      // supplier_invoice) ; flux bancaires, comptes et écritures vivent dans
      // leurs tables dédiées (primary_source) — le compteur générique voyait
      // donc 0 ligne pour ce hub.
      const countBySource = async (table: string) => {
        try {
          const { count } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("primary_source", "pennylane");
          return count ?? 0;
        } catch {
          return 0; // migration non appliquée → table absente
        }
      };
      const [clientInv, supplierInv, bankTx, bankAccts, ledgerMonths] = await Promise.all([
        countCanonicalForProvider(supabase, orgId, "pennylane", "invoice"),
        countCanonicalForProvider(supabase, orgId, "pennylane", "supplier_invoice"),
        countBySource("bank_transactions"),
        countBySource("bank_accounts"),
        countBySource("ledger_balances"),
      ]);
      if (clientInv > 0) entities.push({ label: "Factures clients", count: clientInv });
      if (supplierInv > 0) entities.push({ label: "Factures fournisseurs", count: supplierInv });
      if (bankTx > 0) entities.push({ label: "Transactions bancaires", count: bankTx });
      if (bankAccts > 0) entities.push({ label: "Comptes bancaires", count: bankAccts });
      if (ledgerMonths > 0) entities.push({ label: "Écritures agrégées (compte × mois)", count: ledgerMonths });
      if (entities.length === 0) {
        gaps.push({
          entity: tool.label,
          field: "Aucune donnée synchronisée — relancez la sync",
          pct: 0,
          severity: "critical",
        });
      }
    } else {
      // Autres outils : compte générique multi-entités
      const types = ["contact", "company", "invoice", "subscription", "ticket", "deal"];
      for (const t of types) {
        const c = await countCanonicalForProvider(supabase, orgId, tool.key, t);
        if (c > 0) entities.push({ label: t.charAt(0).toUpperCase() + t.slice(1) + "s", count: c });
      }
      if (entities.length === 0) {
        gaps.push({
          entity: tool.label,
          field: "Aucune donnée synchronisée — relancez la sync",
          pct: 0,
          severity: "critical",
        });
      }
    }

    hubs.push({
      key: tool.key,
      label: tool.label,
      domain: def.domain,
      icon: def.icon,
      category: def.category,
      entities,
      gaps,
    });
  }

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
      href: "/dashboard/donnees/transactions",
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

      {/* ── HUBS SYNCHRONISÉS (CRM + outils tiers) ── */}
      {hubs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Hubs synchronisés
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {hubs.length}
              </span>
            </h2>
            <Link
              href="/dashboard/integration"
              className="text-xs font-medium text-accent hover:underline"
            >
              Gérer les intégrations →
            </Link>
          </div>

          {/* Un table normalisée par hub + alerte chirurgicale. (Les cartes
              « ✓ Connecté » en doublon ont été retirées : Intégrations fait foi.) */}
          <div className="mt-4 space-y-4">
            {hubs.map((h) => {
              if (custom.hiddenBlocks.has(`hub_table_${h.key}`)) return null;
              const rows: BlockTableRow[] = [];
              for (const e of h.entities) {
                rows.push({ name: e.label, value: e.count, unit: "count" });
                if (e.enrichmentPct != null && e.count > 0) {
                  rows.push({
                    name: `${e.label} — enrichissement`,
                    value: e.enrichmentPct,
                    unit: "percent",
                  });
                }
              }
              return (
                <RemovableBlock key={`table-${h.key}`} pageKey="audit_donnees" blockKey={`hub_table_${h.key}`} label={`Hub ${h.label}`}>
                  {rows.length > 0 ? (
                    <BlockDataTable
                      title={`Hub ${h.label}`}
                      subtitle={h.category}
                      team="revops"
                      unit="count"
                      nameLabel="Entité"
                      valueLabel="Valeur"
                      rows={rows}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                      <p className="text-sm font-medium text-slate-700">Hub {h.label} : aucune donnée synchronisée.</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Lance une synchronisation depuis{" "}
                        <Link href="/dashboard/integration" className="font-medium text-fuchsia-600 hover:underline">
                          Intégrations → Mes outils
                        </Link>{" "}
                        pour alimenter ce hub.
                      </p>
                    </div>
                  )}
                </RemovableBlock>
              );
            })}
          </div>
        </div>
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
