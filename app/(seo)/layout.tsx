import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

// Pages de contenu SEO / GEO (mots-clés longue traîne, comparatifs, à propos) :
// INDEXÉES, chaque page porte son titre, sa description et son canonical.
export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function SeoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
