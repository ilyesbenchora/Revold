import { ProductPage } from "@/components/product-page";

const icon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function AlertesPrevisionPage() {
  return (
    <ProductPage
      badge="Alertes & Prévisions de ventes"
      title="Sauvez vos deals."
      titleAccent="Avant qu'il ne soit trop tard."
      subtitle="Détection automatique des deals à risque, alertes en temps réel et prévisions de ventes basées sur vos données réelles — pas sur l'intuition de vos commerciaux."
      heroIcon={icon}
      pains={[
        { value: "61%", label: "des deals perdus le sont par indécision du buyer, pas par la concurrence. Sans alerte, le signal est invisible.", source: "Challenger Inc." },
        { value: "36–44%", label: "des deals slippent au-delà de leur close date prévue. Le forecast devient fiction.", source: "Ebsta" },
        { value: "93%", label: "des forecasts B2B sont inexacts à plus de 5%. Seules 7% des orgas atteignent +90% de précision.", source: "Gartner / CSO Insights" },
      ]}
      features={[
        { title: "Détection de risque automatique", desc: "3 signaux automatiques : inactivité > 14 jours, régression de stage, slippage de date de closing." },
        { title: "Flag is_at_risk avec raisons", desc: "Chaque deal à risque est flaggé avec des raisons explicites en clair. Pas une boîte noire." },
        { title: "Alertes RevOps temps réel", desc: "Cloche dans le header avec dropdown. Alertes par catégorie et sévérité : critique, avertissement, info." },
        { title: "Forecast probabiliste", desc: "Probabilités par stage × historique win rate. Prévision basée sur vos vraies données, pas des estimations." },
        { title: "Deal coaching IA", desc: "Recommandations contextuelles par opportunité : quoi faire, quand, pourquoi. Basé sur les patterns qui gagnent." },
        { title: "Page Deals à Risque", desc: "Vue dédiée avec filtres par owner, montant, ancienneté du risque. Votre war room revenue." },
      ]}
      howItWorks={[
        { step: "Le moteur de risque analyse chaque deal", desc: "À chaque sync, les 3 règles de détection sont appliquées sur l'ensemble de votre pipeline." },
        { step: "Les deals à risque sont flaggés", desc: "is_at_risk = true, avec risk_reasons détaillées : 'Aucune activité depuis 18 jours', 'Stage régressé de Négociation à Qualification'." },
        { step: "Vous recevez une alerte", desc: "Notification dans la cloche + insight IA avec recommandation d'action contextualisée." },
        { step: "Le forecast s'ajuste", desc: "La prévision intègre le risque détecté. Votre vision du trimestre est réaliste, pas optimiste." },
      ]}
      stats={[
        { value: "3", label: "règles de détection" },
        { value: "-22%", label: "de cycle de vente" },
        { value: "+17%", label: "de win rate" },
        { value: "±7%", label: "de variance forecast (vs ±18%)" },
      ]}
      crmSetups={[
        { crm: "HubSpot", items: ["Détection automatique des deals HubSpot à risque", "Alertes quand un deal stagne >14 jours ou régresse de stage", "Forecast probabiliste basé sur votre historique HubSpot", "Deal coaching IA contextuel par opportunité"] },
        { crm: "Salesforce", items: ["Monitoring de vos opportunities Salesforce", "Détection de slippage et d'inactivité", "Prévisions basées sur vos win rates Salesforce", "Recommandations par deal"] },
        { crm: "Tout CRM + Stripe", items: ["Croisement pipeline × paiements pour valider le forecast", "Alerte si un client à fort MRR ouvre des tickets support", "Revenue réel vs prévu mesuré automatiquement", "Prévisions financières fiables pour votre DAF"] },
      ]}
    />
  );
}
