import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createInAppNotification } from "@/lib/notifications/in-app";

export const dynamic = "force-dynamic";

/**
 * Demande de suppression RGPD (Paramètres → Sécurité) :
 * POST   : enregistre la demande (une seule en attente par org) + notification.
 * DELETE : annule la demande en attente.
 * La suppression effective est opérée sous 30 jours (traçée dans data_requests).
 */

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data: existing, error: readError } = await supabase
    .from("data_requests")
    .select("id")
    .eq("organization_id", orgId)
    .eq("kind", "deletion")
    .eq("status", "pending")
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Table data_requests absente — applique la migration." }, { status: 500 });
  }
  if (existing) return NextResponse.json({ ok: true, alreadyPending: true });

  const { error } = await supabase.from("data_requests").insert({
    organization_id: orgId,
    kind: "deletion",
    requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });

  await createInAppNotification({
    orgId,
    userId: user.id,
    type: "manual",
    title: "Demande de suppression des données enregistrée",
    body: "Vos données seront supprimées sous 30 jours. Vous pouvez annuler la demande depuis Paramètres → Sécurité.",
    link: "/dashboard/parametres/securite-api",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { error } = await supabase
    .from("data_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("kind", "deletion")
    .eq("status", "pending");
  if (error) return NextResponse.json({ error: "Annulation impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
