import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isNameMatchEnabled, detectUndeclaredGroups } from "@/lib/actions/engine";

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

  const [companies, withSiren, withSiret, withDomain, dupSiren, wonDeals, unlinkedInvoices, nameEnabled] = await Promise.all([
    countWhere(supabase, "companies", orgId, (q) => q.not("hubspot_id", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("siren", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("siret", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("domain", "is", null)),
    countWhere(supabase, "companies", orgId, (q) => q.not("duplicate_of_siren", "is", null)),
    countWhere(supabase, "deals", orgId, (q) => q.eq("is_closed_won", true).not("company_id", "is", null)),
    countWhere(supabase, "invoices", orgId, (q) => q.not("company_id", "is", null).is("deal_id", null)),
    isNameMatchEnabled(supabase, orgId),
  ]);

  // Run LIVE du détecteur : répartition RÉELLE par signal (pas le stock, qui
  // peut être périmé) + capture d'erreur si la passe échoue silencieusement.
  const bySignal: Record<string, number> = { billing_match: 0, shared_domain: 0, same_siren: 0, name_match: 0 };
  let detectError: string | null = null;
  try {
    const proposals = await detectUndeclaredGroups(supabase, orgId);
    for (const p of proposals) {
      const sig = (p.payload?.groupSignal as string) ?? "billing_match";
      bySignal[sig] = (bySignal[sig] ?? 0) + 1;
    }
  } catch (e) {
    detectError = e instanceof Error ? e.message : "Erreur détecteur";
  }

  return NextResponse.json({ companies, withSiren, withSiret, withDomain, dupSiren, wonDeals, unlinkedInvoices, nameEnabled, bySignal, detectError });
}
