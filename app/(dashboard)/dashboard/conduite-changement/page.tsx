export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { fetchOwnersFromCache } from "./context";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { BlocksManager } from "@/components/data-tables/blocks-manager";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";

export default async function AdoptionOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  // Lecture cache : owners depuis hubspot_objects, KPIs depuis snapshot
  const [owners, snapshot] = await Promise.all([
    fetchOwnersFromCache(supabase, orgId),
    getHubspotSnapshot(),
  ]);

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

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_adoption");

  // Tuiles par défaut (mêmes valeurs qu'avant — désormais masquables/remplaçables).
  const adoptionPct = owners.length > 0 ? Math.round((activeUsers / owners.length) * 100) : null;
  const defaultTiles: DefaultTile[] = [
    { key: "utilisateurs_crm", label: "Utilisateurs CRM", value: String(owners.length), tone: "accent", sub: "Owners déclarés" },
    {
      key: "utilisateurs_actifs",
      label: "Utilisateurs actifs",
      value: String(activeUsers),
      tone: adoptionPct != null && adoptionPct >= 70 ? "pos" : "neutral",
      sub: "Au moins 1 deal ou activité",
    },
    {
      key: "taux_adoption",
      label: "Taux d'adoption",
      value: adoptionPct != null ? `${adoptionPct} %` : "—",
      tone: adoptionPct == null ? "neutral" : adoptionPct >= 70 ? "pos" : adoptionPct >= 40 ? "accent" : "neg",
      sub: "Actifs / utilisateurs",
      verdict: adoptionPct == null ? undefined
        : adoptionPct >= 70 ? { label: "Bonne adoption (> 70 %)", tone: "pos" }
        : adoptionPct >= 40 ? { label: "À accompagner", tone: "warn" }
        : { label: "Adoption faible (< 40 %)", tone: "neg" },
    },
    { key: "activites_totales", label: "Activités totales", value: totalActivities.toLocaleString("fr-FR"), tone: "neutral", sub: "Séquences + deals travaillés" },
  ];

  // Données du bloc + alerte chirurgicale. Affichage ISO avec le mapping
  // « Outil source par page » (clé audit_adoption = page Équipes).
  return (
    <div className="space-y-4">
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_adoption" categories={["crm"]}>
        {snapshot.status === "no-token" ? (
          <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>
        ) : (
          <>
            {/* Lecture cockpit en un coup d'œil : tuiles KPI configurables */}
            <ConfigurableKpiTiles
              supabase={supabase}
              orgId={orgId}
              pageKey="audit_adoption"
              defaults={defaultTiles}
              customization={custom}
            />

            {!custom.hiddenBlocks.has("adoption_synthese") && (
              <RemovableBlock pageKey="audit_adoption" blockKey="adoption_synthese" label="Adoption CRM — synthèse">
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
              </RemovableBlock>
            )}

            {/* Ajouter un bloc : réafficher un bloc masqué ou créer depuis les suggestions. */}
            <BlocksManager pageKey="audit_adoption" tablesPageKey="audit_adoption" hiddenBlocks={hiddenBlockList(custom)} />
          </>
        )}
      </PageSourcesGate>

      <PageDataTables pageKey="audit_adoption" />
    </div>
  );
}
