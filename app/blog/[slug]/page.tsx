import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RevoldLogo } from "@/components/revold-logo";
import { SiteNavbar } from "@/components/site-navbar";
import { articles } from "../data";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return {};
  return {
    title: `${article.title} — Blog Revold`,
    description: article.description,
    authors: [{ name: article.author }],
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.date,
      authors: [article.author],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  const related = articles
    .filter((a) => a.slug !== slug)
    .filter((a) => a.category === article.category)
    .slice(0, 2);
  const extraRelated = related.length < 3
    ? articles.filter((a) => a.slug !== slug && a.category !== article.category).slice(0, 3 - related.length)
    : [];
  const allRelated = [...related, ...extraRelated];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNavbar />

      <article className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        {/* Meta */}
        <Link href="/blog" className="text-xs font-medium text-accent hover:underline">&larr; Retour au blog</Link>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">{article.category}</span>
          <span className="text-xs text-slate-400">{article.readTime} de lecture</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">{article.title}</h1>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white">IB</div>
          <div>
            <p className="text-sm font-medium text-slate-900">{article.author}</p>
            <p className="text-xs text-slate-400">{article.authorRole} — {new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Content */}
        <div
          className="prose-revold mt-12"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>

      {/* Related */}
      {allRelated.length > 0 && (
        <section className="border-t border-card-border bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-xl font-bold text-slate-900">Autres articles</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {allRelated.map((a) => (
                <Link key={a.slug} href={`/blog/${a.slug}`} className="card group p-6 transition hover:shadow-lg hover:shadow-accent/5">
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-medium text-accent">{a.category}</span>
                  <h3 className="mt-3 font-semibold text-slate-900 transition group-hover:text-accent">{a.title}</h3>
                  <p className="mt-2 text-xs text-slate-400">{new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — {a.readTime}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white">Prêt à passer à l&apos;action ?</h2>
          <p className="mt-4 text-purple-100">Connectez votre CRM et voyez vos premiers insights en 5 minutes.</p>
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
