/**
 * Diagnostic des entreprises NON RAPPROCHÉES entre le CRM et les outils de
 * facturation/paiement (Pennylane, Stripe…) — avec la CAUSE probable et une
 * action corrective concrète par cas :
 *
 *   - name_mismatch       → une fiche CRM proche existe mais les noms diffèrent
 *   - email_mismatch      → l'email du contact côté facturation n'existe pas côté CRM
 *   - missing_identifiers → aucun SIREN/SIRET/TVA d'un côté ou de l'autre :
 *                           l'enrichir dans le CRM devient l'action prioritaire
 *                           (facturation électronique obligatoire en sept. 2026 :
 *                           le SIREN devient l'identifiant pivot)
 *   - no_candidate        → aucune fiche CRM équivalente trouvée
 *
 * 100 % déterministe : jointures réelles sur source_links + tables canoniques,
 * mêmes définitions que le taux de rapprochement (hubspot_id null = non relié).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectedTools } from "@/lib/integrations/connected-tools";

export type UnmatchedCause = "name_mismatch" | "email_mismatch" | "missing_identifiers" | "no_candidate";

export type UnmatchedItem = {
  provider: string;
  providerLabel: string;
  /** Nom de l'entreprise (ou email du contact) côté outil tiers. */
  label: string;
  cause: UnmatchedCause;
  /** Diagnostic précis, lisible. */
  detail: string;
  /** Action corrective concrète. */
  action: string;
  /** Fiche CRM la plus proche (cause name_mismatch). */
  candidateName?: string | null;
};

export type UnmatchedReport = {
  hasData: boolean;
  /** Enregistrements de facturation reliés à une entreprise analysée. */
  totalAnalyzed: number;
  counts: Record<UnmatchedCause, number>;
  items: UnmatchedItem[];
};

const EMPTY: UnmatchedReport = {
  hasData: false,
  totalAnalyzed: 0,
  counts: { name_mismatch: 0, email_mismatch: 0, missing_identifiers: 0, no_candidate: 0 },
  items: [],
};

// ── Deals gagnés : préparation au rapprochement (anticipation AVANT facture) ──

/** Identifiants contrôlés = règles de résolution COCHÉES par l'utilisateur. */
const RULE_IDENTIFIERS: Array<{ ruleId: string; label: string; strong: boolean }> = [
  { ruleId: "custom_id_match", label: "ID de rapprochement", strong: true },
  { ruleId: "siren_match", label: "SIREN", strong: true },
  { ruleId: "vat_match", label: "N° TVA", strong: true },
  { ruleId: "siret_match", label: "SIRET", strong: true },
  { ruleId: "exact_email", label: "Email contact", strong: false },
  { ruleId: "domain_match", label: "Domaine", strong: false },
  { ruleId: "name_match", label: "Nom d'entreprise", strong: false },
];
/** Défauts iso Paramètres → Modèle de données (règles cochées d'origine). */
const DEFAULT_ENABLED = new Set(["custom_id_match", "siren_match", "vat_match", "siret_match", "exact_email"]);

export type WonReadinessItem = {
  companyName: string;
  dealsCount: number;
  totalAmount: number;
  lastCloseDate: string | null;
  /** Identifiants actifs manquants sur la fiche (labels). */
  missing: string[];
};

export type WonReadinessReport = {
  hasData: boolean;
  /** Identifiants réellement contrôlés (= règles cochées dans les paramètres). */
  activeIdentifiers: string[];
  totalCompanies: number;
  readyCount: number;
  /** Entreprises à enrichir, triées par montant gagné décroissant. */
  items: WonReadinessItem[];
};

const EMPTY_READINESS: WonReadinessReport = { hasData: false, activeIdentifiers: [], totalCompanies: 0, readyCount: 0, items: [] };

/**
 * Pour chaque entreprise avec au moins un deal GAGNÉ (les seules qui seront
 * facturées), vérifie EN AMONT que les identifiants de rapprochement cochés
 * dans les paramètres (SIREN, SIRET, N° TVA, ID custom, email, domaine, nom)
 * sont renseignés — pour que la future facture se rapproche automatiquement.
 * « Prête » = au moins un identifiant FORT renseigné (custom ID, SIREN, TVA,
 * SIRET) ; si aucune règle forte n'est cochée, tous les identifiants actifs.
 */
