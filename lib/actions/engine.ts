import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Moteur de la boîte d'actions (Suivi → Actions).
 *
 * DÉTECTEURS (déterministes, pas d'IA) : constatent une situation et proposent
 * une action à exécuter DANS l'outil — jamais exécutée sans validation.
 *  - deal silencieux ≥ 21 j (ouvert, sans contact récent) → tâche HubSpot ;
 *  - facture en retard → rappel Stripe (send_invoice) si facture Stripe,
 *    sinon tâche HubSpot de relance sur l'entreprise.
 *
 * EXÉCUTEURS : réalisent l'action validée dans l'outil (API HubSpot / Stripe)
 * et tracent le résultat. Un échec est enregistré avec sa cause exacte.
 */

export type ActionPayload = {
  /** Tâche HubSpot : sujet + corps, associée à un deal ou une entreprise. */
  subject?: string;
  body?: string;
  dealHubspotId?: string | null;
  companyHubspotId?: string | null;
  /** Relance Stripe : id de la facture Stripe (in_…). */
  stripeInvoiceId?: string;
  /** Facture Revold liée (attribution ROI cash récupéré). */
  invoiceId?: string;
};

const DAY_MS = 86_400_000;
const SILENT_DAYS = 21;

/** Détecteur : deals ouverts silencieux depuis ≥ 21 jours (top montants). */
export async function detectSilentDeals(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data } = await supabase
    .from("deals")
    .select("id, hubspot_id, name, amount, last_contacted_at, hs_last_modified_at")
    .eq("organization_id", orgId)
    .eq("is_closed_won", false)
    .eq("is_closed_lost", false)
    .order("amount", { ascending: false, nullsFirst: false })
    .limit(100);

  const cutoff = Date.now() - SILENT_DAYS * DAY_MS;
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const d of (data ?? []) as Array<{ id: string; hubspot_id: string | null; name: string | null; amount: number | null; last_contacted_at: string | null; hs_last_modified_at: string | null }>) {
    if (!d.hubspot_id) continue;
    const lastTouch = d.last_contacted_at ?? d.hs_last_modified_at;
    if (!lastTouch || new Date(lastTouch).getTime() > cutoff) continue;
    const days = Math.floor((Date.now() - new Date(lastTouch).getTime()) / DAY_MS);
    const dealName = d.name?.trim() || "Deal sans nom";
    out.push({
      dedupe_key: `silent_deal:${d.id}`,
      type: "hubspot_task",
      title: `Relancer « ${dealName} » — silencieux depuis ${days} j`,
      description: `Deal ouvert${d.amount ? ` de ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(d.amount)}` : ""} sans contact depuis ${days} jours. Valider crée une tâche HubSpot pour le propriétaire du deal.`,
      source: "detector:silent_deal",
      payload: {
        subject: `Relancer le deal « ${dealName} » (silencieux depuis ${days} j)`,
        body: `Détecté par Revold : aucun contact depuis ${days} jours sur ce deal ouvert${d.amount ? ` (${Math.round(d.amount)} €)` : ""}. Reprendre contact ou mettre à jour l'étape.`,
        dealHubspotId: d.hubspot_id,
      },
    });
    if (out.length >= 10) break;
  }
  return out;
}

