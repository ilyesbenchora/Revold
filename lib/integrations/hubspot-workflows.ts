/**
 * Helper d'audit avancé des workflows HubSpot.
 *
 * 2 problèmes résolus par rapport à l'ancien code de la page Process :
 *
 *   1. Détection de l'objet (Contact / Company / Deal / Ticket) :
 *      L'API v3 /automation/v3/workflows ne renvoie PAS objectTypeId au
 *      top-level → tous les workflows legacy (la majorité) tombaient en
 *      "Autre". On utilise maintenant l'API v4 (/automation/v4/flows) qui
 *      renvoie objectTypeId, et pour les workflows v3-only on appelle le
 *      détail /automation/v3/workflows/{id} pour parser enrollmentCriteria.
 *
 *   2. Analyse des actions internes (réponse à "peut-on voir les actions
 *      à l'intérieur d'un workflow actif ?") : OUI. /automation/v4/flows/
 *      {flowId} renvoie le tableau `actions` complet avec actionType +
 *      fields. On agrège ici par catégorie : SET_PROPERTY, SEND_EMAIL,
 *      CREATE_TASK, WEBHOOK, BRANCH (if/then), DELAY, autre.
 */

const HS_API = "https://api.hubapi.com";

export type WorkflowObjectType = "contact" | "company" | "deal" | "ticket" | "lead" | "custom" | "unknown";

export type WorkflowSummary = {
  id: string;
  name: string;
  enabled: boolean;
  /** Source d'où vient l'info : v4 (objectTypeId direct), v3_detail (parsing
   *  enrollmentCriteria), v3_inferred (heuristique sur le type), unknown. */
  source: "v4" | "v3_detail" | "v3_inferred" | "unknown";
  objectType: WorkflowObjectType;
  /** v4 seulement : type technique du flow (DRIP, PROPERTY_ANCHOR, ...) */
  flowType?: string;
};

export type WorkflowActionStats = {
  totalActions: number;
  byCategory: {
    set_property: number;
    send_email: number;
    create_task: number;
    webhook: number;
    branch: number;
    delay: number;
    create_engagement: number;
    update_owner: number;
    other: number;
  };
  /** Liste des webhook URLs sortantes uniques (utile pour détecter Zapier,
   *  Make, n8n, Slack, etc. branchés en sortie de workflow). */
  outgoingWebhookHosts: string[];
};

export type WorkflowsAuditResult = {
  workflows: WorkflowSummary[];
  active: WorkflowSummary[];
  inactive: WorkflowSummary[];
  countsByObject: Record<WorkflowObjectType, number>;
  /** Stats agrégées sur les actions des workflows ACTIFS uniquement. */
  actionStats: WorkflowActionStats;
  /** Si null, l'audit a fonctionné. Sinon, raison de l'échec. */
  error?: string;
};

/** Mapping HubSpot objectTypeId standard → enum lisible. */
function mapObjectTypeId(id: string | null | undefined): WorkflowObjectType {
  if (!id) return "unknown";
  const s = String(id).toLowerCase();
  if (s === "0-1" || s.includes("contact")) return "contact";
  if (s === "0-2" || s.includes("compan")) return "company";
  if (s === "0-3" || s.includes("deal")) return "deal";
  if (s === "0-5" || s.includes("ticket")) return "ticket";
  if (s === "0-136" || s.includes("lead")) return "lead";
  if (s.startsWith("2-")) return "custom";
  return "unknown";
}

/**
 * Heuristique sur le `type` v3 quand on n'a pas le détail.
 *  - PROPERTY_ANCHOR, STATIC_ANCHOR, DRIP_DELAY → souvent contact
 *  - DEAL_BASED → deal
 *  - TICKET_BASED → ticket
 */
function inferFromV3Type(type: string | undefined): WorkflowObjectType {
  if (!type) return "unknown";
  const t = type.toUpperCase();
  if (t.includes("DEAL")) return "deal";
  if (t.includes("TICKET")) return "ticket";
  if (t.includes("COMPANY")) return "company";
  // La majorité des workflows v3 contact sont DRIP_DELAY, PROPERTY_ANCHOR,
  // STATIC_ANCHOR, EMAIL_ENGAGEMENT — tous contact-based historiquement.
  if (["DRIP_DELAY", "PROPERTY_ANCHOR", "STATIC_ANCHOR", "EMAIL_ENGAGEMENT"].includes(t)) return "contact";
  return "unknown";
}

/** Parse enrollmentCriteria du détail v3 pour deviner l'objet. */
function inferFromV3Detail(detail: Record<string, unknown>): WorkflowObjectType {
  const meta = (detail.metaData ?? {}) as Record<string, unknown>;
  const objectType = (detail.objectTypeId ?? meta.objectTypeId) as string | undefined;
  if (objectType) return mapObjectTypeId(objectType);

  // Heuristique sur les contactListIds / dealListIds présents
  if (meta.dealListIds && Array.isArray(meta.dealListIds) && (meta.dealListIds as unknown[]).length > 0) return "deal";
  if (meta.ticketListIds && Array.isArray(meta.ticketListIds) && (meta.ticketListIds as unknown[]).length > 0) return "ticket";
  if (meta.contactListIds && Array.isArray(meta.contactListIds) && (meta.contactListIds as unknown[]).length > 0) return "contact";

  return "unknown";
}

