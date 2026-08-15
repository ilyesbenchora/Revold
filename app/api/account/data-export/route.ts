import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Export RGPD des données de l'organisation (Paramètres → Sécurité) :
 * téléchargement JSON immédiat des tables canoniques (plafonné à 2000 lignes
 * par table — les volumes supérieurs passent par le support). Réversibilité
 * réelle, pas une promesse.
 */

const EXPORT_TABLES: Array<{ table: string; columns: string }> = [
  { table: "companies", columns: "id, name, legal_name, domain, siren, siret, vat_number, custom_id, created_at" },
  { table: "contacts", columns: "id, email, full_name, phone, title, company_id, created_at" },
  { table: "deals", columns: "id, name, amount, close_date, created_date, is_closed_won, is_closed_lost" },
  { table: "invoices", columns: "id, number, status, amount_total, amount_paid, amount_due, issued_at, due_at, paid_at, primary_source" },
  { table: "subscriptions", columns: "id, status, mrr, started_at, canceled_at" },
  { table: "alerts", columns: "id, title, severity, status, threshold, direction, current_value, created_at" },
  { table: "objectives", columns: "id, title, target, current_value, direction, date_from, date_to, status" },
  { table: "action_items", columns: "id, type, status, title, source, created_at, decided_at" },
];

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    organization_id: orgId,
    note: "Export plafonné à 2000 lignes par table — contactez le support pour un export complet.",
  };
  for (const t of EXPORT_TABLES) {
    try {
      const { data, error } = await supabase
        .from(t.table)
        .select(t.columns)
        .eq("organization_id", orgId)
        .limit(2000);
      out[t.table] = error ? { error: "table indisponible" } : data ?? [];
    } catch {
      out[t.table] = { error: "table indisponible" };
    }
  }

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="revold-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
