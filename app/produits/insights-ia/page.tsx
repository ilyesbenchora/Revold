import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
    <path d="M9 21h6" /><path d="M9 18h6" />
  </svg>
);

export default function InsightsIAPage() {
  return (
    <ProductPage
      badge="Insights IA cross-source"
      title="Des insights que votre CRM"
      titleAccent="ne peut pas voir."
      subtitle="L'IA croise vos données CRM, facturation et support pour générer des insights impossibles avec un seul outil. Pas du bruit — des recommandations actionnables."
      heroIcon={icon}
      pains={[
        { value: "61%", label: "des deals perdus le sont par indécision du buyer — des signaux faibles que personne ne détecte.", source: "Challenger Inc." },
        { value: "55%", label: "des sales leaders n'ont pas confiance dans leur forecast. L'intuition ne suffit plus.", source: "Gartner" },
        { value: "87%", label: "des RevOps leaders trouvent l'adhésion au process difficile — sans insights, pas de motivation.", source: "RevOps Co-op" },
      ]}
      features={[
        { title: "6 insights cross-source", desc: "Corrélation churn/tickets, pipeline réel vs facturé, CAC payback, engagement vs conversion, et plus." },
        { title: "Génération IA (Claude API)", desc: "Analyse de vos KPI snapshots quotidiens pour générer des insights en langage naturel, pas des tableaux." },
        { title: "Deal coaching contextuel", desc: "Chaque deal reçoit des recommandations personnalisées basées sur son historique et ses signaux." },
        { title: "Catégorisation par sévérité", desc: "Chaque insight est classé : critique, important, informatif. Vous savez où agir en premier." },
        { title: "Scoring pondéré par org", desc: "Configurez les poids de votre scoring selon votre méthodologie. Pas un score générique imposé." },
        { title: "Audit CRM intégré", desc: "L'IA audite la santé de vos données CRM et génère un blueprint de règles de résolution." },
      ]}
      howItWorks={[
        { step: "Vos données sont synchronisées", desc: "Vos connecteurs alimentent le modèle de données unifié avec des données fraîches toutes les 6h." },
        { step: "Le moteur KPI calcule", desc: "14 métriques sont calculées quotidiennement : pipeline, vélocité, conversion, win rate, MRR, churn..." },
        { step: "L'IA analyse et croise", desc: "Claude analyse les snapshots KPI et croise les sources pour détecter tendances, anomalies et opportunités." },
        { step: "Vous recevez des recommandations", desc: "Insights priorisés par sévérité, liés au deal ou à la métrique concernée, avec action recommandée." },
      ]}
      stats={[
        { value: "+17%", label: "win rate avec revenue intelligence" },
        { value: "6", label: "insights cross-source" },
        { value: "14", label: "KPIs analysés quotidiennement" },
        { value: "-22%", label: "de cycle de vente" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Insights IA basés sur vos KPIs HubSpot + Stripe + Zendesk", "Deal coaching contextuel sur chaque opportunité HubSpot", "Audit qualité de vos données HubSpot avec blueprint IA", "Alertes quand un deal HubSpot montre des signaux de risque"] },
        { crm: "Salesforce", items: ["Analyse de vos opportunities Salesforce par l'IA", "Croisement pipeline Salesforce × données billing", "Recommandations actionnables par deal", "Scoring pondéré adapté à votre process Salesforce"] },
        { crm: "Tout CRM + billing", items: ["L'IA croise votre CRM avec vos factures et vos tickets", "Insights impossibles avec un seul outil", "Détection de corrélations churn/support/paiement", "Recommandations priorisées par sévérité"] },
      ]}
    />
  );
}
