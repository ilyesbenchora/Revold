/**
 * Catalogue des ÉVÉNEMENTS notifiables — miroir « push » du contenu du brief
 * de la tour de contrôle : ce que le brief te LIT quand tu le demandes, les
 * notifications te l'ENVOIENT quand ça se produit. Chaque événement choisit
 * ses canaux dans Paramètres → Notifications (table notification_event_prefs).
 *
 * Module serveur-safe (aucun "use client") : lu par les crons ET par le
 * formulaire de préférences.
 */

/** Canaux disponibles pour un événement. */
export const NOTIFICATION_CHANNELS = [
  { key: "in_app", label: "Cloche in-app", hint: "Toujours disponible", always: true },
  { key: "email", label: "Email", hint: "Destinataires configurés ci-dessous" },
  { key: "slack", label: "Slack", hint: "Canal Slack connecté" },
  { key: "sms", label: "Mobile (SMS)", hint: "Numéro de Mon compte" },
  { key: "whatsapp", label: "WhatsApp", hint: "Même numéro que le SMS" },
] as const;

export type NotificationChannelKey = (typeof NOTIFICATION_CHANNELS)[number]["key"];

export type NotificationEvent = {
  key: string;
  label: string;
  description: string;
  /** Section équivalente du brief vocal (Paramètres → Tour de contrôle). */
  briefSection: string | null;
  defaultChannels: NotificationChannelKey[];
};

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    key: "alert_resolved",
    label: "Alerte en tension",
    description: "Le seuil d'une alerte active est atteint sur la donnée réelle.",
    briefSection: "alerts",
    defaultChannels: ["in_app", "email"],
  },
  {
    key: "billing_radar",
    label: "Radar de facturation",
    description: "Factures attendues non émises (rythme réel du client + fins de contrat CRM).",
    briefSection: "radar",
    defaultChannels: ["in_app", "email"],
  },
  {
    key: "objective_late",
    label: "Objectif en retard",
    description: "Moins de 60 % de progression à 30 jours ou moins de l'échéance.",
    briefSection: "objectives",
    defaultChannels: ["in_app"],
  },
  {
    key: "objective_reached",
    label: "Objectif atteint",
    description: "La cible d'un objectif actif est franchie.",
    briefSection: "objectives_reached",
    defaultChannels: ["in_app"],
  },
  // ── Coaching : rappels déclenchés par les DONNÉES, pas par le calendrier ──
  {
    key: "coaching_meeting_due",
    label: "Séance de coaching à venir",
    description: "Ta prochaine séance de coaching a lieu demain (ou aujourd'hui).",
    briefSection: "meetings",
    defaultChannels: ["in_app", "email"],
  },
  {
    key: "coaching_commitment_overdue",
    label: "Engagement de coaching en retard",
    description: "Une action décidée en séance a dépassé son échéance sans être faite.",
    briefSection: "coaching",
    defaultChannels: ["in_app"],
  },
  {
    key: "development_step_stalled",
    label: "Étape de développement qui stagne",
    description:
      "Une étape de ton plan de développement est en retard — signalée avec l'évolution du KPI témoin depuis l'ouverture du plan.",
    briefSection: "coaching",
    defaultChannels: ["in_app", "email"],
  },
  {
    key: "sync_failed",
    label: "Synchronisation en échec",
    description: "Le dernier run d'un outil connecté a échoué — données figées.",
    briefSection: "syncs",
    defaultChannels: ["in_app", "email"],
  },
  {
    key: "enrichment_done",
    label: "Enrichissement de données terminé",
    description: "Le robot d'enrichissement a fini de traiter la base (SIREN, effectifs, CA).",
    briefSection: "enrichment",
    defaultChannels: ["in_app"],
  },
  {
    key: "action_executed",
    label: "Action exécutée",
    description: "Une action a été exécutée dans tes outils (tâche CRM, relance, fusion…).",
    briefSection: "actions_done",
    defaultChannels: ["in_app"],
  },
];

/** Défaut d'un événement quand aucune préférence n'est enregistrée. */
export function defaultPrefFor(eventKey: string): { enabled: boolean; channels: string[] } {
  const evt = NOTIFICATION_EVENTS.find((e) => e.key === eventKey);
  return { enabled: true, channels: [...(evt?.defaultChannels ?? ["in_app"])] };
}
