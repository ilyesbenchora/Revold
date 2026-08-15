import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function AlertesObjectifsActionsPage() {
  return (
    <ProductPage
      badge="Alertes, objectifs & actions"
      title="Détecter ne suffit pas."
      titleAccent="Revold agit avec vous."
      subtitle="Des alertes et objectifs au câblage vérifié — la preuve chiffrée avant création — et une boîte d'actions human-in-the-loop : deal silencieux → tâche HubSpot, impayé → rappel Stripe officiel. Chaque euro récupéré est attribué."
      heroIcon={icon}
      pains={[
        { value: "61%", label: "des deals perdus le sont par indécision du buyer, pas par la concurrence. Sans alerte, le signal est invisible.", source: "Challenger Inc." },
        { value: "36–44%", label: "des deals slippent au-delà de leur close date prévue — et meurent en silence.", source: "Ebsta" },
        { value: "~10%", label: "des churns SaaS sont involontaires : un paiement échoue et personne ne relance à temps.", source: "Recover / ProfitWell" },
      ]}
      features={[
        { title: "Câblage vérifié avant création", desc: "Avant de créer une alerte ou un objectif, Revold montre la donnée réellement suivie, l'outil source et la valeur actuelle calculée. La preuve chiffrée d'abord, le suivi ensuite." },
        { title: "Détection déterministe", desc: "Le seuil est détecté par le moteur sur vos données réelles ; l'agent IA rédige la notification. Jamais l'inverse." },
        { title: "Boîte d'actions human-in-the-loop", desc: "Revold propose, vous validez, l'action s'exécute dans vos outils. Rien ne part sans votre accord explicite." },
        { title: "Deal silencieux → tâche HubSpot", desc: "Un deal sans activité depuis 21 jours ? Une tâche est créée dans HubSpot pour le bon owner, avec le contexte du deal." },
        { title: "Impayé → rappel Stripe officiel", desc: "Facture en retard ? Revold déclenche le rappel officiel Stripe après votre validation — pas un email bricolé." },
        { title: "Cash récupéré, attribué en euros", desc: "Chaque relance qui aboutit est tracée : vous voyez, ligne par ligne, les euros réellement récupérés grâce aux actions exécutées." },
      ]}
      howItWorks={[
        { step: "Créez une alerte ou un objectif, preuve à l'appui", desc: "Revold affiche la source, l'outil et la valeur actuelle calculée avant la création. Vous savez exactement ce qui sera suivi." },
        { step: "Le moteur surveille en déterministe", desc: "Les seuils sont contrôlés automatiquement sur vos données synchronisées ; l'agent rédige des notifications claires (email, Slack, Teams)." },
        { step: "Une action vous est proposée", desc: "Deal silencieux, impayé, objectif en dérive : l'action adaptée arrive dans votre boîte d'actions, prête à être validée." },
        { step: "Vous validez, l'impact est mesuré", desc: "L'action s'exécute dans HubSpot ou Stripe, et le résultat — dont le cash récupéré — est attribué en euros, ligne par ligne." },
      ]}
      stats={[
        { value: "100%", label: "des alertes au câblage vérifié" },
        { value: "0", label: "action exécutée sans votre validation" },
        { value: "21 j", label: "de silence → tâche HubSpot proposée" },
        { value: "€", label: "cash récupéré attribué, ligne par ligne" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Détection des deals silencieux sur vos pipelines réels", "Tâche HubSpot créée pour le bon owner, après votre validation", "Alertes d'objectifs câblées sur vos KPIs HubSpot", "Notifications par email, Slack ou Teams"] },
        { crm: "Stripe", items: ["Détection automatique des factures en retard et paiements échoués", "Rappel Stripe officiel déclenché en un clic de validation", "Cash récupéré attribué en euros, relance par relance", "Croisement impayés × CRM pour prioriser les comptes clés"] },
        { crm: "GoCardless / Chargebee / Sage", items: ["Alertes sur prélèvements échoués et abonnements en tension", "Objectifs de trésorerie suivis sur vos encaissements réels", "Échéances fiscales intégrées à votre calendrier d'alertes", "Même exigence : preuve chiffrée avant chaque création"] },
      ]}
    />
  );
}
