export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getBarColor } from "@/lib/score-utils";

async function hsCount(token: string, body: object): Promise<number> {
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
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

export default async function DonneesEntreprisesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  const t = snapshot.totalCompanies;

  // Count "with X" via HubSpot search HAS_PROPERTY
  let withDomain = t - snapshot.companiesNoDomain;
  let withIndustry = t - snapshot.companiesNoIndustry;
  let withRevenue = t - snapshot.companiesNoRevenue;
  let withEmployees = 0;
  let withOwner = 0;
  let withCountry = 0;

  if (token) {
    [withEmployees, withOwner, withCountry] = await Promise.all([
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "numberofemployees", operator: "HAS_PROPERTY" }] }] }),
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }] }),
      hsCount(token, { filterGroups: [{ filters: [{ propertyName: "country", operator: "HAS_PROPERTY" }] }] }),
    ]);
  }

  const pct = (n: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const fields = [
    { label: "Domaine web", filled: pct(withDomain), icon: "🌐" },
    { label: "Secteur d'activité", filled: pct(withIndustry), icon: "🏭" },
    { label: "Chiffre d'affaires", filled: pct(withRevenue), icon: "💰" },
    { label: "Effectifs", filled: pct(withEmployees), icon: "👥" },
    { label: "Owner attribué", filled: pct(withOwner), icon: "👤" },
    { label: "Pays", filled: pct(withCountry), icon: "🌍" },
  ];

  const globalCompleteness =
    fields.length > 0 ? Math.round(fields.reduce((s, f) => s + f.filled, 0) / fields.length) : 0;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Complétude globale des entreprises</p>
            <p className="text-xs text-slate-500">
              {t.toLocaleString("fr-FR")} entreprises HubSpot live
            </p>
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
              {Math.round((f.filled / 100) * t).toLocaleString("fr-FR")} renseignés sur{" "}
              {t.toLocaleString("fr-FR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
