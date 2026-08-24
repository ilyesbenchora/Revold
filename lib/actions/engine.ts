import type { SupabaseClient } from "@supabase/supabase-js";
import { hubFetch } from "@/lib/integrations/hub-fetch";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";

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
  /** Fusion HubSpot : type d'objet + fiche principale (conservée) + doublon absorbé. */
  mergeObjectType?: "contacts" | "companies";
  primaryHubspotId?: string;
  mergeHubspotId?: string;
  /** Enrichissement CRM : propriétés HubSpot à écrire sur l'entreprise. */
  hubspotProperties?: Record<string, string>;
  /** Rattachement canonique : fiche facturation orpheline → fiche CRM. */
  sourceCompanyId?: string;
  targetCompanyId?: string;
  /** Création de deal de renouvellement. */
  dealName?: string;
  dealAmount?: number;
  dealCloseDate?: string;
  /** Création de contact facturation. */
  contactEmail?: string;
  /** Relance par séquence HubSpot (envoi réel au nom de l'owner). */
  sequenceId?: string;
  sequenceName?: string;
  /** Déclaration de hiérarchie de groupe : associer parent/enfant dans HubSpot
   *  (l'entité de facturation devient le parent de l'entité qui a signé). */
  parentHubspotId?: string;
  childHubspotId?: string;
  parentCompanyName?: string;
  childCompanyName?: string;
  /** Signal qui a révélé la paire : correspondance de montant deal↔facture
   *  (sens sûr), domaine web partagé (sens proposé, inversable), même SIREN
   *  avec SIRETs distincts (siège/établissement), ou nom apparenté (signal
   *  FAIBLE : préfixe ou racine + marqueur de groupe, jamais du flou). */
  groupSignal?: "billing_match" | "shared_domain" | "same_siren" | "name_match";
  sharedDomain?: string;
  sharedSiren?: string;
  sharedName?: string;
  /** Hygiène des projections : étape à mapper « gagnée » / pipeline à exclure du prévisionnel. */
  stageName?: string;
  pipelineName?: string;
};

const DAY_MS = 86_400_000;
const SILENT_DAYS = 21;

/**
 * Familles d'actions AUTOMATISABLES par l'utilisateur (opt-in explicite,
 * lignes auto_action_<clé> dans entity_resolution_config). duplicate_merge
 * est volontairement exclue : une fusion HubSpot est irréversible, elle reste
 * validée fiche par fiche.
 */
export const AUTOMATABLE_KEYS = [
  "silent_deal",
  "overdue_invoice",
  "link_company",
  "renewal_deal",
  "revenue_leakage",
  "billing_contact",
] as const;

/**
 * Entité de référence d'une action (pour l'automatisation PAR ENTITÉ) : le
 * deal pour les relances commerciales, l'entreprise pour l'enrichissement /
 * renouvellements / rattachements, le contact pour les créations. Permet
 * d'automatiser une famille pour UN client précis, ou d'exclure un compte
 * clé d'une famille globalement automatisée.
 */
export function actionEntityRef(payload: ActionPayload): { key: string; label: string } | null {
  if (payload.dealHubspotId) return { key: `deal:${payload.dealHubspotId}`, label: "ce deal" };
  if (payload.companyHubspotId) return { key: `company:${payload.companyHubspotId}`, label: "cette entreprise" };
  if (payload.targetCompanyId) return { key: `company_canonical:${payload.targetCompanyId}`, label: "cette entreprise" };
  if (payload.contactEmail) return { key: `contact:${payload.contactEmail.toLowerCase()}`, label: "ce contact" };
  return null;
}

/**
 * Détecteur : deals ouverts silencieux depuis ≥ 21 jours (top montants).
 * Avec une séquence configurée (licence Sales Pro/Enterprise, Paramètres →
 * Intégrations), la relance proposée est un VRAI email : inscription du
 * contact dans la séquence au nom du propriétaire du deal. Sinon : tâche.
 */
