import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PROPERTY_OBJECTS, fetchOwners, type AssetStats } from "../context";

export default async function AssetsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;

  const owners = await fetchOwners(token);
  const assetsPerUser: Record<number, AssetStats> = {};

  const propFetches = PROPERTY_OBJECTS.map((ot) =>
    fetch(`https://api.hubapi.com/crm/v3/properties/${ot.key}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { results: [] })
      .then((data) => ({ field: ot.field, results: (data.results ?? []) as Array<{ hubspotDefined: boolean; createdUserId?: number }> }))
  );

  const [wfRes, ...propResults] = await Promise.all([
    fetch("https://api.hubapi.com/automation/v3/workflows?limit=250", { headers: { Authorization: `Bearer ${token}` } }),
    ...propFetches,
  ]);

  const emptyAssets = (): AssetStats => ({ workflows: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0, propertiesLineItem: 0, propertiesProduct: 0, propertiesTicket: 0 });

  if (wfRes.ok) {
    const wfData = await wfRes.json();
    for (const wf of (wfData.workflows ?? [])) {
      const uid = wf.originalAuthorUserId;
      if (uid) {
        if (!assetsPerUser[uid]) assetsPerUser[uid] = emptyAssets();
        assetsPerUser[uid].workflows++;
      }
    }
  }

  for (const pr of propResults) {
    for (const p of pr.results) {
      if (p.hubspotDefined) continue;
      const uid = p.createdUserId;
      if (uid) {
        if (!assetsPerUser[uid]) assetsPerUser[uid] = emptyAssets();
        assetsPerUser[uid][pr.field]++;
      }
    }
  }

  const ownersEnriched = owners.map((o) => {
    const assets = o.userId ? (assetsPerUser[o.userId] ?? null) : null;
    const totalAssets = assets ? Object.values(assets).reduce((s, v) => s + v, 0) : 0;
    return { ...o, assets, totalAssets };
  });

  const topAssetCreators = [...ownersEnriched].filter((o) => o.totalAssets > 0).sort((a, b) => b.totalAssets - a.totalAssets);

  return (
    <div className="space-y-6">
      {topAssetCreators.length > 0 ? (
        <CollapsibleBlock
          title={<h2 className="text-lg font-semibold text-slate-900">Assets créés par utilisateur</h2>}
        >
          <p className="text-sm text-slate-500">Workflows et propriétés personnalisées créés sur tous les objets CRM.</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-3 py-2 text-right">WF</th>
                  {PROPERTY_OBJECTS.map((ot) => (
                    <th key={ot.key} className="px-2 py-2 text-right">{ot.label}</th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topAssetCreators.map((o) => (
                  <tr key={o.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                      <p className="text-[10px] text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{o.assets?.workflows || <span className="text-slate-300">—</span>}</td>
                    {PROPERTY_OBJECTS.map((ot) => (
                      <td key={ot.key} className="px-2 py-2.5 text-right text-slate-700">
                        {(o.assets?.[ot.field] || 0) > 0 ? o.assets![ot.field] : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{o.totalAssets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500">Aucun asset créé par les utilisateurs pour le moment.</p>
        </div>
      )}
    </div>
  );
}
