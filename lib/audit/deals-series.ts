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

export async function computeDealsSeries(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DealsSeries> {
  const [{ data: won }, { data: open }, { count: lostCount }] = await Promise.all([
    supabase
      .from("deals")
      .select("amount, close_date, created_at")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .limit(5000),
    supabase
      .from("deals")
      .select("amount, win_probability")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .gt("amount", 0)
      .limit(5000),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_closed_lost", true),
  ]);

  const wonRows = won ?? [];
  const openRows = open ?? [];
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
    .filter((d) => d.created_at && d.close_date)
    .map((d) => (new Date(d.close_date as string).getTime() - new Date(d.created_at as string).getTime()) / 86_400_000)
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
