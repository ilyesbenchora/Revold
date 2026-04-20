export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

type AtRiskDeal = {
  id: string;
  name: string;
  amount: number;
  closedate: string | null;
  probability: number;
  daysSinceLastContact: number | null;
  hasNextActivity: boolean;
  pipelineLabel: string;
  stageLabel: string;
  risks: string[];
};

async function fetchAtRiskDeals(token: string): Promise<AtRiskDeal[]> {
  // Critères "à risque" expert CRO :
  //  - Open deal
  //  - hs_deal_stage_probability < 0.30 OU
  //  - Pas de next_activity_date OU
  //  - Last contacted > 14 jours
  // On fait 1 requête large puis on classifie côté serveur.
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const all: Array<{
    id: string;
    properties: {
      dealname?: string;
      amount?: string;
      closedate?: string;
      pipeline?: string;
      dealstage?: string;
      hs_deal_stage_probability?: string;
      notes_last_contacted?: string;
      notes_next_activity_date?: string;
    };
  }> = [];
  let after: string | undefined;
  let page = 0;
  do {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hs_is_closed", operator: "NEQ", value: "true" }] }],
          properties: [
            "dealname",
            "amount",
            "closedate",
            "pipeline",
            "dealstage",
            "hs_deal_stage_probability",
            "notes_last_contacted",
            "notes_next_activity_date",
          ],
          sorts: [{ propertyName: "amount", direction: "DESCENDING" }],
          limit: 100,
          ...(after ? { after } : {}),
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      all.push(...(data.results ?? []));
      after = data.paging?.next?.after;
      page++;
    } catch {
      break;
    }
  } while (after && page < 20); // cap 2000 deals open analysés

  return all
    .map((d) => {
      const probability = parseFloat(d.properties.hs_deal_stage_probability ?? "1");
      const lastContactedStr = d.properties.notes_last_contacted;
      const lastContacted = lastContactedStr ? new Date(parseInt(lastContactedStr, 10)) : null;
      const daysSinceLastContact = lastContacted
        ? Math.floor((Date.now() - lastContacted.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const hasNextActivity = !!d.properties.notes_next_activity_date;

      const risks: string[] = [];
      if (probability < 0.3) risks.push(`Probabilité faible : ${Math.round(probability * 100)}%`);
      if (!hasNextActivity) risks.push("Aucune prochaine activité planifiée");
      if (daysSinceLastContact !== null && daysSinceLastContact > 14) {
        risks.push(`Pas de contact depuis ${daysSinceLastContact} jours`);
      }
      if (lastContacted === null) risks.push("Jamais contacté");

      return {
        id: d.id,
        name: d.properties.dealname || "Sans nom",
        amount: parseFloat(d.properties.amount ?? "0"),
        closedate: d.properties.closedate ?? null,
        probability,
        daysSinceLastContact,
        hasNextActivity,
        pipelineLabel: d.properties.pipeline ?? "",
        stageLabel: d.properties.dealstage ?? "",
        risks,
      } as AtRiskDeal;
    })
    .filter((d) => d.risks.length > 0)
    .sort((a, b) => b.amount - a.amount);
}

export default async function DealsAtRiskPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  if (!token) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Deals à risque</h1>
        </header>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-8 text-center">
          <p className="text-sm">HubSpot non connecté.</p>
        </div>
      </section>
    );
  }

  const deals = await fetchAtRiskDeals(token);

  // Mapping pipeline + stage labels via snapshot
  const stageLabelById = new Map<string, { label: string; pipelineLabel: string }>();
  for (const p of snapshot.pipelines) {
    for (const s of p.stages) {
      stageLabelById.set(s.id, { label: s.label, pipelineLabel: p.label });
    }
  }

  const totalAmount = deals.reduce((sum, d) => sum + d.amount, 0);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Deals à risque</h1>
        <p className="mt-1 text-sm text-slate-600">
          {deals.length} deal{deals.length > 1 ? "s" : ""} flaggé{deals.length > 1 ? "s" : ""} ·
          Total à protéger : {totalAmount.toLocaleString("fr-FR")}€ · Source : HubSpot live
        </p>
      </header>

      {/* KPIs synthèse */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[10px] uppercase text-rose-700">À risque</p>
          <p className="mt-1 text-2xl font-bold text-rose-900">{deals.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] uppercase text-amber-700">Pipeline ouvert</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{snapshot.openDeals}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-[10px] uppercase text-orange-700">% à risque</p>
          <p className="mt-1 text-2xl font-bold text-orange-900">
            {snapshot.openDeals > 0 ? Math.round((deals.length / snapshot.openDeals) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[10px] uppercase text-rose-700">€ exposé</p>
          <p className="mt-1 text-2xl font-bold text-rose-900">
            {Math.round(totalAmount / 1000)}K
          </p>
        </div>
      </div>

      {deals.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Aucun deal à risque détecté. Pipeline en bonne santé.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {deals.slice(0, 100).map((deal) => {
          const stageInfo = stageLabelById.get(deal.stageLabel);
          return (
            <article key={deal.id} className="card overflow-hidden border-rose-200">
              <div className="border-b border-rose-100 bg-rose-50 px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900">{deal.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {stageInfo?.pipelineLabel && <span>{stageInfo.pipelineLabel} · </span>}
                      {stageInfo?.label && <span>Étape : {stageInfo.label}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-slate-900">
                    {deal.amount.toLocaleString("fr-FR")}€
                  </span>
                </div>
              </div>

              <div className="space-y-3 px-5 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                    Signaux de risque
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {deal.risks.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                  {deal.closedate && (
                    <span>Closing prévu : {new Date(deal.closedate).toLocaleDateString("fr-FR")}</span>
                  )}
                  {deal.daysSinceLastContact !== null && (
                    <span>Dernier contact : {deal.daysSinceLastContact}j</span>
                  )}
                  <span>Probabilité : {Math.round(deal.probability * 100)}%</span>
                </div>
              </div>
            </article>
          );
        })}
        {deals.length > 100 && (
          <p className="py-2 text-center text-xs text-slate-400">
            + {deals.length - 100} autres deals à risque (top 100 affichés)
          </p>
        )}
      </div>
    </section>
  );
}
