import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { logAudit } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * Sécurité du compte : changement de mot de passe et déconnexion des autres
 * appareils — pour l'utilisateur CONNECTÉ (session cookie), tous rôles.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();

  let body: { action?: string; password?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  if (body.action === "change_password") {
    const password = (body.password ?? "").trim();
    if (password.length < 8) {
      return NextResponse.json({ error: "8 caractères minimum" }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_changed_at: new Date().toISOString() },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (orgId) void logAudit(supabase, { orgId, actorId: user.id, action: "password.changed" });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "signout_others") {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (orgId) void logAudit(supabase, { orgId, actorId: user.id, action: "sessions.revoked_others" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