/** Catégorise une action HubSpot v4 (actionType) vers nos buckets. */
function categorizeAction(actionType: string): keyof WorkflowActionStats["byCategory"] {
  const t = actionType.toUpperCase();
  if (t.includes("SET_PROPERTY") || t.includes("UPDATE_PROPERTY")) return "set_property";
  if (t.includes("SEND_EMAIL") || t.includes("SEND_AUTOMATED_EMAIL") || t.includes("ONE_TO_ONE_EMAIL")) return "send_email";
  if (t.includes("CREATE_TASK")) return "create_task";
  if (t.includes("WEBHOOK") || t.includes("HTTP")) return "webhook";
  if (t.includes("BRANCH") || t.includes("IF_BRANCH")) return "branch";
  if (t.includes("DELAY") || t.includes("WAIT")) return "delay";
  if (t.includes("CREATE_ENGAGEMENT") || t.includes("CREATE_NOTE") || t.includes("LOG_CALL")) return "create_engagement";
  if (t.includes("OWNER") || t.includes("ROTATE")) return "update_owner";
  return "other";
}

function extractWebhookHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function auditHubSpotWorkflows(token: string): Promise<WorkflowsAuditResult> {
  const empty: WorkflowsAuditResult = {
    workflows: [],
    active: [],
    inactive: [],
    countsByObject: { contact: 0, company: 0, deal: 0, ticket: 0, lead: 0, custom: 0, unknown: 0 },
    actionStats: {
      totalActions: 0,
      byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 },
      outgoingWebhookHosts: [],
    },
  };

  // ── 1. Récupère v4 et v3 en parallèle ────────────────────────────────
  type V4Flow = { id: string | number; name?: string; isEnabled?: boolean; objectTypeId?: string; type?: string };
  type V3Wf = { id: string | number; name?: string; enabled?: boolean; type?: string };

  const [v4Res, v3Res] = await Promise.all([
    fetch(`${HS_API}/automation/v4/flows?limit=200`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    fetch(`${HS_API}/automation/v3/workflows`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
  ]);

  const v4: V4Flow[] = v4Res?.ok ? ((await v4Res.json()).results ?? []) : [];
  const v3: V3Wf[] = v3Res?.ok ? ((await v3Res.json()).workflows ?? []) : [];

  if (!v4Res?.ok && !v3Res?.ok) {
    return { ...empty, error: "Scope automation manquant ou aucun workflow accessible." };
  }

  const summaries = new Map<string, WorkflowSummary>();

  // v4 d'abord (objectTypeId fiable)
  for (const w of v4) {
    const id = String(w.id);
    summaries.set(id, {
      id,
      name: w.name || "Sans nom",
      enabled: w.isEnabled === true,
      objectType: mapObjectTypeId(w.objectTypeId),
      source: "v4",
      flowType: w.type,
    });
  }

  // v3 : tous ceux qui ne sont pas déjà dans v4
  const v3Only = v3.filter((w) => !summaries.has(String(w.id)));
  for (const w of v3Only) {
    summaries.set(String(w.id), {
      id: String(w.id),
      name: w.name || "Sans nom",
      enabled: w.enabled === true,
      objectType: inferFromV3Type(w.type),
      source: "v3_inferred",
      flowType: w.type,
    });
  }

  // ── 2. Pour les v3-only "unknown", on appelle le détail (max 30 pour
  //    rester < 60s sur Vercel) et on parse enrollmentCriteria.
  const needsDetail = v3Only.filter((w) => {
    const s = summaries.get(String(w.id));
    return s && s.objectType === "unknown";
  }).slice(0, 30);

  if (needsDetail.length > 0) {
    await Promise.all(
      needsDetail.map(async (w) => {
        try {
          const r = await fetch(`${HS_API}/automation/v3/workflows/${w.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) return;
          const detail = await r.json();
          const inferred = inferFromV3Detail(detail);
          const existing = summaries.get(String(w.id));
          if (existing && inferred !== "unknown") {
            summaries.set(String(w.id), { ...existing, objectType: inferred, source: "v3_detail" });
          }
        } catch {}
      }),
    );
  }

  // ── 3. Audit des actions sur les workflows ACTIFS de v4 (max 25) ─────
  const actionStats: WorkflowActionStats = {
    totalActions: 0,
    byCategory: { set_property: 0, send_email: 0, create_task: 0, webhook: 0, branch: 0, delay: 0, create_engagement: 0, update_owner: 0, other: 0 },
    outgoingWebhookHosts: [],
  };
  const webhookHosts = new Set<string>();

  const activeV4 = v4.filter((w) => w.isEnabled === true).slice(0, 25);
  await Promise.all(
    activeV4.map(async (w) => {
      try {
        const r = await fetch(`${HS_API}/automation/v4/flows/${w.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        const actions = (data.actions ?? []) as Array<{ actionTypeId?: string; actionType?: string; fields?: Record<string, unknown> }>;
        for (const a of actions) {
          actionStats.totalActions++;
          const t = a.actionTypeId || a.actionType || "";
          const cat = categorizeAction(t);
          actionStats.byCategory[cat]++;
          if (cat === "webhook") {
            const url = (a.fields?.webhookUrl ?? a.fields?.url ?? "") as string;
            const host = extractWebhookHost(url);
            if (host) webhookHosts.add(host);
          }
        }
      } catch {}
    }),
  );
  actionStats.outgoingWebhookHosts = [...webhookHosts].sort();

  // ── 4. Compteurs par objet ──────────────────────────────────────────
  const all = [...summaries.values()];
  const active = all.filter((w) => w.enabled);
  const inactive = all.filter((w) => !w.enabled);
  const countsByObject = empty.countsByObject;
  for (const w of active) {
    countsByObject[w.objectType]++;
  }

  return {
    workflows: all,
    active,
    inactive,
    countsByObject,
    actionStats,
  };
}