export async function computeWonDealsReadiness(
  supabase: SupabaseClient,
  orgId: string,
  maxItems = 15,
): Promise<WonReadinessReport> {
  try {
    // ── Règles cochées (mêmes exclusions que le moteur : dedup_/mapping_) ──
    let enabled = new Set(DEFAULT_ENABLED);
    try {
      const { data } = await supabase
        .from("entity_resolution_config")
        .select("rule_id, enabled")
        .eq("organization_id", orgId);
      const rows = ((data ?? []) as Array<{ rule_id: string; enabled: boolean }>).filter(
        (r) => !r.rule_id.startsWith("dedup_") && !r.rule_id.startsWith("mapping_"),
      );
      if (rows.length > 0) {
        enabled = new Set(DEFAULT_ENABLED);
        for (const r of rows) {
          if (r.enabled) enabled.add(r.rule_id);
          else enabled.delete(r.rule_id);
        }
      }
    } catch {}
    const active = RULE_IDENTIFIERS.filter((r) => enabled.has(r.ruleId));
    if (active.length === 0) return EMPTY_READINESS;

    // ── Deals gagnés → agrégat par entreprise ──
    const { data: won } = await supabase
      .from("deals")
      .select("company_id, amount, close_date")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .not("company_id", "is", null)
      .limit(2000);
    const byCompany = new Map<string, { count: number; amount: number; last: string | null }>();
    for (const d of (won ?? []) as Array<{ company_id: string; amount: number | null; close_date: string | null }>) {
      const cur = byCompany.get(d.company_id) ?? { count: 0, amount: 0, last: null };
      cur.count++;
      cur.amount += Number(d.amount) || 0;
      if (d.close_date && (!cur.last || d.close_date > cur.last)) cur.last = d.close_date;
      byCompany.set(d.company_id, cur);
    }
    const ids = [...byCompany.keys()];
    if (ids.length === 0) return EMPTY_READINESS;

    // ── Fiches entreprises (custom_id résilient : migration facultative) ──
    type Row = { id: string; name: string | null; domain: string | null; siren: string | null; siret: string | null; vat_number: string | null; custom_id?: string | null };
    const companies: Row[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const first = await supabase
        .from("companies")
        .select("id, name, domain, siren, siret, vat_number, custom_id")
        .eq("organization_id", orgId)
        .in("id", chunk);
      if (first.error && /custom_id/.test(first.error.message)) {
        const fb = await supabase
          .from("companies")
          .select("id, name, domain, siren, siret, vat_number")
          .eq("organization_id", orgId)
          .in("id", chunk);
        companies.push(...(((fb.data ?? []) as unknown) as Row[]));
      } else {
        companies.push(...(((first.data ?? []) as unknown) as Row[]));
      }
    }

    // ── Email contact : entreprises ayant AU MOINS un contact avec email ──
    const withEmail = new Set<string>();
    if (enabled.has("exact_email")) {
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase
          .from("contacts")
          .select("company_id")
          .eq("organization_id", orgId)
          .in("company_id", ids.slice(i, i + 200))
          .not("email", "is", null)
          .limit(1000);
        for (const r of (data ?? []) as Array<{ company_id: string | null }>) {
          if (r.company_id) withEmail.add(r.company_id);
        }
      }
    }

    const hasStrongActive = active.some((a) => a.strong);
    const items: WonReadinessItem[] = [];
    let readyCount = 0;
    for (const c of companies) {
      const agg = byCompany.get(c.id);
      if (!agg) continue;
      const filledOf = (ruleId: string): boolean => {
        switch (ruleId) {
          case "custom_id_match": return Boolean(c.custom_id?.trim());
          case "siren_match": return Boolean(c.siren?.trim());
          case "vat_match": return Boolean(c.vat_number?.trim());
          case "siret_match": return Boolean(c.siret?.trim());
          case "exact_email": return withEmail.has(c.id);
          case "domain_match": return Boolean(c.domain?.trim());
          case "name_match": return Boolean(c.name?.trim());
          default: return false;
        }
      };
      const missing = active.filter((a) => !filledOf(a.ruleId));
      const strongFilled = active.some((a) => a.strong && filledOf(a.ruleId));
      const ready = hasStrongActive ? strongFilled : missing.length === 0;
      if (ready) {
        readyCount++;
      } else {
        items.push({
          companyName: c.name?.trim() || "(sans nom)",
          dealsCount: agg.count,
          totalAmount: Math.round(agg.amount),
          lastCloseDate: agg.last,
          missing: missing.map((m) => m.label),
        });
      }
    }
    items.sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      hasData: true,
      activeIdentifiers: active.map((a) => a.label),
      totalCompanies: byCompany.size,
      readyCount,
      items: items.slice(0, maxItems),
    };
  } catch {
    return EMPTY_READINESS;
  }
}

