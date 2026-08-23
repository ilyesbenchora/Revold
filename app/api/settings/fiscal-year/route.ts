import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Mois de début d'exercice comptable de l'org (Paramètres → Général) — consommé
 * par les barres de période côté client pour les presets « Exercice ».
 * Défaut janvier (1) = année civile.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ fiscalYearStart: 1 });

  const { data } = await supabase
    .from("organizations")
    .select("fiscal_year_start")
    .eq("id", orgId)
    .maybeSingle();
  const raw = Number(data?.fiscal_year_start);
  const fiscalYearStart = Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : 1;
  return NextResponse.json({ fiscalYearStart });
}
