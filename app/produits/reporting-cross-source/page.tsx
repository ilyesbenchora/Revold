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
      title="Des KPIs câblés."
      titleAccent="Jamais inventés."
      subtitle="Croisez votre CRM, votre facturation et votre compta dans des KPIs et des tables vérifiés : chaque chiffre est câblé sur vos données réelles, recalculé en déterministe, avec la preuve de sa source."
      heroIcon={icon}
      pains={[
        { value: "68%", label: "des organisations citent les silos de données comme leur principal obstacle opérationnel en 2026.", source: "Agents for Hire" },
        { value: "2 jours/mois", label: "passés en moyenne par les équipes RevOps à compiler manuellement des rapports cross-tool.", source: "RevOps Co-op" },
        { value: "44%", label: "des entreprises perdent +10% de leur CA annuel à cause de données CRM erronées ou incomplètes.", source: "RevOps 802" },
      ]}
      features={[
        { title: "KPIs câblés et vérifiés", desc: "Chaque KPI affiche sa source, l'outil d'origine et la valeur calculée. Pas de chiffre sorti d'un chapeau : vous voyez le câblage avant de faire confiance." },
        { title: "Funnel de câblage", desc: "Avant chaque KPI, l'étape « sources à croiser » : Revold vous montre quels outils connectés alimentent la mesure, et ce qu'il manque pour la fiabiliser." },
        { title: "Recalcul déterministe", desc: "Les valeurs sont recalculées par le moteur — pas générées par l'IA. Le même calcul, sur les mêmes données, donne toujours le même chiffre." },
        { title: "Croisement CRM × facturation × compta", desc: "Pipeline HubSpot croisé avec les factures Stripe et les écritures Pennylane : écart CA CRM ↔ CA facturé, churn réel, revenus encaissés." },
        { title: "Tables cross-source", desc: "Des tables détaillées, ligne par ligne, avec les entités rapprochées par SIREN / SIRET / TVA — la donnée derrière chaque agrégat." },
        { title: "Périodes & comparaisons", desc: "Semaine, mois, trimestre, année : sélecteur de période avec comparaison. Visualisez la progression, pas juste un snapshot." },
      ]}
      howItWorks={[
        { step: "Connectez vos sources", desc: "CRM + facturation + compta. Revold normalise tout dans un modèle de données unifié et rapproche les entités par SIREN / SIRET / TVA." },
        { step: "Le funnel de câblage vérifie", desc: "Pour chaque KPI, Revold identifie les sources à croiser parmi vos outils connectés et contrôle la couverture des données." },
        { step: "Les chiffres sont recalculés en déterministe", desc: "Le moteur calcule chaque valeur sur vos données réelles, avec traçabilité complète — jamais une estimation IA." },
        { step: "Vous croisez ce qui était impossible", desc: "Pipeline réel vs facturé, revenus encaissés vs prévus, churn constaté : une seule source de vérité pour votre équipe et votre board." },
      ]}
      stats={[
        { value: "100%", label: "des chiffres câblés sur vos données réelles" },
        { value: "3", label: "univers croisés : CRM × facturation × compta" },
        { value: "0", label: "export manuel" },
        { value: "0", label: "chiffre inventé par l'IA" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["KPIs câblés sur vos pipelines, deals et contacts HubSpot", "Croisement pipeline HubSpot × factures Stripe / Pennylane", "Funnel de câblage : sources vérifiées avant chaque KPI", "Écart CA CRM ↔ CA réellement facturé, chiffré en euros"] },
        { crm: "Stripe + Pennylane", items: ["MRR, factures et encaissements croisés avec le CRM", "Rapprochement automatique des entreprises par SIREN / N° TVA", "Tables détaillées ligne par ligne, avec la source de chaque montant", "Périodes comparables : mois, trimestre, année"] },
        { crm: "Chargebee / GoCardless / Sage", items: ["Abonnements, prélèvements et écritures intégrés aux KPIs", "Croisement multi-outils dans le même modèle unifié", "Recalcul déterministe à chaque synchronisation", "Une seule source de vérité, quel que soit l'outil d'origine"] },
      ]}
    />
  );
}
