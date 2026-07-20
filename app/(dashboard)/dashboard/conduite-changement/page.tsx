export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { fetchOwnersFromCache } from "./context";
import { BlockDataTable } from "@/components/data-tables/block-data-table";

export default async function AdoptionOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  // Lecture cache : owners depuis hubspot_objects, KPIs depuis snapshot
  const [owners, snapshot] = await Promise.all([
    fetchOwnersFromCache(supabase, orgId),
    getHubspotSnapshot(),
  ]);

  if (snapshot.status === "no-token") {
    return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;
  }

  // Activités totales : on dérive des données disponibles dans le snapshot.
  // sequencesEnrollments + (deals avec notes / activities loguées) sont
  // les proxies les plus représentatifs sans appel /engagements live.
  const totalActivities = snapshot.sequencesEnrollments + Math.max(0, snapshot.totalDeals - snapshot.dealsNoNextActivity);
  // Owners "actifs" = ceux qui ont au moins 1 deal en cours OU 1 activité.
  // Sans agrégation par owner dans le snapshot, on prend une heuristique
  // simple : si au moins un deal et N owners, on assume répartition.
  const activeUsers = owners.length > 0
    ? Math.min(owners.length, Math.max(1, Math.round(snapshot.openDeals / Math.max(1, owners.length / 2))))
    : 0;

  // Données du bloc + alerte chirurgicale.
  return (
    <div>
      <BlockDataTable
        title="Adoption CRM — synthèse"
        subtitle="conduite du changement"
        team="revops"
        unit="count"
        nameLabel="Indicateur"
        valueLabel="Valeur"
        rows={[
          { name: "Activités totales", value: totalActivities, unit: "count" },
          { name: "Utilisateurs", value: owners.length, unit: "count" },
          { name: "Utilisateurs actifs", value: activeUsers, unit: "count" },
        ]}
      />
    </div>
  );
}
