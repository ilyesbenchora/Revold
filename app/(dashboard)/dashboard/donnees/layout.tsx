import type { ReactNode } from "react";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuditableTools } from "@/lib/audit/tool-hubs";
import { DonneesTabs } from "@/components/donnees-tabs";
import { InsightLockedBlock } from "@/components/insight-locked-block";

export default async function DonneesLayout({ children }: { children: ReactNode }) {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  // Onglets dynamiques : une sous-page dédiée par outil connecté (dès qu'un
  // outil est branché à Revold, son onglet apparaît ici).
  const supabase = await createSupabaseServerClient();
  const tools = await getAuditableTools(supabase, orgId);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Rapprochement données</h1>
        <p className="mt-1 text-sm text-slate-500">Qualité des données, audit d&apos;onboarding de vos outils et enrichissement.</p>
      </header>

      <DonneesTabs toolTabs={tools.map((t) => ({ key: t.key, label: t.label }))} />

      {children}

      <InsightLockedBlock />
    </section>
  );
}
