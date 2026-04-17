import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-8" />
  </svg>
);

export default function ReportingCrossSourcePage() {
  return (
    <ProductPage
      badge="Reporting cross-source"
      title="Un seul dashboard."
      titleAccent="Toutes vos sources."
      subtitle="Croisez vos données CRM, facturation et support dans des rapports unifiés impossibles à construire dans HubSpot ou Salesforce seuls. 80+ rapports pré-configurés."
      heroIcon={icon}
      pains={[
        { value: "68%", label: "des organisations citent les silos de données comme leur principal obstacle opérationnel en 2026.", source: "Agents for Hire" },
        { value: "2 jours/mois", label: "passés en moyenne par les équipes RevOps à compiler manuellement des rapports cross-tool.", source: "RevOps Co-op" },
        { value: "44%", label: "des entreprises perdent +10% de leur CA annuel à cause de données CRM erronées ou incomplètes.", source: "RevOps 802" },
      ]}
      features={[
        { title: "80+ rapports pré-configurés", desc: "Performance commerciale, marketing, paiement & facturation, service client. Prêts dès la connexion de vos outils." },
        { title: "Croisement CRM × Billing × Support", desc: "Répondez à : 'Quel est mon vrai CAC payback ?' ou 'Mes clients avec des tickets ouverts vont-ils churner ?'" },
        { title: "3 moteurs de scoring", desc: "Score de santé Sales, Marketing et CRM calculés quotidiennement sur 14 KPIs temps réel." },
        { title: "Rapports par intégration unique", desc: "Drill-down par outil connecté : performance HubSpot, revenus Stripe, satisfaction Zendesk." },
        { title: "Rapports multi-intégrations", desc: "Les rapports impossibles avec un seul outil : revenus réels vs pipeline, churn vs support, CAC vs LTV." },
        { title: "Tendances historiques", desc: "Sélecteur de période avec comparaison semaine/mois/trimestre. Visualisez la progression, pas juste un snapshot." },
      ]}
      howItWorks={[
        { step: "Connectez vos sources", desc: "CRM + facturation + support. Revold normalise tout dans un modèle de données unifié unifié." },
        { step: "Les rapports se remplissent seuls", desc: "80+ rapports sont calculés automatiquement. Aucune formule à écrire, aucun export à faire." },
        { step: "Croisez ce qui était impossible", desc: "Les insights cross-source apparaissent : corrélation churn/tickets, pipeline réel vs facturé, etc." },
        { step: "Partagez et décidez", desc: "Dashboard temps réel pour votre équipe, votre direction, vos boards. Une seule source de vérité." },
      ]}
      stats={[
        { value: "80+", label: "rapports automatiques" },
        { value: "14", label: "KPIs temps réel" },
        { value: "3", label: "moteurs de scoring" },
        { value: "0", label: "exports manuels" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["80+ rapports pré-remplis avec vos données HubSpot", "Croisement pipeline HubSpot × factures Stripe", "Score de santé CRM basé sur vos property groups", "Attribution marketing → deal → facture"] },
        { crm: "Salesforce", items: ["Rapports enrichis par vos données Salesforce", "Pipeline Salesforce croisé avec votre billing", "Métriques de vélocité par stage Salesforce", "Vue unifiée multi-source"] },
        { crm: "Pipedrive + Stripe", items: ["Pipeline Pipedrive × paiements Stripe en un dashboard", "KPIs de conversion calculés automatiquement", "Rapports revenus réels vs pipeline prévu", "Tendances historiques cross-source"] },
      ]}
    />
  );
}
