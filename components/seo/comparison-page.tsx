import Link from "next/link";
import type { Competitor } from "@/lib/seo/competitors";
import { COMPETITORS } from "@/lib/seo/competitors";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { BRAND } from "@/lib/seo/site";
import { FaqBlock, SeoCta } from "@/components/seo/blocks";

/**
 * Gabarit « Alternative à X / Revold vs X » : réponse directe, description
 * factuelle du concurrent, tableau comparatif critère par critère, « quand
 * choisir X » / « quand choisir Revold », FAQ, autres comparatifs.
 */
export function ComparisonPageView({ c }: { c: Competitor }) {
  const others = COMPETITORS.filter((x) => x.slug !== c.slug);
  const related = c.related.map((s) => KEYWORD_PAGES.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-12 pt-16 md:pt-24">
          <nav aria-label="Fil d'Ariane" className="text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/comparatif" className="hover:text-slate-300">Comparatifs</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-400">Revold vs {c.name}</span>
          </nav>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300">
            <span className="text-fuchsia-300">⇄</span>
            {c.category}
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            Alternative à {c.name}{c.aka ? ` (${c.aka})` : ""} :{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Revold vs {c.name}
            </span>
          </h1>
          <p className="mt-8 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-5 text-base leading-relaxed text-slate-200 md:text-lg">
            {c.answer}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="text-2xl font-semibold text-white">Qu&apos;est-ce que {c.name} ?</h2>
        <p className="mt-4 leading-relaxed text-slate-400">{c.summary}</p>
        <h2 className="mt-10 text-2xl font-semibold text-white">Qu&apos;est-ce que Revold ?</h2>
        <p className="mt-4 leading-relaxed text-slate-400">
          Revold est une plateforme française de Revenue Intelligence et de pilotage RevOps. Elle connecte {BRAND.integrations.join(", ")} en lecture seule,
          rapproche les comptes par SIREN, SIRET et TVA, réconcilie le revenu signé, facturé et encaissé, puis restitue à chaque équipe ses indicateurs,
          ses alertes et ses actions. Éditée par {BRAND.editor}, hébergée en Europe, avec un tarif public et {BRAND.trialDays} jours d&apos;essai gratuit.
        </p>
      </section>

      {/* Tableau comparatif */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-2xl font-semibold text-white">{c.name} vs Revold : le comparatif</h2>
        <p className="mt-2 text-sm text-slate-500">
          Informations sur {c.name} d&apos;après sa documentation publique à la date de rédaction ; en cas de doute, vérifiez auprès de l&apos;éditeur.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">Critère</th>
                <th scope="col" className="px-4 py-3">{c.name}</th>
                <th scope="col" className="px-4 py-3 text-fuchsia-300">Revold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {c.table.map((row) => (
                <tr key={row.criterion} className="align-top">
                  <th scope="row" className="px-4 py-3 font-medium text-white">{row.criterion}</th>
                  <td className="px-4 py-3 text-slate-400">{row.them}</td>
                  <td className="px-4 py-3 text-slate-200">{row.revold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white">Quand choisir {c.name}</h2>
            <ul className="mt-4 space-y-2">
              {c.chooseThem.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-slate-400">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/5 p-6">
            <h2 className="text-lg font-semibold text-white">Quand choisir Revold</h2>
            <ul className="mt-4 space-y-2">
              {c.chooseRevold.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-slate-200">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FaqBlock items={c.faq} title={`Questions fréquentes sur ${c.name} et Revold`} />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Autres comparatifs</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/alternative/${o.slug}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:border-fuchsia-400/40 hover:text-white">
                    Revold vs {o.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {related.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white">Pour aller plus loin</h2>
              <ul className="mt-4 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/${r.slug}`} className="text-fuchsia-300 hover:text-fuchsia-200">{r.keyword}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <SeoCta title={`Essayez l'alternative française à ${c.name}`} />
    </>
  );
}
