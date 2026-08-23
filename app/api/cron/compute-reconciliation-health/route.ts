export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { monitoredCron } from "@/lib/cron/monitor";
import { computeDealInvoiceState } from "@/lib/reconciliation/deal-invoice-matching";
import { computeInvoicePaymentState } from "@/lib/reconciliation/payment-invoice-matching";
import { loadSourceLinkStats } from "@/lib/integrations/source-link-stats";

/**
 * SANTÉ DE RÉCONCILIATION — instantané quotidien par org, persisté dans
 * reconciliation_health (P2). Recalcule le lignage deal→facture→encaissement et
 * la couverture de résolution d'entité, en déduit un score 0..100 et
 * l'historise : la réconciliation devient un CONTRÔLE surveillé (tendance),
 * pas un simple constat à l'ouverture d'une page. Toutes les orgs, une fois/jour.
 */
async function handler(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Orgs à traiter : celles qui ont au moins un deal (donc de la donnée revenue).
  const orgIds = new Set<string>();
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("deals")
      .select("organization_id")
      .range(page * 1000, page * 1000 + 999);
    if (error || !data || data.length === 0) break;
    for (const r of data as Array<{ organization_id: string }>) orgIds.add(r.organization_id);
    if (data.length < 1000) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let tableMissing = false;

  for (const orgId of orgIds) {
    try {
      const [deal, pay, links] = await Promise.all([
        computeDealInvoiceState(supabase, orgId),
        computeInvoicePaymentState(supabase, orgId),
        loadSourceLinkStats(supabase, orgId).catch(() => null),
      ]);

      // Écart BRUT = Σ |écart par deal| sur les deals liés en écart : révèle la
      // compensation qu'un total net d'entreprise masque (deal A +10k, B −10k).
      const dealGapGross = deal.rows.reduce((s, r) => s + (r.state === "solde" ? 0 : Math.abs(r.gap)), 0);

      const dealRatio = deal.stats.wonDeals > 0 ? deal.stats.solde / deal.stats.wonDeals : 1;
      const invRatio = pay.stats.invoices > 0 ? pay.stats.solde / pay.stats.invoices : 1;
      const multi = (links?.multiSourcePct ?? 0) / 100;
      // Score composite pondéré, explicable : lignage deal (45 %), lignage
      // paiement (35 %), couverture multi-source (20 %).
      const score = Math.round(100 * (0.45 * dealRatio + 0.35 * invRatio + 0.2 * multi));

      const { error } = await supabase.from("reconciliation_health").upsert(
        {
          organization_id: orgId,
          day: today,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          score: Math.max(0, Math.min(100, score)),
          won_deals: deal.stats.wonDeals,
          deal_solde: deal.stats.solde,
          deal_gap_net: deal.stats.gapTotal,
          deal_gap_gross: Math.round(dealGapGross),
          deal_leak_total: deal.stats.leakTotal,
          invoices: pay.stats.invoices,
          invoice_solde: pay.stats.solde,
          due_total: pay.stats.dueTotal,
          unmatched_payments_total: pay.stats.unmatchedPaymentsTotal,
          multi_source_pct: links?.multiSourcePct ?? 0,
        },
        { onConflict: "organization_id,day" },
      );
      if (error) {
        if (/reconciliation_health/.test(error.message)) { tableMissing = true; break; }
        continue;
      }
      processed++;
    } catch {
      /* org en erreur : on continue les autres */
    }
  }

  if (tableMissing) {
    return NextResponse.json({ ok: true, skipped: "migration reconciliation_health non appliquée" });
  }
  return NextResponse.json({ ok: true, orgs: orgIds.size, processed });
}

// Journalisé dans cron_runs (statut, durée, erreur).
export const GET = monitoredCron("compute-reconciliation-health", handler);
