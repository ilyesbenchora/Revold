import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "@/lib/integrations/oauth-token";
import { normalizeCompanyName } from "@/lib/enrichment/company-enrichment";

/**
 * Source LinkedIn (bêta) pour l'EFFECTIF — branchement de l'API officielle
 * (Organization Lookup, api.linkedin.com/rest/organizations).
 *
 * Périmètre strict : uniquement les entreprises SANS effectif officiel
 * (le registre URSSAF/INSEE reste la source prioritaire — la donnée LinkedIn
 * est stockée dans ses propres colonnes linkedin_*, jamais à la place).
 *
 * Jeton : `LINKEDIN_ENRICH_ACCESS_TOKEN` (env, prioritaire) sinon le token
 * OAuth LinkedIn déjà connecté par l'org (provider linkedin_ads) — le
 * périmètre organisations exige le produit Community Management sur l'app
 * LinkedIn ; un 403 est remonté comme « accès non accordé », jamais en boucle.
 */

const API = "https://api.linkedin.com/rest";
const VERSION = "202405";
const THROTTLE_MS = 400; // l'API LinkedIn est bien plus stricte que Sirene
const RECHECK_DAYS = 30;
const MAX_CONSECUTIVE_ERRORS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tranches staffCountRange LinkedIn → libellé FR + point médian (usage KPI). */
const STAFF_RANGES: Record<string, { label: string; mid: number }> = {
  SIZE_1: { label: "1 employé (LinkedIn)", mid: 1 },
  SIZE_2_TO_10: { label: "2 à 10 employés (LinkedIn)", mid: 6 },
  SIZE_11_TO_50: { label: "11 à 50 employés (LinkedIn)", mid: 30 },
  SIZE_51_TO_200: { label: "51 à 200 employés (LinkedIn)", mid: 125 },
  SIZE_201_TO_500: { label: "201 à 500 employés (LinkedIn)", mid: 350 },
  SIZE_501_TO_1000: { label: "501 à 1 000 employés (LinkedIn)", mid: 750 },
  SIZE_1001_TO_5000: { label: "1 001 à 5 000 employés (LinkedIn)", mid: 3000 },
  SIZE_5001_TO_10000: { label: "5 001 à 10 000 employés (LinkedIn)", mid: 7500 },
  SIZE_10001_OR_MORE: { label: "Plus de 10 000 employés (LinkedIn)", mid: 10001 },
};

/** Jeton utilisable pour l'org : env dédiée sinon connexion OAuth LinkedIn. */
export async function getLinkedInEnrichToken(sb: SupabaseClient, orgId: string): Promise<string | null> {
  const envToken = process.env.LINKEDIN_ENRICH_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    return await getValidAccessToken(sb, orgId, "linkedin_ads");
  } catch {
    return null;
  }
}

type OrgElement = {
  vanityName?: string;
  localizedName?: string;
  staffCountRange?: string;
};

type LinkedInLookup =
  | { status: "found"; range: string; count: number; vanity: string }
  | { status: "none" }
  | { status: "forbidden" } // token sans le périmètre organisations
  | { status: "error" };