/** Normalisation de nom d'entreprise : casse, accents, ponctuation, formes juridiques. */
function normName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(sarl|sasu|sas|sa|eurl|ei|sci|snc|scop|gmbh|ltd|llc|inc|bv|srl|spa|ag|plc|co|company|group|groupe|holding)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Similarité grossière par recouvrement de tokens (0..1). */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length >= 3));
  const tb = new Set(b.split(" ").filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

type CompanyRow = {
  id: string;
  name: string | null;
  domain: string | null;
  siren: string | null;
  siret: string | null;
  vat_number: string | null;
  hubspot_id: string | null;
};

export async function computeUnmatchedReport(
  supabase: SupabaseClient,
  orgId: string,
  maxItems = 20,
): Promise<UnmatchedReport> {
  try {
    const connected = await getConnectedTools(supabase, orgId);
    const billingTools = connected.filter((t) => t.category === "billing");
    if (billingTools.length === 0) return EMPTY;

    // ── 1. Entreprises atteignables depuis chaque outil de facturation :
    //    liens company directs + entreprises des factures/abonnements. ──
    const companyIdsByProvider = new Map<string, Set<string>>();
    for (const tool of billingTools) {
      const ids = new Set<string>();
      const { data: links } = await supabase
        .from("source_links")
        .select("internal_id, entity_type")
        .eq("organization_id", orgId)
        .eq("provider", tool.key)
        .in("entity_type", ["company", "invoice", "subscription"])
        .limit(2000);
      const docIds: string[] = [];
      for (const l of (links ?? []) as Array<{ internal_id: string; entity_type: string }>) {
        if (l.entity_type === "company") ids.add(l.internal_id);
        else docIds.push(l.internal_id);
      }
      // Factures / abonnements → company_id
      for (const [table, chunkIds] of [["invoices", docIds], ["subscriptions", docIds]] as const) {
        if (chunkIds.length === 0) continue;
        for (let i = 0; i < chunkIds.length; i += 200) {
          const { data } = await supabase
            .from(table)
            .select("id, company_id")
            .eq("organization_id", orgId)
            .in("id", chunkIds.slice(i, i + 200));
          for (const row of (data ?? []) as Array<{ company_id: string | null }>) {
            if (row.company_id) ids.add(row.company_id);
          }
        }
      }
      if (ids.size > 0) companyIdsByProvider.set(tool.key, ids);
    }

    const allIds = [...new Set([...companyIdsByProvider.values()].flatMap((s) => [...s]))];
    if (allIds.length === 0) return EMPTY;

    // ── 2. Fiches canoniques de ces entreprises ──
    const companies: CompanyRow[] = [];
    for (let i = 0; i < allIds.length; i += 200) {
      const { data } = await supabase
        .from("companies")
        .select("id, name, domain, siren, siret, vat_number, hubspot_id")
        .eq("organization_id", orgId)
        .in("id", allIds.slice(i, i + 200));
      companies.push(...((data ?? []) as CompanyRow[]));
    }
    const byId = new Map(companies.map((c) => [c.id, c]));

    // ── 3. Référentiel CRM : entreprises reliées à HubSpot ──
    const { data: crmRows } = await supabase
      .from("companies")
      .select("id, name, domain")
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null)
      .limit(3000);
    const crm = (crmRows ?? []) as Array<{ id: string; name: string | null; domain: string | null }>;
    const crmByNorm = new Map<string, string>();
    const crmByDomain = new Map<string, string>();
    for (const c of crm) {
      const n = normName(c.name);
      if (n && !crmByNorm.has(n)) crmByNorm.set(n, c.name ?? n);
      if (c.domain) crmByDomain.set(c.domain.toLowerCase(), c.name ?? c.domain);
    }

    const counts: UnmatchedReport["counts"] = { name_mismatch: 0, email_mismatch: 0, missing_identifiers: 0, no_candidate: 0 };
    const items: UnmatchedItem[] = [];
    let totalAnalyzed = 0;
    const seenCompany = new Set<string>();

    for (const [provider, ids] of companyIdsByProvider) {
      const providerLabel = billingTools.find((t) => t.key === provider)?.label ?? provider;
      for (const id of ids) {
        const c = byId.get(id);
        if (!c) continue;
        totalAnalyzed++;
        if (c.hubspot_id) continue; // rapprochée — rien à faire
        if (seenCompany.has(`${provider}:${c.id}`)) continue;
        seenCompany.add(`${provider}:${c.id}`);

        const name = c.name?.trim() || "(sans nom)";
        const norm = normName(c.name);
        const hasIdentifiers = Boolean(c.siren || c.siret || c.vat_number);

        // Candidat CRM : nom normalisé identique, puis domaine, puis similarité.
        let candidate: string | null = null;
        let via: "nom" | "domaine" | "similarité" | null = null;
        if (norm && crmByNorm.has(norm)) { candidate = crmByNorm.get(norm)!; via = "nom"; }
        else if (c.domain && crmByDomain.has(c.domain.toLowerCase())) { candidate = crmByDomain.get(c.domain.toLowerCase())!; via = "domaine"; }
        else if (norm) {
          for (const [n, label] of crmByNorm) {
            if (tokenOverlap(norm, n) >= 0.6) { candidate = label; via = "similarité"; break; }
          }
        }

        if (candidate) {
          counts.name_mismatch++;
          items.push({
            provider,
            providerLabel,
            label: name,
            cause: "name_mismatch",
            candidateName: candidate,
            detail: `« ${name} » (${providerLabel}) ressemble à « ${candidate} » dans le CRM (trouvée par ${via}) — mais les fiches ne sont pas reliées : les noms/identifiants diffèrent.`,
            action: hasIdentifiers
              ? `Harmonise le nom entre ${providerLabel} et le CRM, ou reporte le SIREN/N° TVA de « ${name} » sur la fiche CRM « ${candidate} » : le rapprochement se fera automatiquement à la prochaine sync.`
              : `Renseigne le SIREN sur « ${candidate} » (CRM) ET sur « ${name} » (${providerLabel}) — identifiant pivot fiable, insensible aux variantes de nom. À défaut, harmonise les deux noms à l'identique.`,
          });
        } else if (!hasIdentifiers) {
          counts.missing_identifiers++;
          items.push({
            provider,
            providerLabel,
            label: name,
            cause: "missing_identifiers",
            detail: `« ${name} » (${providerLabel}) n'a ni SIREN, ni SIRET, ni N° TVA — aucun identifiant pivot pour la relier au CRM.`,
            action: `Ajoute le SIREN de « ${name} » directement dans le CRM (et dans ${providerLabel}) : avec la facturation électronique obligatoire en septembre, le SIREN devient l'identifiant pivot des factures — l'enrichir maintenant fiabilise le rapprochement et prépare l'échéance.`,
          });
        } else {
          counts.no_candidate++;
          items.push({
            provider,
            providerLabel,
            label: name,
            cause: "no_candidate",
            detail: `« ${name} » (${providerLabel}) a des identifiants (${[c.siren && "SIREN", c.siret && "SIRET", c.vat_number && "TVA"].filter(Boolean).join(", ")}) mais aucune fiche CRM correspondante n'a été trouvée.`,
            action: `Vérifie que l'entreprise existe dans le CRM (peut-être sous un autre nom) et reporte son SIREN/N° TVA sur la fiche CRM — sinon crée la fiche : sans elle, factures et paiements resteront invisibles côté CRM.`,
          });
        }
      }
    }

    // ── 4. Contacts de facturation dont l'email n'existe pas côté CRM ──
    for (const tool of billingTools) {
      const { data: cLinks } = await supabase
        .from("source_links")
        .select("internal_id")
        .eq("organization_id", orgId)
        .eq("provider", tool.key)
        .eq("entity_type", "contact")
        .limit(1000);
      const ids = [...new Set(((cLinks ?? []) as Array<{ internal_id: string }>).map((l) => l.internal_id))];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase
          .from("contacts")
          .select("id, email, hubspot_id")
          .eq("organization_id", orgId)
          .in("id", ids.slice(i, i + 200))
          .is("hubspot_id", null)
          .not("email", "is", null);
        for (const row of (data ?? []) as Array<{ email: string | null }>) {
          const email = row.email?.trim();
          if (!email) continue;
          // Un contact CRM existe-t-il avec cet email exact ?
          const { count } = await supabase
            .from("contacts")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .ilike("email", email)
            .not("hubspot_id", "is", null);
          if ((count ?? 0) > 0) continue; // même email des deux côtés → autre cause, déjà couverte
          counts.email_mismatch++;
          items.push({
            provider: tool.key,
            providerLabel: tool.label,
            label: email,
            cause: "email_mismatch",
            detail: `Le contact « ${email} » (${tool.label}) n'existe sous cet email dans aucune fiche CRM — l'email de facturation diffère de l'email CRM.`,
            action: `Ajoute « ${email} » comme email (principal ou secondaire) du contact CRM concerné, ou utilise l'email CRM dans ${tool.label} : l'email exact est une règle de rapprochement automatique.`,
          });
          if (counts.email_mismatch >= 10) break; // borne les requêtes email
        }
        if (counts.email_mismatch >= 10) break;
      }
    }

    // Causes les plus actionnables d'abord : identifiants absents, puis noms, emails, sans correspondance.
    const order: UnmatchedCause[] = ["missing_identifiers", "name_mismatch", "email_mismatch", "no_candidate"];
    items.sort((a, b) => order.indexOf(a.cause) - order.indexOf(b.cause));

    return {
      hasData: totalAnalyzed > 0,
      totalAnalyzed,
      counts,
      items: items.slice(0, maxItems),
    };
  } catch {
    return EMPTY;
  }
}
