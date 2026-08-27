export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { PerformancesTabs } from "@/components/performances-tabs";
import { MarketingTabs } from "@/components/marketing-tabs";
import { LifecycleConversionBlock } from "@/components/lifecycle-conversion-block";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { PageSections } from "@/components/data-tables/page-sections";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { HBarChart } from "@/components/charts/hbar-chart";
import { buildLifecycleConversion } from "@/lib/sync/compute-lifecycle-conversion";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";

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

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "perf_marketing");

  // Tuiles par défaut (mêmes valeurs qu'avant — désormais masquables/remplaçables).
  const lc = buildLifecycleConversion(snapshot);
  const nativeContacts = contactSourcesGlobal
    .filter((s) => nativeKeys.includes(s.source))
    .reduce((n, s) => n + s.count, 0);
  const nativePct = totalSourceContacts > 0 ? Math.round((nativeContacts / totalSourceContacts) * 100) : null;
  const defaultTiles: DefaultTile[] = snapshot.totalContacts > 0
    ? [
        { key: "contacts", label: "Contacts", value: snapshot.totalContacts.toLocaleString("fr-FR"), raw: snapshot.totalContacts, rawUnit: "count", tone: "accent", sub: `${lc.totalContactsInFunnel.toLocaleString("fr-FR")} dans le funnel lifecycle` },
        {
          key: "conversion_funnel",
          label: "Conversion funnel",
          value: lc.endToEndPct != null ? `${lc.endToEndPct} %` : "—",
          raw: lc.endToEndPct,
          rawUnit: "percent",
          tone: lc.endToEndPct == null ? "neutral" : lc.endToEndPct >= 10 ? "pos" : lc.endToEndPct >= 3 ? "accent" : "neg",
          sub: "1ʳᵉ étape → dernière étape clé",
          verdict: lc.endToEndPct == null ? undefined
            : lc.endToEndPct >= 10 ? { label: "Solide (> 10 %)", tone: "pos" }
            : lc.endToEndPct >= 3 ? { label: "Dans la norme", tone: "warn" }
            : { label: "Faible (< 3 %)", tone: "neg" },
        },
        {
          key: "hors_funnel",
          label: "Hors funnel",
          value: lc.contactsOutsideFunnel.toLocaleString("fr-FR"),
          raw: lc.contactsOutsideFunnel,
          rawUnit: "count",
          tone: lc.contactsOutsideFunnel === 0 ? "pos" : "neutral",
          sub: "Lifecycle vide ou custom",
          verdict: snapshot.totalContacts > 0 && lc.contactsOutsideFunnel / snapshot.totalContacts > 0.3
            ? { label: "Segmentation à revoir", tone: "warn" }
            : undefined,
        },
        {
          key: "acquisition_native",
          label: "Acquisition native",
          value: nativePct != null ? `${nativePct} %` : "—",
          raw: nativePct,
          rawUnit: "percent",
          tone: "neutral",
          sub: "Formulaires, emails, site, workflows",
        },
        // ── Lifecycle stage du CRM : UNE tuile par stage (contacts actuellement
        // dans le stage + part du funnel) — masquables individuellement via
        // « Personnaliser les KPIs » comme toutes les tuiles par défaut. ──
        ...lc.stages.map<DefaultTile>((s) => ({
          key: `lifecycle_${s.value}`,
          label: `Lifecycle · ${s.label}`,
          value: s.inStageCount.toLocaleString("fr-FR"),
          raw: s.inStageCount,
          rawUnit: "count",
          tone: "accent",
          sub:
            lc.totalContactsInFunnel > 0
              ? `${Math.round((s.inStageCount / lc.totalContactsInFunnel) * 100)} % du funnel`
              : undefined,
        })),
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Performances</h1>
          <p className="mt-1 text-sm text-slate-500">
            Analyse du funnel, de l&apos;attribution et de la qualité des contacts.
          </p>
        </div>
      </header>

      <PerformancesTabs />
      <MarketingTabs />

      <InsightLockedBlock
        previewTitle="Analyse IA de votre performance marketing"
        previewBody="L'IA Revold analyse votre funnel d'acquisition, identifie les canaux les plus performants et recommande les optimisations à fort impact sur la conversion Lead → Opportunité."
      />

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_perf_marketing" categories={["crm", "ads"]}>

      {/* Lecture cockpit en un coup d'œil : tuiles KPI configurables (CTA unique :
          le panneau d'ajout contient aussi les blocs de la page) */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="perf_marketing"
        defaults={defaultTiles}
        customization={custom}
        tablesPageKey="perf_marketing"
        hiddenBlocks={hiddenBlockList(custom, (key) => ({
          lifecycle_conversion: { view: "funnel", description: "Funnel Lead → Customer avec taux de passage par étape" },
          sources_acquisition: { view: "table", description: "Contacts par source d'origine (part du total, natif/externe)" },
        }[key]))}
      />

      {/* Lifecycle conversion */}
      {!custom.hiddenBlocks.has("lifecycle_conversion") && (
        <RemovableBlock pageKey="perf_marketing" blockKey="lifecycle_conversion" label="Lifecycle conversion (Lead → Customer)">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Lifecycle conversion (Lead → Customer)
              </h2>
            }
          >
            <LifecycleConversionBlock data={lc} />
          </CollapsibleBlock>
        </RemovableBlock>
      )}

      {/* Tunnel d'acquisition par source d'origine */}
      {contactSourcesGlobal.length > 0 && !custom.hiddenBlocks.has("sources_acquisition") && (
        <RemovableBlock pageKey="perf_marketing" blockKey="sources_acquisition" label="Tunnel d'acquisition par source d'origine">
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
          {/* Barres horizontales cockpit : lecture immédiate du mix d'acquisition */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-800">Mix d&apos;acquisition</p>
            <p className="mb-3 text-[10px] text-slate-400">Contacts par source d&apos;origine · part du total</p>
            <HBarChart
              unit="count"
              colorize
              items={contactSourcesGlobal.map((s) => ({
                label: sourceLabels[s.source] ?? s.source,
                value: s.count,
              }))}
            />
          </div>

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
        </RemovableBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey="perf_marketing" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_perf_marketing" categories={["crm", "ads"]} />

      <CreateAlertModal hideTrigger />

      <PageSections pageKey="perf_marketing" />
    </section>
  );
}
