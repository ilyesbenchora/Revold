import { getOrgId } from "@/lib/supabase/cached";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { fetchOwners, searchCount, batchedFetch } from "../context";

export default async function ConnexionsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;

  const owners = await fetchOwners(token);
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];

  // Fetch stale contacts and open deals for ALL owners (batched)
  const staleFns: Array<() => Promise<{ ownerId: string; type: string; count: number }>> = owners.flatMap((o) => [
    () => searchCount(token, "contacts", [
      { propertyName: "hubspot_owner_id", operator: "EQ", value: o.id },
      { propertyName: "notes_last_updated", operator: "LT", value: tenDaysAgo },
    ]).then((count) => ({ ownerId: o.id, type: "contacts", count })),
    () => searchCount(token, "deals", [
      { propertyName: "hubspot_owner_id", operator: "EQ", value: o.id },
      { propertyName: "notes_last_updated", operator: "LT", value: tenDaysAgo },
      { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
    ]).then((count) => ({ ownerId: o.id, type: "deals", count })),
  ]);

  const staleResults = await batchedFetch(staleFns, 3);
  const stalePerOwner: Record<string, { contacts: number; deals: number }> = {};
  for (const r of staleResults) {
    if (!stalePerOwner[r.ownerId]) stalePerOwner[r.ownerId] = { contacts: 0, deals: 0 };
    if (r.type === "contacts") stalePerOwner[r.ownerId].contacts = r.count;
    else stalePerOwner[r.ownerId].deals = r.count;
  }

  const ownersWithStale = owners
    .map((o) => ({ ...o, stale: stalePerOwner[o.id] ?? { contacts: 0, deals: 0 } }))
    .filter((o) => o.stale.contacts > 0 || o.stale.deals > 0)
    .sort((a, b) => (b.stale.contacts + b.stale.deals) - (a.stale.contacts + a.stale.deals));

  const totalStaleContacts = ownersWithStale.reduce((s, o) => s + o.stale.contacts, 0);
  const totalStaleDeals = ownersWithStale.reduce((s, o) => s + o.stale.deals, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Contacts inactifs (&gt;10j)</p>
          <p className="mt-1 text-3xl font-bold text-orange-500">{totalStaleContacts.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs text-slate-400">Dernière activité il y a plus de 10 jours</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Deals ouverts inactifs (&gt;10j)</p>
          <p className="mt-1 text-3xl font-bold text-red-500">{totalStaleDeals.toLocaleString("fr-FR")}</p>
          <p className="mt-1 text-xs text-slate-400">Deals en cours sans activité récente</p>
        </article>
      </div>

      {/* Detail per owner */}
      {ownersWithStale.length > 0 ? (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-orange-500" />Records sans activité depuis 10+ jours par propriétaire
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{ownersWithStale.length} propriétaires</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">Contacts et deals dont la dernière activité date de plus de 10 jours. Signal de relance nécessaire.</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Propriétaire</th>
                  <th className="px-4 py-2">Équipe</th>
                  <th className="px-4 py-2 text-right">Contacts inactifs</th>
                  <th className="px-4 py-2 text-right">Deals ouverts inactifs</th>
                  <th className="px-4 py-2 text-right">Total à relancer</th>
                </tr>
              </thead>
              <tbody>
                {ownersWithStale.map((o) => {
                  const total = o.stale.contacts + o.stale.deals;
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
                        <span className={`tabular-nums ${o.stale.contacts > 0 ? "font-semibold text-orange-600" : "text-slate-300"}`}>
                          {o.stale.contacts > 0 ? o.stale.contacts.toLocaleString("fr-FR") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`tabular-nums ${o.stale.deals > 0 ? "font-semibold text-red-600" : "text-slate-300"}`}>
                          {o.stale.deals > 0 ? o.stale.deals.toLocaleString("fr-FR") : "—"}
                        </span>
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
          <p className="text-sm text-emerald-700">Tous les contacts et deals ont une activité récente. Bonne discipline commerciale.</p>
        </div>
      )}
    </div>
  );
}
