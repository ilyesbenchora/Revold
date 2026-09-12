/**
 * Brief PERSONNALISÉ par équipe (Paramètres → Tour de contrôle → Brief du
 * jour). Module PARTAGÉ client/serveur : types, catalogue des suggestions par
 * pôle, périodes d'analyse, valeurs par défaut. Aucune dépendance serveur.
 *
 * Principe : l'utilisateur choisit son équipe (admin : libre ; membre : son
 * pôle), coche les suggestions de l'équipe et leurs options (pipelines,
 * périodes, seuil de stagnation, propriété de date des prévisions), déclare
 * les propriétés CRM personnalisées qui font office de date de fermeture ou de
 * suivi (vérifiées dans le CRM avant enregistrement), puis valide des
 * suggestions personnalisées dérivées de ces propriétés — chacune passe par le
 * rapprochement (calcul réel) avant d'entrer dans le brief.
 */

export type BriefTeamId = "sales" | "marketing" | "cs" | "finance";
export const BRIEF_TEAMS: { id: BriefTeamId; label: string; icon: string }[] = [
  { id: "sales", label: "Ventes", icon: "💼" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "cs", label: "Service client", icon: "🤝" },
  { id: "finance", label: "Comptabilité", icon: "💳" },
];
export function isBriefTeamId(v: unknown): v is BriefTeamId {
  return v === "sales" || v === "marketing" || v === "cs" || v === "finance";
}
export function briefTeamLabel(id: BriefTeamId): string {
  return BRIEF_TEAMS.find((t) => t.id === id)?.label ?? id;
}

/** Objets CRM porteurs d'une propriété personnalisée. */
export type BriefCrmObject = "deals" | "contacts" | "companies" | "tickets";
export const CRM_OBJECT_LABELS: Record<BriefCrmObject, string> = {
  deals: "Deals",
  contacts: "Contacts",
  companies: "Entreprises",
  tickets: "Tickets",
};
export function isBriefCrmObject(v: unknown): v is BriefCrmObject {
  return v === "deals" || v === "contacts" || v === "companies" || v === "tickets";
}
/** Objets proposés pour les propriétés personnalisées de chaque équipe. */
export const TEAM_OBJECTS: Record<BriefTeamId, BriefCrmObject[]> = {
  sales: ["deals", "companies"],
  marketing: ["contacts", "companies"],
  cs: ["tickets", "contacts"],
  finance: ["deals", "companies"],
};

// ── Périodes d'analyse ──────────────────────────────────────────────────────
export type BriefPeriod = "this_week" | "this_month" | "next_month" | "this_quarter" | "next_quarter" | "this_year";
export const BRIEF_PERIODS: { id: BriefPeriod; label: string; future: boolean }[] = [
  { id: "this_week", label: "Cette semaine", future: false },
  { id: "this_month", label: "Ce mois-ci", future: false },
  { id: "next_month", label: "Mois prochain", future: true },
  { id: "this_quarter", label: "Ce trimestre", future: false },
  { id: "next_quarter", label: "Trimestre suivant", future: true },
  { id: "this_year", label: "Cette année", future: false },
];
export function isBriefPeriod(v: unknown): v is BriefPeriod {
  return BRIEF_PERIODS.some((p) => p.id === v);
}
export function periodLabel(p: BriefPeriod): string {
  return BRIEF_PERIODS.find((x) => x.id === p)?.label ?? p;
}
/** Libellé « à l'oral » (« ce mois-ci », « le trimestre prochain »). */
export function periodSpoken(p: BriefPeriod): string {
  switch (p) {
    case "this_week": return "cette semaine";
    case "this_month": return "ce mois-ci";
    case "next_month": return "le mois prochain";
    case "this_quarter": return "ce trimestre";
    case "next_quarter": return "le trimestre prochain";
    case "this_year": return "cette année";
  }
}

/** Fenêtre [from, to) d'une période (heure locale du serveur, minuit). */
export function periodWindow(p: BriefPeriod, now: Date = new Date()): { from: Date; to: Date } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = d.getMonth();
  const q = Math.floor(m / 3);
  switch (p) {
    case "this_week": {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const to = new Date(monday);
      to.setDate(to.getDate() + 7);
      return { from: monday, to };
    }
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "next_month":
      return { from: new Date(y, m + 1, 1), to: new Date(y, m + 2, 1) };
    case "this_quarter":
      return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1) };
    case "next_quarter":
      return { from: new Date(y, q * 3 + 3, 1), to: new Date(y, q * 3 + 6, 1) };
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
  }
}

