import { SolutionPage } from "@/components/solution-page";

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function OptimiserRevenusPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Optimisez vos revenus"
      titleAccent="avec des données fiables."
      subtitle="Passez d'un forecast basé sur l'intuition à une prédiction revenue basée sur vos vraies données CRM, facturation et support croisées."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
      screenshot="/screenshots/dashboard-overview.png"
      keyBenefits={[
        { title: "Forecast fiable", desc: "Prévisions basées sur les probabilités par stage × historique win rate × données de facturation réelles." },
        { title: "Pipeline visible", desc: "Vue unifiée de votre pipeline avec scoring de santé Sales, Marketing et CRM en temps réel." },
        { title: "Revenue réel vs prévu", desc: "Croisement pipeline CRM × factures Stripe/Pennylane pour mesurer l'écart forecast/réalité." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Aucune visibilité fiable sur les revenus prévu. Les forecasts changent chaque semaine.", solution: "Dashboard exécutif avec forecast probabiliste, tendances et scoring de santé global.", result: "Décisions stratégiques basées sur des données, pas sur des estimations optimistes." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Impossible de mesurer le vrai ROI des campagnes jusqu'aux revenus facturé.", solution: "Attribution cross-source : dépenses marketing → pipeline → factures réelles.", result: "Budget marketing alloué sur les canaux qui génèrent des revenus réel, pas juste des MQLs." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Forecast imprécis, deals qui slippent, pas de visibilité sur les risques.", solution: "Détection de risque automatique + deal coaching IA + forecast probabiliste.", result: "+17% de win rate, -22% de cycle de vente, forecast à ±7% de variance." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "2 jours/mois à compiler des rapports cross-tool. Données incohérentes entre les outils.", solution: "80+ rapports automatiques cross-source. Une seule source de vérité.", result: "Zéro export manuel. Temps libéré pour l'optimisation des process." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Pas de visibilité sur les signaux de churn avant qu'il ne soit trop tard.", solution: "Croisement tickets support × paiements × activité CRM pour prédire le churn.", result: "Intervention proactive sur les comptes à risque. Réduction du churn." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Écart entre les revenus prévu (CRM) et les revenus réel (facturation). Pas de visibilité MRR/ARR.", solution: "Croisement pipeline × factures Stripe/Pennylane. MRR, churn rate, LTV calculés en temps réel.", result: "Prévisions financières fiables. Écart forecast/réel mesuré et réduit." },
      ]}
      relatedProducts={[
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
        { label: "Alertes & Prévisions", href: "/produits/alertes-previsions" },
        { label: "Insights IA", href: "/produits/insights-ia" },
      ]}
    />
  );
}
