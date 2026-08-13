import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInAppNotification } from "@/lib/notifications/in-app";

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ notifications: [] }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, alert_id, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  const unreadCount = (data ?? []).filter((n) => !n.read).length;

  return NextResponse.json(
    { notifications: data ?? [], unreadCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Création d'une notification in-app par le client. Volontairement restreint
 * aux exécutions de routines programmées (les routines tournent côté client :
 * l'insertion ne peut pas venir d'un cron serveur).
 */
export async function POST(request: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, title, body, link } = (await request.json()) as {
    type?: string;
    title?: string;
    body?: string;
    link?: string;
  };
  if (type !== "routine_executed") {
    return NextResponse.json({ error: "Type de notification non autorisé" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre manquant" }, { status: 400 });
  }

  await createInAppNotification({
    orgId,
    userId: user.id,
    type,
    title: title.trim().slice(0, 200),
    body: typeof body === "string" && body.trim() ? body.trim().slice(0, 500) : null,
    link: typeof link === "string" && link.startsWith("/") ? link : null,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, markAllRead } = body;

  if (markAllRead) {
    const orgId = await getOrgId();
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("organization_id", orgId)
      .eq("read", false);
    return NextResponse.json({ success: true });
  }

  if (id) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Missing id or markAllRead" }, { status: 400 });
}
