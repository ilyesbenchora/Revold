import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { sanitizeAttachments } from "@/lib/attachments";

const CATEGORIES = new Set(["commercial", "marketing", "data", "integration", "cross-source", "data-model"]);
const CADENCES = new Set(["once", "weekly", "biweekly", "monthly", "quarterly"]);

/** Upsert de l'agenda de coaching d'une catégorie (objectifs, pains, cadence, prochain RDV). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    category?: string;
    objectives?: string;
    pains?: string;
    cadence?: string;
    next_meeting_at?: string | null;
    sources?: unknown;
    attachments?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const category = String(body.category ?? "");
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
  }
  const cadence = CADENCES.has(String(body.cadence)) ? String(body.cadence) : "monthly";
  const nextMeeting = body.next_meeting_at && /^\d{4}-\d{2}-\d{2}$/.test(body.next_meeting_at) ? body.next_meeting_at : null;
  // Outils à croiser : liste de clés de sources, nettoyée (strings, ≤ 40 entrées).
  const sources = Array.isArray(body.sources)
    ? body.sources.filter((s): s is string => typeof s === "string").slice(0, 40)
    : [];
  const attachments = sanitizeAttachments(body.attachments);

  const { error } = await supabase.from("coaching_agendas").upsert(
    {
      organization_id: orgId,
      category,
      objectives: (body.objectives ?? "").slice(0, 4000),
      pains: (body.pains ?? "").slice(0, 4000),
      cadence,
      next_meeting_at: nextMeeting,
      sources,
      attachments,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,category" },
  );

  if (error) {
    // Table absente (migration non appliquée) → message explicite.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
