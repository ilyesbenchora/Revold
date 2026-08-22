import { SolutionPage } from "@/components/solution-page";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Réduire le churn B2B",
  description: "Tickets, retards de paiement et inactivité CRM croisés en déterministe : les clients à risque détectés avant la résiliation, avec actions concrètes.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function ReduireChurnPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Réduisez le churn"
      titleAccent="avant qu'il n'arrive."
      subtitle="75% des entreprises perdent des clients à cause de mauvaises données. Revold croise CRM, facturation et tickets pour détecter les signaux tôt — et exécute la relance d'impayé validée par vous."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" /></svg>}
      screenshot="/screenshots/dashboard-alertes.png"
      keyBenefits={[
        { title: "Signaux croisés", desc: "Tickets × paiements en retard × inactivité CRM : les signaux sont détectés en déterministe sur vos données rapprochées, pas estimés." },
        { title: "Impayé → rappel Stripe officiel", desc: "~10% des churns SaaS sont involontaires : un paiement échoue et personne ne relance. Revold propose le rappel Stripe officiel, vous validez, le cash récupéré est attribué en euros." },
        { title: "Alertes au câblage vérifié", desc: "Avant de créer une alerte churn, Revold montre la donnée suivie, l'outil source et la valeur actuelle. Notification ensuite par email, Slack ou Teams." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Le churn est découvert au moment du non-renouvellement. Trop tard pour agir.", solution: "Alertes câblées sur le MRR et les comptes en tension, visibles sur la tour de contrôle.", result: "Visibilité anticipée. Le churn est géré comme un KPI stratégique." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Les campagnes de rétention sont envoyées à tout le monde, pas ciblées.", solution: "Segmentation par signaux réels : impayés, inactivité, tickets — ciblez uniquement les comptes menacés.", result: "Campagnes de rétention chirurgicales. Meilleur ROI, moins de bruit." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Les commerciaux ne savent pas quels clients sont à risque de churn.", solution: "Alerte automatique quand un client actif montre des signaux de désengagement.", result: "Le commercial intervient au bon moment. Upsell au lieu de churn." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Le churn rate est calculé manuellement, souvent en retard.", solution: "Churn calculé automatiquement depuis Stripe / Pennylane × CRM, sur entités rapprochées par SIREN / TVA.", result: "Métrique fiable et actionnable. Corrélation churn ↔ causes identifiée." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Pas de priorisation des comptes. Tous les clients sont traités pareil.", solution: "Agent service client dédié + comptes en tension remontés automatiquement dans le brief.", result: "Focus sur les comptes à sauver. Intervention avant la résiliation." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Les impayés s'accumulent sans relance systématique. Le churn involontaire coûte du MRR.", solution: "Détection des factures en retard + rappel Stripe officiel exécuté après validation.", result: "Cash récupéré attribué en euros, relance par relance." },
      ]}
      relatedProducts={[
        { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
        { label: "Alertes, objectifs & actions", href: "/produits/alertes-previsions" },
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
      ]}
    />
  );
}
