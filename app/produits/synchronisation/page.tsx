import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export default function SynchronisationPage() {
  return (
    <ProductPage
      badge="Synchronisation de données"
      title="Vos données CRM,"
      titleAccent="enfin synchronisées."
      subtitle="Connectez HubSpot, Salesforce, Pipedrive, Stripe et 10 autres outils en quelques clics. Sync bidirectionnelle automatique toutes les 6 heures avec monitoring en temps réel."
      heroIcon={icon}
      pains={[
        { value: "27%", label: "du temps des commerciaux perdu à cause de mauvaises données CRM — soit 550h et 32K$ par rep par an.", source: "Validity / Forrester" },
        { value: "76%", label: "des organisations ont moins de 50% de leurs données CRM fiables et complètes.", source: "Validity" },
        { value: "13h/sem", label: "passées par un commercial à chercher de l'information dans son CRM au lieu de vendre.", source: "Validity" },
      ]}
      features={[
        { title: "Connecteurs natifs", desc: "HubSpot, Salesforce, Pipedrive, Stripe, Pennylane, Zendesk, Intercom, Crisp, Freshdesk, Zoho, monday, Sellsy, Axonaut, QuickBooks." },
        { title: "Sync bidirectionnelle", desc: "Les données circulent dans les deux sens. Pas de sync one-way qui crée des décalages." },
        { title: "OAuth2 sécurisé", desc: "Connexion en 3 clics via OAuth2. Aucune clé API à copier-coller. Token refresh automatique." },
        { title: "Monitoring en temps réel", desc: "Logs de sync, compteurs d'entités, alertes sur erreurs. Vous savez exactement ce qui se passe." },
        { title: "Sync automatique toutes les 6h", desc: "Cron Vercel intégré. Vos données sont toujours à jour sans intervention manuelle." },
        { title: "Modèle de données unifié", desc: "Chaque source est normalisée dans un schéma unifié (contacts, companies, deals, invoices, tickets)." },
      ]}
      howItWorks={[
        { step: "Connectez votre outil", desc: "Cliquez sur 'Connecter' dans les paramètres. L'OAuth2 gère tout — pas de clé API à configurer." },
        { step: "La sync démarre automatiquement", desc: "Companies, contacts, deals, factures, tickets sont importés et normalisés dans le modèle de données unifié Revold." },
        { step: "Monitoring continu", desc: "Toutes les 6 heures, la sync tourne. Les logs, erreurs et compteurs sont visibles dans votre dashboard." },
        { step: "Vos données sont prêtes", desc: "Les KPIs, insights et rapports se remplissent automatiquement à partir des données synchronisées." },
      ]}
      stats={[
        { value: "13", label: "connecteurs natifs" },
        { value: "<5 min", label: "pour connecter un outil" },
        { value: "6h", label: "fréquence de sync auto" },
        { value: "100%", label: "des données synchronisées" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Sync bidirectionnelle companies, contacts, deals", "OAuth2 en 3 clics, token refresh automatique", "Monitoring sync en temps réel dans vos paramètres", "Cron automatique toutes les 6 heures"] },
        { crm: "Salesforce", items: ["Connecteur natif (bientôt disponible)", "Sync companies, contacts, opportunities", "Même modèle de données unifié unifié", "Monitoring et logs identiques"] },
        { crm: "Pipedrive", items: ["Sync organizations, persons, deals", "Normalisation dans le modèle de données unifié Revold", "Croisement avec vos données billing et support", "Monitoring sync intégré"] },
      ]}
    />
  );
}
