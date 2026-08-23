import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { poleToWorkspace } from "@/lib/workspaces";
import { narrateForVoice, firstNameFromUser } from "@/lib/voice/narrate";

export const dynamic = "force-dynamic";

/**
 * RÉCAP D'ÉQUIPE de la tour de contrôle — 100 % DÉTERMINISTE (même moteur
 * d'agrégats que les tables de données ; aucun LLM). Période semaine / mois /
 * trimestre, passée ou en cours, avec la période PRÉCÉDENTE en comparaison et
 * des AXES D'AMÉLIORATION dérivés des écarts.
 *
 * Équipe : un admin choisit n'importe quelle équipe (ou toutes) ; un membre
 * rattaché à un pôle est VERROUILLÉ côté serveur sur son équipe — le paramètre
 * `team` de la requête ne peut pas l'outrepasser.
 */

type Period = "week" | "month" | "quarter";
type Scope = "last" | "current";
type Team = "all" | "sales" | "marketing" | "cs" | "finance";

const TEAM_LABEL: Record<Team, string> = {
  all: "toutes équipes",
  sales: "Ventes",
  marketing: "Marketing",
  cs: "Service client",
  finance: "Comptabilité",
};

const PERIOD_LABEL: Record<Period, { last: string; current: string }> = {
  week: { last: "de la semaine passée", current: "de la semaine en cours" },
  month: { last: "du mois passé", current: "du mois en cours" },
  quarter: { last: "du trimestre passé", current: "du trimestre en cours" },
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtN = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
const dFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Fenêtre [from, to) de la période demandée + la fenêtre précédente. */
function windows(period: Period, scope: Scope, now: Date): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  let from: Date;
  let to: Date;
  if (period === "week") {
    // Semaine lundi → dimanche.
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    from = new Date(monday);
    to = new Date(monday);
    to.setDate(to.getDate() + 7);
    if (scope === "last") {
      from.setDate(from.getDate() - 7);
      to.setDate(to.getDate() - 7);
    }
  } else if (period === "month") {
    from = new Date(d.getFullYear(), d.getMonth(), 1);
    to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    if (scope === "last") {
      from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      to = new Date(d.getFullYear(), d.getMonth(), 1);
    }
  } else {
    const q = Math.floor(d.getMonth() / 3);
    from = new Date(d.getFullYear(), q * 3, 1);
    to = new Date(d.getFullYear(), q * 3 + 3, 1);
    if (scope === "last") {
      from = new Date(d.getFullYear(), q * 3 - 3, 1);
      to = new Date(d.getFullYear(), q * 3, 1);
    }
  }
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: new Date(from) };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

