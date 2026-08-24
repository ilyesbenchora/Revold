/**
 * Séquences de relance d'impayés par email (bloc « Relances & cash récupéré »).
 *
 * Le premier envoi est validé à la main dans la modale (contenu éditable) ;
 * les renvois partent automatiquement via le cron `send-invoice-reminders`
 * selon la récurrence choisie, avec deux garde-fous stricts :
 *   1. plafond dur `max_sends` — jamais dépassé ;
 *   2. arrêt immédiat de la séquence dès que la facture est constatée payée
 *      (reste dû ≤ 0 ou statut payé), AVANT tout envoi.
 *
 * L'attribution du cash récupéré reste portée par `invoice_reminders`
 * (une ligne par séquence, créée au 1er envoi) — mécanique inchangée.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDirectEmail } from "@/lib/notifications/send";

export type ReminderSequenceRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  reminder_id: string | null;
  recipient_email: string;
  reply_to: string | null;
  subject: string;
  body: string;
  recurrence_days: number | null;
  max_sends: number;
  sends_count: number;
  last_sent_at: string | null;
  next_send_at: string | null;
  stopped_at: string | null;
  stop_reason: string | null;
};

type InvoiceForEmail = {
  number: string | null;
  company: string | null;
  amountDue: number;
  dueAt: string | null;
  invoiceUrl: string | null;
};

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

const frDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

/** Proposition de mail de relance par défaut (éditable dans la modale). */
export function defaultReminderEmail(inv: InvoiceForEmail, orgName: string | null): { subject: string; body: string } {
  const subject = `Relance — facture ${inv.number ?? ""} en attente de règlement`.replace(/\s+/g, " ").trim();
  const lines = [
    "Bonjour,",
    "",
    `Sauf erreur de notre part, la facture ${inv.number ?? ""}${inv.amountDue > 0 ? ` d'un montant de ${eur(inv.amountDue)}` : ""}${
      inv.dueAt ? `, arrivée à échéance le ${frDate(inv.dueAt)},` : ""
    } reste à ce jour en attente de règlement.`.replace(/\s+/g, " "),
    "",
    ...(inv.invoiceUrl ? [`Vous pouvez la consulter ici : ${inv.invoiceUrl}`, ""] : []),
    "Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce message. Dans le cas contraire, nous vous remercions de bien vouloir procéder au paiement dans les meilleurs délais.",
    "",
    "Nous restons à votre disposition pour toute question.",
    "",
    "Bien cordialement,",
    orgName ?? "",
  ];
  return { subject, body: lines.join("\n").trim() };
}

/** HTML sobre (carte blanche) pour le mail client — pas de branding néon. */
export function reminderEmailHtml(body: string, invoiceUrl: string | null): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const cta = invoiceUrl
    ? `<p style="margin:18px 0 0 0;"><a href="${invoiceUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Voir la facture</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;color:#0f172a;font-size:14px;line-height:1.6;">
    ${paragraphs}
    ${cta}
  </div>
</body>
</html>`;
}

/** Facture payée ? (mêmes critères que l'attribution du cash récupéré). */
export function invoiceIsPaid(inv: { status: string | null; amount_due: number | null }): boolean {
  return inv.status === "paid" || (inv.amount_due != null && Number(inv.amount_due) <= 0);
}

/**
 * Envoie UNE étape d'une séquence et met à jour ses compteurs.
 * Ne vérifie PAS le paiement (à faire par l'appelant avant).
 */
export async function sendSequenceStep(
  supabase: SupabaseClient,
  seq: ReminderSequenceRow,
  invoiceUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const sent = await sendDirectEmail({
    to: [seq.recipient_email],
    subject: seq.sends_count > 0 ? `${seq.subject} (relance ${seq.sends_count + 1})` : seq.subject,
    text: seq.body,
    html: reminderEmailHtml(seq.body, invoiceUrl),
    replyTo: seq.reply_to ?? undefined,
  });

  const now = new Date();
  if (!sent.ok) {
    await supabase
      .from("invoice_reminder_sequences")
      .update({ last_error: sent.error ?? "Envoi impossible" })
      .eq("id", seq.id);
    return { ok: false, error: sent.error };
  }

  const sendsCount = seq.sends_count + 1;
  const hasRecurrence = (seq.recurrence_days ?? 0) > 0;
  const reachedMax = sendsCount >= seq.max_sends;
  const nextSendAt =
    hasRecurrence && !reachedMax
      ? new Date(now.getTime() + (seq.recurrence_days as number) * 86_400_000).toISOString()
      : null;

  await supabase
    .from("invoice_reminder_sequences")
    .update({
      sends_count: sendsCount,
      last_sent_at: now.toISOString(),
      next_send_at: nextSendAt,
      last_error: null,
      ...(reachedMax && hasRecurrence ? { stopped_at: now.toISOString(), stop_reason: "max_reached" } : {}),
    })
    .eq("id", seq.id);

  // Timestamp de relance visible dans le bloc : reminded_at = dernier envoi
  // (amount_due_at_reminder reste figé au 1er envoi — base du cash récupéré).
  if (seq.reminder_id) {
    await supabase
      .from("invoice_reminders")
      .update({ reminded_at: now.toISOString() })
      .eq("id", seq.reminder_id)
      .is("recovered_at", null);
  }

  return { ok: true };
}

/** Stoppe une séquence (paiement détecté, plafond, ou arrêt manuel). */
export async function stopSequence(
  supabase: SupabaseClient,
  sequenceId: string,
  reason: "paid" | "max_reached" | "manual",
): Promise<void> {
  await supabase
    .from("invoice_reminder_sequences")
    .update({ stopped_at: new Date().toISOString(), stop_reason: reason, next_send_at: null })
    .eq("id", sequenceId)
    .is("stopped_at", null);
}
