import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Diagnostic FACTUEL de la couverture des données par signal de rapprochement :
 * combien d'entreprises portent un SIREN / SIRET / domaine, combien de doublons
 * SIREN (établissements) détectés, combien de deals gagnés et factures non
 * rattachées. Remplace toute supposition sur « c'est vide » par des chiffres.
 */

async function countWhere(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: string,
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any,
): Promise<number | null> {
  try {
    const base = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    const { count, error } = await apply(base);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const [companies, withSiren, withSiret, withDomain, dupSiren, wonDeals, unlinkedInvoices] = await Promise.all([
    countWhere(supabase, "companies", orgId, (q) => q.not("hubspot_id", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("siren", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("siret", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("domain", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("duplicate_of_siren", "is", null)),
    countWhere(supabase, "deals", orgId, (q) => q.eq("is_closed_won", true).not("company_id", "is", null)),
    countWhere(supabase, "invoices", orgId, (q) => q.not("company_id", "is", null).is("deal_id", null)),
  ]);

  return NextResponse.json({ companies, withSiren, withSiret, withDomain, dupSiren, wonDeals, unlinkedInvoices });
}
