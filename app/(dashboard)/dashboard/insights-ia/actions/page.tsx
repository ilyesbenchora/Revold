import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { AutomationInsights } from "@/components/automation-insights";
import { buildContext, fetchDismissals, fetchWorkflows } from "../context";
import Link from "next/link";

export default async function ActionsCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  const [ctx, { dismissedKeys }, { workflows, dealsNoOwner }] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchWorkflows(token),
  ]);

  const tDeals = ctx.totalDeals;
  const dealsNoOwnerPct = tDeals > 0 ? Math.round((dealsNoOwner / tDeals) * 100) : 0;

  return (
    <section className="space-y-6">
      <header>
        <Link href="/dashboard/insights-ia" className="text-xs text-slate-400 hover:text-accent transition">
          &larr; Mes coaching IA
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Mes actions coaching IA</h1>
        <p className="mt-1 text-sm text-slate-500">Workflows manquants ou sous-exploités pour optimiser vos processus RevOps.</p>
      </header>

      <AutomationInsights
        workflows={workflows}
        dealsNoOwnerPct={dealsNoOwnerPct}
        dealsNoOwner={dealsNoOwner}
        dealsNoNextActivity={ctx.dealsNoNextActivity}
        dealsNoActivity={ctx.dealsNoActivity}
        openDeals={ctx.openDeals}
        contacts={ctx.totalContacts}
        leads={ctx.leadsCount}
        dismissedKeys={dismissedKeys}
      />
    </section>
  );
}
