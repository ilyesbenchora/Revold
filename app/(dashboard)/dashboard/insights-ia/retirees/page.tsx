import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightCard } from "@/components/insight-card";
import { InsightTabs } from "@/components/insight-tabs";

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

export default async function InsightsRetireesPage() {
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
  const removed = all.filter((d) => d.status === "removed");

  const byCategory: Record<string, DismissalRow[]> = {
    commercial: [],
    marketing: [],
    data: [],
    automation: [],
  };
  removed.forEach((d) => {
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
        <h1 className="text-2xl font-semibold text-slate-900">Insights IA retirés</h1>
        <p className="mt-1 text-sm text-slate-500">Recommandations que vous avez retirées de votre liste active.</p>
      </header>

      <InsightTabs />

      {removed.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-sm text-slate-500">Aucun insight retiré pour le moment.</p>
          <p className="mt-1 text-xs text-slate-400">Cliquez sur la croix rouge d&apos;un insight pour le retrouver ici.</p>
        </div>
      ) : (
        blocs.filter((b) => b.insights.length > 0).map((bloc) => (
          <div key={bloc.id} className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className={`h-2 w-2 rounded-full ${bloc.dot}`} />
              {bloc.label}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{bloc.insights.length}</span>
            </h2>
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
          </div>
        ))
      )}
    </section>
  );
}
