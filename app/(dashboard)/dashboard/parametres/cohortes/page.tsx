export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { CohortMappingsForm, type CohortMapping } from "@/components/cohort-mappings-form";

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

      <CohortMappingsForm initial={mappings} />
    </section>
  );
}
