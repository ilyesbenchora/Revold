export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { LifecycleConversionBlock } from "@/components/lifecycle-conversion-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { CreateDataTableButton } from "@/components/data-tables/create-data-table-button";
import { buildLifecycleConversion } from "@/lib/sync/compute-lifecycle-conversion";

const sourceLabels: Record<string, string> = {
  INTEGRATION: "Intégration native (Outlook, Gmail, etc.)",
  EMAIL_INTEGRATION: "Intégration Email (Gmail/Outlook)",
  IMPORT: "Import de fichier (CSV/Excel)",
  CRM_UI: "Création manuelle CRM",
  FORM: "Formulaires HubSpot",
  API: "API HubSpot",
  MOBILE_IOS: "Application mobile iOS",
  INTERNAL_PROCESSING: "Traitement interne HubSpot",
  MARKETING_EMAIL: "Email marketing",
  WORKFLOW: "Workflow HubSpot",
  CONTACTS_WEB: "Site web (tracking HubSpot)",
};
const nativeKeys = ["INTEGRATION", "EMAIL_INTEGRATION", "FORM", "MARKETING_EMAIL", "WORKFLOW", "CONTACTS_WEB"];

export default async function PerformanceMarketingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const hsToken = await getHubSpotToken(supabase, orgId);
  const snapshot = await getHubspotSnapshot();

  // Helper: count contacts by HubSpot search filter
  async function countContactsBy(filters: Array<{ propertyName: string; operator: string; value?: string }>): Promise<number> {
    if (!hsToken) return 0;
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hsToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.total ?? 0;
    } catch {
      return 0;
    }
  }

  let contactSourcesGlobal: Array<{ source: string; count: number }> = [];
  if (hsToken) {
    const sourcesToCheck = ["INTEGRATION", "EMAIL_INTEGRATION", "IMPORT", "CRM_UI", "FORM", "API", "MOBILE_IOS", "INTERNAL_PROCESSING", "MARKETING_EMAIL", "WORKFLOW", "CONTACTS_WEB"];
    const sourceCounts = await Promise.all(
      sourcesToCheck.map(async (src) => ({
        source: src,
        count: await countContactsBy([{ propertyName: "hs_object_source", operator: "EQ", value: src }]),
      })),
    );
    contactSourcesGlobal = sourceCounts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }

  const totalSourceContacts = contactSourcesGlobal.reduce((s, c) => s + c.count, 0);

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Analyse du funnel, de l&apos;attribution et de la qualité des contacts.
          </p>
        </div>
        <CreateDataTableButton />
      </header>

      <PerformancesTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance marketing"
        previewBody="L'IA Revold analyse votre funnel d'acquisition, identifie les canaux les plus performants et recommande les optimisations à fort impact sur la conversion Lead → Opportunité."
      />

      {/* Lifecycle conversion */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Lifecycle conversion (Lead → Customer)
          </h2>
        }
      >
        <LifecycleConversionBlock data={buildLifecycleConversion(snapshot)} />
      </CollapsibleBlock>

      {/* Tunnel d'acquisition par source d'origine */}
      {contactSourcesGlobal.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Tunnel d&apos;acquisition par source d&apos;origine
              <span className="text-sm font-normal text-slate-400">
                {totalSourceContacts.toLocaleString("fr-FR")} contacts
              </span>
            </h2>
          }
        >
          {/* Contacts par source + alerte chirurgicale. */}
          <div>
            <BlockDataTable
              title="Contacts par source d'origine"
              subtitle="contacts · groupé par source HubSpot"
              team="marketing"
              unit="count"
              nameLabel="Source d'origine"
              valueLabel="Contacts"
              extraColumns={["Part du total", "Type"]}
              showTotal
              rows={contactSourcesGlobal.map((s) => ({
                name: sourceLabels[s.source] ?? s.source,
                value: s.count,
                cells: [
                  `${totalSourceContacts > 0 ? Math.round((s.count / totalSourceContacts) * 100) : 0} %`,
                  nativeKeys.includes(s.source) ? "Native" : "Externe",
                ],
              }))}
              footnote="Compté en direct sur HubSpot (hs_object_source) : la source n'existe pas comme dimension d'agrégat canonique, l'agent Revold rattache l'alerte aux données à la création."
            />
          </div>
        </CollapsibleBlock>
      )}

      <PageDataTables pageKey="perf_marketing" />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
