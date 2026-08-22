"use client";

import { PageNavTabs } from "@/components/page-nav-tabs";
import { SERVICE_CLIENT_NAV } from "@/lib/settings/page-nav";

/** Onglets de la section Service Client — personnalisables (voir PageNavTabs). */
export function ServiceClientTabs() {
  return <PageNavTabs nav={SERVICE_CLIENT_NAV} />;
}