export async function detectSilentDeals(
  supabase: SupabaseClient,
  orgId: string,
  sequence?: { id: string; name: string } | null,
  settings: SilentDealSettings = SILENT_DEAL_DEFAULT,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data } = await supabase
    .from("deals")
    .select("id, hubspot_id, name, amount, last_contacted_at, hs_last_modified_at")
    .eq("organization_id", orgId)
    .eq("is_closed_won", false)
    .eq("is_closed_lost", false)
    .order("amount", { ascending: false, nullsFirst: false })
    .limit(100);

  const cutoff = Date.now() - settings.silentDays * DAY_MS;
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const d of (data ?? []) as Array<{ id: string; hubspot_id: string | null; name: string | null; amount: number | null; last_contacted_at: string | null; hs_last_modified_at: string | null }>) {
    if (!d.hubspot_id) continue;
    const lastTouch = d.last_contacted_at ?? d.hs_last_modified_at;
    if (!lastTouch || new Date(lastTouch).getTime() > cutoff) continue;
    const days = Math.floor((Date.now() - new Date(lastTouch).getTime()) / DAY_MS);
    const dealName = d.name?.trim() || "Deal sans nom";
    const amountTxt = d.amount ? ` de ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(d.amount)}` : "";
    if (sequence) {
      out.push({
        dedupe_key: `silent_deal:${d.id}`,
        type: "hubspot_sequence_enroll",
        title: `Relancer « ${dealName} » par email — silencieux depuis ${days} j`,
        description: `Deal ouvert${amountTxt} sans contact depuis ${days} jours. Valider inscrit le contact du deal dans la séquence « ${sequence.name} » au nom du propriétaire : l'email de relance part réellement de sa boîte.`,
        source: "detector:silent_deal",
        payload: { dealHubspotId: d.hubspot_id, sequenceId: sequence.id, sequenceName: sequence.name },
      });
    } else {
      out.push({
        dedupe_key: `silent_deal:${d.id}`,
        type: "hubspot_task",
        title: `Relancer « ${dealName} » — silencieux depuis ${days} j`,
        description: `Deal ouvert${amountTxt} sans contact depuis ${days} jours. Valider crée une tâche HubSpot pour le propriétaire du deal.`,
        source: "detector:silent_deal",
        payload: {
          subject: `Relancer le deal « ${dealName} » (silencieux depuis ${days} j)`,
          body: `Détecté par Revold : aucun contact depuis ${days} jours sur ce deal ouvert${d.amount ? ` (${Math.round(d.amount)} €)` : ""}. Reprendre contact ou mettre à jour l'étape.`,
          dealHubspotId: d.hubspot_id,
        },
      });
    }
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Cadence du cycle de recouvrement — DÉFAUTS, personnalisables par l'utilisateur
 * (catalogue des actions → « Relancer tous les N jours, M relances maximum »).
 */
export type RelanceCadence = {
  /** Jours minimum entre deux relances d'une même facture. */
  intervalDays: number;
  /** Nombre maximum de relances avant sortie du cycle. */
  maxRelances: number;
  /** CONDITION DE SORTIE : un paiement partiel arrête les relances. */
  stopOnPartialPayment: boolean;
  /** SORTIE DU CYCLE : escalade en tâche de recouvrement humaine (sinon arrêt simple). */
  escalateAfterMax: boolean;
};
export const RELANCE_CADENCE_DEFAULT: RelanceCadence = {
  intervalDays: 7,
  maxRelances: 3,
  stopOnPartialPayment: false,
  escalateAfterMax: true,
};

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Cadence + conditions de sortie validées (bornes : 1–90 jours, 1–10 relances). */
export function normalizeCadence(raw: unknown): RelanceCadence {
  const c = (raw ?? {}) as Partial<RelanceCadence>;
  return {
    intervalDays: clampInt(c.intervalDays, 1, 90, RELANCE_CADENCE_DEFAULT.intervalDays),
    maxRelances: clampInt(c.maxRelances, 1, 10, RELANCE_CADENCE_DEFAULT.maxRelances),
    stopOnPartialPayment: typeof c.stopOnPartialPayment === "boolean" ? c.stopOnPartialPayment : RELANCE_CADENCE_DEFAULT.stopOnPartialPayment,
    escalateAfterMax: typeof c.escalateAfterMax === "boolean" ? c.escalateAfterMax : RELANCE_CADENCE_DEFAULT.escalateAfterMax,
  };
}

/** Seuil de silence d'un deal (condition d'entrée du détecteur), choisi par l'utilisateur. */
export type SilentDealSettings = { silentDays: number };
export const SILENT_DEAL_DEFAULT: SilentDealSettings = { silentDays: SILENT_DAYS };
export function normalizeSilentSettings(raw: unknown): SilentDealSettings {
  const c = (raw ?? {}) as Partial<SilentDealSettings>;
  return { silentDays: clampInt(c.silentDays, 3, 180, SILENT_DAYS) };
}

/**
 * Détecteur : factures en retard → rappel Stripe ou tâche de relance HubSpot.
 * CYCLE DE RECOUVREMENT avec conditions d'arrêt explicites :
 *  - le paiement reçu STOPPE tout (le détecteur ne cible que les restes dus) ;
 *  - `intervalDays` jours minimum entre deux relances d'une même facture ;
 *  - `maxRelances` relances maximum, puis ESCALADE : une tâche de recouvrement
 *    humaine (plus aucun email automatique) ;
 *  - une relance refusée ou en attente bloque la suivante (pas d'empilement).
 * La cadence est choisie par l'utilisateur (catalogue des actions).
 */
export async function detectOverdueInvoiceActions(
  supabase: SupabaseClient,
  orgId: string,
  cadence: RelanceCadence = RELANCE_CADENCE_DEFAULT,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { intervalDays: RELANCE_INTERVAL_DAYS, maxRelances: RELANCE_MAX } = cadence;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("invoices")
    .select("id, number, amount_due, amount_paid, due_at, primary_source, company_id")
    .eq("organization_id", orgId)
    .gt("amount_due", 0)
    .lt("due_at", today)
    .neq("status", "void")
    .order("amount_due", { ascending: false })
    .limit(20);

  const invoices = (data ?? []) as Array<{ id: string; number: string | null; amount_due: number | null; amount_paid: number | null; due_at: string | null; primary_source: string | null; company_id: string | null }>;
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

  // ── Historique de relances par facture (cadence + plafond + escalade) ──
  const { data: priorData } = await supabase
    .from("action_items")
    .select("dedupe_key, status, decided_at")
    .eq("organization_id", orgId)
    .eq("source", "detector:overdue_invoice")
    .limit(2000);
  type Cycle = { hasPending: boolean; relances: number; lastDecidedAt: string | null; escalated: boolean };
  const cycles = new Map<string, Cycle>();
  for (const p of (priorData ?? []) as Array<{ dedupe_key: string; status: string; decided_at: string | null }>) {
    // Clés : overdue_invoice:<id>[:rN] · overdue_invoice_escalation:<id>
    const esc = p.dedupe_key.startsWith("overdue_invoice_escalation:");
    const invId = esc
      ? p.dedupe_key.slice("overdue_invoice_escalation:".length)
      : p.dedupe_key.slice("overdue_invoice:".length).split(":")[0];
    const c = cycles.get(invId) ?? { hasPending: false, relances: 0, lastDecidedAt: null, escalated: false };
    if (esc) c.escalated = true;
    else {
      if (p.status === "pending") c.hasPending = true;
      if (p.status === "executed") c.relances++;
      if (p.decided_at && (!c.lastDecidedAt || p.decided_at > c.lastDecidedAt)) c.lastDecidedAt = p.decided_at;
    }
    cycles.set(invId, c);
  }

  const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const stopNote = "S'arrête dès réception du paiement";
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const inv of invoices) {
    const due = Number(inv.amount_due) || 0;
    const company = inv.company_id ? companyById.get(inv.company_id) : undefined;
    const label = `${inv.number ?? "facture"}${company?.name ? ` · ${company.name}` : ""}`;
    const stripeId = stripeIdByInvoice.get(inv.id);
    const cycle = cycles.get(inv.id) ?? { hasPending: false, relances: 0, lastDecidedAt: null, escalated: false };

    // ── CONDITION DE SORTIE choisie : un paiement partiel arrête le cycle ──
    if (cadence.stopOnPartialPayment && (Number(inv.amount_paid) || 0) > 0) continue;

    // Une relance en attente (ou refusée récemment) bloque la suivante.
    if (cycle.hasPending) continue;
    if (cycle.lastDecidedAt && Date.now() - new Date(cycle.lastDecidedAt).getTime() < RELANCE_INTERVAL_DAYS * DAY_MS) continue;

    // ── Plafond atteint : sortie du cycle (escalade humaine si demandée) ──
    if (cycle.relances >= RELANCE_MAX) {
      if (cadence.escalateAfterMax && !cycle.escalated && company?.hubspot_id) {
        out.push({
          dedupe_key: `overdue_invoice_escalation:${inv.id}`,
          type: "hubspot_task",
          title: `Escalade recouvrement ${label} — ${eur(due)} malgré ${RELANCE_MAX} relances`,
          description: `${RELANCE_MAX} relances envoyées sans paiement : plus aucun email automatique pour cette facture. Valider crée une tâche de recouvrement pour un traitement humain (appel, échéancier, mise en demeure).`,
          source: "detector:overdue_invoice",
          payload: {
            subject: `Recouvrement : facture ${inv.number ?? ""} — ${eur(due)} impayés après ${RELANCE_MAX} relances`,
            body: `Détecté par Revold : facture ${inv.number ?? ""} échue le ${inv.due_at ?? "?"}, reste dû ${eur(due)} malgré ${RELANCE_MAX} relances. Passer en recouvrement humain : appel, échéancier ou mise en demeure.`,
            companyHubspotId: company.hubspot_id,
            invoiceId: inv.id,
          },
        });
      }
      continue;
    }

    // ── Relance n° suivant (clé du 1er cycle inchangée — compat historique) ──
    const n = cycle.relances + 1;
    const key = n === 1 ? `overdue_invoice:${inv.id}` : `overdue_invoice:${inv.id}:r${n}`;
    const cycleNote = `Relance ${n}/${RELANCE_MAX} · cadence : 1 relance tous les ${RELANCE_INTERVAL_DAYS} jours · ${stopNote}${cadence.stopOnPartialPayment ? " (même partiel)" : ""} ; après ${RELANCE_MAX} relances, ${cadence.escalateAfterMax ? "escalade en tâche de recouvrement humaine" : "arrêt du cycle"}.`;
    if (inv.primary_source === "stripe" && stripeId) {
      out.push({
        dedupe_key: key,
        type: "stripe_send_invoice",
        title: `Relancer ${label} — ${eur(due)} en retard${n > 1 ? ` (relance ${n})` : ""}`,
        description: `Valider envoie le RAPPEL STRIPE officiel au client (invoice ${stripeId}). ${cycleNote} Suivie dans « Cash récupéré ».`,
        source: "detector:overdue_invoice",
        // companyHubspotId = référence CLIENT pour l'automatisation par entité.
        payload: { stripeInvoiceId: stripeId, invoiceId: inv.id, companyHubspotId: company?.hubspot_id ?? null },
      });
    } else if (company?.hubspot_id) {
      out.push({
        dedupe_key: key,
        type: "hubspot_task",
        title: `Relancer ${label} — ${eur(due)} en retard${n > 1 ? ` (relance ${n})` : ""}`,
        description: `Valider crée une tâche HubSpot de relance sur l'entreprise. ${cycleNote} Suivie dans « Cash récupéré ».`,
        source: "detector:overdue_invoice",
        payload: {
          subject: `Relancer la facture ${inv.number ?? ""} (${eur(due)} en retard — relance ${n}/${RELANCE_MAX})`,
          body: `Détecté par Revold : facture ${inv.number ?? ""} échue le ${inv.due_at ?? "?"} — reste dû ${eur(due)}. Relancer le client (relance ${n}/${RELANCE_MAX}).`,
          companyHubspotId: company.hubspot_id,
          invoiceId: inv.id,
        },
      });
    }
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Détecteur : DOUBLONS à fusionner, piloté par les règles de déduplication
 * activées (Paramètres → Modèle de données). Activer une règle « Fusion
 * automatique » ne fusionne JAMAIS silencieusement : elle alimente cette file,
 * et chaque fusion est validée ici avant l'appel HubSpot (irréversible).
 *  - dedup_contact_email  → contacts partageant le même email ;
 *  - dedup_company_siren / dedup_company_intl_vat → entreprises partageant le
 *    même domaine (le SIREN/TVA étant unique en canonique, le doublon type est
 *    la fiche sans identifiant à absorber dans la fiche identifiée).
 */
export async function detectMergeCandidates(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data: rules } = await supabase
    .from("entity_resolution_config")
    .select("rule_id, enabled")
    .eq("organization_id", orgId)
    .in("rule_id", ["dedup_contact_email", "dedup_company_siren", "dedup_company_intl_vat"]);
  const enabled = new Set(((rules ?? []) as Array<{ rule_id: string; enabled: boolean }>).filter((r) => r.enabled).map((r) => r.rule_id));
  if (enabled.size === 0) return [];

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  const pairKey = (t: string, a: string, b: string) => `merge:${t}:${[a, b].sort().join(":")}`;

  // ── Contacts en doublon (même email) ──
  if (enabled.has("dedup_contact_email")) {
    const { data } = await supabase
      .from("contacts")
      .select("id, hubspot_id, email, full_name, created_at")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .not("email", "is", null)
      .limit(3000);
    const byEmail = new Map<string, Array<{ hubspot_id: string; full_name: string | null; created_at: string | null }>>();
    for (const c of (data ?? []) as Array<{ hubspot_id: string | null; email: string | null; full_name: string | null; created_at: string | null }>) {
      const email = (c.email ?? "").trim().toLowerCase();
      if (!email || !c.hubspot_id) continue;
      (byEmail.get(email) ?? byEmail.set(email, []).get(email)!).push({ hubspot_id: c.hubspot_id, full_name: c.full_name, created_at: c.created_at });
    }
    for (const [email, list] of byEmail) {
      if (list.length < 2) continue;
      // Fiche principale = la plus ancienne (historique d'activités conservé).
      const sorted = [...list].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      const [primary, dup] = [sorted[0], sorted[1]];
      out.push({
        dedupe_key: pairKey("contacts", primary.hubspot_id, dup.hubspot_id),
        type: "hubspot_merge",
        title: `Fusionner les contacts en doublon « ${email} »`,
        description: `${list.length} fiches contact partagent cet email (règle « email corporate » activée). Valider fusionne dans HubSpot — IRRÉVERSIBLE : la fiche la plus ancienne${primary.full_name ? ` (${primary.full_name})` : ""} est conservée, le doublon est absorbé.`,
        source: "detector:duplicate_merge",
        payload: { mergeObjectType: "contacts", primaryHubspotId: primary.hubspot_id, mergeHubspotId: dup.hubspot_id },
      });
      if (out.length >= 10) return out;
    }
  }

  // ── Entreprises en doublon (même domaine) ──
  if (enabled.has("dedup_company_siren") || enabled.has("dedup_company_intl_vat")) {
    const { data } = await supabase
      .from("companies")
      .select("id, hubspot_id, name, domain, siren, vat_number, created_at")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .not("domain", "is", null)
      .limit(3000);
    const byDomain = new Map<string, Array<{ hubspot_id: string; name: string | null; siren: string | null; vat_number: string | null; created_at: string | null }>>();
    for (const c of (data ?? []) as Array<{ hubspot_id: string | null; name: string | null; domain: string | null; siren: string | null; vat_number: string | null; created_at: string | null }>) {
      const domain = (c.domain ?? "").trim().toLowerCase();
      if (!domain || !c.hubspot_id) continue;
      (byDomain.get(domain) ?? byDomain.set(domain, []).get(domain)!).push({ hubspot_id: c.hubspot_id, name: c.name, siren: c.siren, vat_number: c.vat_number, created_at: c.created_at });
    }
    for (const [domain, list] of byDomain) {
      if (list.length < 2) continue;
      // Fiche principale = celle qui porte un identifiant fort (SIREN/TVA), sinon la plus ancienne.
      const score = (c: { siren: string | null; vat_number: string | null }) => (c.siren ? 2 : 0) + (c.vat_number ? 1 : 0);
      const sorted = [...list].sort((a, b) => score(b) - score(a) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      const [primary, dup] = [sorted[0], sorted[1]];
      out.push({
        dedupe_key: pairKey("companies", primary.hubspot_id, dup.hubspot_id),
        type: "hubspot_merge",
        title: `Fusionner les entreprises en doublon « ${primary.name ?? domain} »`,
        description: `${list.length} fiches entreprise partagent le domaine ${domain} (règles d'identification entreprise activées). Valider fusionne dans HubSpot — IRRÉVERSIBLE : la fiche ${primary.siren ? "porteuse du SIREN" : primary.vat_number ? "porteuse du N° TVA" : "la plus ancienne"} est conservée, le doublon est absorbé.`,
        source: "detector:duplicate_merge",
        payload: { mergeObjectType: "companies", primaryHubspotId: primary.hubspot_id, mergeHubspotId: dup.hubspot_id },
      });
      if (out.length >= 10) break;
    }
  }
  return out;
}

/** Normalisation légère d'un nom d'entreprise (formes juridiques retirées). */
function normCompanyName(name: string | null): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|scop|snc|gmbh|ltd|inc|llc|bv)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Détecteur : entreprise vue côté facturation SANS lien CRM alors qu'une fiche
 * CRM correspond (même nom normalisé ou même domaine) — l'action relie les
 * deux fiches canoniques : le CA devient attribuable compte par compte.
 */
export async function detectUnlinkedCompanies(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const [{ data: orphansData }, { data: crmData }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, domain, siren, vat_number")
      .eq("organization_id", orgId)
      .is("hubspot_id", null)
      .limit(1000),
    supabase
      .from("companies")
      .select("id, name, domain")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .limit(3000),
  ]);
  const orphans = (orphansData ?? []) as Array<{ id: string; name: string | null; domain: string | null; siren: string | null; vat_number: string | null }>;
  const crm = (crmData ?? []) as Array<{ id: string; name: string | null; domain: string | null }>;
  if (orphans.length === 0 || crm.length === 0) return [];

  const crmByNorm = new Map<string, { id: string; name: string | null }>();
  const crmByDomain = new Map<string, { id: string; name: string | null }>();
  for (const c of crm) {
    const n = normCompanyName(c.name);
    if (n && !crmByNorm.has(n)) crmByNorm.set(n, c);
    if (c.domain) crmByDomain.set(c.domain.toLowerCase(), c);
  }

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const o of orphans) {
    const norm = normCompanyName(o.name);
    const match = (norm && crmByNorm.get(norm)) || (o.domain && crmByDomain.get(o.domain.toLowerCase())) || null;
    if (!match || match.id === o.id) continue;
    out.push({
      dedupe_key: `link_company:${o.id}`,
      type: "link_company",
      title: `Relier « ${o.name ?? "entreprise"} » (facturation) à « ${match.name ?? "fiche CRM"} » (CRM)`,
      description: `Les deux fiches désignent la même entreprise (${norm && normCompanyName(match.name) === norm ? "même nom" : "même domaine"}) mais ne sont pas reliées : factures et abonnements restent invisibles côté CRM. Valider fusionne les fiches Revold — le CA de ce compte devient attribuable et les identifiants (SIREN/TVA) sont reportés sur la fiche CRM.`,
      source: "detector:link_company",
      payload: { sourceCompanyId: o.id, targetCompanyId: match.id },
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Détecteur : abonnement actif dont la période se termine sous 60 jours SANS
 * deal de renouvellement ouvert sur le compte — l'action crée le deal dans
 * HubSpot (montant = MRR × 12, closing = fin de période). Le forecast intègre
 * enfin le récurrent à renouveler.
 */
export async function detectMissingRenewalDeals(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const today = new Date();
  const in60d = new Date(today.getTime() + 60 * DAY_MS).toISOString();
  const { data: subsData } = await supabase
    .from("subscriptions")
    .select("id, mrr, current_period_end, company_id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .not("company_id", "is", null)
    .gt("mrr", 0)
    .gte("current_period_end", today.toISOString())
    .lte("current_period_end", in60d)
    .limit(100);
  const subs = (subsData ?? []) as Array<{ id: string; mrr: number | null; current_period_end: string | null; company_id: string | null }>;
  if (subs.length === 0) return [];

  const companyIds = [...new Set(subs.map((s) => s.company_id!))];
  const [{ data: compData }, { data: openDeals }] = await Promise.all([
    supabase.from("companies").select("id, name, hubspot_id").eq("organization_id", orgId).in("id", companyIds),
    supabase
      .from("deals")
      .select("company_id")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .in("company_id", companyIds),
  ]);
  const compById = new Map(((compData ?? []) as Array<{ id: string; name: string | null; hubspot_id: string | null }>).map((c) => [c.id, c]));
  const hasOpenDeal = new Set(((openDeals ?? []) as Array<{ company_id: string | null }>).map((d) => d.company_id).filter(Boolean));

  const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const s of subs) {
    const comp = compById.get(s.company_id!);
    if (!comp?.hubspot_id || hasOpenDeal.has(s.company_id!)) continue;
    const arr = Math.round((Number(s.mrr) || 0) * 12);
    const endDate = (s.current_period_end ?? "").slice(0, 10);
    out.push({
      dedupe_key: `renewal:${s.id}:${endDate}`,
      type: "hubspot_create_deal",
      title: `Créer le deal de renouvellement « ${comp.name ?? "compte"} » (${eur(arr)})`,
      description: `Abonnement actif de ${eur(Math.round(Number(s.mrr) || 0))}/mois se terminant le ${endDate} — aucun deal ouvert sur ce compte. Valider crée le deal de renouvellement dans HubSpot (montant ${eur(arr)}, closing ${endDate}) : le forecast pondéré intègre enfin ce récurrent.`,
      source: "detector:renewal_deal",
      payload: {
        companyHubspotId: comp.hubspot_id,
        dealName: `Renouvellement — ${comp.name ?? "compte"}`,
        dealAmount: arr,
        dealCloseDate: endDate,
      },
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Détecteur : REVENUE LEAKAGE — deal gagné depuis ≥ 30 j dont les factures
 * liées couvrent moins de 90 % du montant signé. L'action crée une tâche
 * chiffrée pour l'owner : ce qui a été vendu mais jamais (entièrement) facturé.
 */
export async function detectRevenueLeakage(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  // GARDE-FOU onboarding : sans AUCUNE facture synchronisée (pas d'outil de
  // facturation connecté, ou rien d'importé), « signé vs facturé » est
  // indécidable — chaque deal gagné serait un faux positif « non facturé ».
  // On ne détecte rien tant qu'une source de factures n'alimente pas la base.
  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if ((invoiceCount ?? 0) === 0) return [];

  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, hubspot_id, name, amount, close_date")
    .eq("organization_id", orgId)
    .eq("is_closed_won", true)
    .gt("amount", 0)
    .lte("close_date", cutoff)
    .order("amount", { ascending: false })
    .limit(200);
  const deals = ((dealsData ?? []) as Array<{ id: string; hubspot_id: string | null; name: string | null; amount: number | null; close_date: string | null }>)
    .filter((d) => d.hubspot_id);
  if (deals.length === 0) return [];

  const { data: invData } = await supabase
    .from("invoices")
    .select("deal_id, amount_total")
    .eq("organization_id", orgId)
    .in("deal_id", deals.map((d) => d.id));
  const billedByDeal = new Map<string, number>();
  for (const i of (invData ?? []) as Array<{ deal_id: string | null; amount_total: number | null }>) {
    if (!i.deal_id) continue;
    billedByDeal.set(i.deal_id, (billedByDeal.get(i.deal_id) ?? 0) + (Number(i.amount_total) || 0));
  }

  const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const d of deals) {
    const signed = Number(d.amount) || 0;
    const billed = billedByDeal.get(d.id) ?? 0;
    if (billed >= signed * 0.9) continue;
    const gap = Math.round(signed - billed);
    const dealName = d.name?.trim() || "Deal sans nom";
    out.push({
      dedupe_key: `leakage:${d.id}`,
      type: "hubspot_task",
      title: `Écart signé vs facturé sur « ${dealName} » — ${eur(gap)} non facturés`,
      description: `Deal gagné le ${d.close_date ?? "?"} pour ${eur(signed)}, factures rattachées : ${eur(Math.round(billed))}. Valider crée une tâche chiffrée pour le propriétaire du deal — ce cash a été vendu mais jamais (entièrement) facturé.`,
      source: "detector:revenue_leakage",
      payload: {
        subject: `Facturer l'écart sur « ${dealName} » : ${eur(gap)} signés non facturés`,
        body: `Détecté par Revold : deal gagné le ${d.close_date ?? "?"} pour ${eur(signed)}, total facturé rattaché ${eur(Math.round(billed))} → écart ${eur(gap)}. Vérifier la facturation (facture manquante, montant partiel, ou facture non rattachée au deal).`,
        dealHubspotId: d.hubspot_id,
      },
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Détecteur : CONTACT FACTURATION manquant côté CRM — un contact relié à un
 * outil de facturation (email connu) n'existe pas dans HubSpot. L'action crée
 * le contact rattaché à l'entreprise : la règle « email exact » fonctionne
 * ensuite pour tous les rapprochements.
 */
export async function detectMissingBillingContacts(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data } = await supabase
    .from("contacts")
    .select("id, email, full_name, company_id")
    .eq("organization_id", orgId)
    .is("hubspot_id", null)
    .not("email", "is", null)
    .limit(500);
  const candidates = (data ?? []) as Array<{ id: string; email: string | null; full_name: string | null; company_id: string | null }>;
  if (candidates.length === 0) return [];

  // Seuls les contacts VENUS d'un outil de facturation (source_links) comptent.
  const { data: links } = await supabase
    .from("source_links")
    .select("internal_id, provider")
    .eq("organization_id", orgId)
    .eq("entity_type", "contact")
    .in("internal_id", candidates.map((c) => c.id));
  const providerByContact = new Map(
    ((links ?? []) as Array<{ internal_id: string; provider: string }>)
      .filter((l) => l.provider !== "hubspot")
      .map((l) => [l.internal_id, l.provider]),
  );
  if (providerByContact.size === 0) return [];

  const companyIds = [...new Set(candidates.map((c) => c.company_id).filter((x): x is string => !!x))];
  const { data: comps } = companyIds.length > 0
    ? await supabase.from("companies").select("id, name, hubspot_id").eq("organization_id", orgId).in("id", companyIds)
    : { data: [] };
  const compById = new Map(((comps ?? []) as Array<{ id: string; name: string | null; hubspot_id: string | null }>).map((c) => [c.id, c]));

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const c of candidates) {
    const provider = providerByContact.get(c.id);
    if (!provider || !c.email) continue;
    const comp = c.company_id ? compById.get(c.company_id) : undefined;
    out.push({
      dedupe_key: `billing_contact:${c.id}`,
      type: "hubspot_create_contact",
      title: `Créer le contact facturation « ${c.email} » dans le CRM`,
      description: `Ce contact existe côté ${provider} mais pas dans HubSpot${comp?.name ? ` (entreprise « ${comp.name} »)` : ""}. Valider le crée dans le CRM${comp?.hubspot_id ? ", rattaché à l'entreprise," : ""} — la règle « email exact » fonctionnera ensuite pour tous les rapprochements de ce compte.`,
      source: "detector:billing_contact",
      payload: {
        contactEmail: c.email,
        subject: c.full_name ?? undefined,
        companyHubspotId: comp?.hubspot_id ?? null,
      },
    });
    if (out.length >= 10) break;
  }
  return out;
}

// ── Hygiène des projections (prévisionnel de trésorerie) ───────────────────
// Trois détecteurs nés d'un cas réel : une étape « ENCAISSÉ » non mappée
// gagnée, des clones de club deal et un pipeline de financement gonflaient le
// solde projeté de plusieurs millions. L'app DÉTECTE et propose ; la
// correction des deux premiers se fait DANS le CRM par l'utilisateur (tâche
// HubSpot) — jamais par Revold, la sync réécrirait de toute façon le mapping.

const fmtEurAct = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));

/**
 * Détecteur : étape de pipeline à l'évidence TERMINALE (nom « encaissé /
 * gagné / won » ou probabilité ≥ 90 %) mais non marquée « gagnée » dans
 * HubSpot → ses deals comptent comme du pipeline FUTUR dans le prévisionnel
 * alors que l'argent est censé être déjà là : double comptage. L'action est
 * une tâche HubSpot : c'est un réglage du CRM, à corriger par l'utilisateur
 * (la synchronisation réécrit le mapping depuis HubSpot à chaque passage).
 */
export async function detectUnmappedWonStages(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, probability, pipeline_name")
    .eq("organization_id", orgId)
    .eq("is_closed_won", false)
    .eq("is_closed_lost", false)
    .limit(200);
  const wonName = /encaiss|gagn|\bwon\b/i;
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const st of (stages ?? []) as Array<{ id: string; name: string | null; probability: number | null; pipeline_name: string | null }>) {
    const prob = st.probability != null ? Number(st.probability) : null;
    if (!((prob != null && prob >= 90) || wonName.test(st.name ?? ""))) continue;
    const { data: deals } = await supabase
      .from("deals")
      .select("hubspot_id, name, amount")
      .eq("organization_id", orgId)
      .eq("stage_id", st.id)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .not("amount", "is", null)
      .order("amount", { ascending: false })
      .limit(200);
    const rows = ((deals ?? []) as Array<{ hubspot_id: string | null; name: string | null; amount: number | null }>).filter(
      (d) => (Number(d.amount) || 0) > 0,
    );
    if (rows.length === 0) continue;
    const total = rows.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const top = rows.find((d) => d.hubspot_id);
    const stageName = st.name ?? "(étape sans nom)";
    out.push({
      dedupe_key: `won_stage:${st.id}`,
      type: "hubspot_task",
      title: `Marquer l'étape « ${stageName} » comme « gagnée » dans HubSpot${prob != null ? ` (probabilité ${Math.round(prob)} %)` : ""}`,
      description:
        `${rows.length} deal${rows.length > 1 ? "s" : ""} ouvert${rows.length > 1 ? "s" : ""} pour ${fmtEurAct(total)} dorment dans cette étape${st.pipeline_name ? ` du pipeline « ${st.pipeline_name} »` : ""}. ` +
        `Tant qu'elle n'est pas déclarée « Gagné » dans HubSpot (Paramètres → Objets → Transactions → Pipelines), ces montants comptent comme du pipeline FUTUR dans le prévisionnel de trésorerie — ` +
        `alors qu'un deal encaissé est déjà dans le solde bancaire : le même argent est compté deux fois. ` +
        `Valider crée une tâche HubSpot sur le deal principal pour faire ce réglage ; la prochaine synchronisation sortira ces deals de la projection.`,
      source: "detector:won_stage_mapping",
      payload: {
        subject: `Marquer l'étape « ${stageName} » comme « Gagné » dans les réglages du pipeline`,
        body:
          `Étape « ${stageName} »${st.pipeline_name ? ` (pipeline « ${st.pipeline_name} »)` : ""}${prob != null ? `, probabilité ${Math.round(prob)} %` : ""} : ` +
          `${rows.length} deal(s) ouvert(s) pour ${fmtEurAct(total)}. Dans HubSpot : Paramètres → Objets → Transactions → Pipelines → cocher « Gagné » sur cette étape. ` +
          `Détecté par Revold : sans ce réglage, ces montants gonflent le prévisionnel de trésorerie (double comptage avec le solde bancaire).`,
        dealHubspotId: top?.hubspot_id ?? null,
        stageName,
        pipelineName: st.pipeline_name ?? undefined,
      },
    });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Détecteur : DEALS CLONES — plusieurs deals ouverts au MÊME montant (≥ 10 k€)
 * avec un même début de nom (≥ 12 caractères). Typique d'une opération
 * dupliquée par contact (club deal, financement) : le pipeline et les
 * projections comptent N fois la même affaire. L'action est une tâche
 * HubSpot : fusionner/fermer les doublons est une décision CRM de
 * l'utilisateur (parfois les clones sont voulus, un ticket par investisseur).
 */
export async function detectDuplicateDeals(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data } = await supabase
    .from("deals")
    .select("hubspot_id, name, amount")
    .eq("organization_id", orgId)
    .eq("is_closed_won", false)
    .eq("is_closed_lost", false)
    .not("amount", "is", null)
    .gte("amount", 10_000)
    .limit(1000);
  const rows = ((data ?? []) as Array<{ hubspot_id: string | null; name: string | null; amount: number | null }>).filter(
    (d) => d.name && (Number(d.amount) || 0) > 0,
  );
  // Clé de groupe : montant exact + préfixe normalisé du nom (12 caractères).
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const groups = new Map<string, typeof rows>();
  for (const d of rows) {
    const prefix = norm(d.name!).slice(0, 12);
    if (prefix.length < 12) continue; // nom trop court pour une clé fiable
    const key = `${Math.round(Number(d.amount))}:${prefix}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
  }
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const amount = Number(list[0].amount) || 0;
    const cumul = amount * list.length;
    const top = list.find((d) => d.hubspot_id);
    const names = list.map((d) => d.name!.trim()).slice(0, 8);
    out.push({
      dedupe_key: `dup_deals:${key.replace(/[^a-z0-9:]/gi, "_")}`,
      type: "hubspot_task",
      title: `${list.length} deals identiques à ${fmtEurAct(amount)} chacun — doublons probables à trier`,
      description:
        `${names[0]}${list.length > 1 ? ` et ${list.length - 1} autre${list.length > 2 ? "s" : ""} deal${list.length > 2 ? "s" : ""} au même montant et au même nom` : ""} : ` +
        `ils cumulent ${fmtEurAct(cumul)} dans le pipeline et gonflent d'autant le prévisionnel. ` +
        `S'il s'agit de la même opération dupliquée par contact, fusionne ou ferme les doublons dans HubSpot — s'ils sont voulus (un ticket par investisseur), déplace-les dans un pipeline dédié et exclus-le du prévisionnel. ` +
        `Valider crée une tâche HubSpot récapitulative sur l'un des deals.`,
      source: "detector:duplicate_deals",
      payload: {
        subject: `Trier ${list.length} deals en doublon à ${fmtEurAct(amount)} chacun`,
        body:
          `Deals ouverts au même montant (${fmtEurAct(amount)}) avec le même nom, cumul ${fmtEurAct(cumul)} :\n- ${names.join("\n- ")}${list.length > names.length ? `\n… et ${list.length - names.length} autres` : ""}\n` +
          `Détecté par Revold : fusionner/fermer les doublons, ou les isoler dans un pipeline dédié hors prévisionnel.`,
        dealHubspotId: top?.hubspot_id ?? null,
      },
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** Réglage app : pipelines exclus du prévisionnel de trésorerie (noms). */
export const FORECAST_EXCLUDED_PIPELINES_RULE = "forecast_excluded_pipelines";

export async function getForecastExcludedPipelines(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("entity_resolution_config")
      .select("enabled, config")
      .eq("organization_id", orgId)
      .eq("rule_id", FORECAST_EXCLUDED_PIPELINES_RULE)
      .maybeSingle();
    if (!data?.enabled) return [];
    const names = (data.config as { names?: unknown } | null)?.names;
    return Array.isArray(names) ? names.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Détecteur : PIPELINE HORS D'ÉCHELLE dans le prévisionnel — un pipeline dont
 * les deals ouverts cumulent ≥ 1 M€ ET ≥ 10× les factures clients ouvertes
 * écrase le solde projeté (cas type : pipeline de financement / club deals,
 * dont les montants ne sont pas du CA encaissable par l'entreprise).
 * L'action s'exécute DANS Revold : exclusion du pipeline de la projection
 * uniquement — il reste visible partout ailleurs.
 */
export async function detectForecastPipelineExclusions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const excluded = new Set(await getForecastExcludedPipelines(supabase, orgId));
  const { data: deals } = await supabase
    .from("deals")
    .select("amount, is_closed_won, is_closed_lost, pipeline_stages(pipeline_name, is_closed_won, is_closed_lost)")
    .eq("organization_id", orgId)
    .not("amount", "is", null)
    .limit(5000);
  type Row = {
    amount: number | null; is_closed_won: boolean; is_closed_lost: boolean;
    pipeline_stages: { pipeline_name: string | null; is_closed_won: boolean | null; is_closed_lost: boolean | null } | Array<{ pipeline_name: string | null; is_closed_won: boolean | null; is_closed_lost: boolean | null }> | null;
  };
  const byPipeline = new Map<string, { total: number; n: number }>();
  for (const d of (deals ?? []) as Row[]) {
    const st = (Array.isArray(d.pipeline_stages) ? d.pipeline_stages[0] : d.pipeline_stages) ?? null;
    if (d.is_closed_won || d.is_closed_lost || st?.is_closed_won || st?.is_closed_lost) continue;
    const amount = Number(d.amount) || 0;
    const name = st?.pipeline_name?.trim();
    if (amount <= 0 || !name || excluded.has(name)) continue;
    const cur = byPipeline.get(name) ?? { total: 0, n: 0 };
    cur.total += amount;
    cur.n++;
    byPipeline.set(name, cur);
  }
  if (byPipeline.size === 0) return [];

  // Référence d'échelle : factures clients ouvertes (le « réel » du moment).
  const { data: inv } = await supabase
    .from("invoices")
    .select("amount_due, direction")
    .eq("organization_id", orgId)
    .in("status", ["open", "uncollectible"])
    .limit(5000);
  const invoicesDue = ((inv ?? []) as Array<{ amount_due: number | null; direction: string | null }>)
    .filter((i) => i.direction !== "out")
    .reduce((s, i) => s + Math.abs(Number(i.amount_due) || 0), 0);

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const [name, agg] of byPipeline) {
    if (agg.total < 1_000_000 || agg.total < 10 * Math.max(invoicesDue, 1)) continue;
    out.push({
      dedupe_key: `forecast_excl:${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      type: "forecast_exclude_pipeline",
      title: `Exclure le pipeline « ${name} » du prévisionnel de trésorerie ?`,
      description:
        `Ses ${agg.n} deals ouverts cumulent ${fmtEurAct(agg.total)}, hors d'échelle face aux ${fmtEurAct(invoicesDue)} de factures clients ouvertes : il écrase le solde projeté. ` +
        `Cas typique : pipeline de financement / club deals dont les montants ne sont pas du CA encaissable par l'entreprise. ` +
        `Valider l'exclut de la projection UNIQUEMENT (effet immédiat) — il reste visible sur toutes les autres pages. Rejeter garde la projection telle quelle.`,
      source: "detector:forecast_pipeline",
      payload: { pipelineName: name },
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** Exécuteur : exclut un pipeline du prévisionnel (réglage app, effet immédiat). */
export async function executeForecastExcludePipeline(
  supabase: SupabaseClient,
  orgId: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const name = payload.pipelineName?.trim();
  if (!name) return { ok: false, detail: "Nom de pipeline manquant." };
  try {
    const { data } = await supabase
      .from("entity_resolution_config")
      .select("config")
      .eq("organization_id", orgId)
      .eq("rule_id", FORECAST_EXCLUDED_PIPELINES_RULE)
      .maybeSingle();
    const cur = (data?.config as { names?: unknown } | null)?.names;
    const names = [...new Set([...(Array.isArray(cur) ? cur.filter((x): x is string => typeof x === "string") : []), name])];
    const { error } = await supabase
      .from("entity_resolution_config")
      .upsert(
        { organization_id: orgId, rule_id: FORECAST_EXCLUDED_PIPELINES_RULE, enabled: true, config: { names } },
        { onConflict: "organization_id,rule_id" },
      );
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `Pipeline « ${name} » exclu du prévisionnel de trésorerie — effet immédiat. Les autres pages ne changent pas.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Exclusion impossible." };
  }
}

// ── Exécuteurs ──────────────────────────────────────────────────────────────

/** GET HubSpot : un objet avec son owner + ses contacts associés. */
export async function fetchOwnerAndContacts(
  token: string,
  objectType: "deals" | "companies",
  id: string,
): Promise<{ ownerId: string | null; contactIds: string[] }> {
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/${objectType}/${encodeURIComponent(id)}?properties=hubspot_owner_id&associations=contacts`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ownerId: null, contactIds: [] };
    const d = (await res.json()) as {
      properties?: { hubspot_owner_id?: string | null };
      associations?: { contacts?: { results?: Array<{ id: string }> } };
    };
    return {
      ownerId: d.properties?.hubspot_owner_id || null,
      contactIds: (d.associations?.contacts?.results ?? []).map((c) => c.id).slice(0, 3),
    };
  } catch {
    return { ownerId: null, contactIds: [] };
  }
}

/** Owner d'un contact HubSpot (fallback d'attribution). */
export async function fetchContactOwner(token: string, contactId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=hubspot_owner_id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { properties?: { hubspot_owner_id?: string | null } };
    return d.properties?.hubspot_owner_id || null;
  } catch {
    return null;
  }
}

/**
 * Détecteur : GROUPE MULTI-ENTITÉS NON DÉCLARÉ (garde-fou de facturation en
 * amont). Signal FIABLE, jamais deviné par le nom : un deal gagné n'a AUCUNE
 * facture sur sa propre société, mais une facture non rattachée d'une AUTRE
 * société (hors de son groupe déclaré) porte EXACTEMENT son montant, dans la
 * fenêtre du closing. C'est le motif « signé sur l'entité A, facturé sur
 * l'entité B du même groupe » — sauf que le lien de groupe n'existe pas encore
 * dans le CRM, donc Revold ne peut pas rapprocher ni garder le garde-fou.
 *
 * L'action RECOMMANDE de déclarer la hiérarchie parent/enfant dans HubSpot (et
 * peut l'écrire : l'entité de facturation devient le parent). Aucun
 * rattachement manuel dans Revold : une fois la hiérarchie déclarée, l'ingestion
 * la reprend et le moteur deal↔facture rapproche + surveille tout seul.
 */
/**
 * OPT-IN de la détection de hiérarchies (page Hiérarchie comptes) : aucune
 * suggestion n'est générée avant le premier clic sur « Lancer le
 * rapprochement » — sinon un nouvel inscrit voit des propositions apparaître
 * sans avoir rien lancé (temporalités d'action mélangées). Les orgs qui ont
 * DÉJÀ des suggestions en base restent actives (pas de régression).
 */
export async function isHierarchyActivated(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("entity_resolution_config")
      .select("enabled")
      .eq("organization_id", orgId)
      .eq("rule_id", "hierarchy_reconciliation")
      .maybeSingle();
    if (data?.enabled === true) return true;
    if (data) return false; // flag posé et désactivé → respecté
    // Pas de flag : activation implicite si la famille a déjà produit des
    // fiches (orgs antérieures à l'opt-in) — sinon inactif.
    const { count } = await supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("source", "detector:declare_group");
    return (count ?? 0) > 0;
  } catch {
    return false; // au moindre doute : pas de suggestion non sollicitée
  }
}

/** Active la détection de hiérarchies (appelé au premier rapprochement). */
export async function activateHierarchy(supabase: SupabaseClient, orgId: string): Promise<void> {
  try {
    await supabase.from("entity_resolution_config").upsert(
      { organization_id: orgId, rule_id: "hierarchy_reconciliation", enabled: true, config: { activated_at: new Date().toISOString() } },
      { onConflict: "organization_id,rule_id" },
    );
  } catch { /* réessayé au prochain rapprochement */ }
}

/**
 * Rapprochement par RESSEMBLANCE DE NOM : OPT-IN uniquement (Paramètres →
 * Enrichissement). Désactivé par défaut — la ressemblance de nom est un signal
 * faible (franchises, homonymes) qu'on ne veut jamais imposer.
 */
export async function isNameMatchEnabled(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("entity_resolution_config")
      .select("enabled")
      .eq("organization_id", orgId)
      .eq("rule_id", "hierarchy_name_match")
      .maybeSingle();
    return data?.enabled === true;
  } catch {
    return false;
  }
}

/** Active/désactive le signal « rapprochement par nom » (opt-in utilisateur). */
export async function setNameMatchEnabled(supabase: SupabaseClient, orgId: string, enabled: boolean): Promise<void> {
  await supabase.from("entity_resolution_config").upsert(
    { organization_id: orgId, rule_id: "hierarchy_name_match", enabled, config: {} },
    { onConflict: "organization_id,rule_id" },
  );
}

export async function detectUndeclaredGroups(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const DAY = 86_400_000;
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  // Plafond par SIGNAL FIABLE (montant / domaine / SIREN) : assez haut pour
  // couvrir la base, borné pour ne pas noyer la file de validation.
  const MAX_PER_SIGNAL = 50;

  const [dealsRes, invRes, compRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, amount, close_date, company_id")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .not("company_id", "is", null)
      .not("amount", "is", null)
      .limit(4000),
    supabase
      .from("invoices")
      .select("id, amount_total, issued_at, company_id, deal_id")
      .eq("organization_id", orgId)
      .not("company_id", "is", null)
      .limit(6000),
    supabase
      .from("companies")
      .select("id, name, hubspot_id, domain, siren, siret, duplicate_of_siren, candidate_siret, legal_name")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .limit(10000),
  ]);

  type D = { id: string; name: string | null; amount: number | null; close_date: string | null; company_id: string | null };
  type I = { id: string; amount_total: number | null; issued_at: string | null; company_id: string | null; deal_id: string | null };
  const deals = ((dealsRes.data ?? []) as D[]).filter((d) => (d.amount ?? 0) > 0);
  const invoices = (invRes.data ?? []) as I[];

  // Seules les entreprises présentes dans le CRM (hubspot_id) peuvent recevoir
  // une association de hiérarchie — on ne recommande que des paires écrivables.
  type CompRow = {
    id: string; name: string | null; hubspot_id: string | null; domain: string | null;
    siren: string | null; siret: string | null; duplicate_of_siren: string | null; candidate_siret: string | null;
    legal_name: string | null;
  };
  // Colonnes d'enrichissement absentes (migration non appliquée) → repli sur
  // les colonnes de base : les passes facture/domaine restent fonctionnelles.
  let compRows = (compRes.data ?? null) as CompRow[] | null;
  if (compRes.error) {
    const retry = await supabase
      .from("companies")
      .select("id, name, hubspot_id, domain")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .limit(10000);
    compRows = ((retry.data ?? []) as Array<Omit<CompRow, "siren" | "siret" | "duplicate_of_siren" | "candidate_siret" | "legal_name">>)
      .map((c) => ({ ...c, siren: null, siret: null, duplicate_of_siren: null, candidate_siret: null, legal_name: null }));
  }
  const comp = new Map<string, { name: string | null; hubspot_id: string; domain: string | null; siren: string | null; siret: string | null; duplicate_of_siren: string | null; candidate_siret: string | null; legal_name: string | null }>();
  for (const c of (compRows ?? []) as CompRow[]) {
    if (c.hubspot_id) comp.set(c.id, { name: c.name, hubspot_id: c.hubspot_id, domain: c.domain, siren: c.siren, siret: c.siret, duplicate_of_siren: c.duplicate_of_siren, candidate_siret: c.candidate_siret, legal_name: c.legal_name });
  }
  if (comp.size < 2) return [];

  // Groupes DÉJÀ déclarés : on ne propose jamais une paire déjà dans le même
  // groupe (rien à déclarer) — le garde-fou Stage 2a la couvre déjà.
  const groups = await loadCompanyGroups(supabase, orgId);
  const rootOf = (id: string): string => groups.rootOf.get(id) ?? id;

  // Index des factures NON rattachées, par entreprise, avec date.
  const invByCompany = new Map<string, Array<{ amount: number; at: number }>>();
  // Ensemble des entreprises qui portent AU MOINS une facture (même montant).
  for (const inv of invoices) {
    if (inv.deal_id) continue; // déjà rattachée à un deal
    const cid = inv.company_id;
    const amt = Number(inv.amount_total) || 0;
    if (!cid || amt <= 0) continue;
    const at = inv.issued_at ? new Date(inv.issued_at).getTime() : NaN;
    (invByCompany.get(cid) ?? invByCompany.set(cid, []).get(cid))!.push({ amount: amt, at });
  }
  // Entreprises qui ont une facture du bon montant, quelle qu'elle soit (pour
  // écarter les deals normalement facturés sur leur propre société).
  const hasOwnInvoice = (companyId: string, amount: number): boolean =>
    (invByCompany.get(companyId) ?? []).some((x) => near(x.amount, amount));

  const seenPairs = new Set<string>();
  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];

  for (const d of deals) {
    const dealCompanyId = d.company_id!;
    const amount = d.amount ?? 0;
    const childC = comp.get(dealCompanyId);
    if (!childC) continue; // société du deal absente du CRM (non écrivable)
    // Facturé normalement sur sa propre société → pas un signal de groupe.
    if (hasOwnInvoice(dealCompanyId, amount)) continue;

    const close = d.close_date ? new Date(d.close_date).getTime() : NaN;
    const dealRoot = rootOf(dealCompanyId);

    // Cherche une AUTRE société portant une facture du montant exact, en fenêtre.
    let match: { companyId: string; name: string | null; hubspot_id: string } | null = null;
    for (const [cid, list] of invByCompany) {
      if (cid === dealCompanyId) continue;
      if (rootOf(cid) === dealRoot) continue; // déjà dans le même groupe déclaré
      const other = comp.get(cid);
      if (!other) continue; // société de facturation absente du CRM (non écrivable)
      const inWindow = list.some((x) => {
        if (!near(x.amount, amount)) return false;
        if (Number.isNaN(close) || Number.isNaN(x.at)) return true; // dates absentes → on n'exclut pas
        return x.at >= close - 30 * DAY && x.at <= close + 365 * DAY;
      });
      if (inWindow) {
        match = { companyId: cid, name: other.name, hubspot_id: other.hubspot_id };
        break;
      }
    }
    if (!match) continue;

    // Paire dédupliquée (indépendante du deal qui a servi de révélateur).
    const pairKey = [dealCompanyId, match.companyId].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const childName = childC.name ?? "entreprise signataire";
    const parentName = match.name ?? "entité de facturation";
    out.push({
      dedupe_key: `declare_group:${pairKey}`,
      type: "hubspot_company_associate",
      title: `Déclarer la hiérarchie : « ${parentName} » (facturation) parent de « ${childName} » (signature)`,
      description: `Le deal « ${d.name ?? "sans nom"} » (${fmt(amount)}) a été signé sur « ${childName} » mais aucune facture de ce montant n'y figure — une facture du montant exact a été émise sur « ${parentName} », une société sans lien de groupe déclaré. C'est le motif « facturation centralisée par une autre entité du groupe ». Tant que la hiérarchie n'est pas déclarée dans HubSpot, Revold ne peut ni rapprocher ce deal ni surveiller la bonne entité de facturation. Valider écrit l'association parent/enfant dans HubSpot (« ${parentName} » parente de « ${childName} ») — jamais deviné par le nom, uniquement sur cette correspondance de montant. Ensuite le rapprochement et le garde-fou inter-entités se font automatiquement. Si le sens est inverse (ou s'il ne s'agit pas du même groupe), rejette et corrige dans HubSpot.`,
      source: "detector:declare_group",
      payload: {
        parentHubspotId: match.hubspot_id,
        childHubspotId: childC.hubspot_id,
        parentCompanyName: parentName,
        childCompanyName: childName,
        groupSignal: "billing_match",
      },
    });
    if (out.length >= MAX_PER_SIGNAL) break;
  }

  // ── Passe 2 : DOMAINE PARTAGÉ, sur TOUTE la base d'entreprises ──
  // Deux fiches CRM distinctes qui partagent le même domaine web sans lien de
  // groupe déclaré = signal de groupe multi-entités (filiales sur le site de
  // la maison mère). Sens parent/enfant PROPOSÉ (facturier > volume de deals),
  // inversable à la validation — jamais déduit du nom.
  const GENERIC_DOMAINS = new Set([
    "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
    "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "live.com", "live.fr", "msn.com",
    "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net", "protonmail.com", "proton.me",
  ]);
  const rootDomain = (raw: string | null): string | null => {
    if (!raw) return null;
    const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
    if (!d || !d.includes(".") || GENERIC_DOMAINS.has(d)) return null;
    return d;
  };
  const byDomain = new Map<string, string[]>();
  for (const [cid, c] of comp) {
    const d = rootDomain(c.domain);
    if (d) (byDomain.get(d) ?? byDomain.set(d, []).get(d))!.push(cid);
  }
  // Volume de deals gagnés par entreprise → heuristique de sens.
  const wonCount = new Map<string, number>();
  for (const d of deals) {
    if (d.company_id) wonCount.set(d.company_id, (wonCount.get(d.company_id) ?? 0) + 1);
  }
  const invoiceCount = (cid: string): number => (invByCompany.get(cid) ?? []).length;

  const domainStart = out.length;
  for (const [domain, ids] of byDomain) {
    if (ids.length < 2) continue;
    // > 6 entités sur un même domaine : probablement une agence / domiciliation
    // ou un domaine générique non listé — trop ambigu pour proposer.
    if (ids.length > 6) continue;
    // Parent proposé : d'abord celle qui FACTURE, sinon la plus active en deals,
    // sinon ordre stable (id) — déterministe, et inversable à la validation.
    const sorted = [...ids].sort((a, b) =>
      (invoiceCount(b) - invoiceCount(a)) || ((wonCount.get(b) ?? 0) - (wonCount.get(a) ?? 0)) || a.localeCompare(b),
    );
    const parentId = sorted[0];
    const parentC = comp.get(parentId)!;
    for (const childId of sorted.slice(1)) {
      if (rootOf(childId) === rootOf(parentId)) continue; // déjà dans le même groupe
      const pairKey = [parentId, childId].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const childC2 = comp.get(childId)!;
      const parentName = parentC.name ?? "entité principale";
      const childName = childC2.name ?? "entité liée";
      out.push({
        dedupe_key: `declare_group:${pairKey}`,
        type: "hubspot_company_associate",
        title: `Déclarer la hiérarchie : « ${parentName} » parent de « ${childName} » (domaine ${domain})`,
        description: `Les fiches « ${parentName} » et « ${childName} » partagent le même domaine web (${domain}) sans lien de groupe déclaré dans HubSpot — signal de groupe multi-entités, détecté sur toute la base (pas seulement les deals). Le sens proposé (« ${parentName} » parente) vient de l'activité facturation/deals des deux fiches : inverse-le avant de valider si besoin. Valider écrit l'association parent/enfant dans HubSpot ; ensuite la consolidation par groupe et le garde-fou inter-entités s'appuient dessus automatiquement.`,
        source: "detector:declare_group",
        payload: {
          parentHubspotId: parentC.hubspot_id,
          childHubspotId: childC2.hubspot_id,
          parentCompanyName: parentName,
          childCompanyName: childName,
          groupSignal: "shared_domain",
          sharedDomain: domain,
        },
      });
      if (out.length - domainStart >= MAX_PER_SIGNAL) break;
    }
    if (out.length - domainStart >= MAX_PER_SIGNAL) break;
  }

  // ── Passe 3 : MÊME SIREN, SIRETs DISTINCTS (registre officiel, toute la
  // base, aucune facturation nécessaire). Le SIREN identifie la société,
  // le SIRET l'établissement : deux fiches CRM sur la même société avec des
  // SIRETs différents = siège + établissement (agence) — hiérarchie officielle.
  // La fiche canonique (qui porte le SIREN, généralement le siège) est parent ;
  // même SIRET ou SIRET inconnu → probable vrai doublon : la FUSION est le bon
  // geste, pas la hiérarchie — on ne propose rien.
  const canonicalBySiren = new Map<string, string>();
  for (const [cid, c] of comp) {
    if (c.siren) canonicalBySiren.set(c.siren, cid);
  }
  const sirenStart = out.length;
  for (const [cid, c] of comp) {
    if (!c.duplicate_of_siren) continue;
    const parentId = canonicalBySiren.get(c.duplicate_of_siren);
    if (!parentId || parentId === cid) continue;
    const parentC = comp.get(parentId)!;
    // Établissements DISTINCTS prouvés : les deux SIRET connus et différents.
    const childSiret = c.candidate_siret;
    if (!childSiret || !parentC.siret || childSiret === parentC.siret) continue;
    if (rootOf(cid) === rootOf(parentId)) continue; // déjà dans le même groupe
    const pairKey = [parentId, cid].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const parentName = parentC.name ?? "siège";
    const childName = c.name ?? "établissement";
    out.push({
      dedupe_key: `declare_group:${pairKey}`,
      type: "hubspot_company_associate",
      title: `Déclarer la hiérarchie : « ${parentName} » (siège) parent de « ${childName} » (établissement)`,
      description: `Ces deux fiches désignent la MÊME société au registre (SIREN ${c.duplicate_of_siren}) mais deux ÉTABLISSEMENTS différents (SIRET ${parentC.siret} vs ${childSiret}) — typiquement le siège et une agence. Signal 100 % registre officiel (Sirene), détecté sur toute la base, sans facturation nécessaire et jamais d'après le nom. Valider écrit l'association parent/enfant dans HubSpot (« ${parentName} » parente) ; si les deux fiches décrivent en réalité le même établissement, c'est une fusion de doublons qu'il faut, pas une hiérarchie — refuse alors.`,
      source: "detector:declare_group",
      payload: {
        parentHubspotId: parentC.hubspot_id,
        childHubspotId: c.hubspot_id,
        parentCompanyName: parentName,
        childCompanyName: childName,
        groupSignal: "same_siren",
        sharedSiren: c.duplicate_of_siren,
      },
    });
    if (out.length - sirenStart >= MAX_PER_SIGNAL) break;
  }

  // ── Passe 4 : NOM APPARENTÉ — signal FAIBLE, proposé avec prudence ──
  // Jamais de ressemblance floue : uniquement deux motifs structurels.
  //   A. PRÉFIXE : « Acme » ⊂ « Acme Consulting » → « Acme » parente proposée.
  //   B. RACINE + MARQUEUR DE GROUPE : « Acme Holding » vs « Acme France » →
  //      la fiche au marqueur (groupe/holding…) est parente proposée.
  // Garde-fous : formes juridiques ignorées, premiers mots génériques exclus
  // (garage, agence…), racine ≥ 3 caractères, sens toujours inversable.
  // Passe « nom » : OPT-IN uniquement (Paramètres → Enrichissement) — jamais
  // par défaut, la ressemblance de nom étant un signal faible/risqué.
  const nameMatchOn = await isNameMatchEnabled(supabase, orgId);
  if (nameMatchOn) {
  const LEGAL_TOKENS = new Set([
    "sas", "sasu", "sarl", "sa", "eurl", "sci", "scop", "scm", "selarl", "snc", "gie",
    "ltd", "inc", "llc", "gmbh", "bv", "srl", "spa", "ag", "co", "cie", "ste",
  ]);
  const GROUP_TOKENS = new Set([
    "groupe", "group", "holding", "holdings", "participations", "invest",
    "investissement", "investissements", "financiere", "finances",
  ]);
  const GENERIC_FIRST = new Set([
    "societe", "entreprise", "ets", "etablissement", "etablissements", "agence", "cabinet",
    "garage", "atelier", "boulangerie", "pharmacie", "institut", "clinique", "centre",
    "maison", "studio", "transport", "transports", "menuiserie", "plomberie", "restaurant",
    "hotel", "boutique", "librairie", "imprimerie", "laboratoire", "compagnie",
    "le", "la", "les", "l", "au", "aux", "du", "de", "des", "d", "et",
  ]);
  const nameTokens = (c: { name: string | null; legal_name: string | null }): string[] => {
    const raw = (c.legal_name ?? c.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return raw.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((t) => t && !LEGAL_TOKENS.has(t));
  };
  const isPrefixOf = (a: string[], b: string[]): boolean =>
    a.length > 0 && a.length < b.length && a.every((t, i) => b[i] === t);

  // Tokens significatifs par entreprise ; on ne retient que les fiches dont le
  // 1er mot est significatif (ni forme juridique, ni générique, ni marqueur).
  const tokensOf = new Map<string, string[]>();
  for (const [cid, c] of comp) {
    const tokens = nameTokens(c);
    if (tokens.length === 0) continue;
    const first = tokens[0];
    if (first.length < 3 || GENERIC_FIRST.has(first) || GROUP_TOKENS.has(first)) continue;
    tokensOf.set(cid, tokens);
  }
  // Base valide comme SOCIÉTÉ MÈRE : ≥ 2 mots significatifs (« banque populaire »)
  // ou 1 mot distinctif ≥ 5 lettres (« decathlon ») — évite les mères d'un seul
  // mot trop générique.
  const validBase = (t: string[]) => t.length >= 2 || (t.length === 1 && t[0].length >= 5);
  // Groupe par 1er mot (le préfixe exact écarte ensuite les homonymes non liés :
  // « banque populaire » n'est pas préfixe de « banque de france »).
  const byRoot = new Map<string, string[]>();
  for (const [cid, tokens] of tokensOf) {
    (byRoot.get(tokens[0]) ?? byRoot.set(tokens[0], []).get(tokens[0]))!.push(cid);
  }

  const nameStart = out.length;
  const emitName = (parentId: string, childId: string, base: string, kind: "prefix" | "marker") => {
    if (rootOf(parentId) === rootOf(childId)) return; // déjà dans le même groupe
    const pairKey = [parentId, childId].sort().join(":");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    const parentC = comp.get(parentId)!;
    const childC = comp.get(childId)!;
    const parentName = parentC.name ?? parentC.legal_name ?? "société mère";
    const childName = childC.name ?? childC.legal_name ?? "entité liée";
    const reason =
      kind === "prefix"
        ? `« ${childName} » reprend le nom de « ${parentName} » en y ajoutant une précision (ville, région, agence) — motif classique société mère → entité locale ; « ${parentName} », sans complément, est proposée comme mère.`
        : `« ${parentName} » porte un marqueur de groupe (« holding/groupe ») que « ${childName} » n'a pas — proposée comme mère.`;
    out.push({
      dedupe_key: `declare_group:${pairKey}`,
      type: "hubspot_company_associate",
      title: `Hiérarchie possible (nom) : « ${parentName} » (mère) parent de « ${childName} »`,
      description: `${reason} Signal par le NOM (opt-in) : deux sociétés au nom proche peuvent être indépendantes (franchises, homonymes). Vérifie, inverse le sens si besoin, refuse au moindre doute. Valider écrit l'association parent/enfant dans HubSpot.`,
      source: "detector:declare_group",
      payload: {
        parentHubspotId: parentC.hubspot_id,
        childHubspotId: childC.hubspot_id,
        parentCompanyName: parentName,
        childCompanyName: childName,
        groupSignal: "name_match",
        sharedName: base,
      },
    });
  };

  for (const [root, cids] of byRoot) {
    if (out.length - nameStart >= MAX_PER_SIGNAL) break;
    if (cids.length < 2 || cids.length > 200) continue; // garde-fou perf sur un mot ultra-commun

    // ── MOTIF A (ton cas Banque Populaire) : nom NU = mère, + ville/région = fille.
    // Pour chaque enfant, sa mère = la base VALIDE la plus courte qui préfixe son nom.
    for (const childId of cids) {
      if (out.length - nameStart >= MAX_PER_SIGNAL) break;
      const ct = tokensOf.get(childId)!;
      let parentId: string | null = null;
      let plen = Infinity;
      for (const pid of cids) {
        if (pid === childId) continue;
        const pt = tokensOf.get(pid)!;
        if (validBase(pt) && isPrefixOf(pt, ct) && pt.length < plen) { parentId = pid; plen = pt.length; }
      }
      if (parentId) emitName(parentId, childId, tokensOf.get(parentId)!.join(" "), "prefix");
    }

    // ── MOTIF B : un SEUL membre porte un marqueur de groupe (« holding/groupe ») →
    // il est la mère des autres fiches de même racine sans marqueur.
    if (out.length - nameStart >= MAX_PER_SIGNAL) break;
    const marked = cids.filter((id) => tokensOf.get(id)!.some((t) => GROUP_TOKENS.has(t)));
    if (marked.length === 1) {
      const parentId = marked[0];
      for (const childId of cids) {
        if (out.length - nameStart >= MAX_PER_SIGNAL) break;
        if (childId === parentId) continue;
        if (tokensOf.get(childId)!.some((t) => GROUP_TOKENS.has(t))) continue;
        emitName(parentId, childId, root, "marker");
      }
    }
  }
  } // fin passe « nom » (opt-in via Paramètres → Enrichissement)
  return out;
}

/**
 * Détecteur : DOUBLONS PAR SIREN → FUSION (pas une hiérarchie). Deux fiches
 * portent le même SIREN (`duplicate_of_siren`, le SIREN d'une fiche = celui
 * d'une autre) SANS établissement (SIRET) distinct prouvé → c'est la même
 * société en double, pas un groupe : le bon geste est la fusion. Quand les deux
 * SIRET sont connus ET différents, c'est au contraire une hiérarchie
 * siège/établissement → laissée au détecteur `declare_group`, pas ici.
 */
export async function detectSirenDuplicates(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  const { data: dupData, error } = await supabase
    .from("companies")
    .select("id, name, hubspot_id, siret, candidate_siret, duplicate_of_siren")
    .eq("organization_id", orgId)
    .not("duplicate_of_siren", "is", null)
    .not("hubspot_id", "is", null)
    .limit(2000);
  // Colonne absente (migration non appliquée) → rien à proposer.
  if (error) return [];
  type Dup = { id: string; name: string | null; hubspot_id: string; siret: string | null; candidate_siret: string | null; duplicate_of_siren: string };
  const dups = (dupData ?? []) as Dup[];
  if (dups.length === 0) return [];

  const sirens = [...new Set(dups.map((d) => d.duplicate_of_siren))];
  const { data: canonData } = await supabase
    .from("companies")
    .select("id, name, hubspot_id, siren, siret")
    .eq("organization_id", orgId)
    .in("siren", sirens)
    .not("hubspot_id", "is", null);
  type Canon = { id: string; name: string | null; hubspot_id: string; siren: string; siret: string | null };
  const canonBySiren = new Map<string, Canon>();
  for (const c of (canonData ?? []) as Canon[]) canonBySiren.set(c.siren, c);

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const d of dups) {
    const canon = canonBySiren.get(d.duplicate_of_siren);
    if (!canon || canon.id === d.id || !canon.hubspot_id) continue;
    // Établissements DISTINCTS prouvés (deux SIRET connus, différents) →
    // HIÉRARCHIE, pas fusion : on laisse `declare_group` s'en charger.
    const childSiret = d.candidate_siret ?? d.siret;
    if (childSiret && canon.siret && childSiret !== canon.siret) continue;
    const dupName = d.name ?? "fiche en double";
    const canonName = canon.name ?? "fiche principale";
    out.push({
      dedupe_key: `merge_siren:${[canon.id, d.id].sort().join(":")}`,
      type: "hubspot_merge",
      title: `Fusionner « ${dupName} » dans « ${canonName} » (même SIREN ${d.duplicate_of_siren})`,
      description: `Ces deux fiches portent le MÊME SIREN (${d.duplicate_of_siren}) sans établissement (SIRET) distinct prouvé — très probablement la même société en double dans le CRM. Fusionner conserve « ${canonName} » et y absorbe « ${dupName} » (activités et associations transférées). Si ce sont en réalité DEUX établissements différents (siège + agence), refuse : la hiérarchie sera proposée à part.`,
      source: "detector:duplicate_merge",
      payload: { mergeObjectType: "companies", primaryHubspotId: canon.hubspot_id, mergeHubspotId: d.hubspot_id },
    });
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Crée une tâche HubSpot TOUJOURS attribuée : owner du deal, sinon owner de
 * l'entreprise, sinon owner du premier contact associé — une tâche sans
 * propriétaire n'apparaît dans la file de personne dans le CRM. La tâche est
 * associée au deal concerné, à l'entreprise ET au contact rattaché.
 */
export async function executeHubspotTask(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const associations: Array<{ to: { id: string }; types: Array<{ associationCategory: string; associationTypeId: number }> }> = [];
  // Types d'association HubSpot definis : tâche→deal 216 · tâche→entreprise 192 · tâche→contact 204.
  if (payload.dealHubspotId) associations.push({ to: { id: payload.dealHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 216 }] });
  if (payload.companyHubspotId) associations.push({ to: { id: payload.companyHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 192 }] });

  // ── Attribution : owner du deal → de l'entreprise → du contact associé. ──
  let ownerId: string | null = null;
  let contactId: string | null = null;
  if (payload.dealHubspotId) {
    const deal = await fetchOwnerAndContacts(hubspotToken, "deals", payload.dealHubspotId);
    ownerId = deal.ownerId;
    contactId = deal.contactIds[0] ?? null;
  }
  if ((!ownerId || !contactId) && payload.companyHubspotId) {
    const comp = await fetchOwnerAndContacts(hubspotToken, "companies", payload.companyHubspotId);
    ownerId = ownerId ?? comp.ownerId;
    contactId = contactId ?? (comp.contactIds[0] ?? null);
  }
  if (!ownerId && contactId) ownerId = await fetchContactOwner(hubspotToken, contactId);
  if (contactId) associations.push({ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }] });

  try {
    const properties: Record<string, unknown> = {
      hs_task_subject: payload.subject ?? "Action Revold",
      hs_task_body: payload.body ?? "",
      hs_timestamp: String(Date.now() + 2 * 86_400_000),
      hs_task_status: "NOT_STARTED",
      hs_task_priority: "HIGH",
      hs_task_type: "TODO",
    };
    if (ownerId) properties.hubspot_owner_id = ownerId;
    const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/tasks", {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties, associations }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        ok: true,
        detail: `Tâche HubSpot créée (id ${d.id ?? "?"})${
          ownerId ? "" : " — non attribuée : ni le deal, ni l'entreprise, ni le contact n'ont de propriétaire dans HubSpot"
        }`,
      };
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

/** Fusionne deux fiches HubSpot (contacts ou entreprises) — validée en amont. */
export async function executeHubspotMerge(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const type = payload.mergeObjectType;
  if ((type !== "contacts" && type !== "companies") || !payload.primaryHubspotId || !payload.mergeHubspotId) {
    return { ok: false, detail: "Payload de fusion incomplet." };
  }
  try {
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/${type}/merge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ primaryObjectId: payload.primaryHubspotId, objectIdToMerge: payload.mergeHubspotId }),
    });
    if (res.ok) {
      return {
        ok: true,
        detail: `Fusion HubSpot effectuée (fiche ${payload.primaryHubspotId} conservée). Le doublon disparaîtra de Revold à la prochaine synchronisation.`,
      };
    }
    const err = await res.text();
    if (res.status === 403) {
      return { ok: false, detail: `Scope HubSpot manquant (crm.objects.${type === "contacts" ? "contacts" : "companies"}.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot.` };
    }
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/**
 * Écrit l'association de hiérarchie parent/enfant entre deux entreprises dans
 * HubSpot (associations v4, type par défaut typeId 14 = « parent » côté enfant,
 * cohérent avec la lecture `fetchCompanyParents` de l'ETL). Validée en amont
 * (human-in-the-loop) : on ne devine jamais le lien, il vient d'une
 * correspondance de montant deal↔facture. HubSpot crée le miroir « enfant »
 * côté parent automatiquement. La synchro suivante repeuple `parent_company_id`
 * et le moteur deal↔facture rapproche + surveille l'entité de facturation.
 */
export async function executeHubspotCompanyAssociate(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const { parentHubspotId, childHubspotId } = payload;
  if (!parentHubspotId || !childHubspotId || parentHubspotId === childHubspotId) {
    return { ok: false, detail: "Payload de hiérarchie incomplet (parent/enfant HubSpot requis)." };
  }
  try {
    // Du point de vue de l'ENFANT, son parent : typeId 14 (HUBSPOT_DEFINED).
    const res = await hubFetch(
      `https://api.hubapi.com/crm/v4/objects/companies/${encodeURIComponent(childHubspotId)}/associations/companies/${encodeURIComponent(parentHubspotId)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 14 }]),
      },
    );
    if (res.ok) {
      return {
        ok: true,
        detail: `Hiérarchie déclarée dans HubSpot : « ${payload.parentCompanyName ?? parentHubspotId} » parente de « ${payload.childCompanyName ?? childHubspotId} ». Le rapprochement du deal et le garde-fou inter-entités s'activeront à la prochaine synchronisation.`,
      };
    }
    const err = await res.text();
    if (res.status === 403) {
      return { ok: false, detail: "Scope HubSpot manquant (crm.objects.companies.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
    }
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/**
 * Inscrit le contact du deal dans une séquence HubSpot AU NOM du propriétaire
 * du deal : l'email de relance part réellement de sa boîte connectée (Sales
 * Pro/Enterprise requis). Si le deal n'a pas de contact associé, repli
 * automatique sur une tâche de relance — jamais d'action perdue.
 */
export async function executeHubspotSequenceEnroll(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string; contactId?: string; inProgress?: boolean }> {
  if (!payload.dealHubspotId || !payload.sequenceId) return { ok: false, detail: "Payload de séquence incomplet." };

  // 1. Owner + contact du deal.
  const deal = await fetchOwnerAndContacts(hubspotToken, "deals", payload.dealHubspotId);
  const contactId = deal.contactIds[0] ?? null;
  if (!contactId) {
    const fb = await executeHubspotTask(hubspotToken, {
      subject: "Relancer le deal (aucun contact associé — relance par séquence impossible)",
      body: "Détecté par Revold : le deal n'a aucun contact associé, l'inscription en séquence est impossible. Associer un contact au deal puis relancer.",
      dealHubspotId: payload.dealHubspotId,
    });
    return { ok: fb.ok, detail: `Aucun contact associé au deal — repli sur une tâche. ${fb.detail}` };
  }
  if (!deal.ownerId) return { ok: false, detail: "Le deal n'a pas de propriétaire — impossible d'envoyer en son nom. Attribue le deal puis revalide." };

  // 2. Owner → utilisateur HubSpot (userId + email d'envoi).
  let userId: number | null = null;
  let senderEmail: string | null = null;
  try {
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/owners/${encodeURIComponent(deal.ownerId)}`, {
      headers: { Authorization: `Bearer ${hubspotToken}` },
    });
    if (res.ok) {
      const d = (await res.json()) as { userId?: number; email?: string };
      userId = typeof d.userId === "number" ? d.userId : null;
      senderEmail = d.email ?? null;
    }
  } catch {}
  if (!userId || !senderEmail) return { ok: false, detail: "Propriétaire du deal sans utilisateur HubSpot actif (userId/email introuvable)." };

  // 3. Inscription dans la séquence (2 formats d'API tentés — v4).
  const attempt = async (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    let res = await attempt(
      `https://api.hubapi.com/automation/v4/sequences/${encodeURIComponent(payload.sequenceId)}/enrollments?userId=${userId}`,
      { contactId, senderEmail },
    );
    if (res.status === 404 || res.status === 405) {
      res = await attempt(`https://api.hubapi.com/automation/v4/sequences/enrollments?userId=${userId}`, {
        sequenceId: payload.sequenceId,
        contactId,
        senderEmail,
      });
    }
    if (res.ok) {
      return {
        ok: true,
        // La séquence démarre : l'action reste « En cours » tant que le
        // contact est inscrit, puis passe « Terminée » (vérifié à chaque
        // chargement de la boîte via hs_sequences_is_enrolled).
        inProgress: true,
        contactId,
        detail: `Contact inscrit dans la séquence « ${payload.sequenceName ?? payload.sequenceId} » au nom de ${senderEmail} — l'email de relance part de sa boîte connectée.`,
      };
    }
    const err = await res.text();
    if (res.status === 403) {
      return { ok: false, detail: "HubSpot a refusé l'inscription (403) : scope automation.sequences.enrollments.write manquant sur l'app OAuth, ou siège Sales Pro/boîte email non connectée pour cet owner." };
    }
    if (res.status === 409) return { ok: false, detail: "Le contact est déjà inscrit dans une séquence active." };
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/**
 * La séquence d'un contact tourne-t-elle encore ? Lit la propriété standard
 * hs_sequences_is_enrolled du contact : true = séquence active (« En cours »),
 * false/absente = séquence finie ou désinscrite (« Terminée »). "unknown" en
 * cas d'erreur réseau/scope — on ne change alors PAS le statut.
 */
export async function checkSequenceStillRunning(
  hubspotToken: string,
  contactId: string,
): Promise<"running" | "done" | "unknown"> {
  try {
    const res = await hubFetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=hs_sequences_is_enrolled`,
      { headers: { Authorization: `Bearer ${hubspotToken}` } },
    );
    if (!res.ok) return "unknown";
    const d = (await res.json()) as { properties?: { hs_sequences_is_enrolled?: string | null } };
    return d.properties?.hs_sequences_is_enrolled === "true" ? "running" : "done";
  } catch {
    return "unknown";
  }
}

/**
 * Écrit des propriétés sur une entreprise HubSpot.
 * L'enrichissement CRM (SIREN/TVA) est désormais piloté par la console de la
 * page Enrichissement — plus aucun détecteur ne produit ce type d'action.
 * Conservé pour exécuter proprement les actions historiques encore en base.
 */
export async function executeHubspotCompanyUpdate(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.companyHubspotId || !payload.hubspotProperties || Object.keys(payload.hubspotProperties).length === 0) {
    return { ok: false, detail: "Payload d'enrichissement incomplet." };
  }
  try {
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/companies/${encodeURIComponent(payload.companyHubspotId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: payload.hubspotProperties }),
    });
    if (res.ok) return { ok: true, detail: `Fiche CRM enrichie (${Object.keys(payload.hubspotProperties).join(", ")}).` };
    const err = await res.text();
    if (res.status === 403) return { ok: false, detail: "Scope HubSpot manquant (crm.objects.companies.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/**
 * Relie une fiche facturation orpheline à sa fiche CRM (fusion canonique
 * Revold) : factures/abonnements/contacts/deals et liens sources repointés,
 * identifiants reportés sur la fiche CRM, fiche orpheline supprimée.
 */
export async function executeLinkCompany(
  supabase: SupabaseClient,
  orgId: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  const src = payload.sourceCompanyId;
  const dst = payload.targetCompanyId;
  if (!src || !dst || src === dst) return { ok: false, detail: "Payload de rattachement incomplet." };

  const { data: pair } = await supabase
    .from("companies")
    .select("id, name, siren, siret, vat_number, domain, hubspot_id")
    .eq("organization_id", orgId)
    .in("id", [src, dst]);
  const rows = (pair ?? []) as Array<{ id: string; name: string | null; siren: string | null; siret: string | null; vat_number: string | null; domain: string | null; hubspot_id: string | null }>;
  const source = rows.find((r) => r.id === src);
  const target = rows.find((r) => r.id === dst);
  if (!source || !target) return { ok: false, detail: "Fiches introuvables (déjà reliées ?)." };

  try {
    // 1. Repointer les enregistrements dépendants vers la fiche CRM.
    for (const table of ["invoices", "subscriptions", "contacts", "deals", "payments"]) {
      await supabase.from(table).update({ company_id: dst }).eq("organization_id", orgId).eq("company_id", src);
    }
    // 2. Repointer les liens sources (le prochain sync retrouve la bonne fiche).
    await supabase
      .from("source_links")
      .update({ internal_id: dst })
      .eq("organization_id", orgId)
      .eq("entity_type", "company")
      .eq("internal_id", src);
    // 3. Reporter les identifiants absents sur la fiche CRM.
    const enrich: Record<string, string> = {};
    if (source.siren && !target.siren) enrich.siren = source.siren;
    if (source.siret && !target.siret) enrich.siret = source.siret;
    if (source.vat_number && !target.vat_number) enrich.vat_number = source.vat_number;
    if (source.domain && !target.domain) enrich.domain = source.domain;
    if (Object.keys(enrich).length > 0) {
      await supabase.from("companies").update(enrich).eq("organization_id", orgId).eq("id", dst);
    }
    // 4. Supprimer la fiche orpheline (tout est repointé).
    await supabase.from("companies").delete().eq("organization_id", orgId).eq("id", src);
    return {
      ok: true,
      detail: `« ${source.name ?? "fiche facturation"} » reliée à « ${target.name ?? "fiche CRM"} » — factures et abonnements attribués au compte${Object.keys(enrich).length > 0 ? `, identifiants reportés (${Object.keys(enrich).join(", ")})` : ""}.`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur de rattachement" };
  }
}

/** Crée un deal de renouvellement HubSpot associé à l'entreprise. */
export async function executeHubspotCreateDeal(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.companyHubspotId || !payload.dealName) return { ok: false, detail: "Payload de deal incomplet." };
  const closeMs = payload.dealCloseDate ? new Date(`${payload.dealCloseDate}T00:00:00Z`).getTime() : Date.now() + 30 * DAY_MS;
  try {
    const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/deals", {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          dealname: payload.dealName.slice(0, 200),
          amount: String(payload.dealAmount ?? 0),
          closedate: String(closeMs),
        },
        // Association HUBSPOT_DEFINED deal→entreprise (typeId 5).
        associations: [{ to: { id: payload.companyHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }] }],
      }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: true, detail: `Deal de renouvellement créé dans HubSpot (id ${d.id ?? "?"}) — visible dans le pipeline par défaut.` };
    }
    const err = await res.text();
    if (res.status === 403) return { ok: false, detail: "Scope HubSpot manquant (crm.objects.deals.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/**
 * Repousse la date de closing d'un deal — action d'agent planifiée « plus
 * tard » (proposition update_closedate mise en file dans Suivi → Actions).
 */
export async function executeHubspotDealUpdate(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.dealHubspotId) return { ok: false, detail: "Deal cible manquant." };
  if (!payload.dealCloseDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dealCloseDate)) {
    return { ok: false, detail: "Date de closing invalide (format attendu AAAA-MM-JJ)." };
  }
  const ms = new Date(`${payload.dealCloseDate}T00:00:00Z`).getTime();
  try {
    const res = await hubFetch(`https://api.hubapi.com/crm/v3/objects/deals/${payload.dealHubspotId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { closedate: String(ms) } }),
    });
    if (res.ok) return { ok: true, detail: `Date de closing repoussée au ${payload.dealCloseDate}.` };
    const err = await res.text();
    if (res.status === 403) return { ok: false, detail: "Scope HubSpot manquant (crm.objects.deals.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
    return { ok: false, detail: `HubSpot ${res.status} : ${err.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Erreur réseau HubSpot" };
  }
}

/** Crée un contact HubSpot (email facturation) rattaché à l'entreprise. */
export async function executeHubspotCreateContact(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.contactEmail) return { ok: false, detail: "Email du contact manquant." };
  const associations = payload.companyHubspotId
    ? [{ to: { id: payload.companyHubspotId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 }] }]
    : [];
  const properties: Record<string, string> = { email: payload.contactEmail };
  // payload.subject transporte le nom complet éventuel du contact facturation.
  if (payload.subject) {
    const parts = payload.subject.trim().split(/\s+/);
    if (parts.length > 1) { properties.firstname = parts[0]; properties.lastname = parts.slice(1).join(" "); }
    else properties.lastname = payload.subject.trim();
  }
  try {
    const res = await hubFetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties, associations }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      return { ok: true, detail: `Contact facturation créé dans HubSpot (id ${d.id ?? "?"}).` };
    }
    const err = await res.text();
    if (res.status === 409) return { ok: false, detail: "Un contact avec cet email existe déjà dans HubSpot — le rapprochement se fera à la prochaine sync." };
    if (res.status === 403) return { ok: false, detail: "Scope HubSpot manquant (crm.objects.contacts.write) — ajoute-le à l'app OAuth puis reconnecte HubSpot." };
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
