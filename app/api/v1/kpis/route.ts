import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/kpis — volumes du modèle canonique de l'organisation (mêmes
 * tables que les pages de données) + alertes actives. Lecture seule, clé d'API
 * requise (Authorization: Bearer rvk_…).
 */
export async function GET(request: Request) {
  const orgId = await authenticateApiKey(request);
  if (!orgId) return NextResponse.json({ error: "Clé d'API invalide ou révoquée" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const count = async (table: string): Promise<number | null> => {
    try {
      const { count: c, error } = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId);
      return error ? null : c ?? 0;
    } catch {
      return null;
    }
  };

  const [contacts, companies, deals, invoices, subscriptions, tickets, bankTransactions, activeAlerts] =
    await Promise.all([
      count("contacts"),
      count("companies"),
      count("deals"),
      count("invoices"),
      count("subscriptions"),
      count("tickets"),
      count("bank_transactions"),
      admin
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active")
        .then((r) => r.count ?? 0, () => null),
    ]);

  return NextResponse.json({
    organization_id: orgId,
    generated_at: new Date().toISOString(),
    counts: { contacts, companies, deals, invoices, subscriptions, tickets, bank_transactions: bankTransactions },
    alerts: { active: activeAlerts },
  });
}