// ── Propriétés CRM personnalisées ───────────────────────────────────────────
export type BriefPropertyRole = "close_date" | "tracking" | "billing_start" | "billing_end";

export const BRIEF_PROPERTY_ROLES: BriefPropertyRole[] = ["close_date", "tracking", "billing_start", "billing_end"];

/** Libellés des rôles — sélecteur d'ajout + rappel sur la propriété validée. */
export const BRIEF_PROPERTY_ROLE_LABELS: Record<BriefPropertyRole, string> = {
  close_date: "date de fermeture",
  tracking: "suivi",
  billing_start: "date de début de facturation",
  billing_end: "date de fin de facturation",
};

/** Rôles qui exigent une propriété de type DATE pour être exploitables. */
export function roleNeedsDate(role: BriefPropertyRole): boolean {
  return role === "close_date" || role === "billing_start" || role === "billing_end";
}
export type BriefCustomProperty = {
  /** Nom API HubSpot (a-z0-9_). */
  name: string;
  /** Libellé HubSpot (affiché dans le brief). */
  label: string;
  object: BriefCrmObject;
  /** fieldType HubSpot (date, select, number, text, booleancheckbox…). */
  fieldType: string | null;
  /** type HubSpot (date, datetime, enumeration, number, string, bool). */
  type: string | null;
  /** close_date = fait office de date de fermeture ; tracking = suivi important ;
   *  billing_start / billing_end = dates de début / fin de facturation. */
  role: BriefPropertyRole;
  /** Rapprochement au moment de la validation : fiches renseignées / total. */
  coverage: { withValue: number; total: number } | null;
};
export function isDateProperty(p: Pick<BriefCustomProperty, "type" | "fieldType">): boolean {
  return p.type === "date" || p.type === "datetime" || p.fieldType === "date";
}

// ── Suggestions personnalisées (dérivées des propriétés) ────────────────────
export type BriefSuggestionKind = "date_window" | "breakdown" | "sum" | "flag";
export type BriefCustomSuggestion = {
  id: string;
  label: string;
  object: BriefCrmObject;
  property: string;
  propertyLabel: string;
  kind: BriefSuggestionKind;
  enabled: boolean;
  /** Périodes lues (date_window : fenêtre de la propriété ; autres : date de création, vide = stock actuel). */
  periods: BriefPeriod[];
  /** Rapprochement validé (nombre de fiches trouvées lors de la validation). */
  coverage: { count: number; total: number | null } | null;
};

/**
 * Suggestions personnalisées proposées pour une propriété validée — selon son
 * type : date → fenêtre de date (prévision) ; liste → répartition ; nombre →
 * total ; booléen → fiches cochées.
 */
export function suggestionsForProperty(p: BriefCustomProperty): Omit<BriefCustomSuggestion, "id" | "enabled" | "coverage">[] {
  const entity = CRM_OBJECT_LABELS[p.object];
  const stockLabel = p.object === "deals" ? "Deals en cours" : p.object === "tickets" ? "Tickets ouverts" : entity;
  if (isDateProperty(p)) {
    return [
      {
        label: `${stockLabel} dont « ${p.label} » tombe dans la période`,
        object: p.object,
        property: p.name,
        propertyLabel: p.label,
        kind: "date_window",
        periods: ["this_month"],
      },
    ];
  }
  if (p.type === "bool" || p.fieldType === "booleancheckbox") {
    return [
      { label: `${stockLabel} avec « ${p.label} » coché`, object: p.object, property: p.name, propertyLabel: p.label, kind: "flag", periods: [] },
    ];
  }
  if (p.type === "number") {
    return [
      { label: `Total « ${p.label} » des ${stockLabel.toLowerCase()}`, object: p.object, property: p.name, propertyLabel: p.label, kind: "sum", periods: [] },
    ];
  }
  return [
    { label: `${stockLabel} par « ${p.label} »`, object: p.object, property: p.name, propertyLabel: p.label, kind: "breakdown", periods: [] },
  ];
}

