import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  executeHubspotSequenceEnroll,
  executeHubspotCompanyUpdate,
  executeLinkCompany,
  executeHubspotCreateDeal,
  executeHubspotCreateContact,
  executeStripeSendInvoice,
  AUTOMATABLE_KEYS,
  type ActionPayload,
} from "@/lib/actions/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Boîte d'actions (Suivi → Actions) — human-in-the-loop, avec AUTOMATISATION
 * opt-in par famille : l'utilisateur peut décider qu'une famille d'actions
 * s'exécute désormais toute seule (lignes auto_action_<famille> dans
 * entity_resolution_config). Les fusions de doublons ne sont JAMAIS
 * automatisables (irréversibles).
 * GET  : détecte, exécute les familles automatisées, renvoie file + historique.
 * POST : décision utilisateur — { id, decision: "approve" | "reject" }.
 */


/** Exécution réelle d'une action dans l'outil — partagée POST / auto. */
async function executeByType(
  supabase: SupabaseClient,
  orgId: string,
  type: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const needsHubspot = ["hubspot_task", "hubspot_sequence_enroll", "hubspot_merge", "hubspot_company_update", "hubspot_create_deal", "hubspot_create_contact"];
  if (needsHubspot.includes(type)) {
    const token = await getHubSpotToken(supabase, orgId);
    if (!token) return { ok: false, detail: "HubSpot non connecté." };
    if (type === "hubspot_task") return executeHubspotTask(token, payload);
    if (type === "hubspot_sequence_enroll") return executeHubspotSequenceEnroll(token, payload);
    if (type === "hubspot_merge") return executeHubspotMerge(token, payload);
    if (type === "hubspot_company_update") return executeHubspotCompanyUpdate(token, payload);
    if (type === "hubspot_create_deal") return executeHubspotCreateDeal(token, payload);
    if (type === "hubspot_create_contact") return executeHubspotCreateContact(token, payload);
  }
  if (type === "link_company") return executeLinkCompany(supabase, orgId, payload);
  if (type === "stripe_send_invoice") return executeStripeSendInvoice(supabase, orgId, payload);
  return { ok: false, detail: `Type d'action inconnu : ${type}` };
}

/** Relance d'impayé exécutée → suivie dans « Cash récupéré » (ROI). */
async function trackInvoiceReminder(
  supabase: SupabaseClient,
  orgId: string,
  type: string,
  payload: ActionPayload,
  userId: string | null,
) {
  if (!payload.invoiceId) return;
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, amount_due")
    .eq("organization_id", orgId)
    .eq("id", payload.invoiceId)
    .maybeSingle();
  if (!inv) return;
  await supabase.from("invoice_reminders").insert({
    organization_id: orgId,
    invoice_id: inv.id,
    amount_due_at_reminder: Number(inv.amount_due) || 0,
    channel: type === "stripe_send_invoice" ? "stripe" : "hubspot_task",
    created_by: userId,
  });
}

/** Familles automatisées par l'utilisateur (auto_action_* activées). */
async function getAutomatedKeys(supabase: SupabaseClient, orgId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("entity_resolution_config")
      .select("rule_id, enabled")
      .eq("organization_id", orgId)
      .like("rule_id", "auto_action_%");
    return new Set(
      ((data ?? []) as Array<{ rule_id: string; enabled: boolean }>)
        .filter((r) => r.enabled)
        .map((r) => r.rule_id.replace("auto_action_", ""))
        .filter((k) => (AUTOMATABLE_KEYS as readonly string[]).includes(k)),
    );
  } catch {
    return new Set();
  }
}

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
    const hubspotToken = await getHubSpotToken(supabase, orgId);
    // Licence HubSpot + séquence choisie (Paramètres → Intégrations) : avec
    // Sales Pro/Enterprise, la relance des deals silencieux devient un VRAI
    // email (inscription en séquence au nom de l'owner) au lieu d'une tâche.
    const { data: hsRow } = await supabase
      .from("integrations")
      .select("metadata")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot")
      .maybeSingle();
    const hsMeta = (hsRow?.metadata ?? {}) as { hubspot_license?: string; sequence_id?: string; sequence_name?: string };
    const sequence =
      (hsMeta.hubspot_license === "sales_pro" || hsMeta.hubspot_license === "sales_enterprise") && hsMeta.sequence_id
        ? { id: hsMeta.sequence_id, name: hsMeta.sequence_name ?? "séquence de relance" }
        : null;
    const run = <T,>(key: string, fn: () => Promise<T[]>): Promise<T[]> =>
      skip.has(key) ? Promise.resolve([]) : fn().catch(() => []);
    const detected = await Promise.all([
      run("silent_deal", () => detectSilentDeals(supabase, orgId, sequence)),
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

  // ── Automatisation opt-in : les familles que l'utilisateur a automatisées
  //    s'exécutent immédiatement (decided_by null = exécution automatique,
  //    badge « Auto » dans l'historique). Cap par passage pour rester réactif. ──
  const automated = await getAutomatedKeys(supabase, orgId);
  if (automated.size > 0 && !needsMigration) {
    try {
      const { data: autoPending } = await supabase
        .from("action_items")
        .select("id, type, source, payload")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .in("source", [...automated].map((k) => `detector:${k}`))
        .order("created_at", { ascending: true })
        .limit(10);
      for (const item of (autoPending ?? []) as Array<{ id: string; type: string; source: string; payload: ActionPayload | null }>) {
        const payload = (item.payload ?? {}) as ActionPayload;
        const outcome = await executeByType(supabase, orgId, item.type, payload);
        await supabase
          .from("action_items")
          .update({ status: outcome.ok ? "executed" : "failed", result: outcome, decided_at: new Date().toISOString(), decided_by: null })
          .eq("id", item.id)
          .eq("organization_id", orgId)
          .eq("status", "pending");
        if (outcome.ok) await trackInvoiceReminder(supabase, orgId, item.type, payload, null);
      }
    } catch {
      /* l'automatisation n'empêche jamais l'affichage de la boîte */
    }
  }

  const { data, error } = await supabase
    .from("action_items")
    // payload inclus : le panneau « Détail » de la fiche montre exactement ce
    // qui sera écrit dans l'outil avant validation.
    .select("id, type, status, title, description, source, created_at, decided_at, decided_by, result, payload")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    return NextResponse.json({ needsMigration: true, pending: [], history: [], automated: [] });
  }

  // Les actions des détecteurs masqués (catalogue) ne sont pas renvoyées.
  const rows = (data ?? [])
    .filter((r) => !skip.has(String(r.source ?? "").replace("detector:", "")))
    .map((r) => ({
      ...r,
      // Badge « Auto » : action décidée sans utilisateur (automatisation).
      auto: r.status !== "pending" && !r.decided_by,
    }));
  return NextResponse.json({
    needsMigration,
    pending: rows.filter((r) => r.status === "pending"),
    history: rows.filter((r) => r.status !== "pending").slice(0, 100),
    automated: [...automated],
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
  const outcome = await executeByType(supabase, orgId, item.type, payload);

  await supabase
    .from("action_items")
    .update({ status: outcome.ok ? "executed" : "failed", result: outcome, ...decided })
    .eq("id", item.id)
    .eq("organization_id", orgId);

  if (outcome.ok) await trackInvoiceReminder(supabase, orgId, item.type, payload, user.id);

  return NextResponse.json({ ok: outcome.ok, status: outcome.ok ? "executed" : "failed", detail: outcome.detail });
}
