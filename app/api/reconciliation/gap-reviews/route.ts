import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  computeCompanyGaps,
  computePeriodizedGap,
  GAP_REVIEW_STATUSES,
  type GapReviewStatus,
} from "@/lib/reconciliation/gap-reviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * File d'apurement des écarts CA signé ↔ facturé :
 *  - GET → écarts par entreprise + statut de traitement ;
 *  - POST { companyId, status, note? } → statue un écart (upsert).
 */

async function authed() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) } as const;
  return { supabase, user, orgId } as const;
}

export async function GET() {
  const a = await authed();
  if ("error" in a) return a.error;
  // Écarts par entreprise + périodisation (6 derniers trimestres) en un appel.
  const [state, periods] = await Promise.all([
    computeCompanyGaps(a.supabase, a.orgId),
    computePeriodizedGap(a.supabase, a.orgId, 6),
  ]);
  return NextResponse.json({ ...state, periods });
}

export async function POST(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { companyId?: string; status?: string; note?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const status = GAP_REVIEW_STATUSES.includes(body.status as GapReviewStatus)
    ? (body.status as GapReviewStatus)
    : null;
  if (!companyId || !status) return NextResponse.json({ error: "companyId et status requis" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  // Upsert manuel (unique org + company_id).
  const { data: existing, error: readErr } = await a.supabase
    .from("recon_gap_reviews")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (readErr && /recon_gap_reviews/.test(readErr.message)) {
    return NextResponse.json(
      { error: "Migration 20260820000002_recon_gap_reviews non appliquée (apurement indisponible)." },
      { status: 500 },
    );
  }
  const row = { status, note, updated_by: a.user.id, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await a.supabase.from("recon_gap_reviews").update(row).eq("id", existing.id)
    : await a.supabase
        .from("recon_gap_reviews")
        .insert({ organization_id: a.orgId, company_id: companyId, ...row });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
