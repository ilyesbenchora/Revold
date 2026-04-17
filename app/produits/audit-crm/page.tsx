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
      subtitle="Auditez l'enrichissement de chaque propriété, détectez les orphelins, les champs manquants et les incohérences. Le regard extérieur que votre CRM ne peut pas avoir sur lui-même."
      heroIcon={icon}
      pains={[
        { value: "76%", label: "des organisations ont moins de 50% de données CRM fiables et complètes.", source: "Validity" },
        { value: "44%", label: "des entreprises perdent +10% de leur revenu annuel à cause de données CRM erronées.", source: "RevOps 802" },
        { value: "700 Md$", label: "coût annuel mondial des mauvaises données — soit environ 30% du CA moyen d'une entreprise.", source: "IBM / Gartner" },
      ]}
      features={[
        { title: "Fill rate par propriété", desc: "Pour chaque champ de votre CRM, voyez le % de remplissage. Identifiez instantanément les propriétés sous-exploitées." },
        { title: "Détection d'orphelins", desc: "Contacts sans entreprise, deals sans owner, entreprises sans contact. Les trous dans votre donnée deviennent visibles." },
        { title: "Score d'intégration de données unifié", desc: "Un score déterministe qui mesure la santé de votre setup : property groups, sources, engagements, workflows." },
        { title: "Audit des intégrations métier", desc: "7 signaux analysés : property groups, sources, engagements, portal apps, workflow webhooks, audit logs." },
        { title: "Blueprint de résolution", desc: "L'IA génère un plan d'action personnalisé : quelles règles de résolution activer selon votre stack." },
        { title: "Suivi dans le temps", desc: "L'audit tourne à chaque sync. Voyez la progression de votre data quality semaine après semaine." },
      ]}
      howItWorks={[
        { step: "Connectez votre CRM", desc: "HubSpot, Salesforce, Pipedrive — l'audit démarre dès que la première sync est complète." },
        { step: "L'audit analyse 7 dimensions", desc: "Property groups, sources de données, engagements, apps installées, webhooks, audit logs, fill rates." },
        { step: "Un score et un plan d'action", desc: "Score d'intégration de données unifié + blueprint IA avec les actions prioritaires pour améliorer votre data quality." },
        { step: "Suivi continu", desc: "À chaque sync, le score est recalculé. Vous voyez l'impact de vos actions en temps réel." },
      ]}
      stats={[
        { value: "7", label: "dimensions d'audit" },
        { value: "100%", label: "des propriétés analysées" },
        { value: "6h", label: "fréquence de recalcul" },
        { value: "1", label: "blueprint IA personnalisé" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Audit des 7 dimensions : property groups, sources, engagements...", "Fill rate de chaque propriété HubSpot", "Score d'intégration de données unifié de votre portail", "Blueprint IA : quelles règles activer pour votre stack"] },
        { crm: "Salesforce", items: ["Audit de vos objets et champs Salesforce", "Détection d'orphelins et de données incomplètes", "Score de santé de votre org Salesforce", "Plan d'action personnalisé par l'IA"] },
        { crm: "Pipedrive", items: ["Audit de vos organizations, persons et deals", "Fill rate par champ personnalisé", "Détection de doublons et d'incohérences", "Recommandations de nettoyage priorisées"] },
      ]}
    />
  );
}
