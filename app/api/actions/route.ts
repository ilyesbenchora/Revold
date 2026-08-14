import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import {
  detectSilentDeals,
  detectOverdueInvoiceActions,
  executeHubspotTask,
  executeStripeSendInvoice,
  type ActionPayload,
} from "@/lib/actions/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Boîte d'actions (Suivi → Actions) — human-in-the-loop.
 * GET  : lance les détecteurs (nouvelles actions en attente, dédupliquées) et
 *        renvoie la file + l'historique.
 * POST : décision utilisateur — { id, decision: "approve" | "reject" }.
 *        approve = EXÉCUTION réelle dans l'outil (tâche HubSpot, rappel
 *        Stripe), résultat tracé ; une relance de facture approuvée alimente
 *        aussi « Cash récupéré » (invoice_reminders).
 */

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // ── Détection (best-effort) : upsert dédupliqué, jamais bloquant ──
  let needsMigration = false;
  try {
    const [silent, overdue] = await Promise.all([
      detectSilentDeals(supabase, orgId),
      detectOverdueInvoiceActions(supabase, orgId),
    ]);
    const candidates = [...overdue, ...silent].map((c) => ({
      organization_id: orgId,
      type: c.type,
      title: c.title,
      description: c.description,
      source: c.source,
      dedupe_key: c.dedupe_key,
      payload: c.payload,
    }));
    if (candidates.length > 0) {
      const { error } = await supabase
        .from("action_items")
        .upsert(candidates, { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true });
      if (error) needsMigration = true;
    }
  } catch {
    /* détecteurs jamais bloquants */
  }

  const { data, error } = await supabase
    .from("action_items")
    .select("id, type, status, title, description, source, created_at, decided_at, result")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ needsMigration: true, pending: [], history: [] });
  }

  const rows = data ?? [];
  return NextResponse.json({
    needsMigration,
    pending: rows.filter((r) => r.status === "pending"),
    history: rows.filter((r) => r.status !== "pending").slice(0, 30),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { id?: string; decision?: "approve" | "reject" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (!body.id || (body.decision !== "approve" && body.decision !== "reject")) {
    return NextResponse.json({ error: "id et decision (approve | reject) requis" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("action_items")
    .select("id, type, status, payload, source")
    .eq("organization_id", orgId)
    .eq("id", body.id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  if (item.status !== "pending") return NextResponse.json({ error: "Action déjà traitée" }, { status: 409 });

  const decided = { decided_at: new Date().toISOString(), decided_by: user.id };

  if (body.decision === "reject") {
    await supabase.from("action_items").update({ status: "rejected", ...decided }).eq("id", item.id).eq("organization_id", orgId);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // ── Exécution réelle dans l'outil ──
  const payload = (item.payload ?? {}) as ActionPayload;
  let outcome: { ok: boolean; detail: string };
  if (item.type === "hubspot_task") {
    const token = await getHubSpotToken(supabase, orgId);
    outcome = token
      ? await executeHubspotTask(token, payload)
      : { ok: false, detail: "HubSpot non connecté." };
  } else if (item.type === "stripe_send_invoice") {
    outcome = await executeStripeSendInvoice(supabase, orgId, payload);
  } else {
    outcome = { ok: false, detail: `Type d'action inconnu : ${item.type}` };
  }

  await supabase
    .from("action_items")
    .update({ status: outcome.ok ? "executed" : "failed", result: outcome, ...decided })
    .eq("id", item.id)
    .eq("organization_id", orgId);

  // Relance de facture exécutée → suivie dans « Cash récupéré » (ROI).
  if (outcome.ok && payload.invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, amount_due")
      .eq("organization_id", orgId)
      .eq("id", payload.invoiceId)
      .maybeSingle();
    if (inv) {
      await supabase.from("invoice_reminders").insert({
        organization_id: orgId,
        invoice_id: inv.id,
        amount_due_at_reminder: Number(inv.amount_due) || 0,
        channel: item.type === "stripe_send_invoice" ? "stripe" : "hubspot_task",
        created_by: user.id,
      });
    }
  }

  return NextResponse.json({ ok: outcome.ok, status: outcome.ok ? "executed" : "failed", detail: outcome.detail });
}
