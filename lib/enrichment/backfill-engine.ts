import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupCompanyByName,
  lookupCompanyFacts,
  vatFromSiren,
  MIN_QUERY_LENGTH,
} from "@/lib/enrichment/company-enrichment";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { pushHubspotIfEmpty } from "@/lib/enrichment/hubspot-push";
import {
  getEnrichmentSettings,
  nafSectionLabel,
  registryForCountry,
  type EnrichmentSettings,
} from "@/lib/enrichment/settings";

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
/** Échecs d'affilée avant de conclure à une vraie panne du registre. */
const MAX_CONSECUTIVE_ERRORS = 8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BackfillCounts = { identities: number; candidates: number; facts: number; duplicates: number };
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
type FactsRow = {
  id: string;
  organization_id: string;
  siren: string;
  siret: string | null;
  vat_number: string | null;
  hubspot_id: string | null;
};

function orgCaches(sb: SupabaseClient) {
  const tokens = new Map<string, string | null>();
  const props = new Map<string, (canonical: string, fallback: string) => string>();
  const settings = new Map<string, EnrichmentSettings>();
  const countryOk = new Map<string, boolean>();
  return {
    async token(orgId: string): Promise<string | null> {
      if (!tokens.has(orgId)) tokens.set(orgId, await getHubSpotToken(sb, orgId));
      return tokens.get(orgId) ?? null;
    },
    /** Réglages Paramètres → Enrichissement (champs actifs, push HubSpot des IDs). */
    async settings(orgId: string): Promise<EnrichmentSettings> {
      if (!settings.has(orgId)) settings.set(orgId, await getEnrichmentSettings(sb, orgId));
      return settings.get(orgId)!;
    },
    /** Registre du pays de l'org supporté ? (FR/absent = Sirene ; autre pays → skip). */
    async registrySupported(orgId: string): Promise<boolean> {
      if (!countryOk.has(orgId)) {
        try {
          const { data } = await sb.from("organizations").select("country").eq("id", orgId).maybeSingle();
          countryOk.set(orgId, registryForCountry((data?.country as string | null) ?? null).supported);
        } catch {
          countryOk.set(orgId, true);
        }
      }
      return countryOk.get(orgId)!;
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
    (perOrg[orgId] ??= { identities: 0, candidates: 0, facts: 0, duplicates: 0 })[k]++;
  };
  const totals: BackfillCounts = { identities: 0, candidates: 0, facts: 0, duplicates: 0 };

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
  // Un 429 isolé ne doit pas tuer un lot de 400 : on tolère des échecs
  // ponctuels (backoff court) et on n'abandonne qu'après 3 d'affilée.
  let consecutiveErrors = 0;
  for (const c of (identityData ?? []) as IdentityRow[]) {
    if (budget <= 0) break;
    const checked = { sirene_checked_at: new Date().toISOString() };

    // Registre du pays non supporté (org non française) → on marque vérifiée
    // sans appeler Sirene : chercher une entreprise étrangère dans le registre
    // français ne produirait que des faux positifs.
    if (!(await caches.registrySupported(c.organization_id))) {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }
    const st = await caches.settings(c.organization_id);
    // SIREN désactivé dans Paramètres → Enrichissement : la clé d'identité ne
    // doit pas être posée — on marque vérifiée et on passe.
    if (!st.fields.siren) {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }

    // Nom trop court pour être cherché (le registre exige 3 caractères) : on
    // MARQUE VÉRIFIÉE au lieu de simplement sauter. Sans cette écriture, la
    // fiche reste en tête de file et revient à chaque passage — c'est ainsi
    // que « 3P », « GA » et « C- » ont gelé un backfill entier.
    if (!c.name || c.name.trim().length < MIN_QUERY_LENGTH) {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }
    budget--;
    const outcome = await lookupCompanyByName(c.name);
    await sleep(THROTTLE_MS);

    // Appel échoué (quota/panne) : on N'ÉCRIT RIEN — l'entreprise reste à
    // traiter au prochain passage. On n'abandonne le lot qu'après une série
    // franche d'échecs (vraie panne), avec un backoff qui laisse le registre
    // respirer — jamais sur un incident isolé.
    if (outcome.status === "error") {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        interrupted = true;
        break;
      }
      await sleep(1000 * consecutiveErrors);
      continue;
    }
    consecutiveErrors = 0;
    if (outcome.status === "none") {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }
    const found = outcome.data;
    // Effectifs/CA du candidat : déjà présents dans la réponse du registre —
    // persistés pour être AFFICHÉS dans le tableau de validation.
    const candidateFacts = {
      candidate_employee_range: found.facts.employeeRange,
      candidate_employee_year: found.facts.employeeYear,
      candidate_revenue: found.facts.revenue,
      candidate_revenue_year: found.facts.revenueYear,
    };
    if (found.confidence !== "high") {
      const base = {
        ...checked,
        candidate_siren: found.siren,
        candidate_siret: found.siret,
        candidate_legal_name: found.legalName,
      };
      // Colonnes candidate_* de faits : migration récente → repli silencieux.
      const { error: candErr } = await sb.from("companies").update({ ...base, ...candidateFacts }).eq("id", c.id);
      if (candErr) await sb.from("companies").update(base).eq("id", c.id);
      bump(c.organization_id, "candidates");
      totals.candidates++;
      continue;
    }

    // Champs pilotés par Paramètres → Enrichissement (défaut : tout actif).
    const update: Record<string, unknown> = {
      ...checked,
      siren: found.siren,
      enriched_at: new Date().toISOString(),
    };
    if (st.fields.vat) update.vat_number = vatFromSiren(found.siren);
    if (st.fields.siret && found.siret) update.siret = found.siret;
    if (st.fields.employees && found.facts.employeeRange) {
      update.official_employee_range = found.facts.employeeRange;
      update.official_employee_year = found.facts.employeeYear;
    }
    if (st.fields.revenue && typeof found.facts.revenue === "number") {
      update.official_revenue = found.facts.revenue;
      update.official_revenue_year = found.facts.revenueYear;
    }
    if (st.fields.industry && found.facts.nafCode) {
      update.naf_code = found.facts.nafCode;
      update.activity_label = nafSectionLabel(found.facts.nafCode);
    }
    let { error } = await sb.from("companies").update(update).eq("id", c.id);
    // Colonnes secteur absentes (migration non appliquée) → on retente sans
    // elles plutôt que perdre l'identité entière.
    if (error && /naf_code|activity_label/.test(error.message)) {
      delete update.naf_code;
      delete update.activity_label;
      ({ error } = await sb.from("companies").update(update).eq("id", c.id));
    }
    if (error) {
      // 23505 = SIREN déjà porté par une autre fiche de l'org : ces deux
      // fiches désignent la MÊME entreprise. On consigne le doublon (info
      // utile) et on marque la ligne vérifiée — sinon elle serait retentée
      // indéfiniment à chaque passage, bloquant tout l'avancement.
      const isDuplicate = error.code === "23505";
      const fallback: Record<string, unknown> = { ...checked };
      if (isDuplicate) {
        fallback.duplicate_of_siren = found.siren;
        // Les faits n'ont pas de contrainte : la fiche doublon en profite.
        fallback.enriched_at = new Date().toISOString();
        if (found.facts.employeeRange) {
          fallback.official_employee_range = found.facts.employeeRange;
          fallback.official_employee_year = found.facts.employeeYear;
        }
        if (typeof found.facts.revenue === "number") {
          fallback.official_revenue = found.facts.revenue;
          fallback.official_revenue_year = found.facts.revenueYear;
        }
      }
      const { error: fbError } = await sb.from("companies").update(fallback).eq("id", c.id);
      // Colonne duplicate_of_siren absente (migration récente) → au minimum,
      // on marque vérifiée pour ne jamais boucler sur la même ligne.
      if (fbError) await sb.from("companies").update(checked).eq("id", c.id);
      if (isDuplicate) {
        bump(c.organization_id, "duplicates");
        totals.duplicates++;
      }
      continue;
    }
    await sb.from("companies").update({ legal_name: found.legalName }).eq("id", c.id);
    bump(c.organization_id, "identities");
    totals.identities++;

    const token = await caches.token(c.organization_id);
    if (token && c.hubspot_id) {
      const propFor = await caches.propFor(c.organization_id);
      const properties: Record<string, string> = {};
      // Identifiants → HubSpot (recherche par SIREN/SIRET dans la barre HubSpot),
      // désactivable dans Paramètres → Enrichissement.
      if (st.hubspotSearchIds) {
        properties[propFor("siren", "siren")] = found.siren;
        if (st.fields.vat) properties[propFor("vat_number", "vat_number")] = vatFromSiren(found.siren);
        if (st.fields.siret && found.siret) properties[propFor("siret", "siret")] = found.siret;
      }
      if (st.fields.revenue && typeof found.facts.revenue === "number") properties.annualrevenue = String(Math.round(found.facts.revenue));
      if (st.fields.employees && typeof found.facts.employeeMidpoint === "number") properties.numberofemployees = String(found.facts.employeeMidpoint);
      // JAMAIS écraser : seuls les champs VIDES de la fiche HubSpot sont remplis.
      await pushHubspotIfEmpty(token, c.hubspot_id, properties);
    }
  }

  // ── 2. Effectifs & CA (déterministe par SIREN) ──
  if (budget > 0 && !interrupted) {
    const factsQuery = scoped(
      sb
        .from("companies")
        .select("id, organization_id, siren, siret, vat_number, hubspot_id")
        .not("siren", "is", null)
        .or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`),
    )
      .order("enriched_at", { ascending: true, nullsFirst: true })
      .limit(budget);
    const { data: factsData } = await factsQuery;

    for (const c of (factsData ?? []) as FactsRow[]) {
      if (budget <= 0) break;
      if (!/^\d{9}$/.test(c.siren)) continue;
      const st = await caches.settings(c.organization_id);
      // Effectifs, CA et secteur désactivés → rien à rafraîchir pour cette org.
      if (!st.fields.employees && !st.fields.revenue && !st.fields.industry) {
        await sb.from("companies").update({ enriched_at: new Date().toISOString() }).eq("id", c.id);
        continue;
      }
      budget--;
      const outcome = await lookupCompanyFacts(c.siren);
      await sleep(THROTTLE_MS);
      // Appel échoué → rien écrit (enriched_at intact) ; on abandonne le lot
      // seulement après 3 échecs d'affilée.
      if (outcome.status === "error") {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          interrupted = true;
          break;
        }
        await sleep(1000 * consecutiveErrors);
        continue;
      }
      consecutiveErrors = 0;
      const facts = outcome.status === "found" ? outcome.data : null;
      const update: Record<string, unknown> = { enriched_at: new Date().toISOString() };
      if (st.fields.employees && facts?.employeeRange) {
        update.official_employee_range = facts.employeeRange;
        update.official_employee_year = facts.employeeYear;
      }
      if (st.fields.revenue && typeof facts?.revenue === "number") {
        update.official_revenue = facts.revenue;
        update.official_revenue_year = facts.revenueYear;
      }
      if (st.fields.industry && facts?.nafCode) {
        update.naf_code = facts.nafCode;
        update.activity_label = nafSectionLabel(facts.nafCode);
      }
      let { error } = await sb.from("companies").update(update).eq("id", c.id);
      if (error && /naf_code|activity_label/.test(error.message)) {
        delete update.naf_code;
        delete update.activity_label;
        ({ error } = await sb.from("companies").update(update).eq("id", c.id));
      }
      if (error) {
        // Colonne absente / conflit : on pose au moins enriched_at, sinon la
        // même fiche reviendrait à chaque passage et bloquerait la file.
        await sb.from("companies").update({ enriched_at: new Date().toISOString() }).eq("id", c.id);
        continue;
      }
      const token = await caches.token(c.organization_id);
      if (token && c.hubspot_id) {
        const propFor = await caches.propFor(c.organization_id);
        const properties: Record<string, string> = {};
        // Identifiants aussi au rafraîchissement : les fiches enrichies AVANT
        // l'activation du push HubSpot se remplissent au fil des passages,
        // pas uniquement les identités nouvellement découvertes.
        if (st.hubspotSearchIds) {
          properties[propFor("siren", "siren")] = c.siren;
          if (st.fields.siret && c.siret) properties[propFor("siret", "siret")] = c.siret;
          if (st.fields.vat) properties[propFor("vat_number", "vat_number")] = c.vat_number ?? vatFromSiren(c.siren);
        }
        if (st.fields.revenue && typeof facts?.revenue === "number") properties.annualrevenue = String(Math.round(facts.revenue));
        if (st.fields.employees && typeof facts?.employeeMidpoint === "number") properties.numberofemployees = String(facts.employeeMidpoint);
        // JAMAIS écraser : seuls les champs VIDES de la fiche HubSpot sont remplis.
        if (Object.keys(properties).length > 0) await pushHubspotIfEmpty(token, c.hubspot_id, properties);
      }
      if (!facts || (!facts.employeeRange && facts.revenue == null)) continue;
      bump(c.organization_id, "facts");
      totals.facts++;
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
