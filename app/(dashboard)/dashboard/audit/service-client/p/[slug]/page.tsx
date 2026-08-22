export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { SERVICE_CLIENT_NAV, mergeNavItems, type PageNavItem } from "@/lib/settings/page-nav";

/**
 * Page CUSTOM de la section Service Client (onglet ajouté par l'utilisateur
 * via « ✎ Onglets ») : coquille vide à composer — tuiles KPI configurables +
 * tableaux de données, accrochés à la clé audit_service_client_<slug>. Le
 * catalogue de KPIs, les presets, l'équipe d'alerte et l'agent sont hérités
 * de la page Service Client racine (résolution par préfixe).
 */
export default async function ServiceClientCustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // Libellé de l'onglet (page_nav) — repli lisible sur le slug si la page a
  // été supprimée des onglets (ses tuiles/tableaux restent accessibles par URL).
  let label = slug.replace(/-/g, " ");
  try {
    const { data } = await supabase
      .from("page_nav")
      .select("items")
      .eq("organization_id", orgId)
      .eq("nav_key", SERVICE_CLIENT_NAV.navKey)
      .maybeSingle();
    const items = mergeNavItems(SERVICE_CLIENT_NAV, (data?.items as PageNavItem[]) ?? []);
    const found = items.find((i) => i.custom && i.slug === slug);
    if (found) label = found.label;
  } catch {
    /* table absente → repli slug */
  }

  const pageKey = `${SERVICE_CLIENT_NAV.basePageKey}_${slug.replace(/-/g, "_")}`;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{label}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Page personnalisée de la section Service Client — compose-la avec tes tuiles KPI et tes tableaux de données.
        </p>
      </header>

      <ServiceClientTabs />

      {/* ── Tuiles KPI configurables (catalogue csm hérité de la page Service Client) ── */}
      <ConfigurableKpiTiles supabase={supabase} orgId={orgId} pageKey={pageKey} defaults={[]} />

      {/* ── Tableaux/graphiques de données (presets Service Client, tables propres à la page) ── */}
      <PageDataTables pageKey={pageKey} />
    </section>
  );
}
