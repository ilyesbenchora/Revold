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
      title="Une entreprise, une fiche."
      titleAccent="Partout."
      subtitle="Revold rapproche vos entreprises entre CRM, facturation et compta par SIREN, SIRET et N° de TVA — et remplit lui-même les identifiants manquants depuis la base Sirene officielle, à valider en un clic."
      heroIcon={icon}
      pains={[
        { value: "40%", label: "des leads B2B générés sont invalides, incomplets ou doublons dans le CRM.", source: "Cognism" },
        { value: "76%", label: "des organisations ont moins de 50% de données CRM fiables — la dédup est un facteur clé.", source: "Validity" },
        { value: "30%", label: "du CA moyen d'une entreprise est impacté par la mauvaise qualité de données (700 Md$/an mondial).", source: "IBM / Gartner" },
      ]}
      features={[
        { title: "Rapprochement à la française", desc: "SIREN, SIRET, N° de TVA intracommunautaire : les identifiants légaux français comme clés de rapprochement. Aucun outil US ne gère ça nativement." },
        { title: "Enrichissement automatique via Sirene", desc: "Le cœur du moteur : quand un identifiant manque, Revold interroge la base Sirene officielle et propose le SIREN / SIRET correspondant. Vous validez, la fiche est complète." },
        { title: "ID de rapprochement custom", desc: "Votre propre identifiant (code client, référence interne…) peut servir de clé de rapprochement entre outils, mappé à l'onboarding." },
        { title: "Validation utilisateur", desc: "Aucun enrichissement n'est écrit sans votre accord. Chaque proposition est présentée avec sa source ; vous validez ou rejetez en un clic." },
        { title: "Écriture dans HubSpot", desc: "Les identifiants validés sont aussi écrits dans vos fiches HubSpot : votre CRM devient plus propre, pas seulement Revold." },
        { title: "Traçabilité totale", desc: "Chaque entité sait d'où elle vient : outil source, identifiant externe, méthode de rapprochement. Rien n'est une boîte noire." },
      ]}
      howItWorks={[
        { step: "Les données arrivent de vos sources", desc: "Entreprises, contacts et deals sont synchronisés depuis HubSpot, Stripe, Pennylane, Chargebee, GoCardless et Sage." },
        { step: "Le moteur rapproche par identifiants légaux", desc: "SIREN, SIRET, N° TVA, email, domaine et votre ID custom sont appliqués selon la priorité configurée." },
        { step: "Sirene comble les manques", desc: "Pour les fiches sans identifiant, Revold interroge la base Sirene officielle et vous propose l'enrichissement, preuve à l'appui." },
        { step: "Vous validez, tout se propage", desc: "La fiche unifiée est consolidée et les identifiants validés sont écrits dans HubSpot pour garder votre CRM cohérent." },
      ]}
      stats={[
        { value: "SIREN", label: "SIRET & N° TVA comme clés de rapprochement" },
        { value: "1 clic", label: "pour valider un enrichissement Sirene" },
        { value: "6", label: "sources rapprochées + Excel / Sheets" },
        { value: "100%", label: "traçabilité des rapprochements" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Rapprochement companies HubSpot ↔ clients Stripe / Pennylane par SIREN / TVA", "Identifiants manquants remplis depuis la base Sirene, à valider en un clic", "Écriture des SIREN / SIRET validés dans vos fiches HubSpot", "Traçabilité complète : source, méthode, date de rapprochement"] },
        { crm: "Stripe + Pennylane", items: ["Le même client facturé et comptabilisé = une seule entreprise", "Rapprochement par N° TVA et SIREN entre facturation et compta", "Écarts CRM ↔ facturé enfin mesurables entreprise par entreprise", "Enrichissement Sirene pour les clients sans identifiant légal"] },
        { crm: "Import Excel / Sheets", items: ["Vos fichiers rejoignent le même moteur de rapprochement", "Mapping de votre ID de rapprochement custom à l'onboarding", "Dédoublonnage contre les entités déjà connues", "Audit de qualité sur les lignes non rapprochées"] },
      ]}
    />
  );
}
