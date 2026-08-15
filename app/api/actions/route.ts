import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import {
  detectSilentDeals,
  detectOverdueInvoiceActions,
  detectMergeCandidates,
  detectCrmIdentifierEnrich,
  detectUnlinkedCompanies,
  detectMissingRenewalDeals,
  detectRevenueLeakage,
  detectMissingBillingContacts,
  executeHubspotTask,
  executeHubspotMerge,
  executeHubspotCompanyUpdate,
  executeLinkCompany,
  executeHubspotCreateDeal,
  executeHubspotCreateContact,
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

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Catalogue des actions : détecteurs masqués par l'utilisateur (?skip=a,b)
  // — non exécutés (perf) et leurs actions ne sont pas renvoyées.
  const skip = new Set(
    (new URL(request.url).searchParams.get("skip") ?? "").split(",").filter(Boolean),
  );

  // ── Détection (best-effort) : upsert dédupliqué, jamais bloquant ──
  let needsMigration = false;
  try {
    const { getHubSpotToken: getToken } = await import("@/lib/integrations/get-hubspot-token");
    const hubspotToken = await getToken(supabase, orgId);
    const run = <T,>(key: string, fn: () => Promise<T[]>): Promise<T[]> =>
      skip.has(key) ? Promise.resolve([]) : fn().catch(() => []);
    const detected = await Promise.all([
      run("silent_deal", () => detectSilentDeals(supabase, orgId)),
      run("overdue_invoice", () => detectOverdueInvoiceActions(supabase, orgId)),
      run("duplicate_merge", () => detectMergeCandidates(supabase, orgId)),
      run("crm_enrich", () => detectCrmIdentifierEnrich(supabase, orgId, hubspotToken)),
      run("link_company", () => detectUnlinkedCompanies(supabase, orgId)),
      run("renewal_deal", () => detectMissingRenewalDeals(supabase, orgId)),
      run("revenue_leakage", () => detectRevenueLeakage(supabase, orgId)),
      run("billing_contact", () => detectMissingBillingContacts(supabase, orgId)),
    ]);
    const candidates = detected.flat().map((c) => ({
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
    // payload inclus : le panneau « Détail » de la fiche montre exactement ce
    // qui sera écrit dans l'outil avant validation.
    .select("id, type, status, title, description, source, created_at, decided_at, result, payload")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    return NextResponse.json({ needsMigration: true, pending: [], history: [] });
  }

  // Les actions des détecteurs masqués (catalogue) ne sont pas renvoyées.
  const rows = (data ?? []).filter((r) => !skip.has(String(r.source ?? "").replace("detector:", "")));
  return NextResponse.json({
    needsMigration,
    pending: rows.filter((r) => r.status === "pending"),
    history: rows.filter((r) => r.status !== "pending").slice(0, 100),
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
  } else if (item.type === "hubspot_merge") {
    const token = await getHubSpotToken(supabase, orgId);
    outcome = token
      ? await executeHubspotMerge(token, payload)
      : { ok: false, detail: "HubSpot non connecté." };
  } else if (item.type === "hubspot_company_update") {
    const token = await getHubSpotToken(supabase, orgId);
    outcome = token
      ? await executeHubspotCompanyUpdate(token, payload)
      : { ok: false, detail: "HubSpot non connecté." };
  } else if (item.type === "link_company") {
    outcome = await executeLinkCompany(supabase, orgId, payload);
  } else if (item.type === "hubspot_create_deal") {
    const token = await getHubSpotToken(supabase, orgId);
    outcome = token
      ? await executeHubspotCreateDeal(token, payload)
      : { ok: false, detail: "HubSpot non connecté." };
  } else if (item.type === "hubspot_create_contact") {
    const token = await getHubSpotToken(supabase, orgId);
    outcome = token
      ? await executeHubspotCreateContact(token, payload)
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
