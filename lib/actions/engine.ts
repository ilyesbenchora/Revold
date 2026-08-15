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

/**
 * Détecteur : SIREN / N° TVA connu en canonique (via la facturation) mais
 * absent de la fiche HubSpot — l'action reporte l'identifiant dans le CRM.
 * Chaque report rend les rapprochements suivants automatiques.
 */
export async function detectCrmIdentifierEnrich(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null,
): Promise<Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }>> {
  if (!hubspotToken) return [];
  // Propriétés HubSpot cibles : mapping utilisateur, sinon défauts du catalogue.
  const { data: mapping } = await supabase
    .from("identifier_field_mapping")
    .select("canonical_field, provider_field")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot")
    .in("canonical_field", ["siren", "vat_number"]);
  const fieldFor = new Map<string, string>([["siren", "siren"], ["vat_number", "vat_number"]]);
  for (const m of (mapping ?? []) as Array<{ canonical_field: string; provider_field: string | null }>) {
    if (m.provider_field) fieldFor.set(m.canonical_field, m.provider_field);
  }

  const { data } = await supabase
    .from("companies")
    .select("id, name, siren, vat_number, hubspot_id")
    .eq("organization_id", orgId)
    .not("hubspot_id", "is", null)
    .or("siren.not.is.null,vat_number.not.is.null")
    .limit(100);
  const companies = ((data ?? []) as Array<{ id: string; name: string | null; siren: string | null; vat_number: string | null; hubspot_id: string | null }>)
    .filter((c) => c.hubspot_id);
  if (companies.length === 0) return [];

  // Lecture batch HubSpot : la propriété est-elle déjà renseignée côté CRM ?
  let hsProps = new Map<string, Record<string, string | null>>();
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/batch/read", {
      method: "POST",
      headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: [...new Set(fieldFor.values())],
        inputs: companies.map((c) => ({ id: c.hubspot_id })),
      }),
    });
    if (!res.ok) return []; // propriété inexistante côté portail → rien à proposer
    const d = (await res.json()) as { results?: Array<{ id: string; properties?: Record<string, string | null> }> };
    hsProps = new Map((d.results ?? []).map((r) => [r.id, r.properties ?? {}]));
  } catch {
    return [];
  }

  const out: Array<{ dedupe_key: string; type: string; title: string; description: string; source: string; payload: ActionPayload }> = [];
  for (const c of companies) {
    const hs = hsProps.get(c.hubspot_id!) ?? {};
    const toWrite: Record<string, string> = {};
    const parts: string[] = [];
    if (c.siren && !hs[fieldFor.get("siren")!]) { toWrite[fieldFor.get("siren")!] = c.siren; parts.push(`SIREN ${c.siren}`); }
    if (c.vat_number && !hs[fieldFor.get("vat_number")!]) { toWrite[fieldFor.get("vat_number")!] = c.vat_number; parts.push(`N° TVA ${c.vat_number}`); }
    if (Object.keys(toWrite).length === 0) continue;
    out.push({
      dedupe_key: `crm_enrich:${c.id}`,
      type: "hubspot_company_update",
      title: `Reporter ${parts.join(" + ")} sur « ${c.name ?? "entreprise"} » (CRM)`,
      description: `L'identifiant est connu via la facturation mais absent de la fiche HubSpot. Valider l'écrit dans le CRM : les prochains rapprochements de cette entreprise deviennent automatiques (et la fiche est prête pour la facturation électronique).`,
      source: "detector:crm_enrich",
      payload: { companyHubspotId: c.hubspot_id!, hubspotProperties: toWrite },
    });
    if (out.length >= 10) break;
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
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/tasks", {
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
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${type}/merge`, {
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

/** Écrit des propriétés sur une entreprise HubSpot (enrichissement SIREN/TVA). */
export async function executeHubspotCompanyUpdate(
  hubspotToken: string,
  payload: ActionPayload,
): Promise<{ ok: boolean; detail: string }> {
  if (!payload.companyHubspotId || !payload.hubspotProperties || Object.keys(payload.hubspotProperties).length === 0) {
    return { ok: false, detail: "Payload d'enrichissement incomplet." };
  }
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${encodeURIComponent(payload.companyHubspotId)}`, {
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
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
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
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
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
