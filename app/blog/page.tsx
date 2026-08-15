"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { articles, CATEGORIES } from "./data";

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? articles.filter((a) => a.category === activeCategory) : articles;
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 py-16 text-center md:py-24">
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-10 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">Blog Revold</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">Insights, guides et analyses pour les équipes revenus B2B françaises.</p>
          <p className="mt-2 text-sm text-slate-500">Par Ilyes Benchora, Expert RevOps</p>
          <div className="mt-3">
            <Link href="/blog/rss.xml" className="text-xs text-fuchsia-300 hover:underline">Flux RSS</Link>
          </div>
        </div>
      </section>

      {/* Category filters */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${!activeCategory ? "bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
          >
            Tous ({articles.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = articles.filter((a) => a.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${activeCategory === cat ? "bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
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
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
            >
              {/* Gradient placeholder */}
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-fuchsia-500/15 via-purple-500/15 to-indigo-600/15">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-fuchsia-200">{article.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-lg font-bold text-white transition group-hover:text-fuchsia-300">{article.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{article.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <p className="text-xs font-medium text-slate-300">{article.author}</p>
                    <p className="text-[10px] text-slate-500">{article.authorRole}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="text-[10px] text-slate-500">{article.readTime} de lecture</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/10 py-16">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white">Passez de la théorie à la pratique</h2>
          <p className="mt-4 text-slate-400">Connectez HubSpot en un clic et voyez vos premiers insights câblés sur vos vraies données.</p>
          <Link
            href="/essai-gratuit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            Essayer Revold gratuitement
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
