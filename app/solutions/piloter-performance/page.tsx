import { SolutionPage } from "@/components/solution-page";

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function PiloterPerformancePage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Pilotez la performance"
      titleAccent="de chaque équipe."
      subtitle="14 KPIs calculés quotidiennement, 3 moteurs de scoring et 80+ rapports automatiques. Chaque équipe sait où elle en est, chaque jour."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
      screenshot="/screenshots/dashboard-performances.png"
      keyBenefits={[
        { title: "14 KPIs temps réel", desc: "Pipeline, vélocité, conversion, win rate, MRR, churn, CSAT — calculés sur la totalité de vos données." },
        { title: "3 scores de santé", desc: "Sales Engine, Marketing Engine, CRM Engine — chacun avec ses métriques propres." },
        { title: "Tendances historiques", desc: "Comparaison semaine/mois/trimestre. Voyez la dynamique, pas juste un snapshot." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Pas de vue consolidée de la performance. Chaque équipe a ses propres métriques.", solution: "Dashboard exécutif unifié avec 3 scores de santé et tendances.", result: "Vision à 360° en un coup d'oeil. Alignement des équipes sur les mêmes chiffres." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Les métriques marketing sont déconnectées des revenus.", solution: "Marketing Engine Score : MQLs, taux de conversion MQL→SQL, coût par lead, attribution.", result: "Le marketing parle le même langage que les sales et la direction." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Pas de benchmark par commercial. La performance est vue globalement.", solution: "KPIs par owner : win rate, pipeline, vélocité, deals à risque par rep.", result: "Coaching data-driven. Les managers savent où investir leur temps." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Compiler les KPIs prend 2 jours/mois. Les dashboards sont toujours en retard.", solution: "80+ rapports pré-configurés alimentés automatiquement à chaque sync.", result: "Zéro temps passé à compiler. Focus sur l'analyse et l'optimisation." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Pas de métriques sur la satisfaction et la rétention post-vente.", solution: "CSAT, NPS, temps de résolution, taux de churn — croisés avec les données CRM.", result: "Performance CSM mesurable. Corrélation satisfaction ↔ rétention visible." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "MRR, ARR, churn rate calculés manuellement ou approximativement.", solution: "Métriques financières calculées automatiquement depuis Stripe/Pennylane × CRM.", result: "Reporting financier fiable et automatique. Board-ready." },
      ]}
      relatedProducts={[
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
        { label: "Insights IA", href: "/produits/insights-ia" },
        { label: "Audit complet du CRM", href: "/produits/audit-crm" },
      ]}
    />
  );
}
