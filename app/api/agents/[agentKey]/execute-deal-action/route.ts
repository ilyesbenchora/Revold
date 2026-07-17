import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getAgent } from "@/lib/ai/agents/registry";
import type { DealActionProposal } from "@/lib/ai/agents/sales-actions";

export const maxDuration = 60;
const HS = "https://api.hubapi.com";

/**
 * Exécute une action pipeline proposée par un agent, APRÈS validation utilisateur
 * (human-in-the-loop). Écrit réellement dans HubSpot : création de tâches de
 * relance, mise à jour de la date de closing, ou dépôt d'un email de relance en
 * tâche. Chaque deal est traité indépendamment ; on renvoie le détail.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  if (!getAgent(agentKey)) return NextResponse.json({ error: `Agent inconnu: ${agentKey}` }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "HubSpot n'est pas connecté." }, { status: 400 });

  let action: DealActionProposal;
  try {
    action = (await request.json()) as DealActionProposal;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const deals = Array.isArray(action.deals) ? action.deals.slice(0, 50) : [];
  if (deals.length === 0) return NextResponse.json({ error: "Aucun deal ciblé." }, { status: 400 });

  const results: { id: string; name: string; ok: boolean; error?: string }[] = [];
  let scopeError = false;

  async function hs(path: string, method: string, body: unknown): Promise<{ ok: boolean; status: number; msg?: string }> {
    try {
      const res = await fetch(`${HS}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, status: res.status };
      if (res.status === 403) scopeError = true;
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        msg = j.message || msg;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, msg };
    } catch (e) {
      return { ok: false, status: 0, msg: e instanceof Error ? e.message : "réseau" };
    }
  }

  // Association tâche → deal (HUBSPOT_DEFINED typeId 216).
  const taskToDeal = [{ to: { id: "" }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 216 }] }];

  async function createTask(dealId: string, subject: string, bodyText: string, ownerId: string | null, dueMs: number) {
    const assoc = [{ to: { id: dealId }, types: taskToDeal[0].types }];
    const properties: Record<string, unknown> = {
      hs_task_subject: subject.slice(0, 250),
      hs_task_body: bodyText.slice(0, 5000),
      hs_task_status: "NOT_STARTED",
      hs_task_priority: "HIGH",
      hs_timestamp: String(dueMs),
    };
    if (ownerId) properties.hubspot_owner_id = ownerId;
    return hs("/crm/v3/objects/tasks", "POST", { properties, associations: assoc });
  }

  const dueMs = Date.now() + (action.dueInDays && action.dueInDays > 0 ? action.dueInDays : 2) * 86_400_000;

  for (const d of deals) {
    let r: { ok: boolean; msg?: string };
    if (action.kind === "update_closedate") {
      const dateStr = action.newCloseDate && /^\d{4}-\d{2}-\d{2}$/.test(action.newCloseDate) ? action.newCloseDate : null;
      if (!dateStr) {
        results.push({ id: d.id, name: d.name, ok: false, error: "Date de closing invalide" });
        continue;
      }
      const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
      r = await hs(`/crm/v3/objects/deals/${d.id}`, "PATCH", { properties: { closedate: String(ms) } });
    } else if (action.kind === "draft_emails") {
      const subject = `✉️ Relance : ${action.emailSubject || d.name}`;
      const body = action.emailBody || `Bonjour,\n\nJe reviens vers vous concernant ${d.name}.\n\nBien à vous.`;
      r = await createTask(d.id, subject, body, d.ownerId, dueMs);
    } else {
      // create_tasks (défaut)
      const subject = `${action.title} — ${d.name}`;
      const body = action.taskBody || `Relancer ${d.name} (deal sans activité récente).`;
      r = await createTask(d.id, subject, body, d.ownerId, dueMs);
    }
    results.push({ id: d.id, name: d.name, ok: r.ok, error: r.ok ? undefined : r.msg });
  }

  const done = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: done > 0,
    done,
    total: results.length,
    results,
    scopeError,
    hint: scopeError
      ? "HubSpot a refusé l'écriture (403). Scopes requis sur l'app OAuth : crm.objects.deals.write (dates de closing) et crm.objects.contacts.write (tâches/relances — il n'existe pas de scope « tasks » dédié). Ajoute-les puis reconnecte HubSpot."
      : undefined,
  });
}
