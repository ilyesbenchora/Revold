/**
 * Séries et KPIs deals depuis le miroir canonique Supabase (table `deals`).
 *
 * Alimente les tuiles + graphes de la page Performances Commerciale :
 *   - CA signé par mois (12 derniers mois, close_date des deals gagnés)
 *   - closing rate, pipeline pondéré, cycle de vente moyen
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DealsSeries = {
  hasData: boolean;
  caSigneTotal: number;
  closingRate: number | null;   // %
  pipelinePondere: number;
  cycleMoyenJours: number | null;
  /** CA gagné par mois (12 derniers mois, ordre chronologique). */
  wonMonthly: Array<{ label: string; value: number }>;
  /** Cumul du CA gagné mois par mois (même fenêtre). */
  wonCumul: Array<{ label: string; value: number }>;
};

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (key: string) => {
  const [yy, mm] = key.split("-");
  return `${MONTHS_FR[Number(mm) - 1]} ${yy.slice(2)}`;
};

/** Pagine au-delà du plafond serveur (~1000 lignes/requête) — 8000 max. */
async function pageAll<T>(
  supabase: SupabaseClient,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 8; page++) {
    const { data, error } = await apply(
      supabase.from("deals").select(columns).range(page * 1000, page * 1000 + 999),
    );
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function computeDealsSeries(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DealsSeries> {
  const [wonRows, openRows, { count: lostCount }] = await Promise.all([
    // created_date = VRAIE createdate HubSpot ; created_at (insert Supabase)
    // n'est qu'un repli pour les lignes historiques — même règle que le
    // resolver d'alertes (sales_cycle_days).
    pageAll<{ amount: number | null; close_date: string | null; created_date: string | null; created_at: string | null }>(
      supabase,
      "amount, close_date, created_date, created_at",
      (q) => q.eq("organization_id", orgId).eq("is_closed_won", true),
    ),
    pageAll<{ amount: number | null; win_probability: number | null }>(
      supabase,
      "amount, win_probability",
      (q) => q.eq("organization_id", orgId).eq("is_closed_won", false).eq("is_closed_lost", false).gt("amount", 0),
    ),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_closed_lost", true),
  ]);

  const lost = lostCount ?? 0;

  const caSigneTotal = Math.round(wonRows.reduce((s, d) => s + (Number(d.amount) || 0), 0));
  const closingRate = wonRows.length + lost > 0
    ? Math.round((wonRows.length / (wonRows.length + lost)) * 100)
    : null;
  const pipelinePondere = Math.round(
    openRows.reduce((s, d) => s + (Number(d.amount) || 0) * (Number(d.win_probability) || 0.5), 0),
  );

  // Cycle moyen (jours création → closing) sur les deals gagnés datés.
  const cycles = wonRows
    .filter((d) => (d.created_date || d.created_at) && d.close_date)
    .map((d) => (new Date(d.close_date as string).getTime() - new Date((d.created_date ?? d.created_at) as string).getTime()) / 86_400_000)
    .filter((n) => n >= 0 && Number.isFinite(n));
  const cycleMoyenJours = cycles.length > 0 ? Math.round(cycles.reduce((s, n) => s + n, 0) / cycles.length) : null;

  // CA gagné par mois (12 derniers mois).
  const byMonth = new Map<string, number>();
  for (const d of wonRows) {
    if (!d.close_date) continue;
    const dt = new Date(d.close_date as string);
    if (Number.isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(d.amount) || 0));
  }
  const months = [...byMonth.keys()].sort().slice(-12);
  const wonMonthly = months.map((key) => ({ label: monthLabel(key), value: Math.round(byMonth.get(key)!) }));
  let running = 0;
  const wonCumul = months.map((key) => {
    running += byMonth.get(key)!;
    return { label: monthLabel(key), value: Math.round(running) };
  });

  return {
    hasData: wonRows.length > 0 || openRows.length > 0,
    caSigneTotal,
    closingRate,
    pipelinePondere,
    cycleMoyenJours,
    wonMonthly,
    wonCumul,
  };
}
