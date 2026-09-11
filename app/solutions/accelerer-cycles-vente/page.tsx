import { SolutionPage } from "@/components/solution-page";
import { ShotPipeline } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accélérer ses cycles de vente",
  description: "Deals silencieux détectés tôt, relances priorisées et KPIs par pipeline : vos cycles de vente pilotés sur données réelles, pas au feeling.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function AccelererCyclesVentePage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Accélérez vos cycles"
      titleAccent="de vente."
      subtitle="61% des deals perdus le sont par indécision. Revold détecte les deals silencieux sur vos données réelles et crée l'action dans HubSpot — après votre validation — avant qu'il ne soit trop tard."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
      shot={<ShotPipeline />}
      keyBenefits={[
        { title: "Deals silencieux détectés tôt", desc: "Inactivité prolongée détectée en déterministe sur vos données HubSpot — le signal remonte avant que le deal ne meure." },
        { title: "Action dans votre CRM", desc: "Deal silencieux → tâche HubSpot créée pour le bon owner, avec le contexte. Vous validez, Revold exécute." },
        { title: "Agent commercial IA", desc: "Un agent expert dédié aux sales, branché sur vos pipelines réels : priorités du jour, deals en tension, chiffres toujours câblés." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Les deals traînent dans le pipeline sans que personne ne réagisse.", solution: "Alertes câblées sur les deals qui stagnent + brief du jour sur la tour de contrôle.", result: "Pipeline qui avance. Décisions rapides sur les deals bloqués." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Relances oubliées. Les deals avancent au feeling, puis meurent en silence.", solution: "Détection des deals silencieux → tâche HubSpot proposée dans la boîte d'actions, validée en un clic.", result: "Aucun deal oublié. Les bons réflexes au bon moment." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Vélocité du pipeline impossible à mesurer. Pas de benchmark par étape.", solution: "KPIs de pipeline câblés et vérifiés, comparables par période.", result: "Identification des goulots d'étranglement. Process optimisé." },
      ]}
      relatedProducts={[
        { label: "Alertes, objectifs & actions", href: "/produits/alertes-previsions" },
        { label: "Mon équipe IA 24/7", href: "/produits/insights-ia" },
        { label: "Reporting cross-source", href: "/produits/reporting-cross-source" },
      ]}
    />
  );
}