// ── Catalogue des suggestions natives par équipe ────────────────────────────
export type BriefBlockDef = {
  id: string;
  label: string;
  hint: string;
  /** Périodes proposées (vide = bloc « stock », sans période). */
  periods: "none" | "past" | "all";
  /** Seuil de jours (stagnation). */
  days?: { default: number; label: string };
  /** Bloc de PRÉVISION : la date de fermeture est remplaçable par une propriété personnalisée. */
  forecast?: boolean;
  /** Bloc dont les chiffres peuvent être VENTILÉS par propriétaire (option par card). */
  ownerBreakdown?: boolean;
};

const PAST: BriefPeriod[] = ["this_week", "this_month", "this_quarter", "this_year"];
const ALL: BriefPeriod[] = BRIEF_PERIODS.map((p) => p.id);
export function periodsFor(def: BriefBlockDef): BriefPeriod[] {
  return def.periods === "all" ? ALL : def.periods === "past" ? PAST : [];
}

export const TEAM_BLOCKS: Record<BriefTeamId, BriefBlockDef[]> = {
  sales: [
    { id: "deals_open", label: "Deals en cours", hint: "Nombre et montant, par pipeline choisi", periods: "none", ownerBreakdown: true },
    { id: "deals_won_by_owner", label: "Deals signés par propriétaire", hint: "Signés sur la période, détaillés par propriétaire", periods: "past" },
    { id: "deals_stagnant", label: "Deals stagnants", hint: "Deals restés dans la même phase au-delà du seuil", periods: "none", days: { default: 14, label: "Jours dans la même phase" }, ownerBreakdown: true },
    { id: "deals_ready", label: "Deals prêts à signer", hint: "Deals en cours dont la date de fermeture tombe dans l'échéance", periods: "all", forecast: true, ownerBreakdown: true },
    { id: "forecast_weighted", label: "Prévision pondérée", hint: "Montant × probabilité d'étape sur l'échéance", periods: "all", forecast: true, ownerBreakdown: true },
  ],
  marketing: [
    { id: "contacts_new", label: "Nouveaux contacts", hint: "Contacts créés dans le CRM sur la période", periods: "past" },
    { id: "mql_new", label: "Nouveaux MQL", hint: "Contacts passés MQL sur la période", periods: "past" },
    { id: "sql_new", label: "Passages en SQL", hint: "Contacts qualifiés ventes sur la période", periods: "past" },
    { id: "contacts_by_source", label: "Contacts par source", hint: "Origine des contacts créés (formulaire, import, API…)", periods: "past" },
    { id: "lifecycle_stock", label: "Cycle de vie", hint: "Répartition actuelle des contacts par étape", periods: "none" },
  ],
  cs: [
    { id: "tickets_open", label: "Tickets ouverts", hint: "Stock actuel, détaillé par priorité", periods: "none" },
    { id: "tickets_new", label: "Nouveaux tickets", hint: "Tickets créés sur la période", periods: "past" },
    { id: "tickets_resolved_by_owner", label: "Tickets résolus par propriétaire", hint: "Résolus sur la période, par propriétaire", periods: "past" },
    { id: "tickets_stagnant", label: "Tickets sans mise à jour", hint: "Ouverts sans mouvement au-delà du seuil", periods: "none", days: { default: 3, label: "Jours sans mise à jour" } },
    { id: "tickets_sla", label: "SLA dépassés", hint: "Tickets ouverts hors SLA (première réponse ou clôture)", periods: "none" },
    { id: "csat", label: "Satisfaction (CSAT)", hint: "Note moyenne des tickets clos sur la période", periods: "past" },
  ],
  finance: [
    { id: "invoices_issued", label: "Factures émises", hint: "Nombre et montant facturés sur la période", periods: "past" },
    { id: "invoices_paid", label: "Encaissements", hint: "Montant encaissé sur la période", periods: "past" },
    { id: "invoices_overdue", label: "Factures en retard", hint: "Échues non réglées, clients les plus exposés", periods: "none" },
    { id: "invoices_due", label: "Échéances à venir", hint: "Factures à encaisser dont l'échéance tombe dans la période", periods: "all" },
    { id: "mrr", label: "MRR actif", hint: "Revenu mensuel récurrent des abonnements actifs", periods: "none" },
    { id: "deals_won_to_invoice", label: "Deals signés à facturer", hint: "Signés sur la période sans facture rattachée", periods: "past" },
  ],
};

