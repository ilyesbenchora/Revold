import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/lib/seo/tools";
import { breadcrumbJsonLd, webPageJsonLd, SITE_URL } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { SeoCta } from "@/components/seo/blocks";

const TITLE = "Outils gratuits RevOps : calculateurs MRR, churn, forecast pondéré, fuite de revenus";
const DESCRIPTION =
  "Calculateurs gratuits pour piloter le revenu : MRR et ARR, taux de churn et rétention nette, forecast pondéré par étape, estimation de la fuite de revenus. Sans inscription, calcul dans le navigateur.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/outils" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/outils`, type: "website", locale: "fr_FR", siteName: "Revold" },
};

export default function OutilsHub() {
  return (
    <>
      <JsonLd data={[webPageJsonLd({ path: "/outils", name: TITLE, description: DESCRIPTION }), breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "Outils gratuits", path: "/outils" }])]} />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-8 pt-16 md:pt-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Outils gratuits pour{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">piloter le revenu</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400">Quatre calculateurs, les formules expliquées, aucune inscription. Le calcul se fait dans votre navigateur.</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link key={t.slug} href={`/outils/${t.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-fuchsia-400/40 hover:bg-white/[0.05]">
              <h2 className="font-semibold text-white">{t.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{t.description}</p>
              <span className="mt-3 inline-block text-sm text-fuchsia-300">Ouvrir le calculateur →</span>
            </Link>
          ))}
        </div>
      </section>
      <SeoCta title="Les mêmes calculs, sur vos vraies données, chaque jour" />
    </>
  );
}
