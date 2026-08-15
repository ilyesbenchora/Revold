import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function AuditCRMPage() {
  return (
    <ProductPage
      badge="Audit complet du CRM"
      title="Votre CRM vous ment."
      titleAccent="Revold vous dit la vérité."
      subtitle="Complétude de chaque propriété, doublons, fiches orphelines, score de santé et plan d'action généré par l'IA : le regard extérieur que votre CRM ne peut pas avoir sur lui-même."
      heroIcon={icon}
      pains={[
        { value: "76%", label: "des organisations ont moins de 50% de données CRM fiables et complètes.", source: "Validity" },
        { value: "44%", label: "des entreprises perdent +10% de leur revenu annuel à cause de données CRM erronées.", source: "RevOps 802" },
        { value: "700 Md$", label: "coût annuel mondial des mauvaises données — soit environ 30% du CA moyen d'une entreprise.", source: "IBM / Gartner" },
      ]}
      features={[
        { title: "Complétude par propriété", desc: "Pour chaque champ de votre CRM, le % de remplissage. Identifiez instantanément les propriétés sous-exploitées — dont les identifiants SIREN / SIRET / TVA." },
        { title: "Détection de doublons", desc: "Entreprises et contacts en double repérés par email, domaine et identifiants légaux. Le rapprochement Sirene aide à trancher les cas ambigus." },
        { title: "Détection d'orphelins", desc: "Contacts sans entreprise, deals sans owner, entreprises sans contact. Les trous dans votre donnée deviennent visibles." },
        { title: "Score de santé", desc: "Un score déterministe, recalculé à chaque sync, qui mesure la santé de vos données : complétude, cohérence, rapprochements possibles." },
        { title: "Plan d'action IA", desc: "L'IA transforme l'audit en plan concret et priorisé : quels champs remplir, quels doublons fusionner, quels rapprochements valider en premier." },
        { title: "Suivi dans le temps", desc: "L'audit tourne à chaque synchronisation. Voyez la progression de votre qualité de données semaine après semaine." },
      ]}
      howItWorks={[
        { step: "Connectez votre CRM", desc: "HubSpot en un clic via OAuth, en lecture seule — l'audit démarre dès que la première sync est complète." },
        { step: "L'audit analyse vos données", desc: "Complétude par propriété, doublons, orphelins, identifiants de rapprochement disponibles : tout est mesuré." },
        { step: "Un score et un plan d'action", desc: "Score de santé déterministe + plan d'action IA avec les actions prioritaires pour améliorer votre qualité de données." },
        { step: "Suivi continu", desc: "À chaque sync, le score est recalculé. Vous voyez l'impact de vos corrections dans le temps." },
      ]}
      stats={[
        { value: "100%", label: "des propriétés analysées" },
        { value: "1", label: "score de santé déterministe" },
        { value: "1", label: "plan d'action IA priorisé" },
        { value: "0", label: "écriture sans votre validation" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Complétude de chaque propriété de votre portail", "Doublons et fiches orphelines détectés automatiquement", "Score de santé recalculé à chaque sync", "Plan d'action IA : quoi corriger, dans quel ordre"] },
        { crm: "HubSpot + facturation", items: ["Croisement CRM × Stripe / Pennylane pour repérer les incohérences", "Clients facturés absents du CRM (et inversement)", "Identifiants SIREN / TVA manquants remplis via Sirene, à valider", "Écriture des identifiants validés dans vos fiches HubSpot"] },
        { crm: "Import Excel / Sheets", items: ["Audit de vos fichiers importés : lignes incomplètes, doublons", "Rapprochement avec les entités déjà connues", "Qualité mesurée avant d'alimenter vos KPIs", "Plan de nettoyage priorisé"] },
      ]}
    />
  );
}
