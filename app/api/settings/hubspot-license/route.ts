import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { hubFetch } from "@/lib/integrations/hub-fetch";

export const dynamic = "force-dynamic";

/**
 * Licence HubSpot du compte (Paramètres → Intégrations) — stockée dans
 * integrations.metadata (provider hubspot). Elle pilote les actions proposées :
 * avec Sales Pro/Enterprise + une séquence choisie, les relances deviennent de
 * VRAIS emails (inscription en séquence au nom de l'owner) au lieu de tâches.
 * GET : réglage actuel + liste des séquences du portail (si accessibles).
 * PUT : { license, sequence_id, sequence_name } fusionnés dans metadata.
 */

const LICENSES = ["free", "starter", "sales_pro", "sales_enterprise"] as const;

async function listSequences(token: string): Promise<{ sequences: Array<{ id: string; name: string }>; error: string | null }> {
  try {
    // L'API séquences est scopée par utilisateur : on essaie les premiers
    // owners porteurs d'un userId jusqu'à obtenir une liste.
    const ownersRes = await hubFetch("https://api.hubapi.com/crm/v3/owners?limit=20", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!ownersRes.ok) return { sequences: [], error: `Owners inaccessibles (HTTP ${ownersRes.status})` };
    const owners = ((await ownersRes.json()) as { results?: Array<{ userId?: number }> }).results ?? [];
    const userIds = owners.map((o) => o.userId).filter((u): u is number => typeof u === "number");
    let lastError: string | null = "Aucun utilisateur HubSpot trouvé";
    for (const userId of userIds.slice(0, 5)) {
      const res = await hubFetch(`https://api.hubapi.com/automation/v4/sequences?userId=${userId}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        lastError = "Accès séquences refusé — scope automation.sequences.read manquant sur l'app OAuth, ou licence insuffisante.";
        continue;
      }
      if (!res.ok) {
        lastError = `HubSpot ${res.status}`;
        continue;
      }
      const d = (await res.json()) as { results?: Array<{ id: string | number; name?: string }> };
      const sequences = (d.results ?? []).map((s) => ({ id: String(s.id), name: s.name ?? `Séquence ${s.id}` }));
      if (sequences.length > 0) return { sequences, error: null };
      lastError = null; // liste vide mais accessible
    }
    return { sequences: [], error: lastError };
  } catch (e) {
    return { sequences: [], error: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data: row } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  const license = typeof meta.hubspot_license === "string" && (LICENSES as readonly string[]).includes(meta.hubspot_license)
    ? meta.hubspot_license
    : null;

  // Séquences listées uniquement quand la licence le permet (économie d'appels).
  let sequences: Array<{ id: string; name: string }> = [];
  let sequencesError: string | null = null;
  if (license === "sales_pro" || license === "sales_enterprise") {
    const token = await getHubSpotToken(supabase, orgId);
    if (token) {
      const r = await listSequences(token);
      sequences = r.sequences;
      sequencesError = r.error;
    } else {
      sequencesError = "HubSpot non connecté";
    }
  }

  return NextResponse.json({
    license,
    sequence_id: typeof meta.sequence_id === "string" ? meta.sequence_id : null,
    sequence_name: typeof meta.sequence_name === "string" ? meta.sequence_name : null,
    sequences,
    sequencesError,
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { license?: string; sequence_id?: string | null; sequence_name?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (body.license != null && !(LICENSES as readonly string[]).includes(body.license)) {
    return NextResponse.json({ error: "Licence inconnue" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("integrations")
    .select("id, metadata")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "HubSpot n'est pas connecté pour cette organisation." }, { status: 400 });

  const meta = { ...((row.metadata ?? {}) as Record<string, unknown>) };
  if (body.license != null) meta.hubspot_license = body.license;
  if (body.sequence_id !== undefined) meta.sequence_id = body.sequence_id || null;
  if (body.sequence_name !== undefined) meta.sequence_name = body.sequence_name || null;

  const { error } = await supabase
    .from("integrations")
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
