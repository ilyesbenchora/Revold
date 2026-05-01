/**
 * POST /api/team/invite — créer une invitation
 * Body: { email: string, role: "admin" | "manager" | "rep" }
 *
 * Le user connecté doit être admin ou manager. Un manager ne peut inviter que
 * des reps. La table invitations stocke un token unique ; un email transactionnel
 * est envoyé via la table notification_channels (Resend) si configurée.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  generateInvitationToken,
  getCurrentRole,
  logAudit,
  roleAtLeast,
  type Role,
} from "@/lib/auth/rbac";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const userClient = await createSupabaseServerClient();
  const { data: auth } = await userClient.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const supabase = adminClient();
  const callerRole = await getCurrentRole(supabase, userId);
  if (!callerRole || !roleAtLeast(callerRole, "manager")) {
    return NextResponse.json({ error: "rôle insuffisant" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: Role;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role ?? "rep";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email invalide" }, { status: 400 });
  }
  if (!["admin", "manager", "rep"].includes(role)) {
    return NextResponse.json({ error: "rôle invalide" }, { status: 400 });
  }

  // Un manager ne peut inviter que des reps
  if (callerRole === "manager" && role !== "rep") {
    return NextResponse.json(
      { error: "Un manager ne peut inviter que des reps." },
      { status: 403 },
    );
  }

  const token = generateInvitationToken();

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: orgId,
      email,
      role,
      token,
      invited_by: userId,
    })
    .select("id, token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Une invitation est déjà en attente pour cet email." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(supabase, {
    orgId,
    actorId: userId,
    action: "member.invited",
    targetType: "email",
    targetId: email,
    metadata: { role },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io";
  const acceptUrl = `${baseUrl}/auth/invitation?token=${token}`;

  // TODO 8.4 hook : envoyer l'email via le canal email configuré pour l'org
  // Pour l'instant on retourne le lien pour copier-coller.

  return NextResponse.json({
    id: invitation.id,
    acceptUrl,
    email,
    role,
  });
}
