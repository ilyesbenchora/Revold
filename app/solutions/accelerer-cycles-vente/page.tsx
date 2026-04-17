import { SolutionPage } from "@/components/solution-page";

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function AccelererCyclesVentePage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Accélérez vos cycles"
      titleAccent="de vente."
      subtitle="61% des deals perdus le sont par indécision. Revold détecte les signaux faibles, coache vos commerciaux et réduit le cycle de vente de 22%."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
      screenshot="/screenshots/dashboard-pipeline.png"
      keyBenefits={[
        { title: "Deals à risque détectés tôt", desc: "Inactivité, régression de stage, slippage — les signaux faibles sont détectés 2 semaines avant le problème." },
        { title: "Deal coaching IA", desc: "Chaque deal reçoit des recommandations personnalisées : quoi faire, quand, pourquoi." },
        { title: "-22% de cycle de vente", desc: "Les plateformes de revenus intelligence réduisent le cycle de vente de 22% en moyenne." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Les deals traînent dans le pipeline sans que personne ne réagisse.", solution: "Alertes automatiques sur les deals qui stagnent. Visibilité en temps réel.", result: "Pipeline qui avance. Décisions rapides sur les deals bloqués." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Les MQLs passés aux sales stagnent. Pas de feedback sur la qualité des leads.", solution: "Suivi MQL → SQL → Deal avec temps de conversion par étape.", result: "Feedback loop marketing ↔ sales. Qualification améliorée." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Pas de coaching structuré. Les deals avancent au feeling.", solution: "Deal coaching IA avec recommandations contextuelles par opportunité.", result: "+17% de win rate. Les bons réflexes au bon moment." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Vélocité du pipeline impossible à mesurer. Pas de benchmark par étape.", solution: "Vélocité par stage, temps moyen par étape, taux de conversion par transition.", result: "Identification des goulots d'étranglement. Process optimisé." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Le handoff sales → CSM perd du contexte. Le client doit ré-expliquer.", solution: "Historique complet du deal (activités, insights, coaching) accessible au CSM.", result: "Transition fluide. Le client se sent compris dès le premier jour." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Le forecast est trop optimiste. Les prévisions de trésorerie sont fausses.", solution: "Forecast probabiliste basé sur données réelles + détection de risque.", result: "Prévisions financières réalistes. Planification de trésorerie fiable." },
      ]}
      relatedProducts={[
        { label: "Alertes & Prévisions", href: "/produits/alertes-previsions" },
        { label: "Insights IA", href: "/produits/insights-ia" },
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
      ]}
    />
  );
}
