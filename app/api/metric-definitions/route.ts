import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isValidMetricUnit } from "@/lib/settings/metric-definitions";

export const dynamic = "force-dynamic";

/**
 * Dictionnaire des métriques de l'org (Paramètres → Métriques) :
 *  - GET             → { metrics }
 *  - POST { label, definition, unit? }            → crée → { metric }
 *  - PATCH { id, label?, definition?, unit? }     → modifie → { metric }
 *  - DELETE { id }   → supprime
 */

const MAX_METRICS = 40;

async function authed() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) } as const;
  return { supabase, user, orgId } as const;
}

const migrationError = (msg: string) =>
  /metric_definitions/.test(msg)
    ? "Migration 20260819000004_metric_definitions non appliquée (table absente)."
    : msg;

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;
  try {
    const { data, error } = await a.supabase
      .from("metric_definitions")
      .select("id, label, definition, unit")
      .eq("organization_id", a.orgId)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ metrics: [], unavailable: true });
    return NextResponse.json({ metrics: data ?? [] });
  } catch {
    return NextResponse.json({ metrics: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { label?: string; definition?: string; unit?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  const definition = typeof body.definition === "string" ? body.definition.trim().slice(0, 600) : "";
  if (!label || !definition) return NextResponse.json({ error: "label et definition requis" }, { status: 400 });

  const { count } = await a.supabase
    .from("metric_definitions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", a.orgId);
  if ((count ?? 0) >= MAX_METRICS) {
    return NextResponse.json({ error: `Maximum ${MAX_METRICS} métriques — supprime-en une d'abord.` }, { status: 400 });
  }

  const { data, error } = await a.supabase
    .from("metric_definitions")
    .insert({
      organization_id: a.orgId,
      label,
      definition,
      unit: isValidMetricUnit(body.unit) ? body.unit : null,
      created_by: a.user.id,
    })
    .select("id, label, definition, unit")
    .single();
  if (error) return NextResponse.json({ error: migrationError(error.message) }, { status: 500 });
  return NextResponse.json({ metric: data });
}

export async function PATCH(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { id?: string; label?: string; definition?: string; unit?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.id || typeof body.id !== "string") return NextResponse.json({ error: "id requis" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.label === "string" && body.label.trim()) update.label = body.label.trim().slice(0, 80);
  if (typeof body.definition === "string" && body.definition.trim()) update.definition = body.definition.trim().slice(0, 600);
  if (body.unit === null || isValidMetricUnit(body.unit)) update.unit = body.unit;

  const { data, error } = await a.supabase
    .from("metric_definitions")
    .update(update)
    .eq("organization_id", a.orgId)
    .eq("id", body.id)
    .select("id, label, definition, unit")
    .maybeSingle();
  if (error) return NextResponse.json({ error: migrationError(error.message) }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Métrique introuvable" }, { status: 404 });
  return NextResponse.json({ metric: data });
}

export async function DELETE(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.id || typeof body.id !== "string") return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await a.supabase
    .from("metric_definitions")
    .delete()
    .eq("organization_id", a.orgId)
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: migrationError(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
