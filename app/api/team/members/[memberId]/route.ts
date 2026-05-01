/**
 * PATCH /api/team/members/[memberId] — change le rôle d'un membre
 * Body: { role: "admin" | "manager" | "rep" }
 *
 * DELETE /api/team/members/[memberId] — supprime un membre de l'org
 *
 * Réservé aux admins. Impossible de retirer son propre rôle admin si on est
 * le dernier admin (évite de bloquer l'org).
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getCurrentRole, logAudit, type Role } from "@/lib/auth/rbac";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function callerOrFail() {
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "non authentifié" }, { status: 401 }) };

  const userClient = await createSupabaseServerClient();
  const { data: auth } = await userClient.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "non authentifié" }, { status: 401 }) };

  const supabase = adminClient();
  const role = await getCurrentRole(supabase, userId);
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "admin requis" }, { status: 403 }) };
  }
  return { orgId, userId, supabase };
}

async function ensureNotLastAdmin(
  supabase: ReturnType<typeof adminClient>,
  orgId: string,
  memberId: string,
): Promise<boolean> {
  // Si on dégrade ou supprime le dernier admin, refus.
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .neq("id", memberId);
  return (count ?? 0) > 0;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const c = await callerOrFail();
  if ("error" in c) return c.error;
  const { orgId, userId, supabase } = c;
  const { memberId } = await context.params;

  const { role } = (await req.json().catch(() => ({}))) as { role?: Role };
  if (!role || !["admin", "manager", "rep"].includes(role)) {
    return NextResponse.json({ error: "rôle invalide" }, { status: 400 });
  }

  // Vérifie que le membre appartient bien à la même org
  const { data: target } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", memberId)
    .maybeSingle();
  if (!target || target.organization_id !== orgId) {
    return NextResponse.json({ error: "membre introuvable" }, { status: 404 });
  }

  if (target.role === "admin" && role !== "admin") {
    const ok = await ensureNotLastAdmin(supabase, orgId, memberId);
    if (!ok) {
      return NextResponse.json(
        { error: "Impossible de dégrader le dernier admin." },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    orgId,
    actorId: userId,
    action: "member.role_changed",
    targetType: "profile",
    targetId: memberId,
    metadata: { from: target.role, to: role },
  });

  return NextResponse.json({ ok: true, role });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  const c = await callerOrFail();
  if ("error" in c) return c.error;
  const { orgId, userId, supabase } = c;
  const { memberId } = await context.params;

  if (memberId === userId) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous supprimer." }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", memberId)
    .maybeSingle();
  if (!target || target.organization_id !== orgId) {
    return NextResponse.json({ error: "membre introuvable" }, { status: 404 });
  }

  if (target.role === "admin") {
    const ok = await ensureNotLastAdmin(supabase, orgId, memberId);
    if (!ok) {
      return NextResponse.json(
        { error: "Impossible de supprimer le dernier admin." },
        { status: 400 },
      );
    }
  }

  // On supprime le profile (CASCADE depuis auth.users : non automatique ici, mais on garde le auth.user pour audit)
  const { error } = await supabase.from("profiles").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, {
    orgId,
    actorId: userId,
    action: "member.removed",
    targetType: "profile",
    targetId: memberId,
  });

  return NextResponse.json({ ok: true });
}
