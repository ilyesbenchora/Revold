"use client";

import { PageNavTabs } from "@/components/page-nav-tabs";
import { VENTES_NAV } from "@/lib/settings/page-nav";

/** Onglets de la section Ventes — personnalisables (voir PageNavTabs). */
export function VentesTabs() {
  return <PageNavTabs nav={VENTES_NAV} />;
}
