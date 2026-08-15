import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupCompanyByName, lookupCompanyFacts, vatFromSiren } from "@/lib/enrichment/company-enrichment";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

/**
 * MOTEUR de backfill d'enrichissement — partagé par le cron horaire
 * (toutes les orgs) et le bouton « Enrichir toute ma base » (org courante,
 * appels en boucle depuis l'UI avec progression).
 *
 *  1. IDENTITÉS — entreprises SANS SIREN (nom requis) :
 *     · correspondance SÛRE (nom normalisé identique) → appliquée seule
 *       (SIREN/SIRET/TVA/raison sociale + effectifs/CA de la même réponse
 *       API) + poussée dans HubSpot ;
 *     · correspondance PLAUSIBLE → persistée en candidat (candidate_*),
 *       validée par l'utilisateur (survit au rafraîchissement) ;
 *     · aucun résultat → marquée vérifiée (re-scan 30 j).
 *  2. EFFECTIFS & CA — entreprises AVEC SIREN jamais enrichies ou > 90 j.
 */

const THROTTLE_MS = 200; // ~5 req/s — l'API publique tolère 7/s
const RECHECK_DAYS = 30;
const REFRESH_DAYS = 90;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BackfillCounts = { identities: number; candidates: number; facts: number };
export type BackfillResult = BackfillCounts & {
  lookupsUsed: number;
  /** Entreprises encore à traiter (pour la boucle de progression côté UI). */
  remainingIdentities: number;
  remainingFacts: number;
  /** Compteurs par org (notifications du cron multi-org). */
  perOrg: Record<string, BackfillCounts>;
  /** Migration enrichment_scale absente → rien n'a été fait. */
  unavailable?: boolean;
  /** Lot écourté : registre injoignable ou quota atteint — reprendre plus tard. */
  interrupted?: boolean;
};

type IdentityRow = { id: string; organization_id: string; name: string | null; hubspot_id: string | null };
type FactsRow = { id: string; organization_id: string; siren: string; hubspot_id: string | null };

function orgCaches(sb: SupabaseClient) {
  const tokens = new Map<string, string | null>();
  const props = new Map<string, (canonical: string, fallback: string) => string>();
  return {
    async token(orgId: string): Promise<string | null> {
      if (!tokens.has(orgId)) tokens.set(orgId, await getHubSpotToken(sb, orgId));
      return tokens.get(orgId) ?? null;
    },
    async propFor(orgId: string): Promise<(canonical: string, fallback: string) => string> {
      if (!props.has(orgId)) {
        const { data } = await sb
          .from("identifier_field_mapping")
          .select("canonical_field, provider_field")
          .eq("organization_id", orgId)
          .eq("provider", "hubspot");
        const rows = data ?? [];
        props.set(orgId, (canonical, fallback) => {
          const m = rows.find((x) => x.canonical_field === canonical);
          return (m?.provider_field as string | undefined)?.trim() || fallback;
        });
      }
      return props.get(orgId)!;
    },
  };
}

