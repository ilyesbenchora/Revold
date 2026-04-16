import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
