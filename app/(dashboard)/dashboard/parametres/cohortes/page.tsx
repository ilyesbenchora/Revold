export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty, checkHubSpotPropertyAcrossObjects, CANONICAL_TO_HUBSPOT_OBJECT } from "@/lib/integrations/hubspot-properties";
import { PROVIDER_IDENTIFIERS } from "@/lib/integrations/identifier-catalog";
import { ParametresTabs } from "@/components/parametres-tabs";
import { CohortMappingsForm, type CohortMapping, type CohortPropertyStatus, type CohortTeamRights } from "@/components/cohort-mappings-form";
import { IdentifierMappingForm, type HubSpotPropertyStatus } from "@/components/identifier-mapping-form";
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

  // ── Dates de contrat (groupe Ventes) : propriétés custom du CRM, stockées
  // dans identifier_field_mapping (la sync et le radar de facturation les
  // consomment) — le bloc d'édition vit ICI, plus dans le Modèle de données. ──
  const CONTRACT_CANONICALS = new Set(["contract_start", "contract_end", "deal_contract_start", "deal_contract_end"]);
  const contractIdentifiers = (PROVIDER_IDENTIFIERS.hubspot ?? []).filter((id) =>
    CONTRACT_CANONICALS.has(id.canonicalField),
  );
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
  const contractPropertyStatus: HubSpotPropertyStatus = {};
  if (hsToken) {
    await Promise.all(
      contractIdentifiers
        .filter((id) => !id.native)
        .map(async (id) => {
          const mapped = contractMappings.find((m) => m.canonical_field === id.canonicalField);
          const propName = mapped?.provider_field ?? id.defaultProviderField;
          // Champ optionnel non mappé : pas de vérification (badge trompeur sinon).
          if (!propName.trim()) return;
          const objectType =
            mapped?.object_type ?? id.defaultObject ?? CANONICAL_TO_HUBSPOT_OBJECT[id.canonicalField] ?? "companies";
          contractPropertyStatus[id.canonicalField] = await checkHubSpotProperty(hsToken, objectType, propName, id.label);
        }),
    );
  }
  const contractRows = [
    { provider: "hubspot", label: "HubSpot", icon: "🟠", domain: "hubspot.com", identifiers: contractIdentifiers },
  ];
  const salesGroup = COHORT_TEAMS.find((t) => t.id === "sales");

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cohortes : indique dans quelles propriétés de ton CRM vivent tes axes d&apos;analyse — secteur, segment,
          sources, priorité, dates de contrat et cohortes custom. Les cohortes sont regroupées par équipe : chacun ne
          voit que les groupes que ses droits autorisent (matrice « Cohortes par équipe » dans Utilisateurs &amp; équipes).
        </p>
      </header>

      <ParametresTabs />

      <CohortMappingsForm initial={mappings} initialStatus={propertyStatus} hasCrm={!!hsToken} teamRights={teamRights} />

      {/* ── Dates de contrat : groupe Ventes — visibles selon les mêmes droits. ── */}
      {teamRights.sales?.view && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span aria-hidden>{salesGroup?.icon}</span> Dates de contrat ({salesGroup?.label})
          </h2>
          <p className="text-sm text-slate-500">
            Les propriétés CRM qui portent les dates de début et de fin de contrat — elles alimentent le radar de
            facturation et les analyses par cohorte de contrat. Le nom de la propriété diffère selon les bases :
            Revold vérifie qu&apos;elle existe dans ton CRM avant d&apos;appliquer le mapping.
          </p>
          {hsToken ? (
            <IdentifierMappingForm
              rows={contractRows}
              savedMappings={contractMappings}
              disabledProviders={[]}
              hubspotPropertyStatus={contractPropertyStatus}
              allowExtraCustomIds={false}
            />
          ) : (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-500">Connecte ton CRM pour mapper les dates de contrat.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