/** Détecteur : factures en retard → rappel Stripe ou tâche de relance HubSpot. */
export async function detectOverdueInvoiceActions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("invoices")
    .select("id, number, amount_due, due_at, primary_source, company_id")
    .eq("organization_id", orgId)
    .gt("amount_due", 0)
    .lt("due_at", today)
    .neq("status", "void")
    .order("amount_due", { ascending: false })
    .limit(20);

  const invoices = (data ?? []) as Array<{ id: string; number: string | null; amount_due: number | null; due_at: string | null; primary_source: string | null; company_id: string | null }>;
  if (invoices.length === 0) return [];

  // Ids Stripe des factures (source_links) + entreprises HubSpot associées.
  const ids = invoices.map((i) => i.id);
  const [linksRes, compsRes] = await Promise.all([
    supabase
      .from("source_links")
      .select("internal_id, external_id")
      .eq("organization_id", orgId)
      .eq("provider", "stripe")
      .eq("entity_type", "invoice")
      .in("internal_id", ids),
    supabase
      .from("companies")
      .select("id, name, hubspot_id")
      .eq("organization_id", orgId)
      .in("id", [...new Set(invoices.map((i) => i.company_id).filter((x): x is string => !!x))]),
  ]);
  const stripeIdByInvoice = new Map(
    ((linksRes.data ?? []) as Array<{ internal_id: string; external_id: string }>).map((l) => [l.internal_id, l.external_id]),
  );
  const companyById = new Map(
    ((compsRes.data ?? []) as Array<{ id: string; name: string | null; hubspot_id: string | null }>).map((c) => [c.id, c]),
  );

  const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const inv of invoices) {
    const due = Number(inv.amount_due) || 0;
    const company = inv.company_id ? companyById.get(inv.company_id) : undefined;
    const label = `${inv.number ?? "facture"}${company?.name ? ` · ${company.name}` : ""}`;
    const stripeId = stripeIdByInvoice.get(inv.id);
    if (inv.primary_source === "stripe" && stripeId) {
      out.push({
        dedupe_key: `overdue_invoice:${inv.id}`,
        type: "stripe_send_invoice",
        title: `Relancer ${label} — ${eur(due)} en retard`,
        description: `Valider envoie le RAPPEL STRIPE officiel au client (invoice ${stripeId}). La relance est suivie dans « Cash récupéré ».`,
        source: "detector:overdue_invoice",
        payload: { stripeInvoiceId: stripeId, invoiceId: inv.id },
      });
    } else if (company?.hubspot_id) {
      out.push({
        dedupe_key: `overdue_invoice:${inv.id}`,
        type: "hubspot_task",
        title: `Relancer ${label} — ${eur(due)} en retard`,
        description: `Valider crée une tâche HubSpot de relance sur l'entreprise. La relance est suivie dans « Cash récupéré ».`,
        source: "detector:overdue_invoice",
        payload: {
          subject: `Relancer la facture ${inv.number ?? ""} (${eur(due)} en retard)`,
          body: `Détecté par Revold : facture ${inv.number ?? ""} échue le ${inv.due_at ?? "?"} — reste dû ${eur(due)}. Relancer le client.`,
          companyHubspotId: company.hubspot_id,
          invoiceId: inv.id,
        },
      });
    }
    if (out.length >= 10) break;
  }
  return out;
}

// ── Exécuteurs ──────────────────────────────────────────────────────────────

/** Crée une tâche HubSpot associée au deal ou à l'entreprise. */
export async function executeHubspotTask(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: string; associationTypeId: number }> }> = [];
  // Types d'association HubSpot definis : tâche→deal 216 · tâche→entreprise 192.
  if (payload.dealHubspotId) associations.push({ to: { id: payload.dealHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 216 }] });
  if (payload.companyHubspotId) associations.push({ to: { id: payload.companyHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 192 }] });
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/tasks", {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          hs_task_subject: payload.subject ?? "Action Revold",
          hs_task_body: payload.body ?? "",
          hs_timestamp: String(Date.now() + 2 * 86_400_000),
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
          hs_task_type: "TODO",
        },
        associations,
      }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: true, detail: `Tâche HubSpot créée (id ${d.id ?? "?"})` };
    }
    const err = await res.text();
    if (res.status === 403) {
      return { ok: false, detail: "Scope HubSpot manquant (crm.objects.tasks.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
    }
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/** Envoie le rappel officiel Stripe d'une facture (send_invoice). */
export async function executeStripeSendInvoice(
  supabase: SupabaseClient,
  orgId: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.stripeInvoiceId) return { ok: false, detail: "Id de facture Stripe manquant" };
  const { data: row } = await supabase
    .from("integrations")
    .select("access_token")
    .eq("organization_id", orgId)
    .eq("provider", "stripe")
    .eq("is_active", true)
    .maybeSingle();
  const key = row?.access_token as string | undefined;
  if (!key) return { ok: false, detail: "Clé Stripe introuvable — vérifie l'intégration Stripe." };
  try {
    const res = await fetch(`https://api.stripe.com/v1/invoices/${encodeURIComponent(payload.stripeInvoiceId)}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, detail: "Rappel Stripe envoyé au client." };
    const msg = (d as { error?: { message?: string } }).error?.message ?? `Stripe ${res.status}`;
    return { ok: false, detail: msg.slice(0, 200) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau Stripe" };
  }
}
