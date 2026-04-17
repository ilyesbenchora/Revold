import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Revold",
  description: "Conditions générales d'utilisation de la plateforme Revold. Accès, services, tarifs, responsabilités et droit applicable.",
};

export default function CGUPage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Dernière mise à jour : 14 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Conditions Générales d&apos;Utilisation</h1>

      <h2 className="mt-10 text-xl font-bold text-slate-900">1. Objet</h2>
      <p className="mt-3 text-slate-600">Les présentes CGU régissent l&apos;accès et l&apos;utilisation de la plateforme Revold, éditée par Air Rise Inc. Toute utilisation du service implique l&apos;acceptation sans réserve des présentes conditions.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">2. Accès et compte</h2>
      <p className="mt-3 text-slate-600">L&apos;accès au service nécessite la création d&apos;un compte avec une adresse email valide. L&apos;utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée depuis son compte.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">3. Description du service</h2>
      <p className="mt-3 text-slate-600">Revold est une plateforme de Revenue Intelligence qui permet aux entreprises B2B de :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Synchroniser leurs données depuis des outils tiers (CRM, facturation, support).</li>
        <li>Calculer des KPIs et scores de santé revenue.</li>
        <li>Générer des insights et recommandations via intelligence artificielle.</li>
        <li>Visualiser et piloter leur performance dans un dashboard unifié.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">4. Tarifs et paiement</h2>
      <p className="mt-3 text-slate-600">Les tarifs en vigueur sont affichés sur la page Tarifs du site. L&apos;abonnement est mensuel et le paiement est géré par Stripe. Revold se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">5. Obligations de l&apos;utilisateur</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Fournir des informations exactes lors de l&apos;inscription.</li>
        <li>Ne pas utiliser le service à des fins illicites ou contraires aux présentes CGU.</li>
        <li>Ne pas tenter de contourner les mesures de sécurité.</li>
        <li>Respecter les droits de propriété intellectuelle de Revold.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">6. Propriété intellectuelle</h2>
      <p className="mt-3 text-slate-600">L&apos;ensemble du contenu de la plateforme (interface, algorithmes, marque, documentation) est la propriété exclusive de Air Rise Inc. Toute reproduction non autorisée est interdite. Les données synchronisées restent la propriété de l&apos;utilisateur.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">7. Responsabilité</h2>
      <p className="mt-3 text-slate-600">Revold s&apos;engage à fournir le service avec diligence. Toutefois, Revold ne saurait être tenu responsable des interruptions temporaires, des pertes de données liées à des outils tiers, ou des décisions prises sur la base des insights générés.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">8. Résiliation</h2>
      <p className="mt-3 text-slate-600">L&apos;utilisateur peut résilier son abonnement à tout moment depuis ses paramètres de compte. Revold se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGU.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">9. Droit applicable</h2>
      <p className="mt-3 text-slate-600">Les présentes CGU sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux de Paris.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">10. Contact</h2>
      <p className="mt-3 text-slate-600">Pour toute question : <a href="mailto:legal@revold.io" className="font-medium text-accent hover:underline">legal@revold.io</a></p>
    </article>
  );
}
