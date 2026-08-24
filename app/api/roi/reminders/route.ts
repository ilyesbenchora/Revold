import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { defaultReminderEmail } from "@/lib/roi/reminder-sequences";

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
  source_metadata: Record<string, unknown> | null;
};

type SequenceRow = {
  invoice_id: string;
  sends_count: number;
  max_sends: number;
  recurrence_days: number | null;
  last_sent_at: string | null;
  next_send_at: string | null;
  stopped_at: string | null;
  stop_reason: string | null;
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
      .select("id, number, status, amount_total, amount_due, amount_paid, due_at, company_id, contact_id, primary_source, source_metadata")
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
    const nowPaidIds: string[] = [];
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
      nowPaidIds.push(r.invoice_id);
    }
    // Paiement détecté → la séquence de relance s'arrête immédiatement.
    if (nowPaidIds.length > 0) {
      await supabase
        .from("invoice_reminder_sequences")
        .update({ stopped_at: new Date().toISOString(), stop_reason: "paid", next_send_at: null })
        .eq("organization_id", orgId)
        .in("invoice_id", nowPaidIds)
        .is("stopped_at", null);
    }
  }

  // ── Stats ROI ──
  const recovered = reminders.reduce((s, r) => s + (Number(r.recovered_amount) || 0), 0);
  const recoveredCount = reminders.filter((r) => r.recovered_at).length;
  const remindedPendingIds = new Set(reminders.filter((r) => !r.recovered_at).map((r) => r.invoice_id));

  // ── Lignes « cash récupéré » récentes (30 j) : la facture n'est plus en
  // retard (payée) mais reste affichée avec le badge vert.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const recoveredRecent = reminders.filter((r) => r.recovered_at && r.recovered_at >= thirtyDaysAgo);
  const overdueIds = new Set(overdue.map((i) => i.id));
  const recoveredInvoiceIds = [...new Set(recoveredRecent.map((r) => r.invoice_id))].filter((id) => !overdueIds.has(id));
  let recoveredInvoices: InvoiceRow[] = [];
  if (recoveredInvoiceIds.length > 0) {
    const { data } = await supabase
      .from("invoices")
      .select("id, number, status, amount_total, amount_due, amount_paid, due_at, company_id, contact_id, primary_source, source_metadata")
      .eq("organization_id", orgId)
      .in("id", recoveredInvoiceIds.slice(0, 50));
    recoveredInvoices = (data ?? []) as InvoiceRow[];
  }
  const allRows = [...overdue, ...recoveredInvoices];

  // Noms des clients (affichage) + emails des contacts (destinataire de relance).
  const companyIds = [...new Set(allRows.map((i) => i.company_id).filter((x): x is string => !!x))];
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
  const contactIds = [...new Set(allRows.map((i) => i.contact_id).filter((x): x is string => !!x))];
  const emails = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email")
      .eq("organization_id", orgId)
      .in("id", contactIds.slice(0, 200));
    for (const c of (contacts ?? []) as { id: string; email: string | null }[]) {
      if (c.email) emails.set(c.id, c.email);
    }
  }

  // Séquences de relance (état du CTA) + nom de l'org (signature du mail).
  const sequences = new Map<string, SequenceRow>();
  {
    const { data } = await supabase
      .from("invoice_reminder_sequences")
      .select("invoice_id, sends_count, max_sends, recurrence_days, last_sent_at, next_send_at, stopped_at, stop_reason")
      .eq("organization_id", orgId)
      .in("invoice_id", allRows.map((i) => i.id).slice(0, 100));
    for (const s of (data ?? []) as SequenceRow[]) sequences.set(s.invoice_id, s);
  }
  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = (org?.name as string | undefined) ?? null;

  const lastReminderByInvoice = new Map<string, ReminderRow>();
  for (const r of reminders) {
    if (!lastReminderByInvoice.has(r.invoice_id)) lastReminderByInvoice.set(r.invoice_id, r);
  }

  const toRow = (i: InvoiceRow) => {
    const rem = lastReminderByInvoice.get(i.id);
    const seq = sequences.get(i.id) ?? null;
    const company = i.company_id ? names.get(i.company_id) || null : null;
    const invoiceUrl = typeof i.source_metadata?.invoice_url === "string" ? (i.source_metadata.invoice_url as string) : null;
    const amountDue = Number(i.amount_due) || 0;
    return {
      id: i.id,
      number: i.number,
      company,
      amountDue,
      dueAt: i.due_at,
      source: i.primary_source,
      remindedAt: rem?.reminded_at ?? null,
      recoveredAt: rem?.recovered_at ?? null,
      recoveredAmount: rem?.recovered_amount != null ? Number(rem.recovered_amount) : null,
      contactEmail: i.contact_id ? emails.get(i.contact_id) ?? null : null,
      invoiceUrl,
      sequence: seq
        ? {
            sendsCount: seq.sends_count,
            maxSends: seq.max_sends,
            recurrenceDays: seq.recurrence_days,
            lastSentAt: seq.last_sent_at,
            nextSendAt: seq.next_send_at,
            stoppedReason: seq.stopped_at ? seq.stop_reason : null,
          }
        : null,
      proposal: defaultReminderEmail(
        { number: i.number, company, amountDue, dueAt: i.due_at, invoiceUrl },
        orgName,
      ),
    };
  };

  return NextResponse.json({
    stats: { recovered, recoveredCount, remindedPending: remindedPendingIds.size },
    overdue: overdue.map(toRow),
    recovered: recoveredInvoices.map(toRow),
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
