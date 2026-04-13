import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { DonneesTabs } from "@/components/donnees-tabs";
import { InsightLockedBlock } from "@/components/insight-locked-block";

export default async function DonneesLayout({ children }: { children: ReactNode }) {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const [{ count: tc }, { count: tco }, { count: td }] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Données</h1>
        <p className="mt-1 text-sm text-slate-500">Qualité et enrichissement des données CRM.</p>
      </header>

      <DonneesTabs contactsCount={tc ?? 0} companiesCount={tco ?? 0} dealsCount={td ?? 0} />

      {children}

      <InsightLockedBlock />
    </section>
  );
}
