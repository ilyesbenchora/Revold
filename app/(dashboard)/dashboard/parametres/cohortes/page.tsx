export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty, checkHubSpotPropertyAcrossObjects } from "@/lib/integrations/hubspot-properties";
import { ParametresTabs } from "@/components/parametres-tabs";
import { CohortMappingsForm, type CohortMapping, type CohortPropertyStatus } from "@/components/cohort-mappings-form";

/**
 * Paramètres → Cohortes : mapping des propriétés CRM (nom interne + nom API)
 * qui portent les axes marketing — Secteur d'activité, Segment, Sources
 * (canal d'acquisition), Priorité + customs. Dans beaucoup de bases, ces axes
 * vivent dans des propriétés CUSTOM : ce mapping permet à Revold de les
 * croiser correctement dans les reportings.
 */
export default async function ParametresCohortesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

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
  // d'identifiants (Modèle de données) : un mapping qui pointe vers une
  // propriété absente du CRM ne vaut rien. CRM connecté = HubSpot aujourd'hui.
  // La recherche cible l'OBJET porté par le mapping (ex : Sources → Contact) ;
  // sans objet enregistré, elle couvre Contact/Entreprise/Deal.
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

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cohortes : indique dans quelles propriétés de ton CRM vivent le secteur d&apos;activité, le segment, les
          sources d&apos;acquisition et la priorité — souvent des propriétés custom. Revold s&apos;en sert pour croiser
          correctement ces axes marketing dans tes reportings.
        </p>
      </header>

      <ParametresTabs />

      <CohortMappingsForm initial={mappings} initialStatus={propertyStatus} hasCrm={!!hsToken} />
    </section>
  );
}
