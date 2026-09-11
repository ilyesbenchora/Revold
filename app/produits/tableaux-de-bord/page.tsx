import { ProductPage } from "@/components/product-page";
import { ShotTemplates, ShotBoards } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tableaux de bord & templates",
  description: "Des templates de tableaux de bord prêts à l'emploi par métier et par outil (HubSpot, Stripe, Pennylane, Chargebee…), ou une construction de zéro : onglets, tuiles KPI câblées, alertes et partage.",
};

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

export default function TableauxDeBordPage() {
  return (
    <ProductPage
      badge="Tableaux de bord & templates"
      title="Votre pilotage,"
      titleAccent="à votre main."
      subtitle="Partez d'un template prêt à l'emploi — par métier ou par outil — ou construisez votre tableau de bord de zéro : onglets, tuiles KPI câblées sur vos données réconciliées, alertes posées sur chaque tuile, partage à l'équipe ou par lien public."
      heroIcon={icon}
      shots={[
        { node: <ShotTemplates />, caption: "Templates prêts à l'emploi par métier et par outil, activés en un clic sur vos données." },
        { node: <ShotBoards />, caption: "Construction de zéro : onglets, tuiles, blocs — et partage en un clic." },
      ]}
      features={[
        { title: "Templates par métier et par outil", desc: "Direction, Sales, Finance, abonnements… chaque modèle est pensé pour un métier et câblé sur les outils concernés (HubSpot, Stripe, Pennylane, Chargebee). Vous l'activez, il se remplit avec vos données." },
        { title: "Construction de zéro", desc: "Page vierge, cadre par défaut, puis tout est à vous : tuiles KPI, courbes, barres, tableaux — vous ajoutez, retirez et réorganisez les blocs comme dans Notion." },
        { title: "Onglets illimités", desc: "Un tableau de bord peut porter plusieurs onglets (Vue générale, Ventes, Trésorerie…) — un seul lien, toute la lecture." },
        { title: "KPIs câblés, jamais inventés", desc: "Chaque tuile affiche une mesure calculée sur vos données synchronisées et réconciliées, avec son outil source. Le catalogue de KPIs est filtré selon les outils réellement connectés." },
        { title: "Une alerte sur chaque tuile", desc: "Posez un seuil directement sur une tuile de votre tableau de bord : franchi, vous êtes prévenu par email, Slack ou Teams." },
        { title: "Visibilité et partage", desc: "Privé, équipe ou organisation — et un partage PUBLIC par lien signé pour un board, un investisseur ou un client, sans compte Revold." },
      ]}
      howItWorks={[
        { step: "Choisissez un template — ou une page vierge", desc: "La galerie propose des modèles par métier et par outil, avec un aperçu fidèle. Vous pouvez aussi partir de zéro." },
        { step: "Le tableau se câble sur vos données", desc: "Les tuiles se remplissent avec vos KPIs réconciliés ; les suggestions ne proposent que ce que vos outils connectés savent calculer." },
        { step: "Ajustez à votre main", desc: "Ajoutez des onglets, déplacez des blocs, renommez des tuiles, posez des alertes — chaque équipe compose sa lecture." },
        { step: "Partagez", desc: "À l'équipe, à toute l'organisation, ou par lien public signé — le tableau vit et se met à jour tout seul." },
      ]}
      stats={[
        { value: "1 clic", label: "pour activer un template sur vos données" },
        { value: "0", label: "KPI inventé — tout est câblé et sourcé" },
        { value: "∞", label: "onglets et blocs par tableau de bord" },
        { value: "Public", label: "partage par lien signé, sans compte" },
      ]}
      cta="Créer mon premier tableau de bord"
      ctaTitle="Votre pilotage, prêt en quelques minutes"
      crmSetups={[
        { crm: "HubSpot", items: ["Templates Sales et Direction câblés sur vos pipelines réels", "Tuiles pipeline pondéré, closing, cycle de vente", "Alertes sur tuiles : deal silencieux, conversion en baisse", "Partage du tableau à l'équipe commerciale"] },
        { crm: "Stripe + Pennylane", items: ["Templates Finance : encaissé, DSO, impayés, MRR", "KPIs réconciliés facturation × compta par identifiants officiels", "Alertes de trésorerie posées sur les tuiles", "Lien public pour le board ou l'expert-comptable"] },
        { crm: "Chargebee / GoCardless / Sage", items: ["Template abonnements : MRR, churn, upgrades", "Prélèvements et écritures intégrés aux mêmes tableaux", "Suggestions de KPIs filtrées par outils connectés", "Un seul tableau pour toute la stack revenue"] },
      ]}
    />
  );
}
