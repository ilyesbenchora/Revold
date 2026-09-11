import { SolutionPage } from "@/components/solution-page";
import { ShotReconciliation } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Optimiser ses revenus B2B",
  description: "Projection pondérée du pipeline croisée avec les encaissements réels : une vision de trésorerie fondée sur la donnée rapprochée, pas sur l'optimisme.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function OptimiserRevenusPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Optimisez vos revenus"
      titleAccent="avec des données fiables."
      subtitle="Passez du pilotage à l'intuition à des chiffres câblés sur vos vraies données : CRM, facturation et compta croisés, projection pondérée du pipeline et actions exécutées dans vos outils."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
      shot={<ShotReconciliation />}
      keyBenefits={[
        { title: "Projection pondérée du pipeline", desc: "Vos deals pondérés par étape, croisés avec vos encaissements réels — une vision de trésorerie qui repose sur la donnée, pas sur l'optimisme." },
        { title: "Revenue réel vs prévu", desc: "Croisement pipeline CRM × factures Stripe / Pennylane pour mesurer l'écart entre le CA promis et le CA réellement facturé." },
        { title: "Actions qui ferment la boucle", desc: "Deal silencieux → tâche HubSpot, impayé → rappel Stripe officiel. Vous validez, l'action s'exécute, le cash récupéré est attribué en euros." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Aucune visibilité fiable sur les revenus. Les chiffres changent selon qui les présente.", solution: "KPIs câblés et vérifiés, projection pondérée du pipeline, brief du jour à la voix.", result: "Décisions stratégiques basées sur des données prouvées, pas sur des estimations optimistes." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Deals qui meurent en silence, relances oubliées, pipeline gonflé.", solution: "Détection des deals silencieux → tâche HubSpot créée après validation + projection pondérée du pipeline.", result: "Aucun deal oublié. Un pipeline qui reflète la réalité, pas les promesses." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Écart permanent entre le pipeline CRM et le cash réellement encaissé.", solution: "Trésorerie temps réel : projection pondérée, échéances fiscales, relances d'impayés exécutées via Stripe.", result: "Écart prévu / encaissé mesuré et réduit. Cash récupéré attribué en euros." },
      ]}
      relatedProducts={[
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
        { label: "Alertes, objectifs & actions", href: "/produits/alertes-previsions" },
        { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
      ]}
    />
  );
}
