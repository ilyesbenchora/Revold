/**
 * Hubs synchronisés — construction des compteurs d'entités par outil connecté
 * (HubSpot + outils tiers). Extrait de la vue d'ensemble Audit qualité pour
 * alimenter les sous-pages dédiées par outil (Audit qualité → onglet outil).
 *
 * Un hub = un outil connecté + ses entités synchronisées (avec enrichissement)
 * + ses points d'attention (gaps).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { fetchStripeLiveCounts } from "@/lib/integrations/sources/stripe";
import { hubFetch } from "@/lib/integrations/hub-fetch";

export type ToolEntityCount = {
  label: string;
  count: number;
  enrichmentPct?: number;
  enrichmentLabel?: string;
};

export type ToolHub = {
  key: string;
  label: string;
  domain: string;
  icon: string;
  category: string;
  entities: ToolEntityCount[];
  /** Champs / hubs critiques manquants (low enrichment ou compteur à 0). */
  gaps: Array<{ entity: string; field: string; pct: number; severity: "critical" | "warning" }>;
};

export async function countCanonicalForProvider(
  supabase: SupabaseClient,
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

const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);

/**
 * Compte, parmi les enregistrements d'un provider (via source_links), ceux dont
 * la ligne canonique a `nullColumn` vide — c'est la mesure directe d'un
 * problème de rapprochement (ex : contact Pennylane sans hubspot_id, facture
 * sans company_id).
 */
async function countUnlinked(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  entityType: string,
  table: string,
  nullColumn: string,
): Promise<{ total: number; unlinked: number; linkedPct: number }> {
  let total = 0;
  let unlinked = 0;
  try {
    const { data: links } = await supabase
      .from("source_links")
      .select("internal_id")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .eq("entity_type", entityType)
      .limit(1000);
    const ids = [...new Set((links ?? []).map((l) => l.internal_id as string))];
    total = ids.length;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("id", chunk)
        .is(nullColumn, null);
      unlinked += count ?? 0;
    }
  } catch {}
  return { total, unlinked, linkedPct: total > 0 ? Math.round(((total - unlinked) / total) * 100) : 0 };
}

// Identifiants de rapprochement côté CRM — mêmes règles que Paramètres →
// « Règles de résolution d'entités » : sans SIREN/SIRET/TVA dans HubSpot,
// les factures et paiements ne peuvent pas être rapprochés au CRM.
const HUBSPOT_MATCH_IDENTIFIERS: Array<{
  ruleId: string;
  canonical: string;
  label: string;
  defaultEnabled: boolean;
  defaultField: string;
}> = [
  { ruleId: "siren_match", canonical: "siren", label: "SIREN", defaultEnabled: true, defaultField: "siren" },
  { ruleId: "siret_match", canonical: "siret", label: "SIRET", defaultEnabled: true, defaultField: "siret" },
  { ruleId: "vat_match", canonical: "vat_number", label: "N° TVA", defaultEnabled: true, defaultField: "vat_number" },
];

/**
 * Construit les hubs synchronisés. `only` limite au hub d'un seul outil
 * (clé catalogue, ex : "hubspot", "pennylane") — utilisé par les sous-pages.
 */
