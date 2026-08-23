import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { computeInvoicePaymentState } from "@/lib/reconciliation/payment-invoice-matching";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rapprochement facture ↔ paiements (dernier maillon deal→facture→encaissement) :
 *  - GET → état complet (factures rapprochées avec reste dû, propositions) ;
 *  - POST { invoiceId, paymentIds } → rattache les paiements à la facture
 *    (confirmation utilisateur — le moteur ne fait que proposer) ;
 *  - DELETE { paymentId } → détache un paiement.
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
  const state = await computeInvoicePaymentState(a.supabase, a.orgId);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { invoiceId?: string; paymentIds?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
  const paymentIds = Array.isArray(body.paymentIds)
    ? body.paymentIds.filter((i): i is string => typeof i === "string").slice(0, 20)
    : [];
  if (!invoiceId || paymentIds.length === 0) {
    return NextResponse.json({ error: "invoiceId et paymentIds requis" }, { status: 400 });
  }

  // La facture doit appartenir à l'org.
  const { data: inv } = await a.supabase
    .from("invoices")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  // On ne rattache que des paiements LIBRES (invoice_id null) de l'org.
  const { data, error } = await a.supabase
    .from("payments")
    .update({ invoice_id: invoiceId })
    .eq("organization_id", a.orgId)
    .in("id", paymentIds)
    .is("invoice_id", null)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, linked: (data ?? []).length });
}

export async function DELETE(request: Request) {
  const a = await authed();
  if ("error" in a) return a.error;
  let body: { paymentId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  if (!body.paymentId || typeof body.paymentId !== "string") {
    return NextResponse.json({ error: "paymentId requis" }, { status: 400 });
  }
  const { error } = await a.supabase
    .from("payments")
    .update({ invoice_id: null })
    .eq("organization_id", a.orgId)
    .eq("id", body.paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
