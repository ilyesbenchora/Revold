import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getAgent } from "@/lib/ai/agents/registry";
import type { DealActionProposal } from "@/lib/ai/agents/sales-actions";

export const dynamic = "force-dynamic";

/**
 * « Plus tard » : une action proposée par un agent (chat) est mise en FILE
 * dans Suivi → Actions au lieu d'être exécutée tout de suite. Elle y attend la
 * même validation que les actions des détecteurs — un seul endroit pour tout
 * ce qui doit être exécuté dans les outils.
 *
 * Une ligne par deal ciblé : l'utilisateur peut ensuite valider ou refuser
 * deal par deal, et l'automatisation par entité s'applique de la même façon.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { agentKey?: string; action?: DealActionProposal };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const agentKey = String(body.agentKey ?? "");
  const agent = getAgent(agentKey);
  if (!agent) return NextResponse.json({ error: `Agent inconnu : ${agentKey}` }, { status: 404 });

  const action = body.action;
  const deals = Array.isArray(action?.deals) ? action.deals.slice(0, 50) : [];
  if (!action || deals.length === 0) return NextResponse.json({ error: "Aucun deal ciblé." }, { status: 400 });

  if (action.kind === "update_closedate" && !/^\d{4}-\d{2}-\d{2}$/.test(String(action.newCloseDate ?? ""))) {
    return NextResponse.json({ error: "Date de closing invalide." }, { status: 400 });
  }

  // Clé de déduplication stable : re-planifier la même action sur les mêmes
  // deals le même jour ne crée pas de doublon dans la file.
  const day = new Date().toISOString().slice(0, 10);
  const rows = deals.map((d) => {
    const isCloseDate = action.kind === "update_closedate";
    const subject = isCloseDate
      ? `${action.title} — ${d.name}`
      : action.kind === "draft_emails"
        ? `✉️ Relance : ${action.emailSubject || d.name}`
        : `${action.title} — ${d.name}`;
    const bodyText = isCloseDate
      ? action.rationale || ""
      : action.kind === "draft_emails"
        ? action.emailBody || `Bonjour,\n\nJe reviens vers vous concernant ${d.name}.\n\nBien à vous.`
        : action.taskBody || `Relancer ${d.name}.`;
    return {
      organization_id: orgId,
      type: isCloseDate ? "hubspot_deal_update" : "hubspot_task",
      title: subject.slice(0, 200),
      description: [action.rationale, action.estimatedImpact].filter(Boolean).join(" · ").slice(0, 500) || null,
      source: `agent:${agentKey}`,
      dedupe_key: `agent:${agentKey}:${action.kind}:${d.id}:${day}`,
      payload: {
        subject: subject.slice(0, 250),
        body: bodyText.slice(0, 5000),
        dealHubspotId: d.id,
        ...(isCloseDate ? { dealCloseDate: action.newCloseDate } : {}),
      },
    };
  });

  const { error } = await supabase
    .from("action_items")
    .upsert(rows, { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true });
  if (error) {
    return NextResponse.json(
      { error: "File d'actions indisponible — applique la migration action_items.", needsMigration: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, queued: rows.length });
}
