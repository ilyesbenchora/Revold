import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { summarizeAndStoreSession } from "@/lib/coaching/session-memory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CATEGORIES = new Set(["commercial", "marketing", "data", "integration", "cross-source", "data-model"]);

/**
 * Marque une séance de coaching comme réalisée (fin manuelle ou auto par
 * inactivité). Si le transcript est fourni, génère et persiste la MÉMOIRE de
 * séance : résumé + plan d'action (engagements) — réinjectés au coach à la
 * séance suivante.
 */
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
    auto?: boolean;
    messages?: { role?: string; content?: string }[];
    /** Satisfaction recueillie en fin de séance (1-5) + verbatim libre. */
    rating?: number;
    feedback?: string;
    agentKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const category = String(body.category ?? "");
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });

  const base = {
    organization_id: orgId,
    category,
    auto: body.auto === true,
    ended_at: new Date().toISOString(),
  };
  const rating = typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? Math.round(body.rating) : null;
  const enriched = {
    ...base,
    ...(rating ? { rating } : {}),
    ...(typeof body.feedback === "string" && body.feedback.trim() ? { feedback: body.feedback.trim().slice(0, 2000) } : {}),
    ...(typeof body.agentKey === "string" && body.agentKey ? { agent_key: body.agentKey.slice(0, 80) } : {}),
  };

  // Colonnes satisfaction non migrées → repli sur le socle, jamais d'échec.
  let { data: inserted, error } = await supabase.from("coaching_sessions").insert(enriched).select("id").single();
  if (error) {
    ({ data: inserted, error } = await supabase.from("coaching_sessions").insert(base).select("id").single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mémoire de séance (best-effort) : résumé + engagements depuis le transcript.
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m): m is { role: string; content: string } =>
          (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
        .slice(-30)
    : [];
  let memory: Awaited<ReturnType<typeof summarizeAndStoreSession>> = null;
  if (messages.length >= 2) {
    memory = await summarizeAndStoreSession(supabase, orgId, category, inserted?.id ?? null, messages);
  }

  return NextResponse.json({ ok: true, memory });
}
