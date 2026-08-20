import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getCurrentRole, logAudit } from "@/lib/auth/rbac";
import { generateApiKey } from "@/lib/api/keys";

export const dynamic = "force-dynamic";

/** Contexte commun : utilisateur admin + org. */
async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) } as const;
  const role = await getCurrentRole(supabase, user.id);
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Réservé aux admins." }, { status: 403 }) } as const;
  }
  return { supabase, user, orgId } as const;
}

/** Liste les clés (jamais la clé complète : préfixe seulement). */
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { data, error } = await ctx.supabase
    .from("api_keys")
    .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (/api_keys/.test(error.message)) return NextResponse.json({ keys: [], migrationMissing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ keys: data ?? [] });
}

/** Crée une clé — la valeur complète n'est renvoyée qu'UNE fois, ici. */
export async function POST(request: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  let body: { label?: string };
  try { body = await request.json(); } catch { body = {}; }
  const label = (body.label ?? "").trim().slice(0, 80) || "Clé API";

  const { key, prefix, hash } = generateApiKey();
  const { error } = await ctx.supabase.from("api_keys").insert({
    organization_id: ctx.orgId,
    created_by: ctx.user.id,
    label,
    key_prefix: prefix,
    key_hash: hash,
  });
  if (error) {
    if (/api_keys/.test(error.message)) {
      return NextResponse.json({ error: "Migration 20260820000020_api_keys_webhooks non appliquée." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  void logAudit(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, action: "api_key.created", metadata: { label } });
  return NextResponse.json({ key, prefix, label });
}

/** Révoque une clé (id en query). */
export async function DELETE(request: Request) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await ctx.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void logAudit(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, action: "api_key.revoked", targetId: id });
  return NextResponse.json({ ok: true });
}
