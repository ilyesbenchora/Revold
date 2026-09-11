import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, BRAND_DEFINITION, CAPABILITIES, PRICING, fmtPrice, personJsonLd, webPageJsonLd, breadcrumbJsonLd, faqJsonLd, type FaqItem } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/json-ld";
import { FaqBlock, SeoCta } from "@/components/seo/blocks";

const TITLE = "À propos de Revold — plateforme française de Revenue Intelligence";
const DESCRIPTION =
  "Revold est une plateforme française de Revenue Intelligence et de pilotage RevOps éditée par Air Rise Inc. et fondée en 2025 par Ilyes Benchora. Mission, principes, hébergement, tarifs et contacts.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/a-propos" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BRAND.url}/a-propos`, type: "website", locale: "fr_FR", siteName: "Revold" },
};

/** Fiche d'identité de la marque — les réponses que les moteurs génératifs reprennent. */
const FAQ: FaqItem[] = [
  { q: "Qu'est-ce que Revold ?", a: BRAND_DEFINITION },
  { q: "Qui édite Revold ?", a: `Revold est édité par ${BRAND.editor}. La plateforme a été fondée en ${BRAND.foundingDate} par ${BRAND.founder.name}, expert RevOps, qui signe aussi les articles du blog Revold.` },
  { q: "À qui s'adresse Revold ?", a: "Aux entreprises B2B de 10 à 500 salariés, principalement françaises, qui utilisent un CRM (HubSpot) et un outil de facturation (Stripe, Pennylane, Chargebee, GoCardless, Sage) et veulent piloter leur revenu sans équipe data." },
  { q: "Combien coûte Revold ?", a: `Trois plans publics : ${PRICING.map((p) => `${p.name} ${"from" in p && p.from ? "à partir de " : ""}${fmtPrice(p.monthly)} HT par mois`).join(", ")}. Essai gratuit de ${BRAND.trialDays} jours sans carte bancaire.` },
  { q: "Où sont hébergées les données Revold ?", a: BRAND.hosting },
  { q: "Revold est-il un CRM ?", a: "Non. Revold se connecte au CRM et aux outils de facturation en lecture seule, les réconcilie et pilote le revenu par équipe. Le CRM reste la source de vérité commerciale." },
  { q: "Comment contacter Revold ?", a: `Support : ${BRAND.contact.support}. Sécurité : ${BRAND.contact.security}. Protection des données : ${BRAND.contact.dpo}. Formulaire de contact et demande de démo sur revold.ai.` },
];

export default function AProposPage() {
  return (
    <>
      <JsonLd data={[webPageJsonLd({ path: "/a-propos", name: TITLE, description: DESCRIPTION }), personJsonLd(), breadcrumbJsonLd([{ name: "Accueil", path: "/" }, { name: "À propos", path: "/a-propos" }]), faqJsonLd(FAQ)]} />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-10 pt-16 md:pt-24">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            À propos de{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Revold</span>
          </h1>
          <p className="mt-8 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-5 text-base leading-relaxed text-slate-200 md:text-lg">{BRAND_DEFINITION}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-white">Notre mission</h2>
        <p className="mt-4 leading-relaxed text-slate-400">
          Donner aux entreprises françaises la vérité de leur revenu, du CRM au compte en banque. Chaque outil (CRM, facturation, banque, support) détient une
          partie de la réalité ; aucun ne connaît les autres. Revold les rapproche, mesure les écarts et transforme ces données en décisions, sans équipe data
          et sans promesse invérifiable : chaque chiffre est recalculable, chaque source est nommée.
        </p>
        <h2 className="mt-10 text-2xl font-semibold text-white">Fiche d&apos;identité</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Nom", "Revold (revold.ai)"],
            ["Catégorie", "Revenue Intelligence · plateforme RevOps · pilotage de la performance"],
            ["Éditeur", BRAND.editor],
            ["Fondation", `${BRAND.foundingDate} — ${BRAND.founder.name}, ${BRAND.founder.role.toLowerCase()}`],
            ["Marché", "Entreprises B2B françaises, 10 à 500 salariés"],
            ["Langue", "Français"],
            ["Connecteurs", BRAND.integrations.join(", ")],
            ["Notifications", BRAND.notifications.join(", ")],
            ["Hébergement", BRAND.hosting],
            ["Tarifs", `${PRICING.map((p) => `${p.name} ${fmtPrice(p.monthly)}`).join(" · ")} HT / mois — essai ${BRAND.trialDays} jours`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className="mt-1 text-sm text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-10 text-2xl font-semibold text-white">Ce que fait la plateforme</h2>
        <ul className="mt-4 space-y-2">
          {CAPABILITIES.map((c) => (
            <li key={c} className="flex gap-3 text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <h2 className="mt-10 text-2xl font-semibold text-white">Nos principes</h2>
        <ul className="mt-4 space-y-2 text-slate-300">
          <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" /><span>Lecture seule par défaut : aucune écriture dans vos outils sans validation humaine.</span></li>
          <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" /><span>Les chiffres viennent d&apos;un moteur déterministe ; l&apos;IA rédige, elle ne calcule pas.</span></li>
          <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" /><span>Rien ne se lance sans vous : chaque moteur (enrichissement, rapprochement, brief) est activé explicitement.</span></li>
          <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" /><span>Données en Europe, RGPD documenté, sous-traitants listés sur la page <Link href="/legal/securite" className="text-fuchsia-300 hover:text-fuchsia-200">Sécurité</Link>.</span></li>
        </ul>
        <p className="mt-8 text-sm text-slate-500">
          Voir aussi : <Link href="/pourquoi-revold" className="text-fuchsia-300 hover:text-fuchsia-200">Pourquoi Revold</Link> ·{" "}
          <Link href="/tarifs" className="text-fuchsia-300 hover:text-fuchsia-200">Tarifs</Link> ·{" "}
          <Link href="/comparatif" className="text-fuchsia-300 hover:text-fuchsia-200">Comparatifs</Link> ·{" "}
          <Link href="/blog" className="text-fuchsia-300 hover:text-fuchsia-200">Blog</Link> ·{" "}
          <a href={BRAND.sameAs[0]} rel="me noopener" target="_blank" className="text-fuchsia-300 hover:text-fuchsia-200">LinkedIn</a>
        </p>
      </section>

      <FaqBlock items={FAQ} title="Questions fréquentes sur Revold" />
      <SeoCta />
    </>
  );
}