/** Candidats de vanity name : label du domaine puis slug du nom. */
function vanityCandidates(name: string | null, domain: string | null): string[] {
  const out: string[] = [];
  const domainLabel = (domain ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(".")[0]
    .replace(/[^a-z0-9-]/g, "");
  if (domainLabel.length >= 2) out.push(domainLabel);
  const slug = normalizeCompanyName(name ?? "").replace(/\s+/g, "-");
  if (slug.length >= 2 && !out.includes(slug)) out.push(slug);
  return out;
}

/** La page trouvée désigne-t-elle bien NOTRE entreprise ? (anti faux positif). */
function nameMatches(companyName: string | null, linkedInName: string | undefined): boolean {
  if (!companyName || !linkedInName) return false;
  const a = normalizeCompanyName(companyName);
  const b = normalizeCompanyName(linkedInName);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Cherche la page entreprise LinkedIn et lit sa tranche d'effectif. */
export async function lookupLinkedInEmployees(
  token: string,
  company: { name: string | null; domain: string | null },
): Promise<LinkedInLookup> {
  const candidates = vanityCandidates(company.name, company.domain);
  if (candidates.length === 0) return { status: "none" };

  let sawError = false;
  for (const vanity of candidates) {
    try {
      const res = await fetch(`${API}/organizations?q=vanityName&vanityName=${encodeURIComponent(vanity)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      if (res.status === 401 || res.status === 403) return { status: "forbidden" };
      if (res.status === 429) return { status: "error" };
      if (!res.ok) {
        sawError = true;
        continue;
      }
      const json = (await res.json()) as { elements?: OrgElement[] };
      const org = (json.elements ?? []).find(
        (e) => e.staffCountRange && (nameMatches(company.name, e.localizedName) || e.vanityName === vanity),
      );
      if (org?.staffCountRange && STAFF_RANGES[org.staffCountRange]) {
        const r = STAFF_RANGES[org.staffCountRange];
        return { status: "found", range: r.label, count: r.mid, vanity: org.vanityName ?? vanity };
      }
    } catch {
      sawError = true;
    }
  }
  return sawError ? { status: "error" } : { status: "none" };
}

export type LinkedInBatchResult = {
  /** Effectifs complétés pendant ce lot. */
  filled: number;
  /** Pages scannées sans résultat exploitable. */
  scanned: number;
  lookupsUsed: number;
  /** Entreprises encore à scanner (boucle de progression côté UI). */
  remaining: number;
  /** Aucun jeton LinkedIn : connexion à faire dans Paramètres → Intégrations. */
  noToken?: boolean;
  /** Jeton présent mais sans le périmètre organisations (produit LinkedIn à activer). */
  forbidden?: boolean;
  /** LinkedIn injoignable / quota : reprendre plus tard. */
  interrupted?: boolean;
};

type Row = { id: string; name: string | null; domain: string | null };

/** File d'attente LinkedIn : sans effectif officiel, jamais scannée (ou > 30 j). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pendingQuery(sb: SupabaseClient, orgId: string): any {
  const recheckBefore = new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString();
  return sb
    .from("companies")
    .select("id, name, domain")
    .eq("organization_id", orgId)
    .is("official_employee_range", null)
    .is("linkedin_employee_count", null)
    .not("name", "is", null)
    .or(`linkedin_checked_at.is.null,linkedin_checked_at.lt.${recheckBefore}`);
}

/** Reste à scanner pour l'org (dénominateur de la barre de progression). */
export async function countLinkedInRemaining(sb: SupabaseClient, orgId: string): Promise<number> {
  try {
    const recheckBefore = new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString();
    const { count } = await sb
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("official_employee_range", null)
      .is("linkedin_employee_count", null)
      .not("name", "is", null)
      .or(`linkedin_checked_at.is.null,linkedin_checked_at.lt.${recheckBefore}`);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Traite un lot LinkedIn pour UNE org — partagé par la route POST (boucle UI)
 * et le cron enrich-companies. Mêmes garanties que le moteur Sirene : un appel
 * qui échoue n'écrit rien (la fiche reste en file), seul un scan abouti pose
 * linkedin_checked_at.
 */
export async function runLinkedInBatch(
  sb: SupabaseClient,
  opts: { orgId: string; budget: number },
): Promise<LinkedInBatchResult> {
  const done = async (partial: Partial<LinkedInBatchResult>): Promise<LinkedInBatchResult> => ({
    filled: 0,
    scanned: 0,
    lookupsUsed: 0,
    remaining: await countLinkedInRemaining(sb, opts.orgId),
    ...partial,
  });

  const token = await getLinkedInEnrichToken(sb, opts.orgId);
  if (!token) return done({ noToken: true });

  const { data, error } = await pendingQuery(sb, opts.orgId)
    .order("linkedin_checked_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, opts.budget));
  if (error) return done({}); // colonnes linkedin_* absentes (migration au prochain build)

  let filled = 0;
  let scanned = 0;
  let lookupsUsed = 0;
  let consecutiveErrors = 0;
  for (const c of (data ?? []) as Row[]) {
    lookupsUsed++;
    const outcome = await lookupLinkedInEmployees(token, { name: c.name, domain: c.domain });
    await sleep(THROTTLE_MS);

    if (outcome.status === "forbidden") return done({ filled, scanned, lookupsUsed, forbidden: true });
    if (outcome.status === "error") {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) return done({ filled, scanned, lookupsUsed, interrupted: true });
      await sleep(1500 * consecutiveErrors);
      continue;
    }
    consecutiveErrors = 0;

    const update: Record<string, unknown> = { linkedin_checked_at: new Date().toISOString() };
    if (outcome.status === "found") {
      update.linkedin_employee_range = outcome.range;
      update.linkedin_employee_count = outcome.count;
    }
    const { error: writeErr } = await sb.from("companies").update(update).eq("id", c.id);
    if (writeErr) continue;
    if (outcome.status === "found") filled++;
    else scanned++;
  }
  return done({ filled, scanned, lookupsUsed });
}
