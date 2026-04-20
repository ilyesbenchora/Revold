export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";

async function hsCount(token: string, body: object): Promise<number> {
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, ...body }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total ?? 0;
  } catch {
    return 0;
  }
}

export default async function DonneesTransactionsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const t = snapshot.totalDeals;
  const withAmount = t - snapshot.dealsNoAmount;
  const withCloseDate = t - snapshot.dealsNoCloseDate;

  let withContact = 0;
  let withPipeline = 0;
  let withOwner = 0;
  let withStage = 0;
  if (token) {
    [withContact, withPipeline, withOwner, withStage] = await Promise.all([
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "num_associated_contacts", operator: "GT", value: "0" }] }] }),
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "HAS_PROPERTY" }] }] }),
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }] }),
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "HAS_PROPERTY" }] }] }),
    ]);
  }

  const pct = (n: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const fields = [
    { label: "Montant renseigné", filled: pct(withAmount), icon: "💰" },
    { label: "Date de closing", filled: pct(withCloseDate), icon: "📅" },
    { label: "Contact associé", filled: pct(withContact), icon: "👤" },
    { label: "Pipeline assigné", filled: pct(withPipeline), icon: "📊" },
    { label: "Owner attribué", filled: pct(withOwner), icon: "🎯" },
    { label: "Stage renseigné", filled: pct(withStage), icon: "📋" },
  ];

  const globalCompleteness =
    fields.length > 0 ? Math.round(fields.reduce((s, f) => s + f.filled, 0) / fields.length) : 0;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Complétude globale des transactions</p>
            <p className="text-xs text-slate-500">{t.toLocaleString("fr-FR")} transactions HubSpot live</p>
          </div>
          <div className="text-right">
            <p
              className={`text-3xl font-bold tabular-nums ${
                globalCompleteness >= 80
                  ? "text-emerald-600"
                  : globalCompleteness >= 50
                  ? "text-amber-600"
                  : "text-red-500"
              }`}
            >
              {globalCompleteness} %
            </p>
            <p className="text-[10px] text-slate-400">complétude moyenne</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${getBarColor(globalCompleteness)} transition-all`}
            style={{ width: `${globalCompleteness}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{f.icon}</span>
                <span className="text-sm text-slate-700">{f.label}</span>
              </div>
              <span
                className={`text-sm font-bold tabular-nums ${
                  f.filled >= 80 ? "text-emerald-600" : f.filled >= 50 ? "text-amber-600" : "text-red-500"
                }`}
              >
                {f.filled} %
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${getBarColor(f.filled)} transition-all`}
                style={{ width: `${f.filled}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              {Math.round((f.filled / 100) * t).toLocaleString("fr-FR")} renseignés sur {t.toLocaleString("fr-FR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
