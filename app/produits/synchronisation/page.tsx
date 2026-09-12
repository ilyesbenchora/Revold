import { ProductPage } from "@/components/product-page";
import { ShotIntegrations, ShotSurMesure } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Synchronisation CRM, facturation et support",
  description: "Connectez HubSpot, Stripe, Pennylane, Chargebee, GoCardless et Sage en lecture seule : vos données revenue synchronisées et rapprochées automatiquement, sans scripts.",
};

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export default function SynchronisationPage() {
  return (
    <ProductPage
      badge="Synchronisation de données"
      title="CRM, facturation, compta :"
      titleAccent="un seul modèle de données."
      subtitle="Connectez HubSpot (OAuth en un clic), Stripe, Pennylane, Chargebee, GoCardless et Sage — mais aussi votre ERP et vos outils métiers via un connecteur sur mesure, plus l'import Excel / Google Sheets. Lecture seule, révocable, avec un rapport d'audit d'onboarding par outil."
      heroIcon={icon}
      shots={[
        { node: <ShotIntegrations />, caption: "Connecteurs natifs : statut et dernière synchronisation, outil par outil." },
        { node: <ShotSurMesure />, caption: "Connecteur sur mesure : votre ERP ou outil métier, croisé avec le CRM et la facturation." },
      ]}
      features={[
        { title: "6 connecteurs natifs, câblés en profondeur", desc: "HubSpot (OAuth), Stripe, Pennylane, Chargebee, GoCardless, Sage. On ne liste jamais un outil que Revold ne sait pas réellement synchroniser — les autres arrivent, marqués « bientôt disponible »." },
        { title: "ERP & outils métiers, sur mesure", desc: "Votre ERP, votre outil de production ou n'importe quel logiciel exposant une API se connecte via le connecteur sur mesure : mapping des champs assisté, champs métier agrégeables (somme, moyenne…) utilisables dans vos KPIs et rapports." },
        { title: "Import Excel / Google Sheets", desc: "Vos fichiers de suivi entrent dans le même modèle de données que vos connecteurs, avec mapping des colonnes assisté." },
        { title: "Lecture seule, révocable", desc: "Revold lit vos données, il n'écrit jamais sans votre validation explicite. Vous révoquez l'accès à tout moment depuis vos outils ou vos paramètres." },
        { title: "Rapport d'audit d'onboarding par outil", desc: "Après chaque connexion, Revold produit un audit : volumes importés, champs remplis, identifiants disponibles, écarts détectés — vous savez exactement ce qui est exploitable." },
        { title: "Monitoring de sync", desc: "Journal des synchronisations, compteurs d'entités, erreurs remontées. Vous savez exactement ce qui se passe, sync après sync." },
        { title: "Modèle de données unifié", desc: "Chaque source est normalisée dans un schéma commun (entreprises, contacts, deals, factures, abonnements) — prêt pour le rapprochement automatique." },
      ]}
      howItWorks={[
        { step: "Connectez vos outils", desc: "Votre CRM en un clic ; facturation et compta par clé API en lecture seule — et votre ERP ou outil métier via le connecteur sur mesure." },
        { step: "La sync démarre automatiquement", desc: "Entreprises, contacts, deals, factures et abonnements sont importés et normalisés dans le modèle de données unifié Revold." },
        { step: "L'audit d'onboarding est généré", desc: "Pour chaque outil : qualité des données importées, identifiants de rapprochement disponibles, plan d'action pour combler les manques." },
        { step: "Vos données sont prêtes", desc: "Les KPIs, alertes, récaps et rapports se câblent automatiquement sur les données synchronisées et vérifiées." },
      ]}
      stats={[
        { value: "6", label: "connecteurs natifs (+ Excel / Sheets)" },
        { value: "API", label: "votre ERP / outil métier via connecteur sur mesure" },
        { value: "0", label: "écriture sans validation — lecture seule, révocable" },
        { value: "1", label: "rapport d'audit d'onboarding par outil" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Connexion OAuth en un clic, sans clé API à copier", "Sync des companies, contacts, deals et tickets en lecture seule", "Audit d'onboarding : fill rates, identifiants identifiants officiels disponibles", "Révocation à tout moment depuis HubSpot Connected Apps"] },
        { crm: "Stripe + Pennylane", items: ["Clé API en lecture seule (Restricted Key côté Stripe)", "Factures, abonnements et paiements normalisés", "Rapprochement avec vos entreprises CRM par identifiants officiels", "Audit d'onboarding : couverture et écarts facturation ↔ CRM"] },
        { crm: "Chargebee / GoCardless / Sage", items: ["Connecteurs natifs par clé API, lecture seule", "Abonnements, prélèvements et écritures intégrés au modèle unifié", "Croisement avec le CRM et la facturation existante", "Même monitoring et même audit d'onboarding que les autres outils"] },
      ]}
    />
  );
}
