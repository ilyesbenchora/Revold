import type { AgentTool, AgentContext } from "./agent-runtime";

const HS = "https://api.hubapi.com";

/** Nom réservé du tool de proposition d'action pipeline (capturé, non exécuté). */
export const PROPOSE_DEAL_ACTIONS_TOOL = "propose_deal_actions";

/** Action pipeline proposée par l'agent, en attente de validation utilisateur. */
export type DealActionProposal = {
  kind: "create_tasks" | "update_closedate" | "draft_emails";
  title: string;
  rationale: string;
  deals: { id: string; name: string; amount: number | null; ownerId: string | null }[];
  dueInDays: number | null;
  taskBody: string | null;
  newCloseDate: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  estimatedImpact: string | null;
};

/**
 * Liste des deals OUVERTS actionnables (les moins récemment touchés en premier),
 * avec leur id HubSpot réel — indispensable pour proposer des actions ciblées
 * (relances, MAJ closing) sur des deals précis.
 */
export const listActionableDeals: AgentTool = {
  def: {
    name: "list_actionable_deals",
    description:
      "Liste des deals OUVERTS actionnables avec leur id HubSpot réel, nom, montant, propriétaire, étape, jours dans l'étape, jours depuis dernière activité, date de closing. Triés du plus « oublié » au plus récent. À appeler AVANT propose_deal_actions pour cibler des deals précis (relances, repousser closing).",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Nombre max de deals (défaut 20, max 50)." },
        minAmount: { type: "number", description: "Montant minimum par deal (optionnel)." },
      },
    },
  },
  run: async (input, ctx: AgentContext) => {
    if (!ctx.hubspotToken) return { hasData: false, note: "HubSpot n'est pas connecté sur cette org." };
    const token = ctx.hubspotToken;
    const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
    const minAmount = Number(input.minAmount) || 0;

    const filters: Record<string, unknown>[] = [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }];
    if (minAmount > 0) filters.push({ propertyName: "amount", operator: "GTE", value: String(minAmount) });

    try {
      const res = await fetch(`${HS}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters }],
          properties: [
            "dealname", "amount", "pipeline", "dealstage", "closedate",
            "hubspot_owner_id", "hs_lastmodifieddate", "notes_last_contacted",
            "hs_time_in_latest_deal_stage",
          ],
          // Du plus ancien "dernière modif" au plus récent → les plus oubliés d'abord.
          sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
          limit,
        }),
      });
      if (!res.ok) return { hasData: false, note: `HubSpot a refusé la lecture des deals (${res.status}).` };
      const data = await res.json();
      const now = Date.now();
      const deals = ((data.results ?? []) as Array<{ id: string; properties?: Record<string, string> }>).map((r) => {
        const p = r.properties ?? {};
        const msInStage = Number(p.hs_time_in_latest_deal_stage ?? 0);
        const lastAct = p.notes_last_contacted || p.hs_lastmodifieddate || null;
        const daysSinceActivity = lastAct ? Math.round((now - new Date(lastAct).getTime()) / 86_400_000) : null;
        return {
          id: r.id,
          name: p.dealname || `Deal ${r.id}`,
          amount: Number(p.amount) || null,
          ownerId: p.hubspot_owner_id || null,
          dealstage: p.dealstage || null,
          closedate: p.closedate || null,
          daysInStage: Math.round(msInStage / 86_400_000),
          daysSinceActivity,
        };
      });
      return { hasData: deals.length > 0, count: deals.length, deals };
    } catch (e) {
      return { hasData: false, note: `Erreur lecture deals: ${e instanceof Error ? e.message : "inconnue"}` };
    }
  },
};

/**
 * Propose une ACTION concrète à exécuter dans HubSpot sur des deals précis
 * (après validation). Capturé par le runtime (aucun `run`) → renvoyé à l'UI.
 */
export const proposeDealActionsTool: AgentTool = {
  def: {
    name: PROPOSE_DEAL_ACTIONS_TOOL,
    description:
      "Propose une ACTION à exécuter dans HubSpot sur des deals PRÉCIS, après validation de l'utilisateur (ne l'exécute jamais toi-même). kind = create_tasks (créer des tâches de relance assignées au propriétaire), update_closedate (repousser la date de closing), draft_emails (rédiger un email de relance déposé en tâche). Fournis TOUJOURS les deals ciblés (id réels obtenus via list_actionable_deals), un titre court, la justification chiffrée, et les paramètres selon kind. Utilise-le quand l'utilisateur veut AGIR (relancer, réactiver, sécuriser le closing), pas seulement analyser.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["create_tasks", "update_closedate", "draft_emails"] },
        title: { type: "string", description: "Libellé court de l'action (ex : « Relancer 4 deals stagnants »)." },
        rationale: { type: "string", description: "Justification chiffrée (pourquoi ces deals, quel enjeu en €)." },
        deals: {
          type: "array",
          description: "Deals ciblés (id HubSpot réels).",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              amount: { type: "number" },
              ownerId: { type: "string" },
            },
            required: ["id", "name"],
          },
        },
        dueInDays: { type: "integer", description: "create_tasks : échéance de la tâche en jours (défaut 2)." },
        taskBody: { type: "string", description: "create_tasks : contenu de la tâche/relance (template)." },
        newCloseDate: { type: "string", description: "update_closedate : nouvelle date de closing (YYYY-MM-DD)." },
        emailSubject: { type: "string", description: "draft_emails : objet de l'email." },
        emailBody: { type: "string", description: "draft_emails : corps de l'email de relance." },
        estimatedImpact: { type: "string", description: "Impact estimé (ex : « ~120 k€ de pipeline réactivé »)." },
      },
      required: ["kind", "title", "deals"],
    },
  },
  // Pas de run → capturé comme action confirmable.
};

/** Normalise l'input du tool en proposition typée. */
export function normalizeDealAction(input: Record<string, unknown>): DealActionProposal | null {
  const kinds = new Set(["create_tasks", "update_closedate", "draft_emails"]);
  const kind = String(input.kind ?? "");
  if (!kinds.has(kind)) return null;
  const rawDeals = Array.isArray(input.deals) ? input.deals : [];
  const deals = rawDeals
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof d.id === "string")
    .map((d) => ({
      id: String(d.id),
      name: String(d.name ?? `Deal ${d.id}`),
      amount: typeof d.amount === "number" ? d.amount : Number(d.amount) || null,
      ownerId: d.ownerId != null ? String(d.ownerId) : null,
    }))
    .slice(0, 50);
  if (deals.length === 0) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    kind: kind as DealActionProposal["kind"],
    title: str(input.title) ?? "Action pipeline",
    rationale: str(input.rationale) ?? "",
    deals,
    dueInDays: typeof input.dueInDays === "number" ? input.dueInDays : null,
    taskBody: str(input.taskBody),
    newCloseDate: str(input.newCloseDate),
    emailSubject: str(input.emailSubject),
    emailBody: str(input.emailBody),
    estimatedImpact: str(input.estimatedImpact),
  };
}
