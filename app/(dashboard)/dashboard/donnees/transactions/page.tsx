export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";

export default async function DonneesTransactionsPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  const [
    { count: total },
    { count: withAmount },
    { count: withCloseDate },
    { count: withContact },
    { count: withPipeline },
    { count: withOwner },
    { count: withStage },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("amount", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("close_date", "is", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("associated_contacts_count", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("pipeline_id", "is", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("hubspot_owner_id", "is", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("deal_stage", "is", null),
  ]);

  const t = total ?? 0;
  const pct = (n: number | null) => t > 0 ? Math.round(((n ?? 0) / t) * 100) : 0;

  const fields = [
    { label: "Montant renseigné", filled: pct(withAmount), icon: "💰" },
    { label: "Date de closing", filled: pct(withCloseDate), icon: "📅" },
    { label: "Contact associé", filled: pct(withContact), icon: "👤" },
    { label: "Pipeline assigné", filled: pct(withPipeline), icon: "📊" },
    { label: "Owner attribué", filled: pct(withOwner), icon: "🎯" },
    { label: "Stage renseigné", filled: pct(withStage), icon: "📋" },
  ];

  const globalCompleteness = fields.length > 0 ? Math.round(fields.reduce((s, f) => s + f.filled, 0) / fields.length) : 0;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Complétude globale des transactions</p>
            <p className="text-xs text-slate-500">{t.toLocaleString("fr-FR")} transactions synchronisées</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold tabular-nums ${globalCompleteness >= 80 ? "text-emerald-600" : globalCompleteness >= 50 ? "text-amber-600" : "text-red-500"}`}>{globalCompleteness} %</p>
            <p className="text-[10px] text-slate-400">complétude moyenne</p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${getBarColor(globalCompleteness)} transition-all`} style={{ width: `${globalCompleteness}%` }} />
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
              <span className={`text-sm font-bold tabular-nums ${f.filled >= 80 ? "text-emerald-600" : f.filled >= 50 ? "text-amber-600" : "text-red-500"}`}>{f.filled} %</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${getBarColor(f.filled)} transition-all`} style={{ width: `${f.filled}%` }} />
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