export type BriefBlockConfig = {
  enabled: boolean;
  periods: BriefPeriod[];
  days?: number;
  /** Propriété de date remplaçant la date de fermeture (blocs de prévision) ; null = closedate. */
  dateProperty?: string | null;
  /** Ventiler les chiffres du bloc par propriétaire (blocs `ownerBreakdown`). */
  byOwner?: boolean;
};

export type BriefTeamConfig = {
  /** Pipelines HubSpot inclus (ids) ; vide = tous. */
  pipelines: string[];
  blocks: Record<string, BriefBlockConfig>;
  customProperties: BriefCustomProperty[];
  customSuggestions: BriefCustomSuggestion[];
  /** Focus sur un utilisateur du CRM (propriétaire) : tout le brief de l'équipe
   *  ne porte que sur ses fiches. null = toute l'équipe. */
  ownerId?: string | null;
  /** Nom du propriétaire choisi (affichage, sans refetch). */
  ownerName?: string | null;
  /** Objet sur lequel le propriétaire est indexé (propriétaire du deal, du
   *  contact, de l'entreprise…). Détermine l'objet dont le champ propriétaire
   *  est vérifié/câblé. null = objet principal de l'équipe. */
  ownerObject?: BriefCrmObject | null;
};

/** Objet « propriétaire » par défaut d'une équipe (objet principal). */
export function defaultOwnerObject(team: BriefTeamId): BriefCrmObject {
  return team === "marketing" ? "contacts" : team === "cs" ? "tickets" : "deals";
}

export type BriefTeamSettings = {
  /** Le brief d'équipe est lu dans le brief du jour. */
  enabled: boolean;
  team: BriefTeamId;
  configs: Partial<Record<BriefTeamId, BriefTeamConfig>>;
};

export const DEFAULT_BRIEF_TEAM: BriefTeamSettings = { enabled: false, team: "sales", configs: {} };

export function emptyTeamConfig(): BriefTeamConfig {
  return { pipelines: [], blocks: {}, customProperties: [], customSuggestions: [], ownerId: null, ownerName: null, ownerObject: null };
}

/** Config par défaut d'un bloc (première période passée cochée, seuil par défaut). */
export function defaultBlockConfig(def: BriefBlockDef): BriefBlockConfig {
  const periods = periodsFor(def);
  return {
    enabled: true,
    periods: periods.length > 0 ? [periods.includes("this_month") ? "this_month" : periods[0]] : [],
    ...(def.days ? { days: def.days.default } : {}),
    ...(def.forecast ? { dateProperty: null } : {}),
  };
}

/** Nombre de contenus actifs d'une config (suggestions natives + personnalisées). */
export function activeBlockCount(cfg: BriefTeamConfig | undefined): number {
  if (!cfg) return 0;
  return Object.values(cfg.blocks).filter((b) => b.enabled).length + cfg.customSuggestions.filter((s) => s.enabled).length;
}

// ── Normalisation (lecture localStorage / serveur) ──────────────────────────
const NAME_RE = /^[a-z0-9_]+$/i;

