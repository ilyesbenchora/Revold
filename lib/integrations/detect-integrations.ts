/**
 * Business Integration Detection Engine
 *
 * Strategy: Detect business tools (Aircall, Pandadoc, LinkedIn, Kaspr, etc.)
 * by searching for properties whose name matches known patterns — works
 * even when properties are scattered across native HubSpot groups.
 *
 * For each detected integration we compute:
 *  - Number of synced properties
 *  - Enrichment rate (% of records with data)
 *  - User adoption (distinct owners using it + top users)
 */

const HS_API = "https://api.hubapi.com";

// Curated whitelist of business tools that matter for RevOps/CRO
type IntegrationDef = {
  key: string;
  label: string;
  vendor: string;
  icon: string;
  // Property name patterns (regex). We match against property names AND group names.
  patterns: RegExp[];
  // Optional: explicit primary property to use for adoption query (more reliable than auto-detect)
  primaryProperty?: string;
};

const BUSINESS_INTEGRATIONS: IntegrationDef[] = [
  {
    key: "aircall",
    label: "Aircall",
    vendor: "Téléphonie",
    icon: "📞",
    patterns: [/aircall/i],
  },
  {
    key: "pandadoc",
    label: "PandaDoc",
    vendor: "Signature électronique",
    icon: "📄",
    patterns: [/pandadoc/i],
  },
  {
    key: "kaspr",
    label: "Kaspr",
    vendor: "Enrichissement contacts",
    icon: "🔎",
    patterns: [/kaspr/i],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    vendor: "Social Selling",
    icon: "💼",
    patterns: [/linkedin/i],
  },
  {
    key: "linkedin_sales_nav",
    label: "LinkedIn Sales Navigator",
    vendor: "Social Selling",
    icon: "🎯",
    patterns: [/sales_navigator/i, /salesnav/i],
  },
  {
    key: "calendly",
    label: "Calendly",
    vendor: "Meeting Scheduling",
    icon: "📅",
    patterns: [/calendly/i],
  },
  {
    key: "zoom",
    label: "Zoom",
    vendor: "Visio",
    icon: "🎥",
    patterns: [/^zoom_/i, /zoominfo/i],
  },
  {
    key: "dropcontact",
    label: "Dropcontact",
    vendor: "Enrichissement",
    icon: "💧",
    patterns: [/dropcontact/i],
  },
  {
    key: "lemlist",
    label: "Lemlist",
    vendor: "Cold Email",
    icon: "✉️",
    patterns: [/lemlist/i],
  },
  {
    key: "lusha",
    label: "Lusha",
    vendor: "Enrichissement",
    icon: "🔍",
    patterns: [/lusha/i],
  },
  {
    key: "ringover",
    label: "Ringover",
    vendor: "Téléphonie",
    icon: "📞",
    patterns: [/ringover/i],
  },
  {
    key: "stripe",
    label: "Stripe",
    vendor: "Paiement",
    icon: "💳",
    patterns: [/^stripe_/i],
  },
  {
    key: "intercom",
    label: "Intercom",
    vendor: "Customer Support",
    icon: "💬",
    patterns: [/intercom/i],
  },
  {
    key: "zendesk",
    label: "Zendesk",
    vendor: "Customer Support",
    icon: "🎧",
    patterns: [/zendesk/i],
  },
  {
    key: "slack",
    label: "Slack",
    vendor: "Communication",
    icon: "💬",
    patterns: [/^slack_/i],
  },
  {
    key: "outlook",
    label: "Outlook",
    vendor: "Email & Calendar",
    icon: "📨",
    patterns: [/^outlook_/i, /^office365_/i],
  },
  {
    key: "gmail",
    label: "Gmail",
    vendor: "Email & Calendar",
    icon: "📧",
    patterns: [/^gmail_/i],
  },
  {
    key: "modjo",
    label: "Modjo",
    vendor: "Conversational Intelligence",
    icon: "🎙️",
    patterns: [/modjo/i],
  },
  {
    key: "gong",
    label: "Gong",
    vendor: "Conversational Intelligence",
    icon: "🔔",
    patterns: [/^gong_/i],
  },
];

type RawProperty = {
  name: string;
  label: string;
  groupName: string;
  type: string;
};

type DetectedProperty = {
  name: string;
  label: string;
  type: string;
  objectType: string;
  enrichedCount: number;
  enrichmentRate: number;
};

export type DetectedIntegration = {
  key: string;
  label: string;
  vendor: string;
  icon: string;
  objectTypes: string[];
  totalProperties: number;
  enrichedRecords: number;
  totalRecords: number;
  enrichmentRate: number;
  topProperties: DetectedProperty[];
  // User adoption
  distinctUsers: number;
  topUsers: Array<{ ownerId: string; name: string; count: number }>;
};

