export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PageNavTabs } from "@/components/page-nav-tabs";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { HIERARCHIE_NAV, mergeNavItems, type PageNavItem } from "@/lib/settings/page-nav";

/**
 * Page CUSTOM de la section Hiérarchie comptes (onglet ajouté via « ✎ Onglets »)
 * : coquille à composer — tuiles KPI configurables + tableaux de données,
 * accrochés à la clé hierarchie_<slug>. Même mécanique que les pages custom
 * des sections Ventes / Marketing.
 */
export default async function HierarchieCustomPage({ params }: { params: Promise<{ slug: string }> }) {
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
      .eq("nav_key", HIERARCHIE_NAV.navKey)
      .maybeSingle();
    const items = mergeNavItems(HIERARCHIE_NAV, (data?.items as PageNavItem[]) ?? []);
    const found = items.find((i) => i.custom && i.slug === slug);
    if (found) label = found.label;
  } catch {
    /* table absente → repli slug */
  }

  const pageKey = `${HIERARCHIE_NAV.basePageKey}_${slug.replace(/-/g, "_")}`;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{label}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Page personnalisée de la section Hiérarchie comptes — compose-la avec tes tuiles KPI et tes tableaux de
          données.
        </p>
      </header>

      <PageNavTabs nav={HIERARCHIE_NAV} />

      {/* ── Tuiles KPI configurables ── */}
      <ConfigurableKpiTiles supabase={supabase} orgId={orgId} pageKey={pageKey} defaults={[]} />

      {/* ── Tableaux / graphiques de données (tables propres à la page) ── */}
      <PageDataTables pageKey={pageKey} />
    </section>
  );
}
