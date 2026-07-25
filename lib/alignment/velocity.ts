import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vélocité du lifecycle & relais marketing → ventes — moteur de la page
 * Alignement.
 *
 * Source de vérité : les colonnes datées de `contacts` (lead_date, mql_date,
 * sql_date, opportunity_date, customer_date — migration 20260725000001,
 * peuplées par l'ETL via hs_v2_date_entered_*) et `deals.created_date` (vraie
 * createdate HubSpot).
 *
 * Fiabilité : chaque métrique expose son ÉCHANTILLON (nombre de contacts
 * réellement mesurés). Un échantillon vide → hasData=false, jamais un faux 0.
 * Médiane partout (robuste aux contacts qui traînent des années).
 */

type ContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
  hs_created_at: string | null;
  lead_date: string | null;
  mql_date: string | null;
  sql_date: string | null;
  opportunity_date: string | null;
  customer_date: string | null;
};

const DAY = 86_400_000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function fetchContacts(sb: SupabaseClient, orgId: string): Promise<ContactRow[]> {
  const out: ContactRow[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, company_id, hs_created_at, lead_date, mql_date, sql_date, opportunity_date, customer_date")
      .eq("organization_id", orgId)
      .range(page * 1000, page * 1000 + 999);
    if (error) return out; // migration absente → tout restera « donnée insuffisante »
    const rows = (data ?? []) as ContactRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ── Funnel de vélocité : temps médian passé à chaque étape ─────────────────

export type StageStep = {
  id: string;
  label: string;
  /** Contacts ayant atteint cette étape (date d'entrée connue). */
  reached: number;
  /** Jours médians entre cette étape et la suivante (null : échantillon vide). */
  medianDaysToNext: number | null;
  /** Contacts mesurés pour ce délai (entrés ET sortis). */
  sample: number;
  /** Taux de passage vers l'étape suivante (reached suivant / reached). */
  conversionPct: number | null;
};

const STAGES: Array<{ id: string; label: string; date: keyof ContactRow }> = [
  { id: "created", label: "Création du contact", date: "hs_created_at" },
  { id: "lead", label: "Lead", date: "lead_date" },
  { id: "mql", label: "MQL", date: "mql_date" },
  { id: "sql", label: "SQL", date: "sql_date" },
  { id: "opportunity", label: "Opportunité", date: "opportunity_date" },
  { id: "customer", label: "Client", date: "customer_date" },
];

export type LifecycleVelocity = {
  steps: StageStep[];
  /** Contacts avec AU MOINS une date de stage — le socle de tout le funnel. */
  datedContacts: number;
  totalContacts: number;
};

export function computeLifecycleVelocity(contacts: ContactRow[]): LifecycleVelocity {
  const dated = contacts.filter((c) => c.lead_date || c.mql_date || c.sql_date || c.opportunity_date || c.customer_date);

  const steps: StageStep[] = STAGES.map((stage, si) => {
    const entered = contacts.filter((c) => c[stage.date]);
    const next = STAGES[si + 1];
    let medianDaysToNext: number | null = null;
    let sample = 0;
    let conversionPct: number | null = null;
    if (next) {
      const durations = entered
        .filter((c) => c[next.date])
        .map((c) => (new Date(c[next.date] as string).getTime() - new Date(c[stage.date] as string).getTime()) / DAY)
        .filter((d) => d >= 0);
      sample = durations.length;
      medianDaysToNext = durations.length > 0 ? Math.round(median(durations) * 10) / 10 : null;
      const reachedNext = contacts.filter((c) => c[next.date]).length;
      conversionPct = entered.length > 0 ? Math.round((reachedNext / entered.length) * 100) : null;
    }
    return { id: stage.id, label: stage.label, reached: entered.length, medianDaysToNext, sample, conversionPct };
  });

  return { steps, datedContacts: dated.length, totalContacts: contacts.length };
}

// ── Relais marketing → ventes : MQL → deal ─────────────────────────────────

export type AbandonedMql = {
  id: string;
  name: string;
  email: string | null;
  mqlDate: string;
  daysSince: number;
};

export type MqlHandoff = {
  /** Contacts entrés en MQL (avec date). */
  mqlCount: number;
  /** MQL rattachés à une entreprise (jointure possible avec les deals). */
  linkableCount: number;
  /** MQL dont l'entreprise a un deal créé APRÈS l'entrée en MQL. */
  withDealCount: number;
  /** Jours médians MQL → création du premier deal. */
  medianDaysToDeal: number | null;
  /** MQL « abandonnés » : ≥ abandonAfterDays sans deal (liste actionnable). */
  abandoned: AbandonedMql[];
  abandonedCount: number;
  abandonAfterDays: number;
};

export async function computeMqlHandoff(
  sb: SupabaseClient,
  orgId: string,
  contacts: ContactRow[],
  abandonAfterDays = 14,
): Promise<MqlHandoff> {
  const mqls = contacts.filter((c) => c.mql_date);
  const linkable = mqls.filter((c) => c.company_id);

  // Deals datés par entreprise (vraie createdate HubSpot).
  const dealsByCompany = new Map<string, number[]>();
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("deals")
      .select("company_id, created_date")
      .eq("organization_id", orgId)
      .not("created_date", "is", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ company_id: string | null; created_date: string | null }>;
    for (const d of rows) {
      if (!d.company_id || !d.created_date) continue;
      if (!dealsByCompany.has(d.company_id)) dealsByCompany.set(d.company_id, []);
      dealsByCompany.get(d.company_id)!.push(new Date(d.created_date).getTime());
    }
    if (rows.length < 1000) break;
  }

  const delays: number[] = [];
  const abandoned: AbandonedMql[] = [];
  const now = Date.now();
  for (const c of linkable) {
    const mqlAt = new Date(c.mql_date as string).getTime();
    const after = (dealsByCompany.get(c.company_id as string) ?? []).filter((t) => t >= mqlAt);
    if (after.length > 0) {
      delays.push((Math.min(...after) - mqlAt) / DAY);
    } else {
      const daysSince = Math.floor((now - mqlAt) / DAY);
      // Toujours MQL/SQL (pas encore opportunité ni client) et sans deal depuis
      // trop longtemps → relais marketing → ventes rompu.
      if (daysSince >= abandonAfterDays && !c.opportunity_date && !c.customer_date) {
        abandoned.push({
          id: c.id,
          name: c.full_name || c.email || "Contact sans nom",
          email: c.email,
          mqlDate: c.mql_date as string,
          daysSince,
        });
      }
    }
  }
  abandoned.sort((a, b) => b.daysSince - a.daysSince);

  return {
    mqlCount: mqls.length,
    linkableCount: linkable.length,
    withDealCount: delays.length,
    medianDaysToDeal: delays.length > 0 ? Math.round(median(delays) * 10) / 10 : null,
    abandoned: abandoned.slice(0, 10),
    abandonedCount: abandoned.length,
    abandonAfterDays,
  };
}

// ── Cycle de vente réel (vraie createdate → closing des deals gagnés) ──────

export type SalesCycle = { medianDays: number | null; sample: number };

export async function computeRealSalesCycle(sb: SupabaseClient, orgId: string): Promise<SalesCycle> {
  const durations: number[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await sb
      .from("deals")
      .select("created_date, close_date")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .not("created_date", "is", null)
      .not("close_date", "is", null)
      .range(page * 1000, page * 1000 + 999);
    if (error) break;
    const rows = (data ?? []) as Array<{ created_date: string; close_date: string }>;
    for (const d of rows) {
      const days = (new Date(d.close_date).getTime() - new Date(d.created_date).getTime()) / DAY;
      if (days >= 0) durations.push(days);
    }
    if (rows.length < 1000) break;
  }
  return {
    medianDays: durations.length > 0 ? Math.round(median(durations) * 10) / 10 : null,
    sample: durations.length,
  };
}

export { fetchContacts as fetchAlignmentContacts };
