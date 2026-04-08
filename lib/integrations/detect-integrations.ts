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
    patterns: [/sales_navigator/i, /salesnav/i, /linkedin\s*sales/i],
  },
  {
    key: "mailchimp",
    label: "Mailchimp",
    vendor: "Marketing automation",
    icon: "📧",
    patterns: [/mailchimp/i],
  },
  {
    key: "zapier",
    label: "Zapier",
    vendor: "Automatisation",
    icon: "⚡",
    patterns: [/zapier/i],
  },
  {
    key: "make",
    label: "Make",
    vendor: "Automatisation",
    icon: "🔧",
    patterns: [/^make$/i, /integromat/i],
  },
  {
    key: "n8n",
    label: "n8n",
    vendor: "Automatisation",
    icon: "🔗",
    patterns: [/^n8n/i],
  },
  {
    key: "brevo",
    label: "Brevo",
    vendor: "Marketing automation",
    icon: "📨",
    patterns: [/brevo/i, /sendinblue/i],
  },
  {
    key: "activecampaign",
    label: "ActiveCampaign",
    vendor: "Marketing automation",
    icon: "📬",
    patterns: [/active\s*campaign/i],
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
  // Detection method (used for explanation in UI)
  detectionMethods: Array<"properties" | "source_detail" | "engagements" | "portal_app">;
  // Optional: source label (e.g. "Outlook Contacts") if detected via hs_object_source_detail_1
  sourceLabels?: string[];
  // Portal apps matched (name + privacy + API usage) when detected via /account-info
  portalAppMatches?: Array<{ name: string; type: "private" | "public"; usageCount: number }>;
};

/**
 * Subset of the PortalApp shape used by detectIntegrations to match against
 * the BUSINESS_INTEGRATIONS catalogue. Lets us inject the apps fetched by
 * detectPortalApps without creating a circular import.
 */
export type PortalAppForMatching = {
  name: string;
  type: "private" | "public";
  usageCount: number;
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

/**
 * Sample records and aggregate distinct values of `hs_object_source_detail_1`
 * to detect integrations that create records but do NOT install custom properties
 * (e.g. Outlook contacts sync, Aircall calls, HubSpot Meetings...).
 */
async function fetchSourceDetails(
  token: string,
  objectType: string,
): Promise<Record<string, { count: number; owners: Record<string, number> }>> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "hs_object_source_detail_1", operator: "HAS_PROPERTY" }] },
        ],
        properties: ["hs_object_source_detail_1", "hs_object_source", "hubspot_owner_id"],
        limit: 100,
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const acc: Record<string, { count: number; owners: Record<string, number> }> = {};
    (data.results ?? []).forEach((r: Record<string, unknown>) => {
      const props = r.properties as Record<string, string | null>;
      const detail = props.hs_object_source_detail_1;
      if (!detail) return;
      if (!acc[detail]) acc[detail] = { count: 0, owners: {} };
      acc[detail].count += 1;
      const ownerId = props.hubspot_owner_id;
      if (ownerId) acc[detail].owners[ownerId] = (acc[detail].owners[ownerId] || 0) + 1;
    });
    return acc;
  } catch {
    return {};
  }
}

/**
 * Sample engagement objects (calls, emails, meetings, notes, tasks) and aggregate
 * by source detail. Each engagement carries its origin app — Aircall calls, Outlook
 * emails, HubSpot Meetings, etc.
 */
