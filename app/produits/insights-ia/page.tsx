import { ProductPage } from "@/components/product-page";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights IA sur vos données revenue",
  description: "Des agents experts par domaine (ventes, trésorerie, service client, données) qui analysent vos chiffres rapprochés et recommandent des actions concrètes.",
};

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
    <path d="M9 21h6" /><path d="M9 18h6" />
  </svg>
);

export default function InsightsIAPage() {
  return (
    <ProductPage
      badge="Mon équipe IA 24/7"
      title="Une équipe d'agents IA,"
      titleAccent="disponible 24/7."
      subtitle="Des agents experts par domaine, des routines programmées et une tour de contrôle vocale — avec une règle absolue : chaque chiffre est câblé sur vos vraies données, jamais inventé."
      heroIcon={icon}
      pains={[
        { value: "61%", label: "des deals perdus le sont par indécision du buyer — des signaux faibles que personne ne détecte.", source: "Challenger Inc." },
        { value: "55%", label: "des sales leaders n'ont pas confiance dans leurs chiffres. L'intuition ne suffit plus.", source: "Gartner" },
        { value: "87%", label: "des RevOps leaders trouvent l'adhésion au process difficile — sans insights, pas de motivation.", source: "RevOps Co-op" },
      ]}
      features={[
        { title: "Agents experts par domaine", desc: "Performance commerciale, trésorerie, service client, qualité des données : chaque agent maîtrise son périmètre et s'appuie sur vos données rapprochées." },
        { title: "Un langage par équipe", desc: "Sales, marketing, CSM, finance, direction : chaque agent parle le langage de l'équipe qu'il sert et connaît ses KPIs — l'accompagnement vit directement sur la page de l'agent." },
        { title: "Routines & récaps programmés", desc: "Choisissez la période (semaine → année) et les KPIs à couvrir : l'agent génère un récap complet (tuiles, courbes, synthèses), validé en aperçu, puis livré automatiquement — même app fermée." },
        { title: "Tour de contrôle vocale", desc: "Une orbe sur votre accueil : demandez votre brief du jour à la voix — alertes en tension, objectifs, impayés, vos KPIs personnalisés — et naviguez en parlant." },
        { title: "Anneau de santé", desc: "L'état de votre revenue d'un coup d'œil : alertes, objectifs et signaux agrégés dans un indicateur unique sur la tour de contrôle." },
        { title: "Chiffres câblés, jamais inventés", desc: "L'agent rédige, mais les valeurs viennent du moteur déterministe : source, outil et calcul vérifiables pour chaque chiffre cité." },
      ]}
      howItWorks={[
        { step: "Vos données sont synchronisées et rapprochées", desc: "HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage : tout est normalisé et relié par SIREN / SIRET / TVA." },
        { step: "Le moteur calcule en déterministe", desc: "KPIs, alertes et objectifs sont recalculés sur vos données réelles — c'est cette base chiffrée que les agents utilisent." },
        { step: "Votre équipe IA analyse et rédige", desc: "Les agents experts croisent les sources, détectent tendances et anomalies, et rédigent briefs, récaps et réponses à vos questions." },
        { step: "Vous recevez briefs et récaps, où vous voulez", desc: "Brief vocal sur la tour de contrôle, routines livrées par email, Slack ou Teams — à votre rythme, sans ouvrir l'app." },
      ]}
      stats={[
        { value: "24/7", label: "disponibilité de votre équipe IA" },
        { value: "4", label: "domaines experts : performance, trésorerie, service client, qualité des données" },
        { value: "100%", label: "des chiffres câblés en déterministe" },
        { value: "1", label: "brief vocal du jour, à la demande" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Agent Performances branché sur vos pipelines et deals HubSpot", "Brief du jour : deals silencieux, objectifs, activité récente", "Récaps de routine sur vos KPIs HubSpot × facturation", "Chaque chiffre cité est recalculé depuis vos données réelles"] },
        { crm: "Stripe + Pennylane", items: ["Agent trésorerie : encaissements, impayés, échéances fiscales", "Croisement CA facturé × pipeline pour des briefs complets", "Alertes d'impayés relayées dans vos routines", "Récaps financiers programmés, livrés même app fermée"] },
        { crm: "Toute votre stack", items: ["Agent qualité des données : complétude, doublons, rapprochements en attente", "Tour de contrôle vocale : posez vos questions à la voix", "Anneau de santé agrégeant alertes et objectifs", "Routines par équipe dans vos espaces de travail"] },
      ]}
    />
  );
}