async function fetchProperties(token: string, objectType: string): Promise<RawProperty[]> {
  const res = await fetch(`${HS_API}/crm/v3/properties/${objectType}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((p: Record<string, unknown>) => ({
    name: p.name as string,
    label: (p.label as string) || (p.name as string),
    groupName: (p.groupName as string) || "",
    type: (p.type as string) || "string",
  }));
}

async function countTotal(token: string, objectType: string): Promise<number> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [], limit: 1 }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

async function countWithProperty(token: string, objectType: string, propertyName: string): Promise<number> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName, operator: "HAS_PROPERTY" }] }],
        limit: 1,
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

async function fetchOwnersByProperty(
  token: string,
  objectType: string,
  propertyName: string,
): Promise<Record<string, number>> {
  // Sample 100 records with the property filled, count by owner
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName, operator: "HAS_PROPERTY" }] }],
        properties: ["hubspot_owner_id"],
        limit: 100,
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const owners: Record<string, number> = {};
    (data.results ?? []).forEach((r: Record<string, unknown>) => {
      const props = r.properties as Record<string, string | null>;
      const ownerId = props.hubspot_owner_id;
      if (ownerId) {
        owners[ownerId] = (owners[ownerId] || 0) + 1;
      }
    });
    return owners;
  } catch {
    return {};
  }
}

export async function detectIntegrations(token: string): Promise<DetectedIntegration[]> {
  // 1. Fetch all properties + totals + owners list
  const [contactProps, companyProps, dealProps, totalContacts, totalCompanies, totalDeals, ownersRes] = await Promise.all([
    fetchProperties(token, "contacts"),
    fetchProperties(token, "companies"),
    fetchProperties(token, "deals"),
    countTotal(token, "contacts"),
    countTotal(token, "companies"),
    countTotal(token, "deals"),
    fetch(`${HS_API}/crm/v3/owners?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { results: [] }),
  ]);

  // Build owner_id → name map
  const ownerNames = new Map<string, string>();
  ((ownersRes.results ?? []) as Array<{ id: string; firstName?: string; lastName?: string; email?: string }>).forEach((o) => {
    const name = `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || o.id;
    ownerNames.set(o.id, name);
  });

  const totalsByObject: Record<string, number> = {
    contacts: totalContacts,
    companies: totalCompanies,
    deals: totalDeals,
  };

  const allObjectProps: Array<{ prop: RawProperty; objectType: string }> = [
    ...contactProps.map((p) => ({ prop: p, objectType: "contacts" })),
    ...companyProps.map((p) => ({ prop: p, objectType: "companies" })),
    ...dealProps.map((p) => ({ prop: p, objectType: "deals" })),
  ];

  const integrations: DetectedIntegration[] = [];

  for (const def of BUSINESS_INTEGRATIONS) {
    // Find all properties matching any pattern
    const matched = allObjectProps.filter(({ prop }) =>
      def.patterns.some((pattern) => pattern.test(prop.name) || pattern.test(prop.groupName))
    );

    if (matched.length === 0) continue;

    // Choose top 3 sample properties to compute enrichment
    const sample = matched.slice(0, 3);

    const enrichmentResults: DetectedProperty[] = await Promise.all(
      sample.map(async ({ prop, objectType }) => {
        const enriched = await countWithProperty(token, objectType, prop.name);
        const total = totalsByObject[objectType] || 1;
        return {
          name: prop.name,
          label: prop.label,
          type: prop.type,
          objectType,
          enrichedCount: enriched,
          enrichmentRate: total > 0 ? Math.round((enriched / total) * 100) : 0,
        };
      }),
    );

    // Skip if no actual data (zero enrichment everywhere)
    const maxEnriched = Math.max(...enrichmentResults.map((r) => r.enrichedCount), 0);
    if (maxEnriched === 0) continue;

    // Use the property with highest enrichment as primary for user adoption
    const primary = [...enrichmentResults].sort((a, b) => b.enrichedCount - a.enrichedCount)[0];

    // Fetch owner adoption from the primary property
    const ownerCounts = primary
      ? await fetchOwnersByProperty(token, primary.objectType, primary.name)
      : {};

    const topUsers = Object.entries(ownerCounts)
      .map(([ownerId, count]) => ({
        ownerId,
        name: ownerNames.get(ownerId) || `User ${ownerId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const objectTypes = Array.from(new Set(matched.map((m) => m.objectType)));
    const dominantObject = primary?.objectType || objectTypes[0];
    const total = totalsByObject[dominantObject] || 1;

    integrations.push({
      key: def.key,
      label: def.label,
      vendor: def.vendor,
      icon: def.icon,
      objectTypes,
      totalProperties: matched.length,
      enrichedRecords: maxEnriched,
      totalRecords: total,
      enrichmentRate: total > 0 ? Math.round((maxEnriched / total) * 100) : 0,
      topProperties: enrichmentResults,
      distinctUsers: topUsers.length,
      topUsers,
    });
  }

  return integrations.sort((a, b) => b.enrichedRecords - a.enrichedRecords);
}