async function fetchEngagementSources(
  token: string,
  engagementType: "calls" | "emails" | "meetings" | "notes" | "tasks",
): Promise<Record<string, { count: number; owners: Record<string, number> }>> {
  try {
    const res = await fetch(`${HS_API}/crm/v3/objects/${engagementType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [],
        properties: ["hs_object_source_detail_1", "hs_object_source", "hubspot_owner_id"],
        limit: 100,
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const acc: Record<string, { count: number; owners: Record<string, number> }> = {};
    (data.results ?? []).forEach((r: Record<string, unknown>) => {
      const props = r.properties as Record<string, string | null>;
      const detail = props.hs_object_source_detail_1 || props.hs_object_source;
      if (!detail) return;
      if (!acc[detail]) acc[detail] = { count: 0, owners: {} };
      acc[detail].count += 1;
      const ownerId = props.hubspot_owner_id;
      if (ownerId) acc[detail].owners[ownerId] = (acc[detail].owners[ownerId] || 0) + 1;
    });
    return acc;
  } catch {
    return {};
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

export async function detectIntegrations(
  token: string,
  portalApps: PortalAppForMatching[] = [],
): Promise<DetectedIntegration[]> {
  // 1. Fetch all properties + totals + owners list + source signals from CRM and engagement objects
  const [
    contactProps, companyProps, dealProps,
    totalContacts, totalCompanies, totalDeals,
    ownersRes,
    contactSources, companySources, dealSources,
    callSources, emailSources, meetingSources, noteSources, taskSources,
  ] = await Promise.all([
    fetchProperties(token, "contacts"),
    fetchProperties(token, "companies"),
    fetchProperties(token, "deals"),
    countTotal(token, "contacts"),
    countTotal(token, "companies"),
    countTotal(token, "deals"),
    fetch(`${HS_API}/crm/v3/owners?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { results: [] }),
    fetchSourceDetails(token, "contacts"),
    fetchSourceDetails(token, "companies"),
    fetchSourceDetails(token, "deals"),
    fetchEngagementSources(token, "calls"),
    fetchEngagementSources(token, "emails"),
    fetchEngagementSources(token, "meetings"),
    fetchEngagementSources(token, "notes"),
    fetchEngagementSources(token, "tasks"),
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

  // Merge all source-detail signals from CRM objects + engagements into a single map.
  // Each entry: sourceLabel → { count, owners, objectTypes }
  const allSourceSignals: Record<
    string,
    { count: number; owners: Record<string, number>; objectTypes: Set<string> }
  > = {};
  const addSignals = (
    src: Record<string, { count: number; owners: Record<string, number> }>,
    objectType: string,
  ) => {
    Object.entries(src).forEach(([label, data]) => {
      if (!allSourceSignals[label]) {
        allSourceSignals[label] = { count: 0, owners: {}, objectTypes: new Set() };
      }
      allSourceSignals[label].count += data.count;
      allSourceSignals[label].objectTypes.add(objectType);
      Object.entries(data.owners).forEach(([oid, c]) => {
        allSourceSignals[label].owners[oid] = (allSourceSignals[label].owners[oid] || 0) + c;
      });
    });
  };
  addSignals(contactSources, "contacts");
  addSignals(companySources, "companies");
  addSignals(dealSources, "deals");
  addSignals(callSources, "calls");
  addSignals(emailSources, "emails");
  addSignals(meetingSources, "meetings");
  addSignals(noteSources, "notes");
  addSignals(taskSources, "tasks");

  const integrations: DetectedIntegration[] = [];
  // Track which source labels have been claimed by a known integration so we
  // don't surface them again as "unknown".
  const claimedSourceLabels = new Set<string>();
  // Track which portal apps have been claimed so we can surface the rest as
  // "other connected apps" at the end.
  const claimedPortalApps = new Set<string>();

  for (const def of BUSINESS_INTEGRATIONS) {
    // Find all properties matching any pattern
    const matched = allObjectProps.filter(({ prop }) =>
      def.patterns.some((pattern) => pattern.test(prop.name) || pattern.test(prop.groupName))
    );

    // Match against source signals (e.g. "Outlook Contacts", "Aircall")
    const matchedSources = Object.entries(allSourceSignals).filter(([label]) =>
      def.patterns.some((p) => p.test(label)),
    );
    matchedSources.forEach(([label]) => claimedSourceLabels.add(label));

    // Match against portal apps actually connected to HubSpot via API usage
    const matchedPortalApps = portalApps.filter((app) =>
      def.patterns.some((p) => p.test(app.name)),
    );
    matchedPortalApps.forEach((app) => claimedPortalApps.add(app.name));

    if (matched.length === 0 && matchedSources.length === 0 && matchedPortalApps.length === 0) continue;

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

    // Total volume coming from source signals (records created by this integration)
    const sourceTotalCount = matchedSources.reduce((s, [, d]) => s + d.count, 0);
    const maxEnriched = Math.max(...enrichmentResults.map((r) => r.enrichedCount), 0);
    // We DO NOT skip when data is empty: the existence of installed properties
    // (matched.length > 0) is itself a reliable proof that the app is connected,
    // even if no record uses those properties yet.

    // Use the property with highest enrichment as primary for user adoption
    const primary = [...enrichmentResults].sort((a, b) => b.enrichedCount - a.enrichedCount)[0];

    // Fetch owner adoption from the primary property
    const ownerCounts: Record<string, number> = primary
      ? await fetchOwnersByProperty(token, primary.objectType, primary.name)
      : {};

    // Also merge in owner counts coming from source signals
    matchedSources.forEach(([, data]) => {
      Object.entries(data.owners).forEach(([oid, c]) => {
        ownerCounts[oid] = (ownerCounts[oid] || 0) + c;
      });
    });

    const topUsers = Object.entries(ownerCounts)
      .map(([ownerId, count]) => ({
        ownerId,
        name: ownerNames.get(ownerId) || `User ${ownerId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const objectTypesFromProps = matched.map((m) => m.objectType);
    const objectTypesFromSources = matchedSources.flatMap(([, d]) => Array.from(d.objectTypes));
    const objectTypes = Array.from(new Set([...objectTypesFromProps, ...objectTypesFromSources]));
    const dominantObject = primary?.objectType || objectTypes[0] || "contacts";
    const total = totalsByObject[dominantObject] || 1;

    // For source-only integrations (no properties), use source volume as the metric.
    const effectiveEnriched = Math.max(maxEnriched, sourceTotalCount);

    const detectionMethods: Array<"properties" | "source_detail" | "engagements" | "portal_app"> = [];
    if (matched.length > 0) detectionMethods.push("properties");
    if (matchedSources.some(([, d]) =>
      Array.from(d.objectTypes).some((o) => ["contacts", "companies", "deals"].includes(o)),
    )) detectionMethods.push("source_detail");
    if (matchedSources.some(([, d]) =>
      Array.from(d.objectTypes).some((o) => ["calls", "emails", "meetings", "notes", "tasks"].includes(o)),
    )) detectionMethods.push("engagements");
    if (matchedPortalApps.length > 0) detectionMethods.push("portal_app");

    integrations.push({
      key: def.key,
      label: def.label,
      vendor: def.vendor,
      icon: def.icon,
      objectTypes,
      totalProperties: matched.length,
      enrichedRecords: effectiveEnriched,
      totalRecords: total,
      enrichmentRate: total > 0 ? Math.round((maxEnriched / total) * 100) : 0,
      topProperties: enrichmentResults,
      distinctUsers: topUsers.length,
      topUsers,
      detectionMethods,
      sourceLabels: matchedSources.map(([label]) => label),
      portalAppMatches: matchedPortalApps,
    });
  }

  // 2. Surface UNKNOWN source labels with significant volume as "other detected tools"
  // (e.g. an integration that we don't have a curated entry for yet).
  const SYSTEM_LABELS = /^(crm[_ ]?ui|api|workflow|import|migration|sync|email|forms?|meetings?|conversations|automation|hubspot)/i;
  Object.entries(allSourceSignals)
    .filter(([label, data]) =>
      !claimedSourceLabels.has(label) &&
      data.count >= 5 &&
      !SYSTEM_LABELS.test(label),
    )
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([label, data]) => {
      const objectTypes = Array.from(data.objectTypes);
      const dominantObject = objectTypes[0] || "contacts";
      const total = totalsByObject[dominantObject] || 1;
      const topUsers = Object.entries(data.owners)
        .map(([ownerId, count]) => ({
          ownerId,
          name: ownerNames.get(ownerId) || `User ${ownerId}`,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      integrations.push({
        key: `other_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        label,
        vendor: "Source détectée",
        icon: "🔌",
        objectTypes,
        totalProperties: 0,
        enrichedRecords: data.count,
        totalRecords: total,
        enrichmentRate: 0,
        topProperties: [],
        distinctUsers: topUsers.length,
        topUsers,
        detectionMethods: ["source_detail"],
        sourceLabels: [label],
      });
    });

  // 3. Surface UNMATCHED portal apps as "other connected apps" — these are
  // really installed on HubSpot (they call the API) but we don't have a
  // curated catalogue entry yet.
  // Skip noise: messaging (Outlook/Gmail/Slack/Teams), visio (Zoom/Meet),
  // chat support (Intercom/Zendesk/Crisp/Freshdesk), HubSpot natives + system tools.
  // Only RevOps business tools (billing, quoting, prospection, accounting,
  // automation, enrichment) should surface.
  const PORTAL_APP_NOISE = /(outlook|gmail|slack|teams|whatsapp|messenger|zoom|google\s*meet|google\s*calendar|calendly|intercom|zendesk|crisp|freshdesk|export|import|migration|sync|hubspot|workflow|forms?|backup|csv)/i;
  portalApps
    .filter((app) => !claimedPortalApps.has(app.name) && !PORTAL_APP_NOISE.test(app.name))
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 15)
    .forEach((app) => {
      integrations.push({
        key: `portal_${app.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        label: app.name,
        vendor: app.type === "private" ? "App privée HubSpot" : "App marketplace HubSpot",
        icon: app.type === "private" ? "🔒" : "🧩",
        objectTypes: [],
        totalProperties: 0,
        enrichedRecords: 0,
        totalRecords: 0,
        enrichmentRate: 0,
        topProperties: [],
        distinctUsers: 0,
        topUsers: [],
        detectionMethods: ["portal_app"],
        portalAppMatches: [app],
      });
    });

  return integrations.sort((a, b) => {
    // Curated business integrations first, then portal apps, then unknowns
    const aRank = a.key.startsWith("portal_") ? 2 : a.key.startsWith("other_") ? 3 : 1;
    const bRank = b.key.startsWith("portal_") ? 2 : b.key.startsWith("other_") ? 3 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return b.enrichedRecords - a.enrichedRecords;
  });
}