export function sanitizeBriefTeam(raw: unknown): BriefTeamSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BRIEF_TEAM, configs: {} };
  const r = raw as Record<string, unknown>;
  const configs: Partial<Record<BriefTeamId, BriefTeamConfig>> = {};
  const rc = (r.configs && typeof r.configs === "object" ? r.configs : {}) as Record<string, unknown>;
  for (const team of BRIEF_TEAMS.map((t) => t.id)) {
    const c = rc[team];
    if (!c || typeof c !== "object") continue;
    const cc = c as Record<string, unknown>;
    const defs = TEAM_BLOCKS[team];
    const blocks: Record<string, BriefBlockConfig> = {};
    const rb = (cc.blocks && typeof cc.blocks === "object" ? cc.blocks : {}) as Record<string, unknown>;
    for (const def of defs) {
      const b = rb[def.id];
      if (!b || typeof b !== "object") continue;
      const bb = b as Record<string, unknown>;
      const allowed = periodsFor(def);
      const periods = (Array.isArray(bb.periods) ? bb.periods : []).filter((p): p is BriefPeriod => isBriefPeriod(p) && allowed.includes(p));
      const days = typeof bb.days === "number" && Number.isFinite(bb.days) ? Math.min(365, Math.max(1, Math.round(bb.days))) : undefined;
      const dateProperty = typeof bb.dateProperty === "string" && NAME_RE.test(bb.dateProperty) ? bb.dateProperty.slice(0, 80) : null;
      blocks[def.id] = {
        enabled: bb.enabled !== false,
        periods,
        ...(def.days ? { days: days ?? def.days.default } : {}),
        ...(def.forecast ? { dateProperty } : {}),
        ...(def.ownerBreakdown && bb.byOwner === true ? { byOwner: true } : {}),
      };
    }
    const customProperties = (Array.isArray(cc.customProperties) ? cc.customProperties : [])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .filter((p) => typeof p.name === "string" && NAME_RE.test(p.name) && isBriefCrmObject(p.object))
      .slice(0, 12)
      .map((p) => {
        const cov = p.coverage as Record<string, unknown> | null | undefined;
        return {
          name: (p.name as string).slice(0, 80),
          label: typeof p.label === "string" && p.label.trim() ? p.label.slice(0, 120) : (p.name as string),
          object: p.object as BriefCrmObject,
          fieldType: typeof p.fieldType === "string" ? p.fieldType.slice(0, 40) : null,
          type: typeof p.type === "string" ? p.type.slice(0, 40) : null,
          role: BRIEF_PROPERTY_ROLES.includes(p.role as BriefPropertyRole) ? (p.role as BriefPropertyRole) : "tracking",
          coverage:
            cov && typeof cov.withValue === "number" && typeof cov.total === "number"
              ? { withValue: cov.withValue, total: cov.total }
              : null,
        } satisfies BriefCustomProperty;
      });
    const customSuggestions = (Array.isArray(cc.customSuggestions) ? cc.customSuggestions : [])
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .filter(
        (s) =>
          typeof s.id === "string" &&
          typeof s.label === "string" &&
          typeof s.property === "string" &&
          NAME_RE.test(s.property) &&
          isBriefCrmObject(s.object) &&
          ["date_window", "breakdown", "sum", "flag"].includes(s.kind as string),
      )
      .slice(0, 16)
      .map((s) => {
        const cov = s.coverage as Record<string, unknown> | null | undefined;
        return {
          id: (s.id as string).slice(0, 64),
          label: (s.label as string).slice(0, 160),
          object: s.object as BriefCrmObject,
          property: (s.property as string).slice(0, 80),
          propertyLabel: typeof s.propertyLabel === "string" ? s.propertyLabel.slice(0, 120) : (s.property as string),
          kind: s.kind as BriefSuggestionKind,
          enabled: s.enabled !== false,
          periods: (Array.isArray(s.periods) ? s.periods : []).filter(isBriefPeriod),
          coverage:
            cov && typeof cov.count === "number"
              ? { count: cov.count, total: typeof cov.total === "number" ? cov.total : null }
              : null,
        } satisfies BriefCustomSuggestion;
      });
    const ownerId = typeof cc.ownerId === "string" && cc.ownerId.trim() ? (cc.ownerId as string).slice(0, 64) : null;
    const ownerName = ownerId && typeof cc.ownerName === "string" && cc.ownerName.trim() ? (cc.ownerName as string).slice(0, 120) : null;
    const ownerObject = ownerId && isBriefCrmObject(cc.ownerObject) ? cc.ownerObject : (ownerId ? defaultOwnerObject(team) : null);
    configs[team] = {
      pipelines: (Array.isArray(cc.pipelines) ? cc.pipelines : []).filter((p): p is string => typeof p === "string").slice(0, 30),
      blocks,
      customProperties,
      customSuggestions,
      ownerId,
      ownerName,
      ownerObject,
    };
  }
  return {
    enabled: r.enabled === true,
    team: isBriefTeamId(r.team) ? r.team : "sales",
    configs,
  };
}
