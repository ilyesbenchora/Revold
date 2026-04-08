/**
 * Integration Detection Engine
 *
 * Strategy: HubSpot integrations create CRM properties grouped by integration name.
 * By analyzing property groups across contacts/companies/deals, we can:
 *   1. Detect which integrations are connected
 *   2. Count synced properties per integration
 *   3. Compute enrichment rate (% of records with the property filled)
 *
 * This works without dev API access — just standard CRM properties API.
 */

const HS_API = "https://api.hubapi.com";

// Native HubSpot groups (NOT integrations) — to exclude
const NATIVE_GROUPS = new Set([
  "contactinformation", "contact_activity", "contactlcs", "contactscripted",
  "emailinformation", "conversioninformation", "deal_information",
  "sales_properties", "order_information", "multiaccountmanagement",
  "real_estate_information", "smsinformation",
  "companyinformation", "company_activity", "companylcs", "companyscripted",
  "targetaccountsinformation", "catégorie",
  "dealinformation", "deal_activity", "deal_revenue", "dealscripted",
  "dealstages", "historicalproperties", "hubspotmetrics",
  "predictive_deal_score_feature_properties",
  "proprietes_axma", "proprietes_sherkan_pv", "storee_retail",
]);

// Known integration display names + icons
const INTEGRATION_META: Record<string, { label: string; vendor: string; icon: string }> = {
  aircall: { label: "Aircall", vendor: "Téléphonie", icon: "📞" },
  pandadoc: { label: "PandaDoc", vendor: "Signature électronique", icon: "📄" },
  linkedin: { label: "LinkedIn", vendor: "Social Selling", icon: "💼" },
  linkedin_sales_navigator_information: { label: "LinkedIn Sales Navigator", vendor: "Social Selling", icon: "💼" },
  socialmediainformation: { label: "Réseaux sociaux", vendor: "Social Media", icon: "📱" },
  analyticsinformation: { label: "HubSpot Web Tracking", vendor: "Analytics", icon: "📊" },
  facebook_ads_properties: { label: "Facebook Ads", vendor: "Advertising", icon: "📘" },
  google_ads_properties: { label: "Google Ads", vendor: "Advertising", icon: "🟢" },
  buyer_intent_properties: { label: "Buyer Intent", vendor: "Sales Intelligence", icon: "🎯" },
  company_signals: { label: "Company Signals", vendor: "Sales Intelligence", icon: "📡" },
  prospectingagent: { label: "Prospecting Agent", vendor: "AI Assistant", icon: "🤖" },
  calendly: { label: "Calendly", vendor: "Meeting Scheduling", icon: "📅" },
  zoom: { label: "Zoom", vendor: "Visio", icon: "🎥" },
  slack: { label: "Slack", vendor: "Communication", icon: "💬" },
  intercom: { label: "Intercom", vendor: "Customer Support", icon: "💬" },
  zendesk: { label: "Zendesk", vendor: "Customer Support", icon: "🎧" },
  stripe: { label: "Stripe", vendor: "Paiement", icon: "💳" },
  shopify: { label: "Shopify", vendor: "E-commerce", icon: "🛒" },
  mailchimp: { label: "Mailchimp", vendor: "Email Marketing", icon: "📧" },
  segment: { label: "Segment", vendor: "Data Platform", icon: "📊" },
  jira: { label: "Jira", vendor: "Project Management", icon: "📋" },
  asana: { label: "Asana", vendor: "Project Management", icon: "✅" },
  outlook: { label: "Outlook", vendor: "Email & Calendar", icon: "📨" },
  gmail: { label: "Gmail", vendor: "Email & Calendar", icon: "📧" },
};

function getIntegrationMeta(groupName: string): { label: string; vendor: string; icon: string } {
  if (INTEGRATION_META[groupName]) return INTEGRATION_META[groupName];
  // Try matching by prefix
  for (const [key, meta] of Object.entries(INTEGRATION_META)) {
    if (groupName.toLowerCase().includes(key)) return meta;
  }
  // Fallback: prettify the group name
  const label = groupName
    .replace(/_/g, " ")
    .replace(/information$/i, "")
    .replace(/properties$/i, "")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { label: label || groupName, vendor: "Intégration", icon: "🔌" };
}