async function pushHubspot(token: string, hsId: string, properties: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${hsId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runEnrichmentBatch(
  sb: SupabaseClient,
  opts: { orgId?: string; budget: number },
): Promise<BackfillResult> {
  const caches = orgCaches(sb);
  const now = Date.now();
  const recheckBefore = new Date(now - RECHECK_DAYS * 86_400_000).toISOString();
  const refreshBefore = new Date(now - REFRESH_DAYS * 86_400_000).toISOString();

  let budget = Math.max(1, opts.budget);
  const perOrg: Record<string, BackfillCounts> = {};
  const bump = (orgId: string, k: keyof BackfillCounts) => {
    (perOrg[orgId] ??= { identities: 0, candidates: 0, facts: 0 })[k]++;
  };
  const totals: BackfillCounts = { identities: 0, candidates: 0, facts: 0 };

  const scoped = <T>(q: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return opts.orgId ? (q as any).eq("organization_id", opts.orgId) : q;
  };

  // ── 1. Identités manquantes ──
  const identityQuery = scoped(
    sb
      .from("companies")
      .select("id, organization_id, name, hubspot_id")
      .is("siren", null)
      .not("name", "is", null)
      .is("candidate_siren", null)
      .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`),
  )
    .order("sirene_checked_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.floor(opts.budget * 0.6)));
  const { data: identityData, error: identityError } = await identityQuery;
  if (identityError) {
    return { ...totals, lookupsUsed: 0, remainingIdentities: 0, remainingFacts: 0, perOrg, unavailable: true };
  }

  let interrupted = false;
  for (const c of (identityData ?? []) as IdentityRow[]) {
    if (budget <= 0) break;
    if (!c.name || c.name.trim().length < 2) continue;
    budget--;
    const outcome = await lookupCompanyByName(c.name);
    await sleep(THROTTLE_MS);
    const checked = { sirene_checked_at: new Date().toISOString() };

    // Appel échoué (quota/panne) : on N'ÉCRIT RIEN — l'entreprise reste à
    // traiter au prochain passage — et on écourte le lot (backoff naturel).
    if (outcome.status === "error") {
      interrupted = true;
      break;
    }
    if (outcome.status === "none") {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }
    const found = outcome.data;
    if (found.confidence !== "high") {
      await sb
        .from("companies")
        .update({ ...checked, candidate_siren: found.siren, candidate_siret: found.siret, candidate_legal_name: found.legalName })
        .eq("id", c.id);
      bump(c.organization_id, "candidates");
      totals.candidates++;
      continue;
    }

    const update: Record<string, unknown> = {
      ...checked,
      siren: found.siren,
      vat_number: vatFromSiren(found.siren),
      enriched_at: new Date().toISOString(),
    };
    if (found.siret) update.siret = found.siret;
    if (found.facts.employeeRange) {
      update.official_employee_range = found.facts.employeeRange;
      update.official_employee_year = found.facts.employeeYear;
    }
    if (typeof found.facts.revenue === "number") {
      update.official_revenue = found.facts.revenue;
      update.official_revenue_year = found.facts.revenueYear;
    }
    const { error } = await sb.from("companies").update(update).eq("id", c.id);
    if (error) continue;
    await sb.from("companies").update({ legal_name: found.legalName }).eq("id", c.id);
    bump(c.organization_id, "identities");
    totals.identities++;

    const token = await caches.token(c.organization_id);
    if (token && c.hubspot_id) {
      const propFor = await caches.propFor(c.organization_id);
      const properties: Record<string, string> = {
        [propFor("siren", "siren")]: found.siren,
        [propFor("vat_number", "vat_number")]: vatFromSiren(found.siren),
      };
      if (found.siret) properties[propFor("siret", "siret")] = found.siret;
      if (typeof found.facts.revenue === "number") properties.annualrevenue = String(Math.round(found.facts.revenue));
      if (typeof found.facts.employeeMidpoint === "number") properties.numberofemployees = String(found.facts.employeeMidpoint);
      await pushHubspot(token, c.hubspot_id, properties);
    }
  }

  // ── 2. Effectifs & CA (déterministe par SIREN) ──
  if (budget > 0 && !interrupted) {
    const factsQuery = scoped(
      sb
        .from("companies")
        .select("id, organization_id, siren, hubspot_id")
        .not("siren", "is", null)
        .or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`),
    )
      .order("enriched_at", { ascending: true, nullsFirst: true })
      .limit(budget);
    const { data: factsData } = await factsQuery;

    for (const c of (factsData ?? []) as FactsRow[]) {
      if (budget <= 0) break;
      if (!/^\d{9}$/.test(c.siren)) continue;
      budget--;
      const outcome = await lookupCompanyFacts(c.siren);
      await sleep(THROTTLE_MS);
      // Appel échoué → rien écrit (enriched_at intact), lot écourté.
      if (outcome.status === "error") {
        interrupted = true;
        break;
      }
      const facts = outcome.status === "found" ? outcome.data : null;
      const update: Record<string, unknown> = { enriched_at: new Date().toISOString() };
      if (facts?.employeeRange) {
        update.official_employee_range = facts.employeeRange;
        update.official_employee_year = facts.employeeYear;
      }
      if (typeof facts?.revenue === "number") {
        update.official_revenue = facts.revenue;
        update.official_revenue_year = facts.revenueYear;
      }
      const { error } = await sb.from("companies").update(update).eq("id", c.id);
      if (error || !facts || (!facts.employeeRange && facts.revenue == null)) continue;
      bump(c.organization_id, "facts");
      totals.facts++;

      const token = await caches.token(c.organization_id);
      if (token && c.hubspot_id) {
        const properties: Record<string, string> = {};
        if (typeof facts.revenue === "number") properties.annualrevenue = String(Math.round(facts.revenue));
        if (typeof facts.employeeMidpoint === "number") properties.numberofemployees = String(facts.employeeMidpoint);
        if (Object.keys(properties).length > 0) await pushHubspot(token, c.hubspot_id, properties);
      }
    }
  }

  // ── Restant à traiter (progression côté UI) ──
  const countRemaining = async (kind: "identities" | "facts"): Promise<number> => {
    try {
      const base = sb.from("companies").select("id", { count: "exact", head: true });
      const q =
        kind === "identities"
          ? scoped(base)
              .is("siren", null)
              .not("name", "is", null)
              .is("candidate_siren", null)
              .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`)
          : scoped(base).not("siren", "is", null).or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`);
      const { count } = await q;
      return count ?? 0;
    } catch {
      return 0;
    }
  };
  const [remainingIdentities, remainingFacts] = await Promise.all([countRemaining("identities"), countRemaining("facts")]);

  return { ...totals, lookupsUsed: opts.budget - budget, remainingIdentities, remainingFacts, perOrg, interrupted };
}
