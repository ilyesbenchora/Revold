import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getCurrentRole, logAudit } from "@/lib/auth/rbac";
import type { WebhookEvent } from "@/lib/webhooks/dispatch";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS: WebhookEvent[] = ["alert.created", "sync.completed", "sync.failed", "objective.reached"];

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) } as const;
  const role = await getCurrentRole(supabase, user.id);
  if (role !== "admin") return { error: NextResponse.json({ error: "Réservé aux admins." }, { status: 403 }) } as const;
  return { supabase, user, orgId } as const;
}

export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { data, error } = await ctx.supabase
    .from("webhooks")
    .select("id, url, events, is_active, created_at, last_delivery_at, last_status")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (/webhooks/.test(error.message)) return NextResponse.json({ webhooks: [], migrationMissing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ webhooks: data ?? [] });
}

/** Crée un webhook (body: url, events[]) — secret HMAC renvoyé UNE fois. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  let body: { url?: string; events?: string[]; test?: string };
  try { body = await request.json(); } catch { body = {}; }

  // Action « tester » : envoie un événement test.ping au webhook ciblé.
  if (body.test) {
    const { data: hook } = await ctx.supabase
      .from("webhooks").select("id").eq("organization_id", ctx.orgId).eq("id", body.test).maybeSingle();
    if (!hook) return NextResponse.json({ error: "Webhook introuvable" }, { status: 404 });
    // test.ping ne filtre pas sur l'abonnement : envoi ciblé direct.
    await dispatchTestPing(ctx.supabase, ctx.orgId, body.test);
    return NextResponse.json({ ok: true });
  }

  const url = (body.url ?? "").trim();
  const events = (Array.isArray(body.events) ? body.events : []).filter((e): e is WebhookEvent =>
    (ALLOWED_EVENTS as string[]).includes(e),
  );
  if (!/^https:\/\/.+/.test(url)) return NextResponse.json({ error: "URL HTTPS requise" }, { status: 400 });
  if (events.length === 0) return NextResponse.json({ error: "Choisis au moins un événement" }, { status: 400 });

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const { error } = await ctx.supabase.from("webhooks").insert({
    organization_id: ctx.orgId,
    created_by: ctx.user.id,
    url,
    events,
    secret,
  });
  if (error) {
    if (/webhooks/.test(error.message)) {
      return NextResponse.json({ error: "Migration 20260820000020_api_keys_webhooks non appliquée." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  void logAudit(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, action: "webhook.created", metadata: { url } });
  return NextResponse.json({ ok: true, secret });
}

export async function DELETE(request: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await ctx.supabase.from("webhooks").delete().eq("organization_id", ctx.orgId).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void logAudit(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, action: "webhook.deleted", targetId: id });
  return NextResponse.json({ ok: true });
}

/** Envoi direct d'un test.ping à UN webhook (sans filtre d'abonnement). */
async function dispatchTestPing(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  hookId: string,
) {
  const { data: h } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("organization_id", orgId)
    .eq("id", hookId)
    .maybeSingle();
  if (!h) return;
  const { signWebhookPayload } = await import("@/lib/api/keys");
  const body = JSON.stringify({
    event: "test.ping",
    organization_id: orgId,
    created_at: new Date().toISOString(),
    data: { message: "Webhook Revold opérationnel 🎉" },
  });
  let status = 0;
  try {
    const res = await fetch(h.url as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revold-event": "test.ping",
        "x-revold-signature": signWebhookPayload(h.secret as string, body),
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
  } catch {
    status = -1;
  }
  await supabase
    .from("webhooks")
    .update({ last_delivery_at: new Date().toISOString(), last_status: status })
    .eq("id", h.id);
}
