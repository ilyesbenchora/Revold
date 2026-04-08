import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { InsightTabs } from "@/components/insight-tabs";
import { CollapsibleBlock } from "@/components/collapsible-block";

type DismissalRow = {
  template_key: string;
  status?: string;
  title?: string | null;
  body?: string | null;
  recommendation?: string | null;
  severity?: string | null;
  category?: string | null;
  hubspot_url?: string | null;
  dismissed_at?: string;
};

export default async function InsightsRealiseesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const { data: rawDismissals } = await supabase
    .from("insight_dismissals")
    .select("*")
    .eq("organization_id", orgId)
    .order("dismissed_at", { ascending: false });

  const all = (rawDismissals ?? []) as DismissalRow[];
  // "done" status OR no status (legacy = treat as done)
  const done = all.filter((d) => !d.status || d.status === "done");
  const removedCount = all.filter((d) => d.status === "removed").length;
  const doneCount = done.length;

  // Group by category
  const byCategory: Record<string, DismissalRow[]> = {
    commercial: [],
    marketing: [],
    data: [],
    automation: [],
  };
  done.forEach((d) => {
    const cat = d.category || (d.template_key.startsWith("automation_") ? "automation" : "commercial");
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(d);
  });

  const blocs = [
    { id: "commercial", label: "Insights Commerciaux", insights: byCategory.commercial, dot: "bg-blue-500" },
    { id: "marketing", label: "Insights Marketing", insights: byCategory.marketing, dot: "bg-amber-500" },
    { id: "data", label: "Insights Data", insights: byCategory.data, dot: "bg-emerald-500" },
    { id: "automation", label: "Insights Automation", insights: byCategory.automation, dot: "bg-violet-500" },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Insights IA réalisés</h1>
        <p className="mt-1 text-sm text-slate-500">Recommandations que vous avez marquées comme faites.</p>
      </header>

      <InsightTabs doneCount={doneCount} removedCount={removedCount} />

      {done.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-500">Aucun insight réalisé pour le moment.</p>
          <p className="mt-1 text-xs text-slate-400">Cliquez sur « Marquer comme fait » sur un insight depuis la page principale.</p>
        </div>
      ) : (
        blocs.filter((b) => b.insights.length > 0).map((bloc) => (
          <CollapsibleBlock
            key={bloc.id}
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
                {bloc.label}
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{bloc.insights.length}</span>
              </h2>
            }
          >
            <div className="space-y-3">
              {bloc.insights.map((d) => (
                <InsightCard
                  key={d.template_key}
                  templateKey={d.template_key}
                  severity={(d.severity as "critical" | "warning" | "info") || "info"}
                  title={d.title || d.template_key}
                  body={d.body || ""}
                  recommendation={d.recommendation || ""}
                  hubspotUrl={d.hubspot_url || undefined}
                  category={d.category || undefined}
                  showRestore
                />
              ))}
            </div>
          </CollapsibleBlock>
        ))
      )}
    </section>
  );
}
