import { getOrgId } from "@/lib/supabase/cached";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";

type Owner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number | null;
  teams: string[];
};

type AssetStats = {
  workflows: number;
  propertiesContact: number;
  propertiesCompany: number;
  propertiesDeal: number;
  propertiesLineItem: number;
  propertiesProduct: number;
  propertiesTicket: number;
};

type ActivityByType = { CALL: number; EMAIL: number; MEETING: number; NOTE: number; TASK: number; total: number };

const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE", "TASK"] as const;
const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  CALL: { label: "Appels", color: "bg-blue-500", icon: "📞" },
  EMAIL: { label: "Emails", color: "bg-indigo-500", icon: "📧" },
  MEETING: { label: "RDV", color: "bg-violet-500", icon: "📅" },
  NOTE: { label: "Notes", color: "bg-amber-500", icon: "📝" },
  TASK: { label: "Tâches", color: "bg-emerald-500", icon: "✅" },
};

const PROPERTY_OBJECTS = [
  { key: "contacts", label: "Contacts", field: "propertiesContact" as const },
  { key: "companies", label: "Entreprises", field: "propertiesCompany" as const },
  { key: "deals", label: "Transactions", field: "propertiesDeal" as const },
  { key: "line_items", label: "Lignes produit", field: "propertiesLineItem" as const },
  { key: "products", label: "Produits", field: "propertiesProduct" as const },
  { key: "tickets", label: "Tickets", field: "propertiesTicket" as const },
];

// Batched fetch to avoid HubSpot rate limits (max 3 concurrent)
async function batchedFetch<T>(promises: (() => Promise<T>)[], batchSize = 3): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

