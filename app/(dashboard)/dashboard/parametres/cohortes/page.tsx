export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty, checkHubSpotPropertyAcrossObjects } from "@/lib/integrations/hubspot-properties";
import { ParametresTabs } from "@/components/parametres-tabs";
import { SettingsEditLock } from "@/components/settings-edit-lock";
import { CohortMappingsForm, type CohortMapping, type CohortPropertyStatus, type CohortTeamRights } from "@/components/cohort-mappings-form";
import { CohortContractRow, type ContractFieldInit } from "@/components/cohort-contract-row";
import { getCurrentRole } from "@/lib/auth/rbac";
import { COHORT_TEAMS, cohortAccessHref, cohortTeamRight, isCohortTeam, type CohortTeamId } from "@/lib/settings/cohort-teams";

/**
 * Paramètres → Cohortes : mapping des propriétés CRM (nom interne + nom API)
 * qui portent les axes d'analyse — GROUPÉES PAR ÉQUIPE (Ventes, Marketing,
 * Service client, Comptabilité, transverses). Chaque membre ne voit que les
 * groupes autorisés par la matrice « Cohortes par équipe » (Utilisateurs &
 * équipes) ; l'admin voit tout. Le groupe Ventes porte aussi les dates de
 * début/fin de contrat (propriétés custom du CRM, radar de facturation).
 */
export default async function ParametresCohortesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  // ── Droits du membre courant par groupe d'équipe ──
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const myRole = userId ? await getCurrentRole(supabase, userId) : null;
  let myPole: string | null = null;
  if (userId) {
    try {
      const { data } = await supabase.from("profiles").select("pole").eq("id", userId).maybeSingle();
      myPole = (data?.pole as string | null) ?? null;
    } catch {
      /* colonne pole absente → non restreint */
    }
  }
  let accessRules: Record<string, Record<string, Record<string, boolean>>> = {};
  try {
    const { data: ruleRows } = await supabase
      .from("page_access")
      .select("page_href, access")
      .eq("organization_id", orgId)
      .in("page_href", COHORT_TEAMS.map((t) => cohortAccessHref(t.id)));
    for (const r of ruleRows ?? []) {
      const row = r as { page_href: string; access: Record<string, Record<string, boolean>> | null };
      if (row.page_href && row.access) accessRules[row.page_href] = row.access;
    }
  } catch {
    accessRules = {};
  }
  // Admin ou membre sans pôle : tous les droits. Membre avec pôle : règle
  // enregistrée sinon défaut (son équipe = tous droits, les autres = aucun).
  const unrestricted = myRole === "admin" || !myPole || !isCohortTeam(myPole);
  const teamRights: CohortTeamRights = {};
  for (const t of COHORT_TEAMS) {
    teamRights[t.id] = unrestricted
      ? { view: true, edit: true, create: true }
      : {
          view: cohortTeamRight(accessRules, t.id, myPole as CohortTeamId, "view"),
          edit: cohortTeamRight(accessRules, t.id, myPole as CohortTeamId, "edit"),
          create: cohortTeamRight(accessRules, t.id, myPole as CohortTeamId, "create"),
        };
  }

  // ── Mappings de cohortes enregistrés ──
  let mappings: CohortMapping[] = [];
  try {
    const { data } = await supabase
      .from("cohort_mappings")
      .select("mappings")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (Array.isArray(data?.mappings)) mappings = data.mappings as CohortMapping[];
  } catch {
    /* table absente → vide */
  }

  // Vérification live des propriétés CRM du mapping — même système que le bloc
  // d'identifiants (Modèle de données). La recherche cible l'OBJET porté par le
  // mapping ; sans objet enregistré, elle couvre Contact/Entreprise/Deal.
  const VALID_OBJECTS = new Set(["contacts", "companies", "deals"]);
  const hsToken = await getHubSpotToken(supabase, orgId);
  const propertyStatus: CohortPropertyStatus = {};
  await Promise.all(
    mappings
      .filter((m) => m.api_name?.trim() || m.internal_name?.trim())
      .map(async (m) => {
        const obj = m.object && VALID_OBJECTS.has(m.object) ? m.object : null;
        const check = obj
          ? { ...(await checkHubSpotProperty(hsToken, obj, m.api_name ?? "", m.internal_name)), foundObject: null as string | null }
          : await checkHubSpotPropertyAcrossObjects(hsToken, m.api_name ?? "", m.internal_name);
        propertyStatus[m.key] = {
          exists: check.exists,
          label: check.label,
          suggestedName: check.suggestedName,
          foundObject: check.foundObject ?? (obj && check.exists === true ? obj : null),
        };
      }),
  );

  // ── Cohorte « Contrat » (groupe Ventes) : dates de début/fin de contrat,
  // stockées en identifier_field_mapping (la sync et le radar de facturation
  // les consomment) — rendue avec la MÊME structure que les lignes de cohortes.
  const CONTRACT_CANONICALS = new Set(["contract_start", "contract_end", "deal_contract_start", "deal_contract_end"]);
  let contractMappings: Array<{ provider: string; canonical_field: string; provider_field: string; object_type?: string | null }> = [];
  try {
    const { data } = await supabase
      .from("identifier_field_mapping")
      .select("provider, canonical_field, provider_field, object_type")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot");
    contractMappings = ((data ?? []) as typeof contractMappings).filter((m) => CONTRACT_CANONICALS.has(m.canonical_field));
  } catch {
    /* table absente → défauts */
  }
  const contractField = async (canonical: string, legacy: string): Promise<ContractFieldInit> => {
    const m =
      contractMappings.find((x) => x.canonical_field === canonical) ??
      contractMappings.find((x) => x.canonical_field === legacy);
    const object = m?.object_type ?? (m?.canonical_field.startsWith("deal_") ? "deals" : "companies");
    const apiName = m?.provider_field?.trim() ?? "";
    // Vérification serveur uniquement si un mapping existe (badge honnête).
    const check = hsToken && apiName ? await checkHubSpotProperty(hsToken, object, apiName) : null;
    return { object, apiName, label: check?.label ?? "", exists: check?.exists ?? null };
  };
  const [contractStart, contractEnd] = await Promise.all([
    contractField("contract_start", "deal_contract_start"),
    contractField("contract_end", "deal_contract_end"),
  ]);
  const contractBlock = (
    <CohortContractRow
      initial={{ start: contractStart, end: contractEnd }}
      hasCrm={!!hsToken}
      editable={teamRights.sales?.edit ?? false}
    />
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cohortes : indique dans quelles propriétés de ton CRM vivent tes axes d&apos;analyse — secteur, segment,
          sources, dates de contrat et cohortes custom. Les cohortes sont regroupées par équipe : chacun ne
          voit que les groupes que ses droits autorisent (matrice « Cohortes par équipe » dans Utilisateurs &amp; équipes).
        </p>
      </header>

      <ParametresTabs />

      <SettingsEditLock label="✎ Modifier les cohortes">
        <CohortMappingsForm
          initial={mappings}
          initialStatus={propertyStatus}
          hasCrm={!!hsToken}
          teamRights={teamRights}
          salesExtra={contractBlock}
        />
      </SettingsEditLock>
    </section>
  );
}
