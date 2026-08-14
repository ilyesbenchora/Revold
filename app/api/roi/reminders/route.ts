import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Module ROI « cash récupéré » — relances d'impayés suivies.
 *
 * GET  : factures en retard (reste dû > 0, échéance dépassée) + statut de
 *        relance, et ATTRIBUTION DÉTERMINISTE du cash récupéré : toute relance
 *        dont la facture est depuis constatée payée (reste dû à 0 / statut
 *        payé) est marquée récupérée, à hauteur du reste dû au moment de la
 *        relance. Aucun LLM : le chiffre est prouvable ligne à ligne.
 * POST : marque une facture comme relancée (fige le reste dû du moment).
 */

type InvoiceRow = {
  id: string;
  number: string | null;
  status: string | null;
  amount_total: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  due_at: string | null;
  company_id: string | null;
  contact_id: string | null;
  primary_source: string | null;
};

type ReminderRow = {
  id: string;
  invoice_id: string;
  reminded_at: string;
  amount_due_at_reminder: number | null;
  recovered_at: string | null;
  recovered_amount: number | null;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  const [remRes, overdueRes] = await Promise.all([
    supabase
      .from("invoice_reminders")
      .select("id, invoice_id, reminded_at, amount_due_at_reminder, recovered_at, recovered_amount")
      .eq("organization_id", orgId)
      .order("reminded_at", { ascending: false })
      .limit(500),
    supabase
      .from("invoices")
      .select("id, number, status, amount_total, amount_due, amount_paid, due_at, company_id, contact_id, primary_source")
      .eq("organization_id", orgId)
      .gt("amount_due", 0)
      .lt("due_at", today)
      .neq("status", "void")
      .order("amount_due", { ascending: false })
      .limit(50),
  ]);

  // Table absente → migration à appliquer : le bloc l'explique proprement.
  if (remRes.error) {
    return NextResponse.json({ needsMigration: true, overdue: [], stats: { recovered: 0, remindedPending: 0, recoveredCount: 0 } });
  }

  const reminders = (remRes.data ?? []) as ReminderRow[];
  const overdue = (overdueRes.data ?? []) as InvoiceRow[];

  // ── Attribution : relances non soldées dont la facture est depuis payée ──
  const pending = reminders.filter((r) => !r.recovered_at);
  if (pending.length > 0) {
    const ids = [...new Set(pending.map((r) => r.invoice_id))];
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, status, amount_due, amount_paid")
      .eq("organization_id", orgId)
      .in("id", ids.slice(0, 200));
    const paidSet = new Map(
      ((invs ?? []) as { id: string; status: string | null; amount_due: number | null }[])
        .filter((i) => i.status === "paid" || (i.amount_due != null && i.amount_due <= 0))
        .map((i) => [i.id, i]),
    );
    for (const r of pending) {
      if (!paidSet.has(r.invoice_id)) continue;
      const recovered = Number(r.amount_due_at_reminder) || 0;
      await supabase
        .from("invoice_reminders")
        .update({ recovered_at: new Date().toISOString(), recovered_amount: recovered })
        .eq("id", r.id)
        .eq("organization_id", orgId);
      r.recovered_at = new Date().toISOString();
      r.recovered_amount = recovered;
    }
  }

  // ── Stats ROI ──
  const recovered = reminders.reduce((s, r) => s + (Number(r.recovered_amount) || 0), 0);
  const recoveredCount = reminders.filter((r) => r.recovered_at).length;
  const remindedPendingIds = new Set(reminders.filter((r) => !r.recovered_at).map((r) => r.invoice_id));

  // Noms des clients des factures en retard (affichage).
  const companyIds = [...new Set(overdue.map((i) => i.company_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: comps } = await supabase
      .from("companies")
      .select("id, name, legal_name")
      .eq("organization_id", orgId)
      .in("id", companyIds.slice(0, 200));
    for (const c of (comps ?? []) as { id: string; name: string | null; legal_name?: string | null }[]) {
      names.set(c.id, (c.legal_name || c.name || "").trim());
    }
  }

  const lastReminderByInvoice = new Map<string, ReminderRow>();
  for (const r of reminders) {
    if (!lastReminderByInvoice.has(r.invoice_id)) lastReminderByInvoice.set(r.invoice_id, r);
  }

  return NextResponse.json({
    stats: { recovered, recoveredCount, remindedPending: remindedPendingIds.size },
    overdue: overdue.map((i) => ({
      id: i.id,
      number: i.number,
      company: i.company_id ? names.get(i.company_id) || null : null,
      amountDue: Number(i.amount_due) || 0,
      dueAt: i.due_at,
      source: i.primary_source,
      remindedAt: lastReminderByInvoice.get(i.id)?.reminded_at ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { invoiceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (!body.invoiceId) return NextResponse.json({ error: "invoiceId requis" }, { status: 400 });

  // La facture doit appartenir à l'org — et on fige son reste dû du moment.
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, amount_due")
    .eq("organization_id", orgId)
    .eq("id", body.invoiceId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  const { error } = await supabase.from("invoice_reminders").insert({
    organization_id: orgId,
    invoice_id: inv.id,
    amount_due_at_reminder: Number(inv.amount_due) || 0,
    channel: "manual",
    created_by: user.id,
  });
  if (error) {
    return NextResponse.json(
      { error: "Table des relances absente — applique la migration invoice_reminders." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
