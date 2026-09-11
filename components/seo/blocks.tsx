import Link from "next/link";
import type { FaqItem } from "@/lib/seo/site";
import { BRAND } from "@/lib/seo/site";

/** FAQ visible (les questions/réponses sont aussi émises en JSON-LD FAQPage par la page). */
export function FaqBlock({ items, title = "Questions fréquentes" }: { items: FaqItem[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <dl className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
        {items.map((f) => (
          <div key={f.q} className="p-5">
            <dt className="font-semibold text-white">{f.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Appel à l'action final, commun aux pages SEO. */
export function SeoCta({ title = "Voyez la vérité revenue de votre entreprise" }: { title?: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-8">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 via-purple-600/10 to-indigo-600/20 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          Connectez {BRAND.integrations.slice(0, 3).join(", ")}… en lecture seule : première réconciliation et premier brief en une matinée.
          Essai gratuit de {BRAND.trialDays} jours, sans carte bancaire.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/essai-gratuit"
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:shadow-xl hover:shadow-purple-500/40"
          >
            Essayer gratuitement
          </Link>
          <Link href="/demo" className="rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Demander une démo
          </Link>
        </div>
      </div>
    </section>
  );
}
