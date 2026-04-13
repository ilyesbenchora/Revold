/**
 * Attribution KPI Computation
 *
 * Queries HubSpot API (contacts/search, deals/search, owners, pipelines/deals)
 * to compute real per-owner distribution metrics for Attribution reports.
 */

const HUBSPOT_API = "https://api.hubapi.com";

// ── Types ──────────────────────────────────────────────────────────────────

type HubSpotOwner = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type OwnerDistribution = {
  ownerId: string;
  ownerName: string;
  count: number;
  amount: number;
};

export type AttributionKpis = {
  // Contacts by owner
  totalContacts: number;
  contactsPerOwner: OwnerDistribution[];
  orphanContacts: number;
  topOwnerContactPct: number;
  avgContactsPerOwner: number;

  // Deals by owner (active / open pipeline only)
  totalActiveDeals: number;
  dealsPerOwner: OwnerDistribution[];
  orphanDeals: number;
  avgDealsPerOwner: number;
  avgPipelinePerOwner: number;
  totalPipelineAmount: number;

  // Companies by owner
  totalCompanies: number;
  companiesPerOwner: OwnerDistribution[];
  orphanCompanies: number;

  ownerCount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function hubspotSearch(
  token: string,
  objectType: "contacts" | "deals" | "companies",
  properties: string[],
  extraFilters: object[] = [],
  maxPages = 20,
): Promise<Array<Record<string, string | null>>> {
  const results: Array<Record<string, string | null>> = [];
  let after: string | undefined;
  let pages = 0;

  do {
    const body: Record<string, unknown> = { properties, limit: 100 };
    if (extraFilters.length > 0) {
      body.filterGroups = [{ filters: extraFilters }];
    }
    if (after) body.after = after;

    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = await res.json();
    for (const item of data.results ?? []) {
      results.push(item.properties ?? {});
    }

    after = data.paging?.next?.after;
    pages++;
  } while (after && pages < maxPages);

  return results;
}

async function fetchOwners(token: string): Promise<HubSpotOwner[]> {
  const res = await fetch(`${HUBSPOT_API}/crm/v3/owners?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []) as HubSpotOwner[];
}

// ── Main computation ───────────────────────────────────────────────────────

export async function computeAttributionKpis(token: string): Promise<AttributionKpis> {
  const [owners, contactProps, dealProps, companyProps] = await Promise.all([
    fetchOwners(token),
    hubspotSearch(token, "contacts", ["hubspot_owner_id"], [], 20),
    hubspotSearch(token, "deals", ["hubspot_owner_id", "amount", "hs_is_closed"], [], 10),
    hubspotSearch(token, "companies", ["hubspot_owner_id", "annualrevenue"], [], 10),
  ]);

  const ownerNames = new Map(
    owners.map((o) => [
      o.id,
      [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email,
    ]),
  );

  // ── Contacts ──
  const contactOwnerMap = new Map<string, number>();
  let orphanContacts = 0;

  for (const props of contactProps) {
    const ownerId = props.hubspot_owner_id ?? null;
    if (!ownerId) {
      orphanContacts++;
    } else {
      contactOwnerMap.set(ownerId, (contactOwnerMap.get(ownerId) ?? 0) + 1);
    }
  }

  const totalContacts = contactProps.length;
  const contactsPerOwner: OwnerDistribution[] = Array.from(contactOwnerMap.entries())
    .map(([id, count]) => ({
      ownerId: id,
      ownerName: ownerNames.get(id) ?? id,
      count,
      amount: 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topOwnerContactPct =
    totalContacts > 0 && contactsPerOwner.length > 0
      ? Math.round((contactsPerOwner[0].count / totalContacts) * 100)
      : 0;
  const avgContactsPerOwner =
    contactsPerOwner.length > 0
      ? Math.round((totalContacts - orphanContacts) / contactsPerOwner.length)
      : 0;

  // ── Deals (active pipeline only) ──
  const dealOwnerMap = new Map<string, { count: number; amount: number }>();
  let orphanDeals = 0;
  let totalPipelineAmount = 0;
  let totalActiveDeals = 0;

  for (const props of dealProps) {
    if (props.hs_is_closed === "true") continue; // skip closed deals
    totalActiveDeals++;
    const ownerId = props.hubspot_owner_id ?? null;
    const amount = Number(props.amount ?? 0);

    if (!ownerId) {
      orphanDeals++;
    } else {
      const curr = dealOwnerMap.get(ownerId) ?? { count: 0, amount: 0 };
      dealOwnerMap.set(ownerId, { count: curr.count + 1, amount: curr.amount + amount });
      totalPipelineAmount += amount;
    }
  }

  const dealsPerOwner: OwnerDistribution[] = Array.from(dealOwnerMap.entries())
    .map(([id, { count, amount }]) => ({
      ownerId: id,
      ownerName: ownerNames.get(id) ?? id,
      count,
      amount,
    }))
    .sort((a, b) => b.count - a.count);

  const avgDealsPerOwner =
    dealsPerOwner.length > 0
      ? Math.round((totalActiveDeals - orphanDeals) / dealsPerOwner.length)
      : 0;
  const avgPipelinePerOwner =
    dealsPerOwner.length > 0 ? Math.round(totalPipelineAmount / dealsPerOwner.length) : 0;

  // ── Companies ──
  const companyOwnerMap = new Map<string, number>();
  let orphanCompanies = 0;

  for (const props of companyProps) {
    const ownerId = props.hubspot_owner_id ?? null;
    if (!ownerId) {
      orphanCompanies++;
    } else {
      companyOwnerMap.set(ownerId, (companyOwnerMap.get(ownerId) ?? 0) + 1);
    }
  }

  const companiesPerOwner: OwnerDistribution[] = Array.from(companyOwnerMap.entries())
    .map(([id, count]) => ({
      ownerId: id,
      ownerName: ownerNames.get(id) ?? id,
      count,
      amount: 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalContacts,
    contactsPerOwner,
    orphanContacts,
    topOwnerContactPct,
    avgContactsPerOwner,

    totalActiveDeals,
    dealsPerOwner,
    orphanDeals,
    avgDealsPerOwner,
    avgPipelinePerOwner,
    totalPipelineAmount,

    totalCompanies: companyProps.length,
    companiesPerOwner,
    orphanCompanies,

    ownerCount: owners.length,
  };
}

// ── Metric label → value mapping ───────────────────────────────────────────

const fmtNum = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const fmtEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Maps a metric label string (from activated_reports.metrics[])
 * to a computed value string. Returns null if the metric cannot be computed.
 */
export function getAttributionMetricValue(
  metricLabel: string,
  kpis: AttributionKpis,
): string | null {
  switch (metricLabel) {
    // ── Contacts par owner ──
    case "Nb de contacts par owner":
      return `${fmtNum(kpis.avgContactsPerOwner)} / owner`;
    case "% de la base par owner":
      return `${kpis.topOwnerContactPct} % (top)`;
    case "Contacts sans owner (non attribués)":
      return fmtNum(kpis.orphanContacts);
    case "Évolution mensuelle de l'attribution":
      return null; // requires historical snapshots

    // ── Deals par owner ──
    case "Nb de deals par owner":
      return `${fmtNum(kpis.avgDealsPerOwner)} / owner`;
    case "Montant total du pipeline par owner (€)":
      return fmtEur(kpis.avgPipelinePerOwner);
    case "Nb de deals sans owner":
      return fmtNum(kpis.orphanDeals);
    case "Deals par owner par pipeline":
      return null; // requires per-pipeline breakdown

    // ── Companies par owner ──
    case "Nb de companies par owner":
      return kpis.companiesPerOwner.length > 0
        ? `${fmtNum(Math.round(kpis.totalCompanies / kpis.companiesPerOwner.length))} / owner`
        : null;
    case "Revenue annuel total des companies par owner (€)":
      return null; // annualrevenue not consistently filled
    case "Companies sans owner":
      return fmtNum(kpis.orphanCompanies);
    case "Répartition par industrie par owner":
      return null; // requires industry-level breakdown

    // ── Outbound attribution ──
    case "Nb de contacts créés par source outbound":
      return null;
    case "% de contacts attribués par owner":
      return `${100 - kpis.topOwnerContactPct} % non-top`;
    case "Taux de conversion contact → deal par source":
      return kpis.totalContacts > 0
        ? `${Math.round((kpis.totalActiveDeals / kpis.totalContacts) * 100)} %`
        : null;
    case "Nb de contacts orphelins (sans owner)":
      return fmtNum(kpis.orphanContacts);

    default:
      return null;
  }
}
