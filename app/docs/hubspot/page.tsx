import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Installer Revold pour HubSpot",
  description:
    "Guide d'installation de l'app Revold pour HubSpot : connexion OAuth en un clic, données lues et écrites, sécurité et révocation.",
};

const STEPS: { title: string; desc: string }[] = [
  { title: "Créez votre compte Revold", desc: "Sur revold.ai : inscription avec Google ou par email (code à 6 chiffres), puis renseignez votre entreprise — 2 minutes, sans carte bancaire." },
  { title: "Connectez HubSpot en un clic", desc: "Intégrations → Bibliothèque d'outils → HubSpot → « Se connecter avec HubSpot ». Vous êtes redirigé vers HubSpot (OAuth officiel), vous choisissez votre portail et validez les autorisations. Aucune clé API à copier." },
  { title: "Choisissez vos sources par page", desc: "Paramètres → Intégrations : le bloc « Outil source par page » relie chaque page Revold à vos outils. Les tutoriels intégrés vous guident à la première visite." },
  { title: "La synchronisation démarre seule", desc: "Revold maintient un miroir de vos contacts, entreprises et transactions (sync delta toutes les 30 min) et l'enrichit avec les données officielles françaises (SIREN, SIRET, TVA via l'API Sirene de l'État)." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Quelles données Revold lit-il ?", a: "Contacts, entreprises, transactions, propriétaires, pipelines et propriétés de votre portail — en lecture. Selon les fonctionnalités activées : factures, abonnements, tickets, séquences." },
  { q: "Qu'est-ce que Revold écrit dans HubSpot ?", a: "Uniquement ce que vous validez : les identifiants officiels (SIREN, SIRET, N° TVA) et données d'enrichissement sur vos fiches entreprises, des tâches de relance, et les fusions de doublons que vous confirmez fiche par fiche. Jamais d'écriture silencieuse ; les champs déjà remplis ne sont pas écrasés." },
  { q: "Où sont hébergées les données ?", a: "En Union européenne : base de données à Francfort (Supabase, AWS eu-central-1), traitement applicatif à Paris (Vercel). Détails sur revold.ai/legal/securite." },
  { q: "Comment révoquer l'accès ?", a: "Depuis Revold (Paramètres → Intégrations → Déconnecter) ou depuis HubSpot (Paramètres → Intégrations → Applications connectées → Revold → Désinstaller). La révocation est immédiate ; vos données Revold sont supprimées sur demande sous 30 jours." },
  { q: "Combien de temps prend l'installation ?", a: "Moins de 5 minutes de la création du compte au premier tableau de bord alimenté. La première synchronisation complète prend de quelques minutes à une heure selon la taille du portail." },
];

export default function DocsHubSpotPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-20 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 pb-10 pt-16 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Guide d&apos;installation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">Revold pour HubSpot</h1>
          <p className="mt-4 text-lg text-slate-400">
            Connexion OAuth officielle, lecture seule par défaut, écritures validées par vous. De l&apos;installation au
            premier insight en moins de 5 minutes.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-8">
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-white">{s.title}</p>
                <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-16">
        <h2 className="text-xl font-bold text-white">Questions fréquentes</h2>
        <div className="mt-4 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-semibold text-white">{f.q}</p>
              <p className="mt-1 text-sm text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-400">
          Besoin d&apos;aide ? Écrivez-nous via la{" "}
          <Link href="/contact" className="font-medium text-fuchsia-300 hover:underline">page contact</Link>{" "}
          — réponse sous 24 h ouvrées.
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