export type DetectedIntegration = {
  groupName: string;
  label: string;
  vendor: string;
  icon: string;
  objectTypes: string[];
  totalProperties: number;
  enrichedRecords: number;
  totalRecords: number;
  enrichmentRate: number;
  topProperties: Array<{ name: string; label: string; enrichedCount: number; rate: number }>;
};

type RawProperty = {
  name: string;
  label: string;
  groupName: string;
  type: string;
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

/**
 * Detect all third-party integrations connected to the HubSpot portal
 * by analyzing CRM property groups across contacts, companies and deals.
 */
export async function detectIntegrations(token: string): Promise<DetectedIntegration[]> {
  // 1. Fetch all properties for the 3 main objects in parallel
  const [contactProps, companyProps, dealProps, totalContacts, totalCompanies, totalDeals] = await Promise.all([
    fetchProperties(token, "contacts"),
    fetchProperties(token, "companies"),
    fetchProperties(token, "deals"),
    countTotal(token, "contacts"),
    countTotal(token, "companies"),
    countTotal(token, "deals"),
  ]);

  // 2. Group properties by groupName + object type
  type GroupBucket = {
    groupName: string;
    properties: Array<{ name: string; label: string; type: string; objectType: string }>;
    objectTypes: Set<string>;
  };

  const buckets = new Map<string, GroupBucket>();

  function addToGroup(prop: RawProperty, objectType: string) {
    if (!prop.groupName) return;
    if (NATIVE_GROUPS.has(prop.groupName)) return;
    if (!buckets.has(prop.groupName)) {
      buckets.set(prop.groupName, {
        groupName: prop.groupName,
        properties: [],
        objectTypes: new Set(),
      });
    }
    const b = buckets.get(prop.groupName)!;
    b.properties.push({ name: prop.name, label: prop.label, type: prop.type, objectType });
    b.objectTypes.add(objectType);
  }

  contactProps.forEach((p) => addToGroup(p, "contacts"));
  companyProps.forEach((p) => addToGroup(p, "companies"));
  dealProps.forEach((p) => addToGroup(p, "deals"));

  if (buckets.size === 0) return [];

  // 3. For each detected integration, compute enrichment rate using sample of top 3 properties
  const totalsByObject: Record<string, number> = {
    contacts: totalContacts,
    companies: totalCompanies,
    deals: totalDeals,
  };

  const integrations: DetectedIntegration[] = [];

  for (const bucket of buckets.values()) {
    const meta = getIntegrationMeta(bucket.groupName);
    const sampleProps = bucket.properties.slice(0, 3);

    // Compute enrichment for each sample property
    const enrichmentResults = await Promise.all(
      sampleProps.map(async (p) => {
        const enriched = await countWithProperty(token, p.objectType, p.name);
        const total = totalsByObject[p.objectType] || 1;
        return {
          name: p.name,
          label: p.label,
          enrichedCount: enriched,
          rate: total > 0 ? Math.round((enriched / total) * 100) : 0,
        };
      }),
    );

    // Average enrichment across sample
    const avgEnriched = enrichmentResults.length > 0
      ? Math.max(...enrichmentResults.map((r) => r.enrichedCount))
      : 0;
    // Use the dominant object type for total
    const dominantObject = Array.from(bucket.objectTypes)[0];
    const total = totalsByObject[dominantObject] || 1;
    const enrichmentRate = total > 0 ? Math.round((avgEnriched / total) * 100) : 0;

    integrations.push({
      groupName: bucket.groupName,
      label: meta.label,
      vendor: meta.vendor,
      icon: meta.icon,
      objectTypes: Array.from(bucket.objectTypes),
      totalProperties: bucket.properties.length,
      enrichedRecords: avgEnriched,
      totalRecords: total,
      enrichmentRate,
      topProperties: enrichmentResults,
    });
  }

  // Sort by total properties descending
  return integrations.sort((a, b) => b.totalProperties - a.totalProperties);
}
