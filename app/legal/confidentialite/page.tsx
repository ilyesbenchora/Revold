import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Revold",
  description: "Politique de confidentialité de Revold. Découvrez comment nous collectons, utilisons et protégeons vos données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Dernière mise à jour : 14 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Politique de Confidentialité</h1>

      <p className="mt-6 text-slate-600">La présente politique de confidentialité décrit comment Revold (exploité par Air Rise Inc.) collecte, utilise et protège les informations personnelles des utilisateurs de la plateforme Revold.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">1. Données collectées</h2>
      <p className="mt-3 text-slate-600">Nous collectons les catégories de données suivantes :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Données de compte</strong> : nom, prénom, adresse email, nom de l&apos;entreprise, rôle.</li>
        <li><strong>Données d&apos;utilisation</strong> : pages visitées, fonctionnalités utilisées, horodatages, adresse IP, type de navigateur.</li>
        <li><strong>Données CRM synchronisées</strong> : contacts, entreprises, deals, activités, factures, tickets — synchronisés depuis les outils que vous connectez (HubSpot, Stripe, Zendesk, etc.).</li>
        <li><strong>Données de paiement</strong> : gérées par Stripe. Nous ne stockons aucune donnée de carte bancaire.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">2. Finalités du traitement</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Fournir et maintenir le service Revold.</li>
        <li>Calculer vos KPIs, scores et insights à partir de vos données synchronisées.</li>
        <li>Améliorer et personnaliser votre expérience.</li>
        <li>Communiquer avec vous (support, mises à jour produit).</li>
        <li>Respecter nos obligations légales.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">3. Partage des données</h2>
      <p className="mt-3 text-slate-600">Nous ne vendons jamais vos données. Nous partageons vos données uniquement avec :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Sous-traitants techniques</strong> : Vercel (hébergement), Supabase (base de données), Anthropic (IA), Stripe (paiements).</li>
        <li><strong>Obligations légales</strong> : si requis par la loi ou une décision de justice.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">4. Cookies</h2>
      <p className="mt-3 text-slate-600">Revold utilise des cookies strictement nécessaires au fonctionnement du service (authentification, préférences de session). Nous n&apos;utilisons pas de cookies publicitaires ou de tracking tiers.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">5. Vos droits (RGPD)</h2>
      <p className="mt-3 text-slate-600">Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Droit d&apos;accès à vos données personnelles.</li>
        <li>Droit de rectification.</li>
        <li>Droit à l&apos;effacement (&ldquo;droit à l&apos;oubli&rdquo;).</li>
        <li>Droit à la portabilité.</li>
        <li>Droit d&apos;opposition et de limitation du traitement.</li>
      </ul>
      <p className="mt-3 text-slate-600">Pour exercer vos droits : <a href="mailto:privacy@revold.io" className="font-medium text-accent hover:underline">privacy@revold.io</a></p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">6. Conservation des données</h2>
      <p className="mt-3 text-slate-600">Vos données sont conservées pendant la durée de votre abonnement et supprimées dans les 30 jours suivant la clôture de votre compte, sauf obligation légale de conservation.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">7. Contact</h2>
      <p className="mt-3 text-slate-600">Pour toute question relative à cette politique : <a href="mailto:privacy@revold.io" className="font-medium text-accent hover:underline">privacy@revold.io</a></p>
    </article>
  );
}
