import type { ConnectableTool } from "./connect-catalog";

/** Métadonnées d'affichage par catégorie d'outil (pages Intégrations). */
export const CATEGORY_META: Record<ConnectableTool["category"], { label: string; emoji: string; gradient: string; description: string }> = {
  crm: {
    label: "CRM",
    emoji: "🗂️",
    gradient: "from-orange-500 to-amber-500",
    description: "Source principale de vos contacts, deals, pipelines et activités commerciales.",
  },
  billing: {
    label: "Facturation",
    emoji: "💳",
    gradient: "from-emerald-500 to-teal-500",
    description: "Réconciliez les opportunités fermées avec les factures et paiements réels — pilotez le cash, pas seulement le pipeline.",
  },
  phone: {
    label: "Téléphonie",
    emoji: "📞",
    gradient: "from-indigo-500 to-blue-500",
    description: "Croisez les appels (durée, taux de connexion) avec les deals pour mesurer l'impact du téléphone sur le closing.",
  },
  support: {
    label: "Service client",
    emoji: "🎧",
    gradient: "from-fuchsia-500 to-pink-500",
    description: "Croisez tickets clients et opportunités pour mesurer la rétention, anticiper le churn et calculer le NPS.",
  },
  communication: {
    label: "Communication",
    emoji: "💬",
    gradient: "from-violet-500 to-purple-500",
    description: "Recevez vos alertes Revold + digest quotidien dans Slack, Teams, Gmail ou Outlook — là où votre équipe travaille déjà.",
  },
  conv_intel: {
    label: "Conversation Intelligence",
    emoji: "🎙️",
    gradient: "from-rose-500 to-fuchsia-500",
    description: "Transcription + analyse IA des appels commerciaux. Talk ratio, objections, sentiment, scoring deal — auto-enrichis dans Revold.",
  },
  files: {
    label: "Fichiers & Tableurs",
    emoji: "🟩",
    gradient: "from-green-500 to-emerald-500",
    description: "Vos données vivent encore dans Excel ou Google Sheets ? Importez-les et Revold les croise avec vos CRM, facturation et support.",
  },
};

/** Ordre d'affichage des catégories (files présenté à part via l'import). */
export const CATEGORY_ORDER: ConnectableTool["category"][] = ["crm", "billing", "phone", "support", "conv_intel", "communication"];