type AggRow = { label?: string; value?: number };

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const plan = await getOrgPlan(supabase, orgId);
  if (featureLocked(plan, "voice_control_tower")) {
    return NextResponse.json({ error: "La tour de contrôle vocale est disponible à partir du plan Business." }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = (["week", "month", "quarter"].includes(url.searchParams.get("period") ?? "") ? url.searchParams.get("period") : "week") as Period;
  const scope = (url.searchParams.get("scope") === "current" ? "current" : "last") as Scope;
  const requested = (url.searchParams.get("team") ?? "all") as Team;

  // ── Verrou d'équipe côté serveur : un non-admin ne voit QUE son pôle. ──
  const { data: profile } = await supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  const ownTeam = poleToWorkspace(profile?.pole as string | null);
  const team: Team = isAdmin
    ? (["all", "sales", "marketing", "cs", "finance"].includes(requested) ? requested : "all")
    : (ownTeam ?? "all");

  const now = new Date();
  const { from, to, prevFrom, prevTo } = windows(period, scope, now);
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  /** Agrégat déterministe sur une fenêtre — null si le moteur échoue. */
  const agg = async (
    spec: { entity: string; groupBy: string; measure: string; field?: string | null; target?: string },
    win: { f: Date; t: Date } | null,
  ): Promise<{ total: number; byLabel: Map<string, number> } | null> => {
    try {
      const result = await computeAggregate(supabase, orgId, [], hubspotToken, {
        entity: spec.entity,
        groupBy: spec.groupBy,
        measure: spec.measure,
        field: spec.field ?? null,
        pipeline: null,
        granularity: null,
        date_from: win ? iso(win.f) : null,
        date_to: win ? iso(new Date(win.t.getTime() - 1)) : null,
      });
      if (result.error) return null;
      const rows = ((result.rows as AggRow[] | undefined) ?? []);
      const byLabel = new Map<string, number>();
      let total = 0;
      for (const r of rows) {
        const v = Number(r.value) || 0;
        byLabel.set(String(r.label ?? ""), v);
        total += v;
      }
      if (spec.target) {
        const v = byLabel.get(spec.target) ?? 0;
        return { total: v, byLabel };
      }
      return { total, byLabel };
    } catch {
      return null;
    }
  };

  const W = { f: from, t: to };
  const P = { f: prevFrom, t: prevTo };
  const lines: string[] = [];
  const axes: string[] = [];

  /** Ligne « valeur (vs période précédente) » + axe si baisse marquée. */
  const push = (label: string, cur: number | null, prev: number | null, unit: "eur" | "n", axisIfDown?: string) => {
    if (cur == null) return;
    const fmt = unit === "eur" ? fmtEur : fmtN;
    let delta = "";
    if (prev != null && prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      delta = ` (${pct >= 0 ? "+" : ""}${pct} % vs période précédente)`;
      if (pct <= -15 && axisIfDown) axes.push(`${axisIfDown} — ${label.toLowerCase()} en baisse de ${Math.abs(pct)} %.`);
    }
    lines.push(`${label} : ${fmt(cur)}${delta}`);
  };

  // ── Ventes ──
  if (team === "sales" || team === "all") {
    const [won, wonPrev, created, createdPrev, open] = await Promise.all([
      agg({ entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", target: "Gagnés" }, W),
      agg({ entity: "deals", groupBy: "outcome", measure: "sum", field: "amount", target: "Gagnés" }, P),
      agg({ entity: "deals", groupBy: "status", measure: "count" }, W),
      agg({ entity: "deals", groupBy: "status", measure: "count" }, P),
      agg({ entity: "deals", groupBy: "status", measure: "sum", field: "amount", target: "En cours" }, null),
    ]);
    push("CA signé", won?.total ?? null, wonPrev?.total ?? null, "eur", "Relancer le closing");
    push("Deals sur la période", created?.total ?? null, createdPrev?.total ?? null, "n", "Regarnir le pipeline");
    if (open != null) lines.push(`Pipeline en cours : ${fmtEur(open.total)}`);
  }

  // ── Marketing ──
  if (team === "marketing" || team === "all") {
    const [mql, mqlPrev] = await Promise.all([
      agg({ entity: "contacts", groupBy: "mql", measure: "count", target: "MQL" }, W),
      agg({ entity: "contacts", groupBy: "mql", measure: "count", target: "MQL" }, P),
    ]);
    push("Contacts MQL", mql?.total ?? null, mqlPrev?.total ?? null, "n", "Réactiver l'acquisition");
  }

  // ── Comptabilité / Trésorerie ──
  if (team === "finance" || team === "all") {
    const [billed, billedPrev, paid, paidPrev, due] = await Promise.all([
      agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" }, W),
      agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_total" }, P),
      agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" }, W),
      agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_paid" }, P),
      agg({ entity: "invoices", groupBy: "status", measure: "sum", field: "amount_due" }, null),
    ]);
    push("CA facturé", billed?.total ?? null, billedPrev?.total ?? null, "eur", "Relancer l'émission de factures");
    push("CA encaissé", paid?.total ?? null, paidPrev?.total ?? null, "eur", "Accélérer les encaissements");
    if (due != null && due.total > 0) {
      lines.push(`Reste dû (stock) : ${fmtEur(due.total)}`);
      axes.push(`Lancer une passe de relances — ${fmtEur(due.total)} de créances en attente.`);
    }
  }

  // ── Service client ──
  if (team === "cs" || team === "all") {
    const [tickets, ticketsPrev, stock] = await Promise.all([
      agg({ entity: "tickets", groupBy: "status", measure: "count" }, W),
      agg({ entity: "tickets", groupBy: "status", measure: "count" }, P),
      agg({ entity: "tickets", groupBy: "status", measure: "count" }, null),
    ]);
    push("Tickets sur la période", tickets?.total ?? null, ticketsPrev?.total ?? null, "n");
    if (stock != null) {
      let openCount = 0;
      for (const [label, v] of stock.byLabel) {
        if (/open|ouvert|pending|attente|progress|cours/i.test(label)) openCount += v;
      }
      if (openCount > 0) {
        lines.push(`Tickets encore ouverts : ${fmtN(openCount)}`);
        if (openCount >= 10) axes.push(`Résorber la file support — ${fmtN(openCount)} tickets ouverts.`);
      }
    }
  }

  if (lines.length === 0) {
    lines.push("Aucune donnée synchronisée sur la période — connecte ou synchronise tes outils pour un récap chiffré.");
  }

  const title = `Récap ${TEAM_LABEL[team]} ${PERIOD_LABEL[period][scope]} (du ${dFr(from)} au ${dFr(new Date(to.getTime() - 86_400_000))})`;
  let text =
    `${title}. ${lines.join(". ")}.` +
    (axes.length > 0 ? ` Axes d'amélioration : ${axes.join(" ")}` : " Aucun axe d'amélioration détecté — continue comme ça.");

  // ── Mise en récit parlée (narrate=1, lecture par l'orbe) : les chiffres
  // restent 100 % ceux du moteur déterministe, l'agent les raconte posément.
  // Repli : texte déterministe si clé absente ou appel en échec.
  if (url.searchParams.get("narrate") === "1") {
    const narrated = await narrateForVoice({ kind: "recap", firstName: firstNameFromUser(user), facts: text });
    if (narrated) text = narrated;
  }

  return NextResponse.json({ title, team, period, scope, lines, axes, text });
}
