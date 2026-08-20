import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { computeDealInvoiceState } from "@/lib/reconciliation/deal-invoice-matching";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rapprochement deal ↔ factures :
 *  - GET → état complet (deals liés avec écart, propositions à confirmer) ;
 *  - POST { dealId, invoiceIds, method? } → lie les factures au deal
 *    (confirmation utilisateur — le moteur ne fait que proposer) ;
 *  - DELETE { invoiceId } → délie une facture.
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
  const state = await computeDealInvoiceState(a.supabase, a.orgId);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { dealId?: string; invoiceIds?: string[]; method?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const dealId = typeof body.dealId === "string" ? body.dealId : "";
  const invoiceIds = Array.isArray(body.invoiceIds)
    ? body.invoiceIds.filter((i): i is string => typeof i === "string").slice(0, 20)
    : [];
  if (!dealId || invoiceIds.length === 0) {
    return NextResponse.json({ error: "dealId et invoiceIds requis" }, { status: 400 });
  }
  // auto_exact = proposition « correspondance exacte » confirmée telle quelle.
  const method = body.method === "auto_exact" ? "auto_exact" : "manual";

  // Le deal doit être un deal GAGNÉ de l'org.
  const { data: deal } = await a.supabase
    .from("deals")
    .select("id, company_id")
    .eq("organization_id", a.orgId)
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal introuvable" }, { status: 404 });

  const { data, error } = await a.supabase
    .from("invoices")
    .update({ deal_id: dealId, deal_link_method: method })
    .eq("organization_id", a.orgId)
    .in("id", invoiceIds)
    .is("deal_id", null)
    .select("id");
  if (error) {
    const msg = /deal_id|deal_link_method/.test(error.message)
      ? "Migration 20260820000001_invoice_deal_link non appliquée (rapprochement indisponible)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, linked: (data ?? []).length });
}

export async function DELETE(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { invoiceId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.invoiceId || typeof body.invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId requis" }, { status: 400 });
  }
  const { error } = await a.supabase
    .from("invoices")
    .update({ deal_id: null, deal_link_method: null })
    .eq("organization_id", a.orgId)
    .eq("id", body.invoiceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