export async function buildToolHubs(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { only?: string },
): Promise<ToolHub[]> {
  const only = opts?.only;
  const [snapshot, hubspotToken, connectedTools] = await Promise.all([
    getHubspotSnapshot(),
    getHubSpotToken(supabase, orgId),
    getConnectedTools(supabase, orgId),
  ]);

  const hubs: ToolHub[] = [];

  // ── HubSpot : depuis le snapshot (dès qu'il est OK ou non vide) ──
  const hubspotConnected =
    snapshot.status === "ok" ||
    (snapshot.totalContacts + snapshot.totalCompanies + snapshot.totalDeals) > 0;
  if (hubspotConnected && (!only || only === "hubspot")) {
    const contactsTotal = snapshot.totalContacts;
    const companiesTotal = snapshot.totalCompanies;
    const dealsTotal = snapshot.totalDeals;
    const phonePct = pct(Math.max(0, contactsTotal - snapshot.contactsNoPhone), contactsTotal);
    const companyPct = pct(Math.max(0, contactsTotal - snapshot.orphansCount), contactsTotal);
    const titlePct = pct(Math.max(0, contactsTotal - snapshot.contactsNoTitle), contactsTotal);
    const domainPct = pct(Math.max(0, companiesTotal - snapshot.companiesNoDomain), companiesTotal);
    const industryPct = pct(Math.max(0, companiesTotal - snapshot.companiesNoIndustry), companiesTotal);
    const revenuePct = pct(Math.max(0, companiesTotal - snapshot.companiesNoRevenue), companiesTotal);
    const amountPct = pct(Math.max(0, dealsTotal - snapshot.dealsNoAmount), dealsTotal);
    const closeDatePct = pct(Math.max(0, dealsTotal - snapshot.dealsNoCloseDate), dealsTotal);

    // dealsWithOwner non dans snapshot — fetch direct rapide
    let ownerPct = 0;
    if (hubspotToken && dealsTotal > 0) {
      try {
        const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }],
            limit: 1,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          ownerPct = pct(d.total ?? 0, dealsTotal);
        }
      } catch {}
    }

    // ── Problèmes de rapprochement : couverture des identifiants forts ──
    // Une entreprise HubSpot sans SIREN/SIRET/TVA ne peut être rapprochée à la
    // facturation que par domaine/nom (faible). On mesure la couverture réelle
    // des propriétés mappées, pour chaque règle de résolution cochée.
    const matchGaps: ToolHub["gaps"] = [];
    if (hubspotToken && companiesTotal > 0) {
      let savedRules: Array<{ rule_id: string; enabled: boolean }> = [];
      let fieldMap: Record<string, string> = {};
      try {
        const [rulesRes, mappingRes] = await Promise.all([
          supabase.from("entity_resolution_config").select("rule_id, enabled").eq("organization_id", orgId),
          supabase.from("identifier_field_mapping").select("canonical_field, provider_field").eq("organization_id", orgId).eq("provider", "hubspot"),
        ]);
        savedRules = (rulesRes.data ?? []) as typeof savedRules;
        fieldMap = Object.fromEntries(
          ((mappingRes.data ?? []) as Array<{ canonical_field: string; provider_field: string }>).map((m) => [m.canonical_field, m.provider_field]),
        );
      } catch {}

      const active = HUBSPOT_MATCH_IDENTIFIERS.filter((def) => {
        const saved = savedRules.find((r) => r.rule_id === def.ruleId);
        return saved ? saved.enabled : def.defaultEnabled;
      });

      await Promise.all(
        active.map(async (def) => {
          const propName = (fieldMap[def.canonical] ?? def.defaultField).trim();
          if (!propName) return;
          try {
            const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: propName, operator: "HAS_PROPERTY" }] }],
                limit: 1,
              }),
            });
            if (res.ok) {
              const d = await res.json();
              const covPct = pct(d.total ?? 0, companiesTotal);
              if (covPct < 70) {
                matchGaps.push({
                  entity: "Entreprises",
                  field: `${def.label} renseigné — rapprochement facturation limité`,
                  pct: covPct,
                  severity: covPct < 40 ? "critical" : "warning",
                });
              }
            } else if (res.status === 400) {
              // Propriété inexistante dans le portail : la règle cochée ne peut rien rapprocher.
              matchGaps.push({
                entity: "Entreprises",
                field: `${def.label} : propriété « ${propName} » absente du CRM — créez-la puis vérifiez le mapping`,
                pct: 0,
                severity: "critical",
              });
            }
          } catch {}
        }),
      );
      // Ordre stable (Promise.all ne garantit pas l'ordre d'insertion).
      matchGaps.sort((a, b) => a.field.localeCompare(b.field));
    }

    const hsGaps: ToolHub["gaps"] = [...matchGaps];
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

  // ── Outils tiers : entités synchronisées via source_links / tables dédiées ──
  for (const tool of connectedTools) {
    if (tool.key === "hubspot") continue; // déjà traité au-dessus
    if (only && tool.key !== only) continue;
    const def = CONNECTABLE_TOOLS[tool.key];
    if (!def) continue;
    // Outils de communication (Slack, Teams…) : canaux de notification,
    // pas des sources de données — hors périmètre de l'audit qualité.
    if (def.category === "communication") continue;

    const entities: ToolEntityCount[] = [];
    const gaps: ToolHub["gaps"] = [];

    if (tool.key === "stripe") {
      // 1. On lit d'abord ce qu'on a en local (source_links) — rapide.
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

        // 2. Si la sync n'a rien produit en local MAIS qu'on a une clé Stripe
        //    valide, on lit LIVE chez Stripe.
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
        gaps.push({ entity: "Stripe", field: `Erreur lecture Stripe : ${stripeBlockError.slice(0, 80)}`, pct: 0, severity: "critical" });
      } else if (liveCounts?.error) {
        gaps.push({ entity: "Stripe", field: `Erreur API Stripe : ${liveCounts.error.slice(0, 80)}`, pct: 0, severity: "critical" });
      } else if (customersCount === 0 && invoicesCount === 0 && subsCount === 0) {
        gaps.push({ entity: "Stripe", field: "Aucune donnée détectée dans Stripe — vérifiez la clé secrète", pct: 0, severity: "critical" });
      } else if (stripeContacts + stripeInvoices + stripeSubs === 0 && liveCounts) {
        // Live OK mais sync locale jamais lancée → suggestion, pas critique.
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
      // leurs tables dédiées (primary_source).
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
      const [clientInv, supplierInv, bankTx, bankAccts, ledgerMonths, plContacts, plCompanies, plInvoices] = await Promise.all([
        countCanonicalForProvider(supabase, orgId, "pennylane", "invoice"),
        countCanonicalForProvider(supabase, orgId, "pennylane", "supplier_invoice"),
        countBySource("bank_transactions"),
        countBySource("bank_accounts"),
        countBySource("ledger_balances"),
        // Rapprochement : clients/sociétés Pennylane reliés (ou non) au CRM,
        // factures clients reliées (ou non) à une entreprise.
        countUnlinked(supabase, orgId, "pennylane", "contact", "contacts", "hubspot_id"),
        countUnlinked(supabase, orgId, "pennylane", "company", "companies", "hubspot_id"),
        countUnlinked(supabase, orgId, "pennylane", "invoice", "invoices", "company_id"),
      ]);
      if (plContacts.total > 0) entities.push({ label: "Clients", count: plContacts.total, enrichmentPct: plContacts.linkedPct, enrichmentLabel: "liés à HubSpot" });
      if (plCompanies.total > 0) entities.push({ label: "Sociétés", count: plCompanies.total, enrichmentPct: plCompanies.linkedPct, enrichmentLabel: "rapprochées HubSpot" });
      if (clientInv > 0) entities.push({ label: "Factures clients", count: clientInv, enrichmentPct: plInvoices.total > 0 ? plInvoices.linkedPct : undefined, enrichmentLabel: plInvoices.total > 0 ? "reliées à une entreprise" : undefined });
      if (supplierInv > 0) entities.push({ label: "Factures fournisseurs", count: supplierInv });
      if (bankTx > 0) entities.push({ label: "Transactions bancaires", count: bankTx });
      if (bankAccts > 0) entities.push({ label: "Comptes bancaires", count: bankAccts });
      if (ledgerMonths > 0) entities.push({ label: "Écritures agrégées (compte × mois)", count: ledgerMonths });

      // ── Problèmes de rapprochement (mêmes seuils que le hub Stripe) ──
      if (plContacts.total > 0 && plContacts.linkedPct < 70) {
        gaps.push({
          entity: "Clients",
          field: `${plContacts.unlinked} sans contact HubSpot`,
          pct: plContacts.linkedPct,
          severity: plContacts.linkedPct < 40 ? "critical" : "warning",
        });
      }
      if (plCompanies.total > 0 && plCompanies.linkedPct < 70) {
        gaps.push({
          entity: "Sociétés",
          field: `${plCompanies.unlinked} sans fiche HubSpot — vérifiez SIREN/TVA côté CRM`,
          pct: plCompanies.linkedPct,
          severity: plCompanies.linkedPct < 40 ? "critical" : "warning",
        });
      }
      if (plInvoices.total > 0 && plInvoices.linkedPct < 70) {
        gaps.push({
          entity: "Factures clients",
          field: `${plInvoices.unlinked} sans entreprise rapprochée — CA non attribuable par compte`,
          pct: plInvoices.linkedPct,
          severity: plInvoices.linkedPct < 40 ? "critical" : "warning",
        });
      }
      if (entities.length === 0) {
        gaps.push({ entity: tool.label, field: "Aucune donnée synchronisée — relancez la sync", pct: 0, severity: "critical" });
      }
    } else {
      // Autres outils : compte générique multi-entités
      const types = ["contact", "company", "invoice", "subscription", "ticket", "deal"];
      for (const t of types) {
        const c = await countCanonicalForProvider(supabase, orgId, tool.key, t);
        if (c > 0) entities.push({ label: t.charAt(0).toUpperCase() + t.slice(1) + "s", count: c });
      }
      if (entities.length === 0) {
        gaps.push({ entity: tool.label, field: "Aucune donnée synchronisée — relancez la sync", pct: 0, severity: "critical" });
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

  return hubs;
}

/**
 * Outils connectés éligibles à une sous-page Audit qualité (HubSpot + sources
 * de données, jamais la communication). Alimente les onglets dynamiques.
 */
export async function getAuditableTools(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ key: string; label: string; toolLabel: string; category: string; domain: string; icon: string }>> {
  const [connected, hsToken] = await Promise.all([
    getConnectedTools(supabase, orgId),
    getHubSpotToken(supabase, orgId),
  ]);
  const eligible = connected.filter((t) => {
    const def = CONNECTABLE_TOOLS[t.key];
    return def && def.category !== "communication";
  });
  // CRM connecté de l'org — les sous-pages des outils tiers sont nommées
  // « CRM ↔ Outil » (c'est un RAPPROCHEMENT, pas une vue mono-outil).
  const crm = eligible.find((t) => t.category === "crm");
  const crmLabel = crm?.label ?? (hsToken ? "HubSpot" : "CRM");
  const list = eligible.map((t) => {
    const def = CONNECTABLE_TOOLS[t.key];
    return {
      key: t.key,
      label: t.category === "crm" ? t.label : `${crmLabel} ↔ ${t.label}`,
      toolLabel: t.label,
      category: t.category as string,
      domain: def.domain,
      icon: def.icon,
    };
  });
  // HubSpot peut être actif (token OAuth / legacy) sans ligne integrations —
  // il garde sa sous-page dès qu'un token existe.
  if (hsToken && !list.some((t) => t.key === "hubspot")) {
    list.unshift({ key: "hubspot", label: "HubSpot", toolLabel: "HubSpot", category: "crm", domain: "hubspot.com", icon: "🟧" });
  }
  return list;
}
