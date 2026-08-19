export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { MetricDefinitionsForm, type Metric } from "@/components/metric-definitions-form";

/**
 * Paramètres → Métriques : le dictionnaire sémantique des métriques de
 * l'organisation — chaque terme chiffré de l'entreprise (« CA signé »,
 * « MRR net »…) avec sa définition MAISON, injectée dans tous les agents.
 */
export default async function ParametresMetriquesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  let metrics: Metric[] = [];
  let unavailable = false;
  try {
    const { data, error } = await supabase
      .from("metric_definitions")
      .select("id, label, definition, unit")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) unavailable = true;
    else metrics = (data ?? []) as Metric[];
  } catch {
    unavailable = true;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Métriques : définis le vocabulaire chiffré de TON entreprise — ce que veut dire « CA signé »,
          « MRR net » ou « churn » chez toi (périmètre, exclusions, pipeline de référence). Tous les agents
          Revold appliquent ces définitions : tout le monde parle du même chiffre.
        </p>
      </header>

      <ParametresTabs />

      <MetricDefinitionsForm initial={metrics} unavailable={unavailable} />
    </section>
  );
}
