import { SolutionPage } from "@/components/solution-page";
import { ShotRapports } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Piloter la performance commerciale",
  description: "Pipeline, conversion, MRR, encaissements, churn : des tableaux de bord câblés sur vos vraies données CRM et facturation, vérifiables chiffre par chiffre.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function PiloterPerformancePage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Pilotez la performance"
      titleAccent="de chaque équipe."
      subtitle="Des KPIs câblés et vérifiés, des objectifs suivis en déterministe et des récaps de routine livrés automatiquement. Chaque équipe sait où elle en est, chaque jour."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
      shot={<ShotRapports />}
      keyBenefits={[
        { title: "KPIs câblés et vérifiés", desc: "Pipeline, conversion, MRR, encaissements, churn — chaque chiffre affiche sa source et sa valeur calculée sur vos données réelles." },
        { title: "Objectifs au câblage vérifié", desc: "Avant de créer un objectif, Revold montre la donnée suivie et la valeur actuelle. Le suivi est ensuite automatique et déterministe." },
        { title: "Routines & récaps programmés", desc: "Semaine, mois, trimestre : les récaps sont générés et livrés automatiquement (email, Slack, Teams) — même app fermée." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Pas de vue consolidée de la performance. Chaque équipe a ses propres métriques.", solution: "Tour de contrôle avec anneau de santé, brief vocal du jour et KPIs câblés partagés.", result: "Vision à 360° en un coup d'oeil. Alignement des équipes sur les mêmes chiffres." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Les métriques marketing sont déconnectées des revenus.", solution: "Attribution cross-source : acquisition → pipeline → factures réellement encaissées.", result: "Le marketing parle le même langage que les sales et la direction." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Compiler les KPIs prend 2 jours/mois. Les dashboards sont toujours en retard.", solution: "KPIs et récaps alimentés automatiquement à chaque sync, sur données rapprochées par SIREN / TVA.", result: "Zéro temps passé à compiler. Focus sur l'analyse et l'optimisation." },
      ]}
      relatedProducts={[
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
        { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
        { label: "Audit complet du CRM", href: "/produits/audit-crm" },
      ]}
    />
  );
}
