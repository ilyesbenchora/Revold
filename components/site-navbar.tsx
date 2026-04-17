"use client";

import Link from "next/link";
import { useState } from "react";
import { RevoldLogo } from "@/components/revold-logo";

const PRODUCT_LINKS = [
  { label: "Synchronisation de données", href: "/produits/synchronisation", desc: "Connecteurs natifs, sync bidirectionnelle" },
  { label: "Reporting cross-source", href: "/produits/reporting-cross-source", desc: "80+ rapports, croisement CRM × billing × support" },
  { label: "Résolution d'entités", href: "/produits/resolution-entites", desc: "7 méthodes de rapprochement, SIREN/SIRET" },
  { label: "Insights IA", href: "/produits/insights-ia", desc: "IA qui croise vos sources, deal coaching" },
  { label: "Audit complet du CRM", href: "/produits/audit-crm", desc: "Taux de remplissage, orphelins, score de santé" },
  { label: "Alertes & Prévisions", href: "/produits/alertes-previsions", desc: "Deals à risque, forecast probabiliste" },
];

const SOLUTION_LINKS = [
  { label: "Optimiser les revenus", href: "/solutions/optimiser-revenus" },
  { label: "Fiabiliser les données", href: "/solutions/fiabiliser-donnees" },
  { label: "Accélérer les cycles de vente", href: "/solutions/accelerer-cycles-vente" },
  { label: "Piloter la performance", href: "/solutions/piloter-performance" },
  { label: "Unifier le stack", href: "/solutions/unifier-stack" },
  { label: "Réduire le churn", href: "/solutions/reduire-churn" },
];

const TEAM_LINKS = [
  { label: "Direction / CEO", href: "/equipes/direction" },
  { label: "Marketing", href: "/equipes/marketing" },
  { label: "Sales", href: "/equipes/sales" },
  { label: "RevOps", href: "/equipes/revops" },
  { label: "CSM", href: "/equipes/csm" },
  { label: "Finance", href: "/equipes/finance" },
];

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SiteNavbar() {
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [solutionMenuOpen, setSolutionMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProduct, setMobileProduct] = useState(false);
  const [mobileSolution, setMobileSolution] = useState(false);

  function closeAll() {
    setMobileOpen(false);
    setMobileProduct(false);
    setMobileSolution(false);
    setProductMenuOpen(false);
    setSolutionMenuOpen(false);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-card-border bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link href="/" onClick={closeAll}><RevoldLogo /></Link>

          {/* ═══ DESKTOP MENU ═══ */}
          <div className="hidden items-center gap-7 lg:flex">
            <Link href="/pourquoi-revold" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Pourquoi Revold
            </Link>

            {/* Produit dropdown */}
            <div className="relative" onMouseEnter={() => setProductMenuOpen(true)} onMouseLeave={() => setProductMenuOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900" onClick={() => setProductMenuOpen(!productMenuOpen)}>
                Produit <ChevronDown open={productMenuOpen} />
              </button>
              {productMenuOpen && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="w-[420px] rounded-xl border border-card-border bg-white p-3 shadow-xl shadow-slate-200/50">
                    {PRODUCT_LINKS.map((p) => (
                      <Link key={p.href} href={p.href} className="flex flex-col rounded-lg px-4 py-3 transition hover:bg-accent-soft" onClick={() => setProductMenuOpen(false)}>
                        <span className="text-sm font-semibold text-slate-900">{p.label}</span>
                        <span className="mt-0.5 text-xs text-slate-500">{p.desc}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Solutions dropdown */}
            <div className="relative" onMouseEnter={() => setSolutionMenuOpen(true)} onMouseLeave={() => setSolutionMenuOpen(false)}>
              <button className="flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-slate-900" onClick={() => setSolutionMenuOpen(!solutionMenuOpen)}>
                Solutions <ChevronDown open={solutionMenuOpen} />
              </button>
              {solutionMenuOpen && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="flex w-[560px] rounded-xl border border-card-border bg-white shadow-xl shadow-slate-200/50">
                    <div className="flex-1 border-r border-card-border p-3">
                      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Par cas d&apos;usage</p>
                      {SOLUTION_LINKS.map((s) => (
                        <Link key={s.href} href={s.href} className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-accent-soft hover:text-accent" onClick={() => setSolutionMenuOpen(false)}>
                          {s.label}
                        </Link>
                      ))}
                    </div>
                    <div className="flex-1 p-3">
                      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Par équipe</p>
                      {TEAM_LINKS.map((t) => (
                        <Link key={t.href} href={t.href} className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-accent-soft hover:text-accent" onClick={() => setSolutionMenuOpen(false)}>
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="/tarifs" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Tarifs</Link>
          </div>
        </div>

        {/* Desktop right */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Connexion</Link>
          <Link href="/essai-gratuit" className="rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-500/25 transition hover:shadow-lg hover:shadow-purple-500/30">
            Essai gratuit
          </Link>
        </div>

        {/* Mobile: CTA + Hamburger */}
        <div className="flex items-center gap-3 lg:hidden">
          <Link href="/essai-gratuit" className="rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-purple-500/25">
            Essai gratuit
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100" aria-label="Menu">
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* ═══ MOBILE MENU ═══ */}
      {mobileOpen && (
        <div className="border-t border-card-border bg-white lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="space-y-1">
              <Link href="/pourquoi-revold" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={closeAll}>
                Pourquoi Revold
              </Link>

              {/* Produit accordion */}
              <div>
                <button onClick={() => setMobileProduct(!mobileProduct)} className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Produit <ChevronDown open={mobileProduct} />
                </button>
                {mobileProduct && (
                  <div className="ml-4 space-y-1 border-l-2 border-accent-soft pl-3">
                    {PRODUCT_LINKS.map((p) => (
                      <Link key={p.href} href={p.href} className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-accent-soft hover:text-accent" onClick={closeAll}>
                        {p.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Solutions accordion */}
              <div>
                <button onClick={() => setMobileSolution(!mobileSolution)} className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Solutions <ChevronDown open={mobileSolution} />
                </button>
                {mobileSolution && (
                  <div className="ml-4 border-l-2 border-accent-soft pl-3">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Par cas d&apos;usage</p>
                    {SOLUTION_LINKS.map((s) => (
                      <Link key={s.href} href={s.href} className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-accent-soft hover:text-accent" onClick={closeAll}>
                        {s.label}
                      </Link>
                    ))}
                    <p className="mt-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Par équipe</p>
                    {TEAM_LINKS.map((t) => (
                      <Link key={t.href} href={t.href} className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-accent-soft hover:text-accent" onClick={closeAll}>
                        {t.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link href="/tarifs" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={closeAll}>
                Tarifs
              </Link>
              <Link href="/blog" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={closeAll}>
                Blog
              </Link>
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-card-border pt-4">
              <Link href="/essai-gratuit" className="block rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-3 text-center text-sm font-semibold text-white shadow-md" onClick={closeAll}>
                Essai gratuit
              </Link>
              <Link href="/login" className="block rounded-xl border border-card-border py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={closeAll}>
                Connexion
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
