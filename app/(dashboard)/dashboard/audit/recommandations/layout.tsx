import type { ReactNode } from "react";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { RecommandationsTabs } from "@/components/recommandations-tabs";
import { buildAuditRecommendations } from "@/lib/audit/recommendations-library";

export default async function RecommandationsLayout({ children }: { children: ReactNode }) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const snapshot = await getHubspotSnapshot();
  const recs = buildAuditRecommendations(snapshot);
  const counts = {
    donnees: recs.donnees.length,
    process: recs.process.length,
    performances: recs.performances.length,
    adoption: recs.adoption.length,
  };

  return (
    <section className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            🧠 CRO/RevOps Expert
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Recommandations Audit</h1>
        <p className="mt-1 text-sm text-slate-500">
          Diagnostic data-driven de votre CRM + plans d&apos;action concrets pour activer des coachings IA persistés.
        </p>
      </header>

      <RecommandationsTabs counts={counts} />

      {children}
    </section>
  );
}
