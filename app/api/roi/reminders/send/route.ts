import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { sendDirectEmail } from "@/lib/notifications/send";
import { invoiceIsPaid, reminderEmailHtml, stopSequence } from "@/lib/roi/reminder-sequences";

export const dynamic = "force-dynamic";

/**
 * POST — envoie la PREMIÈRE relance email d'une facture (validée à la main
 * dans la modale) et crée la séquence : les renvois suivants partent
 * automatiquement via le cron `send-invoice-reminders` selon la récurrence,
 * jusqu'au paiement (arrêt immédiat) ou au plafond max_sends.
 *
 * L'envoi part AVANT toute écriture : pas d'état « relancée » sans email
 * réellement parti. Le reply-to est l'email de l'utilisateur qui valide.
 *
 * DELETE — stoppe manuellement la séquence d'une facture.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    invoiceId?: string;
    recipientEmail?: string;
    subject?: string;
    body?: string;
    recurrenceDays?: number;
    maxSends?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const emailBody = body.body?.trim();
  const recipient = body.recipientEmail?.trim().toLowerCase();
  if (!body.invoiceId || !subject || !emailBody) {
    return NextResponse.json({ error: "invoiceId, subject et body sont requis" }, { status: 400 });
  }
  if (!recipient || !EMAIL_RE.test(recipient)) {
    return NextResponse.json({ error: "Email destinataire invalide" }, { status: 400 });
  }
  // Récurrence bornée : 0 (aucune) ou 1–30 jours ; plafond dur 1–5 envois.
  const recurrenceDays = Math.min(30, Math.max(0, Math.round(Number(body.recurrenceDays) || 0)));
  const maxSends = Math.min(5, Math.max(1, Math.round(Number(body.maxSends) || 3)));

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, number, status, amount_due, source_metadata")
    .eq("organization_id", orgId)
    .eq("id", body.invoiceId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  if (invoiceIsPaid(inv)) {
    return NextResponse.json({ error: "Cette facture est déjà payée — rien à relancer." }, { status: 400 });
  }

  // Une seule séquence ACTIVE par facture.
  const { data: existing } = await supabase
    .from("invoice_reminder_sequences")
    .select("id, stopped_at")
    .eq("organization_id", orgId)
    .eq("invoice_id", inv.id)
    .maybeSingle();
  if (existing && !existing.stopped_at) {
    return NextResponse.json({ error: "Une séquence de relance est déjà en cours pour cette facture." }, { status: 409 });
  }

  const invoiceUrl =
    typeof (inv.source_metadata as Record<string, unknown> | null)?.invoice_url === "string"
      ? ((inv.source_metadata as Record<string, unknown>).invoice_url as string)
      : null;

  // ── 1. Envoi réel d'abord ──
  const sent = await sendDirectEmail({
    to: [recipient],
    subject,
    text: emailBody,
    html: reminderEmailHtml(emailBody, invoiceUrl),
    replyTo: user.email ?? undefined,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: `Envoi impossible : ${sent.error ?? "erreur Resend"}` }, { status: 502 });
  }

  // ── 2. Trace invoice_reminders (base du cash récupéré, mécanique existante) ──
  const now = new Date();
  const { data: reminder, error: remError } = await supabase
    .from("invoice_reminders")
    .insert({
      organization_id: orgId,
      invoice_id: inv.id,
      amount_due_at_reminder: Number(inv.amount_due) || 0,
      channel: "email",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (remError) {
    return NextResponse.json(
      { error: "Email envoyé, mais la table des relances est absente — applique la migration invoice_reminders." },
      { status: 500 },
    );
  }

  // ── 3. Séquence (renvois automatiques par cron si récurrence) ──
  const nextSendAt =
    recurrenceDays > 0 && maxSends > 1 ? new Date(now.getTime() + recurrenceDays * 86_400_000).toISOString() : null;
  const seqPayload = {
    organization_id: orgId,
    invoice_id: inv.id,
    reminder_id: reminder.id,
    recipient_email: recipient,
    reply_to: user.email ?? null,
    subject,
    body: emailBody,
    recurrence_days: recurrenceDays > 0 ? recurrenceDays : null,
    max_sends: maxSends,
    sends_count: 1,
    last_sent_at: now.toISOString(),
    next_send_at: nextSendAt,
    stopped_at: null,
    stop_reason: null,
    last_error: null,
    created_by: user.id,
  };
  const { error: seqError } = existing
    ? await supabase.from("invoice_reminder_sequences").update(seqPayload).eq("id", existing.id)
    : await supabase.from("invoice_reminder_sequences").insert(seqPayload);
  if (seqError) {
    // L'email est parti et la relance est tracée — seule la récurrence manque.
    return NextResponse.json({
      ok: true,
      warning: "Relance envoyée, mais la séquence automatique n'a pas pu être créée (migration invoice_reminder_sequences à appliquer).",
    });
  }

  return NextResponse.json({ ok: true, nextSendAt });
}

export async function DELETE(request: Request) {
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

  const { data: seq } = await supabase
    .from("invoice_reminder_sequences")
    .select("id")
    .eq("organization_id", orgId)
    .eq("invoice_id", body.invoiceId)
    .maybeSingle();
  if (!seq) return NextResponse.json({ error: "Aucune séquence pour cette facture" }, { status: 404 });

  await stopSequence(supabase, seq.id, "manual");
  return NextResponse.json({ ok: true });
}
