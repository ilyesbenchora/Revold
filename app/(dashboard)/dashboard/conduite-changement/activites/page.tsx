import { getOrgId } from "@/lib/supabase/cached";
import { CollapsibleBlock } from "@/components/collapsible-block";
import {
  ACTIVITY_TYPES, ACTIVITY_LABELS,
  fetchOwners, searchCount, batchedFetch,
  type Owner, type ActivityByType,
} from "../context";

export default async function ActivitesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;

  const owners = await fetchOwners(token);
  const activitiesPerOwner: Record<string, ActivityByType> = {};

  // Fetch activity breakdown by type for each owner (batched to avoid 429)
  // We fetch by type directly — no separate total call, sum types for total
  const typeFns = owners.flatMap((o) =>
    ACTIVITY_TYPES.map((type) => () =>
      searchCount(token, "engagements", [
        { propertyName: "hubspot_owner_id", operator: "EQ", value: o.id },
        { propertyName: "hs_engagement_type", operator: "EQ", value: type },
      ]).then((count) => ({ ownerId: o.id, type, count }))
    )
  );
  const typeResults = await batchedFetch(typeFns, 3);

  for (const r of typeResults) {
    if (!activitiesPerOwner[r.ownerId]) {
      activitiesPerOwner[r.ownerId] = { CALL: 0, EMAIL: 0, INCOMING_EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0 };
    }
    activitiesPerOwner[r.ownerId][r.type as keyof Omit<ActivityByType, "total">] = r.count;
    activitiesPerOwner[r.ownerId].total += r.count;
  }

  const ownersEnriched = owners.map((o) => ({
    ...o,
    activity: activitiesPerOwner[o.id] ?? { CALL: 0, EMAIL: 0, INCOMING_EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0 },
  }));

  const topActivityUsers = [...ownersEnriched].filter((o) => o.activity.total > 0).sort((a, b) => b.activity.total - a.activity.total);

  // Team ranking
  const teamActivity: Record<string, ActivityByType & { members: number }> = {};
  ownersEnriched.forEach((o) => {
    const teamList = o.teams.length > 0 ? o.teams : ["Sans équipe"];
    teamList.forEach((t) => {
      if (!teamActivity[t]) teamActivity[t] = { CALL: 0, EMAIL: 0, INCOMING_EMAIL: 0, MEETING: 0, NOTE: 0, TASK: 0, total: 0, members: 0 };
      teamActivity[t].total += o.activity.total;
      teamActivity[t].members++;
      ACTIVITY_TYPES.forEach((at) => { teamActivity[t][at] += o.activity[at]; });
    });
  });
  const sortedTeamActivity = Object.entries(teamActivity).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      {/* Équipes */}
      {sortedTeamActivity.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="text-lg font-semibold text-slate-900">Activité commerciale par équipe</h2>}
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
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {ACTIVITY_TYPES.map((t) => (
                    <div key={t} className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-base">{ACTIVITY_LABELS[t].icon}</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">{stats[t].toLocaleString("fr-FR")}</p>
                      <p className="text-[9px] text-slate-500">{ACTIVITY_LABELS[t].label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* Utilisateurs */}
      {topActivityUsers.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="text-lg font-semibold text-slate-900">Activité de vente par utilisateur</h2>}
        >
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-[11px] font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-3 py-2">Équipe</th>
                  {ACTIVITY_TYPES.map((t) => (
                    <th key={t} className="px-2 py-2 text-center">{ACTIVITY_LABELS[t].icon}</th>
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
                      <td className="px-3 py-2.5">
                        {o.teams.length > 0 ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{o.teams[0]}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      {ACTIVITY_TYPES.map((t) => (
                        <td key={t} className="px-2 py-2.5 text-center">
                          <span className={`text-xs tabular-nums ${o.activity[t] > 0 ? "font-semibold text-slate-800" : "text-slate-300"}`}>
                            {o.activity[t] > 0 ? o.activity[t].toLocaleString("fr-FR") : "—"}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-slate-900 tabular-nums text-xs">{o.activity.total.toLocaleString("fr-FR")}</span>
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
    </div>
  );
}
