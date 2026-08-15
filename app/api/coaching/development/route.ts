import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadDevelopmentPlans } from "@/lib/coaching/development";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["commercial", "marketing", "data", "integration", "cross-source", "data-model"]);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** GET : plans de développement d'une catégorie (étapes + preuve business). */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "";
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Catégorie inconnue" }, { status: 400 });

  const plans = await loadDevelopmentPlans(supabase, orgId, category, {
    includeArchived: url.searchParams.get("all") === "1",
  });
  return NextResponse.json({ plans });
}

/** POST : ouvre un plan de développement (titre, pourquoi, étapes, témoin). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let b: {
    category?: string;
    agent_key?: string;
    title?: string;
    why?: string;
    target_behavior?: string;
    target_date?: string;
    objective_id?: string | null;
    steps?: Array<{ title?: string; description?: string; due_date?: string }>;
  };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!b.category || !CATEGORIES.has(b.category)) return NextResponse.json({ error: "Catégorie inconnue" }, { status: 400 });
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  // Valeur de départ du KPI témoin : sans elle, impossible de dire plus tard
  // « le comportement a changé ET le chiffre a bougé ».
  let baseline: number | null = null;
  if (b.objective_id) {
    const { data: obj } = await supabase
      .from("objectives")
      .select("current_value")
      .eq("organization_id", orgId)
      .eq("id", b.objective_id)
      .maybeSingle();
    baseline = (obj?.current_value as number) ?? null;
  }

  const { data: plan, error } = await supabase
    .from("development_plans")
    .insert({
      organization_id: orgId,
      category: b.category,
      agent_key: typeof b.agent_key === "string" ? b.agent_key.slice(0, 80) : null,
      objective_id: b.objective_id || null,
      title: title.slice(0, 300),
      why: typeof b.why === "string" ? b.why.slice(0, 2000) : null,
      target_behavior: typeof b.target_behavior === "string" ? b.target_behavior.slice(0, 2000) : null,
      target_date: typeof b.target_date === "string" && dateRe.test(b.target_date) ? b.target_date : null,
      baseline_value: baseline,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error || !plan) {
    return NextResponse.json({ error: error?.message ?? "Création impossible" }, { status: 500 });
  }

  const steps = (b.steps ?? [])
    .filter((s) => typeof s?.title === "string" && s.title.trim())
    .slice(0, 12)
    .map((s, i) => ({
      plan_id: plan.id,
      organization_id: orgId,
      position: i,
      title: String(s.title).trim().slice(0, 300),
      description: typeof s.description === "string" ? s.description.slice(0, 2000) : null,
      due_date: typeof s.due_date === "string" && dateRe.test(s.due_date) ? s.due_date : null,
    }));
  if (steps.length > 0) await supabase.from("development_steps").insert(steps);

  return NextResponse.json({ ok: true, id: plan.id });
}
