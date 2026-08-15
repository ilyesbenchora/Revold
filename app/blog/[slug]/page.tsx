import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
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

/* Surcharges sombres du style .prose-revold (défini clair dans globals.css) */
const PROSE_DARK_CSS = `
.prose-dark h2, .prose-dark h3 { color: #ffffff; }
.prose-dark p, .prose-dark ul li { color: #94a3b8; }
.prose-dark strong { color: #f1f5f9; }
.prose-dark em { color: #94a3b8; }
.prose-dark a { color: #f0abfc; }
.prose-dark code { background: rgba(255, 255, 255, 0.08); color: #e2e8f0; }
.prose-dark blockquote { color: #94a3b8; border-color: rgba(255, 255, 255, 0.15); }
`;

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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <style dangerouslySetInnerHTML={{ __html: PROSE_DARK_CSS }} />
      <SiteNavbar />

      <article className="relative mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <div className="pointer-events-none absolute -left-52 top-0 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-52 top-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />

        {/* Meta */}
        <Link href="/blog" className="relative text-xs font-medium text-fuchsia-300 hover:underline">&larr; Retour au blog</Link>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-medium text-fuchsia-300">{article.category}</span>
          <span className="text-xs text-slate-500">{article.readTime} de lecture</span>
        </div>
        <h1 className="relative mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">{article.title}</h1>
        <div className="relative mt-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white">IB</div>
          <div>
            <p className="text-sm font-medium text-white">{article.author}</p>
            <p className="text-xs text-slate-500">{article.authorRole} — {new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Content */}
        <div
          className="prose-revold prose-dark relative mt-12"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>

      {/* Related */}
      {allRelated.length > 0 && (
        <section className="border-t border-white/10 bg-white/[0.02] py-16">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="text-xl font-bold text-white">Autres articles</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {allRelated.map((a) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
                >
                  <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-[10px] font-medium text-fuchsia-300">{a.category}</span>
                  <h3 className="mt-3 font-semibold text-white transition group-hover:text-fuchsia-300">{a.title}</h3>
                  <p className="mt-2 text-xs text-slate-500">{new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — {a.readTime}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-white/10 py-16">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-fuchsia-600/20 via-purple-600/20 to-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white">Prêt à passer à l&apos;action ?</h2>
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
