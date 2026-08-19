"use client";

import { PageNavTabs } from "@/components/page-nav-tabs";
import { MARKETING_NAV } from "@/lib/settings/page-nav";

/** Onglets de la section Marketing — personnalisables (voir PageNavTabs). */
export function MarketingTabs() {
  return <PageNavTabs nav={MARKETING_NAV} />;
}
