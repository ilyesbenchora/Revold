import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { MesRapports } from "@/components/agents/mes-rapports";

export const dynamic = "force-dynamic";

export default async function MesRapportsPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const { data: alerts } = orgId
    ? await supabase
        .from("alerts")
        .select("id, title, description, impact, category, status, created_at")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les rapports que tu as enregistrés depuis les agents, avec leurs alertes de suivi activées.
        </p>
      </div>
      <MesRapports alerts={alerts ?? []} />
    </div>
  );
}
