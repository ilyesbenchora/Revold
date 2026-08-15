import { SolutionPage } from "@/components/solution-page";

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function AccelererCyclesVentePage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Accélérez vos cycles"
      titleAccent="de vente."
      subtitle="61% des deals perdus le sont par indécision. Revold détecte les deals silencieux sur vos données réelles et crée l'action dans HubSpot — après votre validation — avant qu'il ne soit trop tard."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
      screenshot="/screenshots/dashboard-pipeline.png"
      keyBenefits={[
        { title: "Deals silencieux détectés tôt", desc: "Inactivité prolongée détectée en déterministe sur vos données HubSpot — le signal remonte avant que le deal ne meure." },
        { title: "Action dans votre CRM", desc: "Deal silencieux → tâche HubSpot créée pour le bon owner, avec le contexte. Vous validez, Revold exécute." },
        { title: "Coach commercial IA", desc: "Un coach dédié aux sales, branché sur vos pipelines réels : priorités du jour, deals en tension, chiffres toujours câblés." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Les deals traînent dans le pipeline sans que personne ne réagisse.", solution: "Alertes câblées sur les deals qui stagnent + brief du jour sur la tour de contrôle.", result: "Pipeline qui avance. Décisions rapides sur les deals bloqués." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "Les MQLs passés aux sales stagnent. Pas de feedback sur la qualité des leads.", solution: "Suivi du funnel avec temps de conversion par étape, câblé sur les données CRM réelles.", result: "Feedback loop marketing ↔ sales. Qualification améliorée." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Relances oubliées. Les deals avancent au feeling, puis meurent en silence.", solution: "Détection des deals silencieux → tâche HubSpot proposée dans la boîte d'actions, validée en un clic.", result: "Aucun deal oublié. Les bons réflexes au bon moment." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Vélocité du pipeline impossible à mesurer. Pas de benchmark par étape.", solution: "KPIs de pipeline câblés et vérifiés, comparables par période.", result: "Identification des goulots d'étranglement. Process optimisé." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Le handoff sales → CSM perd du contexte. Le client doit ré-expliquer.", solution: "Fiche unifiée du client : deals, factures, historique — rapprochés par SIREN / TVA.", result: "Transition fluide. Le client se sent compris dès le premier jour." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Le pipeline annoncé ne se transforme pas en cash au rythme prévu.", solution: "Projection pondérée du pipeline croisée avec les encaissements réels Stripe / Pennylane.", result: "Vision de trésorerie réaliste, appuyée sur la donnée." },
      ]}
      relatedProducts={[
        { label: "Alertes, objectifs & actions", href: "/produits/alertes-previsions" },
        { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
      ]}
    />
  );
}
