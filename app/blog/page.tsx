"use client";

import Link from "next/link";
import { useState } from "react";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { articles, CATEGORIES } from "./data";

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? articles.filter((a) => a.category === activeCategory) : articles;
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      {/* Hero */}
      <section className="border-b border-card-border bg-gradient-to-b from-slate-50 to-background py-16 text-center md:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Blog Revold</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Insights, guides et analyses pour les équipes revenus B2B françaises.</p>
          <p className="mt-2 text-sm text-slate-400">Par Ilyes Benchora, Expert RevOps</p>
          <div className="mt-3">
            <Link href="/blog/rss.xml" className="text-xs text-accent hover:underline">Flux RSS</Link>
          </div>
        </div>
      </section>

      {/* Category filters */}
      <div className="border-b border-card-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${!activeCategory ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Tous ({articles.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = articles.filter((a) => a.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${activeCategory === cat ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Articles grid */}
      <section className="mx-auto w-full max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`} className="card group flex flex-col overflow-hidden transition hover:shadow-lg hover:shadow-accent/5">
              {/* Gradient placeholder */}
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-indigo-600/10">
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-accent">{article.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-lg font-bold text-slate-900 transition group-hover:text-accent">{article.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{article.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-card-border pt-4">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{article.author}</p>
                    <p className="text-[10px] text-slate-400">{article.authorRole}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="text-[10px] text-slate-400">{article.readTime} de lecture</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white">Passez de la théorie à la pratique</h2>
          <p className="mt-4 text-purple-100">Connectez votre CRM en 5 minutes et voyez vos premiers insights.</p>
          <Link href="/essai-gratuit" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-purple-600 shadow-lg transition hover:bg-purple-50">
            Essayer Revold gratuitement
          </Link>
        </div>
      </section>

      <footer className="border-t border-card-border bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <RevoldLogo />
              <p className="mt-4 text-sm text-slate-500">Plateforme de Revenue Intelligence pour le marché B2B français.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Produit</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/produits/synchronisation" className="text-sm text-slate-500 transition hover:text-slate-700">Synchronisation</Link></li>
                <li><Link href="/produits/reporting-cross-source" className="text-sm text-slate-500 transition hover:text-slate-700">Reporting</Link></li>
                <li><Link href="/produits/insights-ia" className="text-sm text-slate-500 transition hover:text-slate-700">Insights IA</Link></li>
                <li><Link href="/produits/audit-crm" className="text-sm text-slate-500 transition hover:text-slate-700">Audit CRM</Link></li>
                <li><Link href="/integrations" className="text-sm text-slate-500 transition hover:text-slate-700">Intégrations</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Solutions</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/solutions/optimiser-revenus" className="text-sm text-slate-500 transition hover:text-slate-700">Optimiser les revenus</Link></li>
                <li><Link href="/solutions/fiabiliser-donnees" className="text-sm text-slate-500 transition hover:text-slate-700">Fiabiliser les données</Link></li>
                <li><Link href="/solutions/accelerer-cycles-vente" className="text-sm text-slate-500 transition hover:text-slate-700">Accélérer les ventes</Link></li>
                <li><Link href="/solutions/reduire-churn" className="text-sm text-slate-500 transition hover:text-slate-700">Réduire le churn</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Ressources</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/blog" className="text-sm text-slate-500 transition hover:text-slate-700">Blog</Link></li>
                <li><Link href="/pourquoi-revold" className="text-sm text-slate-500 transition hover:text-slate-700">Pourquoi Revold</Link></li>
                <li><Link href="/contact" className="text-sm text-slate-500 transition hover:text-slate-700">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Légal</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/legal/confidentialite" className="text-sm text-slate-500 transition hover:text-slate-700">Confidentialité</Link></li>
                <li><Link href="/legal/cgu" className="text-sm text-slate-500 transition hover:text-slate-700">CGU</Link></li>
                <li><Link href="/legal/securite" className="text-sm text-slate-500 transition hover:text-slate-700">Sécurité</Link></li>
                <li><Link href="/legal/rgpd" className="text-sm text-slate-500 transition hover:text-slate-700">RGPD</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-card-border pt-8 md:flex-row">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Revold. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
