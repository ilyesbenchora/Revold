export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import { LifecycleConversionBlock } from "@/components/lifecycle-conversion-block";
import { buildLifecycleConversion } from "@/lib/sync/compute-lifecycle-conversion";

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  // Derniers contacts ajoutés via /search HubSpot
  type RecentContact = { id: string; full_name: string; email: string; lifecycle: string; created_at: string };
  let recent: RecentContact[] = [];
  if (hsToken) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hsToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: ["firstname", "lastname", "email", "lifecyclestage", "createdate"],
          sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
          limit: 10,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        recent = ((data.results ?? []) as Array<{
          id: string;
          properties: { firstname?: string; lastname?: string; email?: string; lifecyclestage?: string; createdate?: string };
        }>).map((r) => ({
          id: r.id,
          full_name: `${r.properties.firstname ?? ""} ${r.properties.lastname ?? ""}`.trim() || "Sans nom",
          email: r.properties.email ?? "",
          lifecycle: r.properties.lifecyclestage ?? "",
          created_at: r.properties.createdate ?? "",
        }));
      }
    } catch {}
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyse du funnel, de l&apos;attribution et de la qualité des contacts.
        </p>
      </header>

      <PerformancesTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance marketing"
        previewBody="L'IA Revold analyse votre funnel d'acquisition, identifie les canaux les plus performants et recommande les optimisations à fort impact sur la conversion Lead → Opportunité."
      />

      {/* Funnel */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BlockHeaderIcon icon="funnel" tone="fuchsia" />Lifecycle conversion (Lead → Customer)
          </h2>
        }
      >
        <LifecycleConversionBlock data={buildLifecycleConversion(snapshot)} />
      </CollapsibleBlock>

      {/* Derniers contacts */}
      {recent.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BlockHeaderIcon icon="users" tone="emerald" />Derniers contacts ajoutés
            </h2>
          }
        >
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {recent.map((c) => {
                const isOpp = ["opportunity", "salesqualifiedlead", "customer"].some((s) =>
                  c.lifecycle.toLowerCase().includes(s),
                );
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.full_name}</p>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isOpp ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.lifecycle || "Lead"}
                      </span>
                      {c.created_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(c.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleBlock>
      )}
    </section>
  );
}
