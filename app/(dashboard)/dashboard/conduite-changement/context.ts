export const ACTIVITY_TYPES = ["CALL", "EMAIL", "INCOMING_EMAIL", "MEETING", "NOTE", "TASK"] as const;

export const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  CALL: { label: "Appels", color: "bg-blue-500", icon: "📞" },
  EMAIL: { label: "Emails envoyés", color: "bg-indigo-500", icon: "📧" },
  INCOMING_EMAIL: { label: "Emails reçus", color: "bg-sky-500", icon: "📩" },
  MEETING: { label: "RDV", color: "bg-violet-500", icon: "📅" },
  NOTE: { label: "Notes", color: "bg-amber-500", icon: "📝" },
  TASK: { label: "Tâches", color: "bg-emerald-500", icon: "✅" },
};

export const PROPERTY_OBJECTS = [
  { key: "contacts", label: "Contacts", field: "propertiesContact" as const },
  { key: "companies", label: "Entreprises", field: "propertiesCompany" as const },
  { key: "deals", label: "Transactions", field: "propertiesDeal" as const },
  { key: "line_items", label: "Lignes produit", field: "propertiesLineItem" as const },
  { key: "products", label: "Produits", field: "propertiesProduct" as const },
  { key: "tickets", label: "Tickets", field: "propertiesTicket" as const },
];

export type Owner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number | null;
  teams: string[];
};

export type AssetStats = {
  workflows: number;
  propertiesContact: number;
  propertiesCompany: number;
  propertiesDeal: number;
  propertiesLineItem: number;
  propertiesProduct: number;
  propertiesTicket: number;
};

export type ActivityByType = { CALL: number; EMAIL: number; INCOMING_EMAIL: number; MEETING: number; NOTE: number; TASK: number; total: number };

export async function batchedFetch<T>(promises: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

export async function searchCount(token: string, objectType: string, filters: Array<{ propertyName: string; operator: string; value?: string }>): Promise<number> {
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
    });
    if (!res.ok) return 0;
    const d = await res.json();
    return d.total ?? 0;
  } catch { return 0; }
}

export async function fetchOwners(token: string): Promise<Owner[]> {
  const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const d = await res.json();
  return (d.results ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    email: o.email as string,
    firstName: (o.firstName as string) || "",
    lastName: (o.lastName as string) || "",
    userId: (o.userId as number) || null,
    teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
  }));
}

/**
 * Lit les owners depuis hubspot_objects (cache Supabase).
 * Évite l'appel live à HubSpot — utilisé par les pages Adoption.
 */
export async function fetchOwnersFromCache(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
): Promise<Owner[]> {
  const { data } = await supabase
    .from("hubspot_objects")
    .select("hubspot_id, raw_data")
    .eq("organization_id", orgId)
    .eq("object_type", "owners");
  return ((data ?? []) as Array<{ hubspot_id: string; raw_data: Record<string, unknown> }>)
    .map((row) => {
      const o = row.raw_data;
      return {
        id: String(o.id ?? row.hubspot_id),
        email: (o.email as string) || "",
        firstName: (o.firstName as string) || "",
        lastName: (o.lastName as string) || "",
        userId: (o.userId as number) || null,
        teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
      };
    });
}
