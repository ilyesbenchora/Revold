import type { ReactNode } from "react";
import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 md:py-24">
        {children}
      </main>

      <footer className="border-t border-card-border bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row md:justify-between">
          <RevoldLogo />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal/confidentialite" className="hover:text-slate-900">Confidentialité</Link>
            <Link href="/legal/cgu" className="hover:text-slate-900">CGU</Link>
            <Link href="/legal/securite" className="hover:text-slate-900">Sécurité</Link>
            <Link href="/legal/rgpd" className="hover:text-slate-900">RGPD</Link>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
