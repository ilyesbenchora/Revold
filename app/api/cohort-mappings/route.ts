import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

type CohortMapping = { key: string; label: string; internal_name: string; api_name: string; object: string; team: string };

/** Objets HubSpot valides pour l'objet porteur d'une cohorte ("" = détection auto). */
const VALID_OBJECTS = new Set(["contacts", "companies", "deals"]);

/** Équipes propriétaires valides ("" = cohorte transverse, toutes équipes). */
const VALID_TEAMS = new Set(["sales", "marketing", "cs", "finance"]);

/** Nettoie la liste de mappings (clés/labels/champs texte, 30 max). */
function cleanMappings(v: unknown): CohortMapping[] | null {
  if (!Array.isArray(v)) return null;
  const out: CohortMapping[] = [];
  for (const m of v.slice(0, 30)) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim().slice(0, 60) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 80) : "";
    if (!key || !label) continue;
    out.push({
      key,
      label,
      internal_name: typeof o.internal_name === "string" ? o.internal_name.trim().slice(0, 120) : "",
      api_name: typeof o.api_name === "string" ? o.api_name.trim().slice(0, 120) : "",
      object: typeof o.object === "string" && VALID_OBJECTS.has(o.object) ? o.object : "",
      team: typeof o.team === "string" && VALID_TEAMS.has(o.team) ? o.team : "",
    });
  }
  return out;
}

/**
 * Liste le mapping des cohortes de l'organisation ([] si aucune / table absente).
 * `?scope=filters` : périmètre des FILTRES de rapports — uniquement les
 * cohortes de l'équipe du membre (profiles.pole) + celles de « Toutes les
 * équipes » (team vide). Admin ou membre sans pôle : tout.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const scope = new URL(request.url).searchParams.get("scope");
  try {
    const { data } = await supabase
      .from("cohort_mappings")
      .select("mappings")
      .eq("organization_id", orgId)
      .maybeSingle();
    let mappings = Array.isArray(data?.mappings) ? (data.mappings as Array<{ team?: string }>) : [];
    if (scope === "filters") {
      const { data: prof } = await supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
      const role = (prof?.role as string | null) ?? null;
      const pole = (prof?.pole as string | null) ?? null;
      if (role !== "admin" && pole) {
        mappings = mappings.filter((m) => !(m.team ?? "") || m.team === pole);
      }
    }
    return NextResponse.json({ mappings });
  } catch {
    return NextResponse.json({ mappings: [] });
  }
}

/** Enregistre (upsert) le mapping des cohortes de l'organisation. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { mappings?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const mappings = cleanMappings(body.mappings);
  if (!mappings) return NextResponse.json({ error: "mappings (liste) requis" }, { status: 400 });

  const { data: existing, error: readErr } = await supabase
    .from("cohort_mappings")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (readErr && /cohort_mappings/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260817000003_cohort_mappings non appliquée (table absente)." },
      { status: 500 },
    );
  }
  const row = { mappings, updated_by: user.id, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await supabase.from("cohort_mappings").update(row).eq("id", existing.id)
    : await supabase.from("cohort_mappings").insert({ organization_id: orgId, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── BACKFILL des valeurs : les propriétés de cohortes ne sont demandées à
  // HubSpot que pour les fiches modifiées depuis le watermark — une cohorte
  // fraîchement mappée resterait donc SANS VALEURS (filtres de rapports vides)
  // tant que les fiches ne bougent pas. On remet le curseur des objets
  // concernés à zéro : le prochain etl-delta (cron 30 min) ré-importe TOUT
  // l'objet avec les nouvelles propriétés. Service role : hubspot_sync_state
  // n'a qu'une policy SELECT en RLS. Best effort — l'enregistrement prime.
  try {
    const objects = [
      ...new Set(
        mappings
          .filter((m) => (m.api_name ?? "").trim())
          .map((m) => (m.object && ["companies", "contacts", "deals"].includes(m.object) ? m.object : "companies")),
      ),
    ];
    if (objects.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await admin
        .from("hubspot_sync_state")
        .update({ last_modified_cursor: null, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .in("object_type", objects);
    }
  } catch {
    /* backfill non déclenché → le full hebdo rattrapera */
  }

  return NextResponse.json({ ok: true });
}
