import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { monitoredCron } from "@/lib/cron/monitor";
import {
  invoiceIsPaid,
  sendSequenceStep,
  stopSequence,
  type ReminderSequenceRow,
} from "@/lib/roi/reminder-sequences";

export const maxDuration = 300;

/**
 * Cron horaire — déroule les séquences de relance d'impayés (bloc « Relances
 * & cash récupéré ») : pour chaque séquence dont next_send_at est échu,
 *  1. re-vérifie la facture : payée → STOP immédiat (reason "paid") + le
 *     cash récupéré est attribué sur le invoice_reminders de la séquence
 *     (sans attendre l'ouverture du bloc) ;
 *  2. sinon renvoie l'email (garde-fou : jamais au-delà de max_sends —
 *     déjà garanti par sendSequenceStep qui stoppe au plafond).
 */
async function handler() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("invoice_reminder_sequences")
    .select("id, organization_id, invoice_id, reminder_id, recipient_email, reply_to, subject, body, recurrence_days, max_sends, sends_count, last_sent_at, next_send_at, stopped_at, stop_reason")
    .is("stopped_at", null)
    .not("next_send_at", "is", null)
    .lte("next_send_at", now)
    .limit(200);

  // Table absente (migration pas encore appliquée) → rien à faire.
  if (error) return NextResponse.json({ ok: true, skipped: "migration_pending" });

  const due = (data ?? []) as ReminderSequenceRow[];
  let sent = 0;
  let stoppedPaid = 0;
  let failed = 0;

  for (const seq of due) {
    const { data: inv } = await admin
      .from("invoices")
      .select("id, status, amount_due, source_metadata")
      .eq("organization_id", seq.organization_id)
      .eq("id", seq.invoice_id)
      .maybeSingle();

    if (!inv) {
      await stopSequence(admin, seq.id, "manual");
      continue;
    }

    if (invoiceIsPaid(inv)) {
      await stopSequence(admin, seq.id, "paid");
      // Attribution du cash récupéré sans attendre l'ouverture du bloc.
      if (seq.reminder_id) {
        const { data: rem } = await admin
          .from("invoice_reminders")
          .select("id, amount_due_at_reminder, recovered_at")
          .eq("id", seq.reminder_id)
          .maybeSingle();
        if (rem && !rem.recovered_at) {
          await admin
            .from("invoice_reminders")
            .update({
              recovered_at: new Date().toISOString(),
              recovered_amount: Number(rem.amount_due_at_reminder) || 0,
            })
            .eq("id", rem.id);
        }
      }
      stoppedPaid++;
      continue;
    }

    const invoiceUrl =
      typeof (inv.source_metadata as Record<string, unknown> | null)?.invoice_url === "string"
        ? ((inv.source_metadata as Record<string, unknown>).invoice_url as string)
        : null;
    const result = await sendSequenceStep(admin, seq, invoiceUrl);
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, due: due.length, sent, stoppedPaid, failed });
}

// Monitoring : chaque exécution journalisée dans cron_runs (statut, durée, erreur).
export const GET = monitoredCron("send-invoice-reminders", handler);
