import Link from "next/link";
import { RevoldLogo } from "@/components/revold-logo";

/**
 * Footer du site public — thème sombre cockpit, partagé par toutes les pages
 * marketing. Colonnes produit / solutions / légal + baseline.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <RevoldLogo tone="dark" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              La vérité revenue des entreprises françaises — du CRM au compte en banque.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Produit</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/produits/resolution-entites" className="text-slate-300 transition hover:text-white">Rapprochement de données</Link></li>
              <li><Link href="/produits/insights-ia" className="text-slate-300 transition hover:text-white">Mon équipe IA 24/7</Link></li>
              <li><Link href="/produits/synchronisation" className="text-slate-300 transition hover:text-white">Synchronisation</Link></li>
              <li><Link href="/produits/reporting-cross-source" className="text-slate-300 transition hover:text-white">Reporting cross-source</Link></li>
              <li><Link href="/produits/alertes-previsions" className="text-slate-300 transition hover:text-white">Alertes & actions</Link></li>
              <li><Link href="/tarifs" className="text-slate-300 transition hover:text-white">Tarifs</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Entreprise</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/pourquoi-revold" className="text-slate-300 transition hover:text-white">Pourquoi Revold</Link></li>
              <li><Link href="/blog" className="text-slate-300 transition hover:text-white">Blog</Link></li>
              <li><Link href="/contact" className="text-slate-300 transition hover:text-white">Contact</Link></li>
              <li><Link href="/demo" className="text-slate-300 transition hover:text-white">Demander une démo</Link></li>
              <li><Link href="/essai-gratuit" className="text-slate-300 transition hover:text-white">Essai gratuit 14 jours</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Légal & sécurité</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/legal/securite" className="text-slate-300 transition hover:text-white">Sécurité & conformité</Link></li>
              <li><Link href="/legal/rgpd" className="text-slate-300 transition hover:text-white">RGPD</Link></li>
              <li><Link href="/legal/dpa" className="text-slate-300 transition hover:text-white">DPA</Link></li>
              <li><Link href="/legal/confidentialite" className="text-slate-300 transition hover:text-white">Confidentialité</Link></li>
              <li><Link href="/legal/cgu" className="text-slate-300 transition hover:text-white">CGU</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 md:flex-row">
          <p>© {new Date().getFullYear()} Revold — Revenue Intelligence made in France 🇫🇷</p>
          <p>Données hébergées dans l&apos;Union européenne · Accès lecture seule à vos outils, révocable à tout moment</p>
        </div>
      </div>
    </footer>
  );
}
