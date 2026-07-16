import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { updateAlertResilient } from "@/lib/alerts/resilient";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** PATCH /api/alerts/[id] — modifie une alerte existante (RLS org-scoped). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    title?: string;
    description?: string;
    impact?: string;
    threshold?: number | null;
    unit_mode?: string;
    date_from?: string | null;
    date_to?: string | null;
    notification_channels?: string[];
    cross_sources?: string[] | null;
    threshold_secondary?: number | null;
    unit_mode_secondary?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.slice(0, 200);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if (typeof body.impact === "string") patch.impact = body.impact.slice(0, 2000);
  if (body.threshold === null || typeof body.threshold === "number") patch.threshold = body.threshold;
  if (body.unit_mode === "percent" || body.unit_mode === "count" || body.unit_mode === "currency") patch.unit_mode = body.unit_mode;
  if (body.date_from === null || (typeof body.date_from === "string" && dateRe.test(body.date_from))) patch.date_from = body.date_from;
  if (body.date_to === null || (typeof body.date_to === "string" && dateRe.test(body.date_to))) patch.date_to = body.date_to;
  if (Array.isArray(body.notification_channels)) {
    patch.notification_channels = body.notification_channels.filter((c) => typeof c === "string").slice(0, 8);
  }
  if (body.cross_sources === null || Array.isArray(body.cross_sources)) {
    patch.cross_sources = Array.isArray(body.cross_sources)
      ? body.cross_sources.filter((s) => typeof s === "string").slice(0, 12)
      : null;
  }
  if (body.threshold_secondary === null || typeof body.threshold_secondary === "number") {
    patch.threshold_secondary = body.threshold_secondary;
  }
  if (
    body.unit_mode_secondary === "percent" ||
    body.unit_mode_secondary === "count" ||
    body.unit_mode_secondary === "currency" ||
    body.unit_mode_secondary === null
  ) {
    patch.unit_mode_secondary = body.unit_mode_secondary;
  }

  const { error } = await updateAlertResilient(supabase, patch, { id, organization_id: orgId });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/alerts/[id] — supprime une alerte. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase.from("alerts").delete().eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
