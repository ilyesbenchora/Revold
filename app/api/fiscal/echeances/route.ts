import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { computeFiscalEcheances } from "@/lib/fiscal/echeances";

export const dynamic = "force-dynamic";

/**
 * GET /api/fiscal/echeances — échéances fiscales (TVA · IS · URSSAF) de l'org,
 * au format { data: [{ name, value }] } attendu par la table de données du funnel
 * Trésorerie. Lit la config Organisation (Paramètres) si présente, sinon calcule
 * les échéances standard françaises à partir de la date du jour.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // select("*") : tolérant si les colonnes fiscales ne sont pas encore migrées.
  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();

  const rows = computeFiscalEcheances(org ?? null, new Date());
  return NextResponse.json({ data: rows, totalRows: rows.length });
}
