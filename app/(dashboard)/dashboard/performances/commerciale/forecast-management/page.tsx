export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { PerformancesTabs } from "@/components/performances-tabs";
import { VentesTabs } from "@/components/ventes-tabs";
import { CloseDateManagementBlock } from "@/components/close-date-management-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { fetchCloseDateBuckets } from "@/lib/integrations/hubspot-close-date";
import { fetchOwners } from "@/app/(dashboard)/dashboard/conduite-changement/context";

export default async function ForecastManagementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const pipelines = snapshot.pipelines.map((p) => ({
    id: p.id,
    label: p.label,
    stages: p.stages.map((s) => ({ id: s.id, label: s.label })),
  }));

  const fallbackBuckets = {
    pipelineId: null as string | null,
    year: new Date().getFullYear(),
    passedCloseDate: [],
    quarters: (["T1", "T2", "T3", "T4"] as const).map((k) => ({
      key: k,
      label: `${k} ${new Date().getFullYear()}`,
      start: "",
      end: "",
      deals: [],
    })),
  };
  const [initialBuckets, ownersRaw] = await Promise.all([
    token ? fetchCloseDateBuckets(token, null).catch(() => fallbackBuckets) : Promise.resolve(fallbackBuckets),
    token ? fetchOwners(token).catch(() => []) : Promise.resolve([]),
  ]);

  const owners = ownersRaw.map((o) => ({
    id: o.id,
    name: `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim() || o.email || o.id,
  }));

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Forecast Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestion des dates de fermeture et fiabilité du forecast par pipeline.
        </p>
      </header>

      <PerformancesTabs />
      <VentesTabs />

      {pipelines.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun pipeline détecté. Vérifiez la connexion HubSpot.
        </p>
      ) : (
        <CloseDateManagementBlock
          pipelines={pipelines}
          owners={owners}
          initialPipelineId={null}
          initialBuckets={initialBuckets}
        />
      )}

      <CreateAlertModal hideTrigger />
    </section>
  );
}
