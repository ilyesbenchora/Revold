import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadDevelopmentPlans } from "@/lib/coaching/development";

export const dynamic = "force-dynamic";

/**
 * INSIGHTS DU COACHING — la lecture qui manquait : est-ce que ça sert ?
 *  - satisfaction : note moyenne des séances (recueillie à la clôture) ;
 *  - assiduité : séances tenues, régularité réelle vs cadence choisie ;
 *  - thèmes récurrents : ce qui revient séance après séance (souvent le vrai
 *    blocage) ;
 *  - progrès : engagements tenus, étapes franchies, et surtout la PREUVE
 *    business (objectif témoin des plans de développement).
 * Toutes les lectures sont résilientes : une colonne absente ne casse rien.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const category = new URL(request.url).searchParams.get("category");

  // ── Séances ──
  type SessionRow = { category: string; ended_at: string; rating?: number | null; topics?: unknown };
  let sessions: SessionRow[] = [];
  {
    const cols = "category, ended_at, rating, topics";
    let q = supabase.from("coaching_sessions").select(cols).eq("organization_id", orgId).order("ended_at", { ascending: false }).limit(200);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) {
      // Colonnes rating/topics non migrées : on retombe sur le socle.
      let q2 = supabase.from("coaching_sessions").select("category, ended_at").eq("organization_id", orgId).order("ended_at", { ascending: false }).limit(200);
      if (category) q2 = q2.eq("category", category);
      const { data: d2 } = await q2;
      sessions = (d2 ?? []) as SessionRow[];
    } else {
      sessions = (data ?? []) as unknown as SessionRow[];
    }
  }

  // ── Engagements ──
  let commitQ = supabase
    .from("coaching_commitments")
    .select("category, status, created_at, completed_at, due_date")
    .eq("organization_id", orgId)
    .limit(500);
  if (category) commitQ = commitQ.eq("category", category);
  const { data: commitments } = await commitQ;
  type CommitRow = { category: string; status: string; created_at: string; completed_at: string | null; due_date: string | null };
  const commits = (commitments ?? []) as CommitRow[];

  // ── Satisfaction ──
  const rated = sessions.filter((s) => typeof s.rating === "number" && s.rating! > 0);
  const avgRating = rated.length > 0 ? Math.round((rated.reduce((n, s) => n + (s.rating as number), 0) / rated.length) * 10) / 10 : null;

  // ── Thèmes récurrents ──
  const themeCount = new Map<string, number>();
  for (const s of sessions) {
    const list = Array.isArray(s.topics) ? (s.topics as unknown[]) : [];
    for (const t of list) {
      if (typeof t !== "string" || !t.trim()) continue;
      const k = t.trim().toLowerCase();
      themeCount.set(k, (themeCount.get(k) ?? 0) + 1);
    }
  }
  const themes = [...themeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  // ── Assiduité : séances des 90 derniers jours + délai moyen entre séances ──
  const now = Date.now();
  const last90 = sessions.filter((s) => now - Date.parse(s.ended_at) < 90 * 86_400_000);
  let avgGapDays: number | null = null;
  if (sessions.length >= 2) {
    const times = sessions.map((s) => Date.parse(s.ended_at)).sort((a, b) => b - a).slice(0, 10);
    const gaps: number[] = [];
    for (let i = 0; i < times.length - 1; i++) gaps.push((times[i] - times[i + 1]) / 86_400_000);
    if (gaps.length > 0) avgGapDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  // ── Engagements tenus ──
  const doneCommits = commits.filter((c) => c.status === "done");
  const completionRate = commits.length > 0 ? Math.round((doneCommits.length / commits.length) * 100) : null;
  const overdue = commits.filter((c) => c.status === "pending" && c.due_date && c.due_date < new Date().toISOString().slice(0, 10)).length;
  const delays = doneCommits
    .filter((c) => c.completed_at && c.created_at)
    .map((c) => (Date.parse(c.completed_at!) - Date.parse(c.created_at)) / 86_400_000);
  const avgCompletionDays = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;

  // ── Progrès des plans (preuve business incluse) ──
  const cats = category ? [category] : ["commercial", "marketing", "data", "data-model"];
  const planLists = await Promise.all(cats.map((c) => loadDevelopmentPlans(supabase, orgId, c, { includeArchived: true })));
  const plans = planLists.flat();

  return NextResponse.json({
    satisfaction: { average: avgRating, ratedSessions: rated.length, totalSessions: sessions.length },
    assiduity: { sessions90d: last90.length, avgGapDays, lastSessionAt: sessions[0]?.ended_at ?? null },
    themes,
    commitments: { total: commits.length, done: doneCommits.length, completionRate, overdue, avgCompletionDays },
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      category: p.category,
      stepProgress: p.stepProgress,
      stepsDone: p.steps.filter((s) => s.status === "done").length,
      stepsTotal: p.steps.length,
      witness: p.witness,
      targetDate: p.target_date,
    })),
  });
}
