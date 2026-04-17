import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function ResolutionEntitesPage() {
  return (
    <ProductPage
      badge="Résolution d'entités"
      title="Un contact, une entreprise."
      titleAccent="Partout."
      subtitle="Réconciliez automatiquement vos contacts et entreprises entre CRM, facturation et support. 7 méthodes de matching — pas juste l'email."
      heroIcon={icon}
      pains={[
        { value: "40%", label: "des leads B2B générés sont invalides, incomplets ou doublons dans le CRM.", source: "Cognism" },
        { value: "76%", label: "des organisations ont moins de 50% de données CRM fiables — la dédup est un facteur clé.", source: "Validity" },
        { value: "30%", label: "du CA moyen d'une entreprise est impacté par la mauvaise qualité de données (700 Md$/an mondial).", source: "IBM / Gartner" },
      ]}
      features={[
        { title: "7 méthodes de matching", desc: "Email, SIREN, SIRET, numéro de TVA, domaine, LinkedIn URL, external ID. Pas juste un match email." },
        { title: "9 règles configurables", desc: "Définissez la priorité de résolution par stack : email + SIREN combo, domain fallback, etc." },
        { title: "Résolution cross-source", desc: "Le même client chez HubSpot, Stripe et Zendesk est automatiquement réconcilié en une seule fiche." },
        { title: "French-native (SIREN/SIRET)", desc: "Matching par identifiants légaux français. Aucun outil US ne gère ça nativement." },
        { title: "Table source_links", desc: "Chaque entité sait d'où elle vient (provider, external_id, match_method). Traçabilité totale." },
        { title: "Auto-writeback", desc: "Les résolutions sont propagées vers les sources connectées pour garder la cohérence." },
      ]}
      howItWorks={[
        { step: "Les données arrivent de vos sources", desc: "Contacts, entreprises, deals sont synchronisés depuis chaque outil connecté." },
        { step: "Le moteur de résolution analyse", desc: "7 méthodes de matching sont appliquées dans l'ordre de priorité que vous avez configuré." },
        { step: "Les entités sont réconciliées", desc: "Un contact présent dans 3 outils devient une seule fiche avec toutes ses interactions." },
        { step: "Writeback automatique", desc: "Les identifiants croisés sont propagés vers vos outils pour maintenir la cohérence." },
      ]}
      stats={[
        { value: "7", label: "méthodes de matching" },
        { value: "9", label: "règles configurables" },
        { value: "13", label: "sources réconciliées" },
        { value: "100%", label: "traçabilité" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Matching contacts HubSpot ↔ clients Stripe par email + domaine", "Réconciliation entreprises par SIREN/SIRET/TVA", "Enrichissement des fiches HubSpot avec données billing", "Writeback des identifiants croisés vers HubSpot"] },
        { crm: "Salesforce", items: ["Résolution accounts Salesforce ↔ companies billing", "7 méthodes de matching appliquées sur vos données", "Traçabilité complète dans la table source_links", "Propagation automatique des résolutions"] },
        { crm: "Multi-CRM", items: ["Un contact dans HubSpot, Pipedrive ET Stripe = une seule fiche", "Résolution cross-CRM si vous migrez ou utilisez plusieurs outils", "Identifiants français natifs (SIREN, SIRET, TVA)", "9 règles de priorité configurables"] },
      ]}
    />
  );
}