async function searchCount(token: string, objectType: string, filters: Array<{ propertyName: string; operator: string; value?: string }>): Promise<number> {
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

export default async function AdoptionPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return (
      <section className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez votre CRM pour analyser l&apos;adoption.</p>
        </header>
      </section>
    );
  }

  let owners: Owner[] = [];
  const assetsPerUser: Record<number, AssetStats> = {};
  const activitiesPerOwner: Record<string, ActivityByType> = {};
  const stalePerOwner: Record<string, { contacts: number; deals: number }> = {};

  try {
    // ── 1. Owners ──
    const ownerRes = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", { headers: { Authorization: `Bearer ${token}` } });
    if (ownerRes.ok) {
      const d = await ownerRes.json();
      owners = (d.results ?? []).map((o: Record<string, unknown>) => ({
        id: o.id as string,
        email: o.email as string,
        firstName: (o.firstName as string) || "",
        lastName: (o.lastName as string) || "",
        userId: (o.userId as number) || null,
        teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
      }));
    }

    // ── 2. Assets: workflows (v3) + properties on ALL object types ──
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

    // ── 3. Activities per owner — total + breakdown by type (batched to avoid 429) ──
    const totalFns = owners.map((o) => () =>
      searchCount(token, "engagements", [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }])
        .then((total) => ({ ownerId: o.id, total }))
    );
    const totals = await batchedFetch(totalFns, 5);

    for (const t of totals) {
      activitiesPerOwner[t.ownerId] = { CALL: 0, EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: t.total };
    }

    // Type breakdown for active owners (batched by 3 to stay under rate limit)
    const activeOwnerIds = totals.filter((t) => t.total > 0).sort((a, b) => b.total - a.total).slice(0, 10).map((t) => t.ownerId);
    const typeFns = activeOwnerIds.flatMap((oid) =>
      ACTIVITY_TYPES.map((type) => () =>
        searchCount(token, "engagements", [
          { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
          { propertyName: "hs_engagement_type", operator: "EQ", value: type },
        ]).then((count) => ({ ownerId: oid, type, count }))
      )
    );
    const typeResults = await batchedFetch(typeFns, 3);
    for (const r of typeResults) {
      if (activitiesPerOwner[r.ownerId]) {
        activitiesPerOwner[r.ownerId][r.type as keyof Omit<ActivityByType, "total">] = r.count;
      }
    }

    // ── 4. Stale records: contacts/deals with last_activity_date > 10 days per owner ──
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
    const staleFns: Array<() => Promise<{ ownerId: string; type: string; count: number }>> = activeOwnerIds.flatMap((oid) => [
      () => searchCount(token, "contacts", [
        { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
        { propertyName: "notes_last_updated", operator: "LT", value: tenDaysAgo },
      ]).then((count) => ({ ownerId: oid, type: "contacts", count })),
      () => searchCount(token, "deals", [
        { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
        { propertyName: "notes_last_updated", operator: "LT", value: tenDaysAgo },
        { propertyName: "hs_is_closed", operator: "NEQ", value: "true" },
      ]).then((count) => ({ ownerId: oid, type: "deals", count })),
    ]);
    const staleResults = await batchedFetch(staleFns, 3);
    for (const r of staleResults) {
      if (!stalePerOwner[r.ownerId]) stalePerOwner[r.ownerId] = { contacts: 0, deals: 0 };
      if (r.type === "contacts") stalePerOwner[r.ownerId].contacts = r.count;
      else stalePerOwner[r.ownerId].deals = r.count;
    }
  } catch {}

  // ── Build view data ──
  const ownersEnriched = owners.map((o) => {
    const assets = o.userId ? (assetsPerUser[o.userId] ?? null) : null;
    const totalAssets = assets ? Object.values(assets).reduce((s, v) => s + v, 0) : 0;
    const activity = activitiesPerOwner[o.id] ?? { CALL: 0, EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0 };
    const stale = stalePerOwner[o.id] ?? { contacts: 0, deals: 0 };
    return { ...o, assets, totalAssets, activity, stale };
  });

  const topAssetCreators = [...ownersEnriched].filter((o) => o.totalAssets > 0).sort((a, b) => b.totalAssets - a.totalAssets).slice(0, 15);
  const topActivityUsers = [...ownersEnriched].filter((o) => o.activity.total > 0).sort((a, b) => b.activity.total - a.activity.total).slice(0, 10);
  const usersWithStale = [...ownersEnriched].filter((o) => o.stale.contacts > 0 || o.stale.deals > 0).sort((a, b) => (b.stale.contacts + b.stale.deals) - (a.stale.contacts + a.stale.deals));

  // Team activity ranking
  const teamActivity: Record<string, ActivityByType & { members: number }> = {};
  ownersEnriched.forEach((o) => {
    const teamList = o.teams.length > 0 ? o.teams : ["Sans équipe"];
    teamList.forEach((t) => {
      if (!teamActivity[t]) teamActivity[t] = { CALL: 0, EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0, members: 0 };
      teamActivity[t].total += o.activity.total;
      teamActivity[t].members++;
      ACTIVITY_TYPES.forEach((at) => { teamActivity[t][at] += o.activity[at]; });
    });
  });
  const sortedTeamActivity = Object.entries(teamActivity).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
        <p className="mt-1 text-sm text-slate-500">Mesure de l&apos;adoption du CRM : activités de vente, assets créés et suivi des records.</p>
      </header>

      <InsightLockedBlock />

      {/* ── Équipes les plus actives ── */}
      {sortedTeamActivity.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-blue-500" />Activité commerciale par équipe</h2>}
        >
          <div className="space-y-3">
            {sortedTeamActivity.map(([team, stats]) => (
              <div key={team} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{team}</p>
                    <p className="text-xs text-slate-400">{stats.members} membre{stats.members > 1 ? "s" : ""} — {Math.round(stats.total / stats.members).toLocaleString("fr-FR")} act. moy./user</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{stats.total.toLocaleString("fr-FR")} activités</p>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {ACTIVITY_TYPES.map((t) => (
                    <div key={t} className="rounded-lg bg-slate-50 p-2.5 text-center">
                      <p className="text-lg">{ACTIVITY_LABELS[t].icon}</p>
                      <p className="mt-1 text-base font-bold text-slate-900 tabular-nums">{stats[t].toLocaleString("fr-FR")}</p>
                      <p className="text-[10px] text-slate-500">{ACTIVITY_LABELS[t].label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Activité de vente par utilisateur ── */}
      {topActivityUsers.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />Activité de vente par utilisateur</h2>}
        >
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2">Équipe</th>
                  {ACTIVITY_TYPES.map((t) => (
                    <th key={t} className="px-3 py-2 text-center">{ACTIVITY_LABELS[t].icon} {ACTIVITY_LABELS[t].label}</th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topActivityUsers.map((o) => {
                  const maxAct = topActivityUsers[0].activity.total || 1;
                  const pct = Math.round((o.activity.total / maxAct) * 100);
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
                      {ACTIVITY_TYPES.map((t) => (
                        <td key={t} className="px-3 py-2.5 text-center">
                          <span className={`text-sm tabular-nums ${o.activity[t] > 0 ? "font-semibold text-slate-800" : "text-slate-300"}`}>
                            {o.activity[t] > 0 ? o.activity[t].toLocaleString("fr-FR") : "—"}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-slate-900 tabular-nums">{o.activity.total.toLocaleString("fr-FR")}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Records sans activité récente (> 10 jours) ── */}
      {usersWithStale.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-orange-500" />Records sans activité depuis 10+ jours</h2>}
        >
          <p className="text-sm text-slate-500">Contacts et deals dont la dernière activité date de plus de 10 jours, par propriétaire. Signal de relance nécessaire.</p>
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
                {usersWithStale.map((o) => {
                  const total = o.stale.contacts + o.stale.deals;
                  return (
                    <tr key={o.id} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
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
      )}

      {/* ── Assets créés par utilisateur ── */}
      {topAssetCreators.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-indigo-500" />Assets créés par utilisateur</h2>}
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
      )}
    </section>
  );
}
