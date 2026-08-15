import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/cron/monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCompanyInSirene, fetchCompanyFacts, vatFromSiren } from "@/lib/enrichment/company-enrichment";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

export const maxDuration = 300;

/**
 * Enrichissement AUTOMATIQUE de toute la base (cron horaire) — réponse au
 * problème d'échelle : le bloc manuel traitait 25 entreprises par clic, ce
 * cron avance dans TOUTE la base heure après heure (≈ 250 lookups/run,
 * ≈ 6 000/jour), sans rescanner les lots déjà vus (sirene_checked_at).
 *
 *  1. IDENTITÉS — entreprises SANS SIREN (nom requis) :
 *     · correspondance SÛRE (nom normalisé identique) → appliquée seule :
 *       SIREN/SIRET/TVA/raison sociale + effectifs/CA (même réponse API),
 *       et poussée dans HubSpot (propriétés mappées) ;
 *     · correspondance PLAUSIBLE → rangée en candidat (candidate_*), à
 *       valider dans Suivi → Enrichissement (aucune écriture hasardeuse) ;
 *     · aucun résultat → marquée vérifiée (re-scan dans 30 j).
 *  2. EFFECTIFS & CA — entreprises AVEC SIREN jamais enrichies ou > 90 j :
 *     lookup déterministe par SIREN → colonnes official_* + HubSpot
 *     (annualrevenue / numberofemployees).
 */

const LOOKUP_BUDGET = 250; // ~250 appels API par run, throttlés
const THROTTLE_MS = 220; // ~4,5 req/s — l'API publique tolère 7/s
const RECHECK_DAYS = 30; // re-scan des « sans correspondance »
const REFRESH_DAYS = 90; // rafraîchissement des effectifs/CA

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type IdentityRow = { id: string; organization_id: string; name: string | null; hubspot_id: string | null };
type FactsRow = { id: string; organization_id: string; siren: string; hubspot_id: string | null };

/** Caches par org (tokens HubSpot + mapping des propriétés d'identifiants). */
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

async function handler(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const caches = orgCaches(sb);
  const now = new Date();
  const recheckBefore = new Date(now.getTime() - RECHECK_DAYS * 86_400_000).toISOString();
  const refreshBefore = new Date(now.getTime() - REFRESH_DAYS * 86_400_000).toISOString();

  let budget = LOOKUP_BUDGET;
  // Par org : compteurs pour la notification de fin de run.
  const perOrg = new Map<string, { identities: number; candidates: number; facts: number }>();
  const bump = (orgId: string, k: "identities" | "candidates" | "facts") => {
    const e = perOrg.get(orgId) ?? { identities: 0, candidates: 0, facts: 0 };
    e[k]++;
    perOrg.set(orgId, e);
  };

  // ── 1. Identités manquantes (jamais scannées d'abord, puis re-scan 30 j) ──
  const { data: identityData, error: identityError } = await sb
    .from("companies")
    .select("id, organization_id, name, hubspot_id")
    .is("siren", null)
    .not("name", "is", null)
    .is("candidate_siren", null)
    .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`)
    .order("sirene_checked_at", { ascending: true, nullsFirst: true })
    .limit(Math.floor(LOOKUP_BUDGET * 0.6));
  // Migration non appliquée → no-op silencieux.
  if (identityError) return NextResponse.json({ ok: true, skipped: "migration enrichment_scale absente" });

  for (const c of (identityData ?? []) as IdentityRow[]) {
    if (budget <= 0) break;
    if (!c.name || c.name.trim().length < 2) continue;
    budget--;
    const found = await searchCompanyInSirene(c.name);
    await sleep(THROTTLE_MS);
    const checked = { sirene_checked_at: new Date().toISOString() };

    if (!found) {
      await sb.from("companies").update(checked).eq("id", c.id);
      continue;
    }
    if (found.confidence !== "high") {
      // Plausible mais pas sûr → file de validation humaine, rien d'écrit d'autre.
      await sb
        .from("companies")
        .update({ ...checked, candidate_siren: found.siren, candidate_siret: found.siret, candidate_legal_name: found.legalName })
        .eq("id", c.id);
      bump(c.organization_id, "candidates");
      continue;
    }

    // Correspondance SÛRE → application complète (identité + faits, même réponse API).
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
    // legal_name à part (colonne d'une migration distincte — jamais bloquant).
    await sb.from("companies").update({ legal_name: found.legalName }).eq("id", c.id);
    bump(c.organization_id, "identities");

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

  // ── 2. Effectifs & CA des entreprises AVEC SIREN (déterministe) ──
  const { data: factsData } = await sb
    .from("companies")
    .select("id, organization_id, siren, hubspot_id")
    .not("siren", "is", null)
    .or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)
    .order("enriched_at", { ascending: true, nullsFirst: true })
    .limit(budget);

  for (const c of (factsData ?? []) as FactsRow[]) {
    if (budget <= 0) break;
    if (!/^\d{9}$/.test(c.siren)) continue;
    budget--;
    const facts = await fetchCompanyFacts(c.siren);
    await sleep(THROTTLE_MS);
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

    const token = await caches.token(c.organization_id);
    if (token && c.hubspot_id) {
      const properties: Record<string, string> = {};
      if (typeof facts.revenue === "number") properties.annualrevenue = String(Math.round(facts.revenue));
      if (typeof facts.employeeMidpoint === "number") properties.numberofemployees = String(facts.employeeMidpoint);
      if (Object.keys(properties).length > 0) await pushHubspot(token, c.hubspot_id, properties);
    }
  }

  // ── Notification par org (uniquement s'il s'est passé quelque chose) ──
  for (const [orgId, n] of perOrg) {
    if (n.identities + n.candidates + n.facts === 0) continue;
    const parts: string[] = [];
    if (n.identities) parts.push(`${n.identities} identité${n.identities > 1 ? "s" : ""} complétée${n.identities > 1 ? "s" : ""}`);
    if (n.facts) parts.push(`${n.facts} effectifs/CA mis à jour`);
    if (n.candidates) parts.push(`${n.candidates} à valider`);
    await createInAppNotification({
      orgId,
      type: "enrichment_auto",
      title: "Enrichissement automatique",
      body: `${parts.join(" · ")} — les correspondances incertaines t'attendent dans Suivi → Enrichissement.`,
      link: "/dashboard/enrichissement",
    });
  }

  const totals = [...perOrg.values()].reduce(
    (s, n) => ({ identities: s.identities + n.identities, candidates: s.candidates + n.candidates, facts: s.facts + n.facts }),
    { identities: 0, candidates: 0, facts: 0 },
  );
  return NextResponse.json({ ok: true, lookupsUsed: LOOKUP_BUDGET - budget, ...totals });
}

// Monitoring : chaque execution journalisee dans cron_runs (statut, duree, erreur).
export const GET = monitoredCron("enrich-companies", handler);
