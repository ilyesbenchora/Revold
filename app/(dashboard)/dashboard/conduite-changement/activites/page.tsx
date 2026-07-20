export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import {
  ACTIVITY_TYPES, ACTIVITY_LABELS,
  fetchOwners, searchCount, batchedFetch,
  type Owner, type ActivityByType,
} from "../context";

export default async function ActivitesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
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
          {/* Données du bloc + alerte chirurgicale. */}
          <div>
            <BlockDataTable
              title="Activité par équipe"
              subtitle="activités CRM"
              team="revops"
              unit="count"
              nameLabel="Équipe"
              valueLabel="Total activités"
              extraColumns={[
                "Membres",
                "Act. moy./membre",
                ...ACTIVITY_TYPES.map((t) => ACTIVITY_LABELS[t].label),
              ]}
              rows={sortedTeamActivity.map(([teamName, stats]) => ({
                name: teamName,
                value: stats.total,
                unit: "count" as const,
                cells: [
                  stats.members,
                  Math.round(stats.total / stats.members),
                  ...ACTIVITY_TYPES.map((t) => stats[t]),
                ],
              }))}
            />
          </div>
        </CollapsibleBlock>
      )}

      {/* Utilisateurs */}
      {topActivityUsers.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="text-lg font-semibold text-slate-900">Activité de vente par utilisateur</h2>}
        >
          {/* Données du bloc + alerte chirurgicale. */}
          <div>
            <BlockDataTable
              title="Activité par utilisateur"
              subtitle="activités CRM"
              team="revops"
              unit="count"
              nameLabel="Utilisateur"
              valueLabel="Total activités"
              extraColumns={[
                "Email",
                "Équipe",
                ...ACTIVITY_TYPES.map((t) => ACTIVITY_LABELS[t].label),
              ]}
              rows={topActivityUsers.map((o) => ({
                name: `${o.firstName} ${o.lastName}`.trim() || o.email,
                value: o.activity.total,
                unit: "count" as const,
                cells: [
                  o.email,
                  o.teams[0] ?? "—",
                  ...ACTIVITY_TYPES.map((t) => o.activity[t]),
                ],
              }))}
            />
          </div>
        </CollapsibleBlock>
      )}
    </div>
  );
}
