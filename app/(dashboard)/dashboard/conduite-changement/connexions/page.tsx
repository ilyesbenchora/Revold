import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { StaleDaysSelector } from "@/components/stale-days-selector";
import { fetchOwners, searchCount, batchedFetch } from "../context";

const HUBSPOT_PORTAL = "48372600";

type Props = {
  searchParams: Promise<{ days?: string; lc?: string | string[]; owner?: string }>;
};

export default async function ConnexionsPage({ searchParams }: Props) {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;

  const params = await searchParams;
  const days = Math.max(1, Math.min(365, parseInt(params.days as string || "10") || 10));
  const cutoffDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const selectedLifecycles = Array.isArray(params.lc) ? params.lc : (params.lc ? [params.lc] : []);
  const selectedOwner = (params.owner as string) || "";

  // Fetch owners + lifecycle stages in parallel
  const [owners, lcData] = await Promise.all([
    fetchOwners(token),
    fetch("https://api.hubapi.com/crm/v3/properties/contacts", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((d) => {
        const lcProp = (d.results ?? []).find((p: { name: string }) => p.name === "lifecyclestage");
        return (lcProp?.options ?? []) as Array<{ value: string; label: string }>;
      })
      .catch(() => [] as Array<{ value: string; label: string }>),
  ]);

  // Filter owners if specific owner selected
  const targetOwners = selectedOwner ? owners.filter((o) => o.id === selectedOwner) : owners;

  // Build lifecycle filter for HubSpot Search API
  const buildContactFilters = (oid: string) => {
    const filters: Array<{ propertyName: string; operator: string; value?: string }> = [
      { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
      { propertyName: "notes_last_updated", operator: "LT", value: cutoffDate },
    ];
    // If lifecycle stages selected, add filter (for single selection; multi requires filterGroups OR)
    if (selectedLifecycles.length === 1) {
      filters.push({ propertyName: "lifecyclestage", operator: "EQ", value: selectedLifecycles[0] });
    }
    return filters;
  };

  const buildDealFilters = (oid: string) => [
    { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
    { propertyName: "notes_last_updated", operator: "LT", value: cutoffDate },
    { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
  ];

  // For multi-lifecycle, we run per-lifecycle and sum
  const staleFns: Array<() => Promise<{ ownerId: string; type: string; count: number }>> = targetOwners.flatMap((o) => {
    if (selectedLifecycles.length > 1) {
      // Multi-lifecycle: sum contacts across selected lifecycles
      return [
        ...selectedLifecycles.map((lc) => () =>
          searchCount(token, "contacts", [
            { propertyName: "hubspot_owner_id", operator: "EQ", value: o.id },
            { propertyName: "notes_last_updated", operator: "LT", value: cutoffDate },
            { propertyName: "lifecyclestage", operator: "EQ", value: lc },
          ]).then((count) => ({ ownerId: o.id, type: `contacts_${lc}`, count }))
        ),
        () => searchCount(token, "deals", buildDealFilters(o.id)).then((count) => ({ ownerId: o.id, type: "deals", count })),
      ];
    }
    return [
      () => searchCount(token, "contacts", buildContactFilters(o.id)).then((count) => ({ ownerId: o.id, type: "contacts", count })),
      () => searchCount(token, "deals", buildDealFilters(o.id)).then((count) => ({ ownerId: o.id, type: "deals", count })),
    ];
  });

  const staleResults = await batchedFetch(staleFns, 3);
  const stalePerOwner: Record<string, { contacts: number; deals: number }> = {};
  for (const r of staleResults) {
    if (!stalePerOwner[r.ownerId]) stalePerOwner[r.ownerId] = { contacts: 0, deals: 0 };
    if (r.type === "deals") {
      stalePerOwner[r.ownerId].deals = r.count;
    } else {
      // "contacts" or "contacts_{lifecycle}" — sum them
      stalePerOwner[r.ownerId].contacts += r.count;
    }
  }

  const ownersWithStale = targetOwners
    .map((o) => ({ ...o, stale: stalePerOwner[o.id] ?? { contacts: 0, deals: 0 } }))
    .filter((o) => o.stale.contacts > 0 || o.stale.deals > 0)
    .sort((a, b) => (b.stale.contacts + b.stale.deals) - (a.stale.contacts + a.stale.deals));

  const ownerOptions = owners.map((o) => ({ id: o.id, name: `${o.firstName} ${o.lastName}`.trim() || o.email }));

  // Lifecycle label for display
  const lcLabel = selectedLifecycles.length > 0
    ? selectedLifecycles.map((v) => lcData.find((l) => l.value === v)?.label ?? v).join(", ")
    : "";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <StaleDaysSelector lifecycleStages={lcData} owners={ownerOptions} />

      {/* Active filters summary */}
      {(selectedLifecycles.length > 0 || selectedOwner) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Filtres actifs :</span>
          {lcLabel && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">{lcLabel}</span>}
          {selectedOwner && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
              {ownerOptions.find((o) => o.id === selectedOwner)?.name ?? selectedOwner}
            </span>
          )}
        </div>
      )}

      {/* Detail per owner */}
      {ownersWithStale.length > 0 ? (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Records sans activité depuis {days}+ jours
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{ownersWithStale.length} propriétaires</span>
            </h2>
          }
        >
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Propriétaire</th>
                  <th className="px-4 py-2">Équipe</th>
                  <th className="px-4 py-2 text-right">Contacts inactifs</th>
                  <th className="px-4 py-2 text-right">Deals ouverts inactifs</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ownersWithStale.map((o) => {
                  const total = o.stale.contacts + o.stale.deals;
                  const contactsUrl = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-1?query=&filterId=0&property=hubspot_owner_id&value=${o.id}`;
                  const dealsUrl = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL}/objects/0-3?query=&filterId=0&property=hubspot_owner_id&value=${o.id}`;
                  return (
                    <tr key={o.id} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                        <p className="text-[10px] text-slate-400">{o.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {o.teams.length > 0 ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{o.teams[0]}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {o.stale.contacts > 0 ? (
                          <a href={contactsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:underline tabular-nums">
                            {o.stale.contacts.toLocaleString("fr-FR")}
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          </a>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {o.stale.deals > 0 ? (
                          <a href={dealsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline tabular-nums">
                            {o.stale.deals.toLocaleString("fr-FR")}
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          </a>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{total.toLocaleString("fr-FR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm text-emerald-700">
            {selectedOwner || selectedLifecycles.length > 0
              ? "Aucun record inactif avec ces filtres."
              : `Tous les contacts et deals ont une activité dans les ${days} derniers jours.`}
          </p>
        </div>
      )}
    </div>
  );
}
