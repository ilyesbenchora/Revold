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

type ActivityByType = {
  CALL: number;
  EMAIL: number;
  MEETING: number;
  NOTE: number;
  TASK: number;
  total: number;
};

const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE", "TASK"] as const;
const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
  CALL: { label: "Appels", color: "bg-blue-500" },
  EMAIL: { label: "Emails", color: "bg-indigo-500" },
  MEETING: { label: "RDV", color: "bg-violet-500" },
  NOTE: { label: "Notes", color: "bg-amber-500" },
  TASK: { label: "Tâches", color: "bg-emerald-500" },
};

const PROPERTY_OBJECTS = [
  { key: "contacts", label: "Contacts", field: "propertiesContact" as const },
  { key: "companies", label: "Entreprises", field: "propertiesCompany" as const },
  { key: "deals", label: "Transactions", field: "propertiesDeal" as const },
  { key: "line_items", label: "Lignes de produit", field: "propertiesLineItem" as const },
  { key: "products", label: "Produits", field: "propertiesProduct" as const },
  { key: "tickets", label: "Tickets", field: "propertiesTicket" as const },
];

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

    // ── 3. Activities per owner (engagements by type) ──
    // First get total per owner, then breakdown by type for top owners
    const totalPromises = owners.map((o) =>
      fetch("https://api.hubapi.com/crm/v3/objects/engagements/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }], limit: 1 }),
      }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, total: d.total ?? 0 }))
    );
    const totals = await Promise.all(totalPromises);
    for (const t of totals) {
      activitiesPerOwner[t.ownerId] = { CALL: 0, EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: t.total };
    }

    // Get type breakdown for owners with activity
    const activeOwnerIds = totals.filter((t) => t.total > 0).sort((a, b) => b.total - a.total).slice(0, 15).map((t) => t.ownerId);
    const typePromises = activeOwnerIds.flatMap((oid) =>
      ACTIVITY_TYPES.map((type) =>
        fetch("https://api.hubapi.com/crm/v3/objects/engagements/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [
              { propertyName: "hubspot_owner_id", operator: "EQ", value: oid },
              { propertyName: "hs_engagement_type", operator: "EQ", value: type },
            ] }],
            limit: 1,
          }),
        }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: oid, type, count: d.total ?? 0 }))
      )
    );
    const typeResults = await Promise.all(typePromises);
    for (const r of typeResults) {
      if (activitiesPerOwner[r.ownerId]) {
        activitiesPerOwner[r.ownerId][r.type as keyof Omit<ActivityByType, "total">] = r.count;
      }
    }
  } catch {}

  // ── Build view data ──
  const ownersEnriched = owners.map((o) => {
    const assets = o.userId ? (assetsPerUser[o.userId] ?? null) : null;
    const totalAssets = assets ? Object.values(assets).reduce((s, v) => s + v, 0) : 0;
    const activity = activitiesPerOwner[o.id] ?? { CALL: 0, EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0 };
    return { ...o, assets, totalAssets, activity };
  });

  const topAssetCreators = [...ownersEnriched].filter((o) => o.totalAssets > 0).sort((a, b) => b.totalAssets - a.totalAssets).slice(0, 15);
  const topActivityUsers = [...ownersEnriched].filter((o) => o.activity.total > 0).sort((a, b) => b.activity.total - a.activity.total).slice(0, 15);

  // Team activity ranking
  const teamActivity: Record<string, { total: number; members: number; calls: number; emails: number; meetings: number }> = {};
  ownersEnriched.forEach((o) => {
    const teamList = o.teams.length > 0 ? o.teams : ["Sans équipe"];
    teamList.forEach((t) => {
      if (!teamActivity[t]) teamActivity[t] = { total: 0, members: 0, calls: 0, emails: 0, meetings: 0 };
      teamActivity[t].total += o.activity.total;
      teamActivity[t].members++;
      teamActivity[t].calls += o.activity.CALL;
      teamActivity[t].emails += o.activity.EMAIL;
      teamActivity[t].meetings += o.activity.MEETING;
    });
  });
  const sortedTeamActivity = Object.entries(teamActivity).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);
  const maxTeamActivity = sortedTeamActivity[0]?.[1]?.total ?? 1;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
        <p className="mt-1 text-sm text-slate-500">Mesure de l&apos;adoption du CRM : assets créés, activités de vente et engagement par équipe.</p>
      </header>

      <InsightLockedBlock />

      {/* ── Équipes les plus actives ── */}
      {sortedTeamActivity.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-blue-500" />Activité commerciale par équipe</h2>}
        >
          <div className="space-y-3">
            {sortedTeamActivity.map(([team, stats]) => {
              const pct = Math.round((stats.total / maxTeamActivity) * 100);
              return (
                <div key={team} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{team}</p>
                      <p className="text-xs text-slate-400">{stats.members} membre{stats.members > 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.total.toLocaleString("fr-FR")}</p>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {/* Type breakdown */}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{stats.calls.toLocaleString("fr-FR")} appels</span>
                    <span className="text-slate-300">|</span>
                    <span>{stats.emails.toLocaleString("fr-FR")} emails</span>
                    <span className="text-slate-300">|</span>
                    <span>{stats.meetings.toLocaleString("fr-FR")} RDV</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-400">{Math.round(stats.total / stats.members).toLocaleString("fr-FR")} moy./user</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Activité de vente par utilisateur ── */}
      {topActivityUsers.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />Activité de vente par utilisateur</h2>}
        >
          <p className="text-sm text-slate-500">Volume d&apos;activités commerciales par utilisateur : appels, emails, RDV, notes, tâches.</p>
          <div className="space-y-2">
            {topActivityUsers.map((o) => {
              const maxAct = topActivityUsers[0].activity.total || 1;
              const pct = Math.round((o.activity.total / maxAct) * 100);
              // Breakdown bars
              const types = ACTIVITY_TYPES.filter((t) => o.activity[t] > 0);
              return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{o.firstName} {o.lastName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {o.teams.slice(0, 2).map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{t}</span>
                        ))}
                      </div>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-900 tabular-nums">{o.activity.total.toLocaleString("fr-FR")}</p>
                  </div>
                  {/* Stacked bar */}
                  <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    {types.map((t) => {
                      const typePct = (o.activity[t] / o.activity.total) * pct;
                      return (
                        <div key={t} className={`h-full ${ACTIVITY_LABELS[t].color}`} style={{ width: `${typePct}%` }} title={`${ACTIVITY_LABELS[t].label}: ${o.activity[t]}`} />
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {types.map((t) => (
                      <span key={t} className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${ACTIVITY_LABELS[t].color}`} />
                        {ACTIVITY_LABELS[t].label} {o.activity[t].toLocaleString("fr-FR")}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleBlock>
      )}

      {/* ── Assets créés par utilisateur ── */}
      {topAssetCreators.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-indigo-500" />Assets créés par utilisateur</h2>}
        >
          <p className="text-sm text-slate-500">Workflows et propriétés personnalisées créés par chaque utilisateur sur tous les objets CRM.</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2 text-right">Workflows</th>
                  {PROPERTY_OBJECTS.map((ot) => (
                    <th key={ot.key} className="px-3 py-2 text-right">{ot.label}</th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topAssetCreators.map((o) => (
                  <tr key={o.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets?.workflows || <span className="text-slate-300">—</span>}</td>
                    {PROPERTY_OBJECTS.map((ot) => (
                      <td key={ot.key} className="px-3 py-2.5 text-right text-slate-700">
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
