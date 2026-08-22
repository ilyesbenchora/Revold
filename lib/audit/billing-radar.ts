/**
 * Radar de facturation — détecte les factures ATTENDUES mais non émises,
 * pour attaquer le vrai problème de trésorerie : « l'échéance est passée et
 * personne n'a facturé ».
 *
 * Deux ancres, par ordre de priorité :
 *  1. « contract » : la date de fin de contrat mappée depuis le CRM
 *     (companies.contract_end, sinon celle du dernier deal GAGNÉ) — opt-in,
 *     utilisée uniquement là où elle est renseignée ;
 *  2. « rhythm » : le rythme de facturation RÉEL observé dans l'outil de
 *     facturation (écart médian entre les factures successives du client).
 *     Zéro donnée déclarative : l'historique du client fait foi.
 *
 * Un client sans rythme établi (0-2 factures, intervalles anarchiques) et sans
 * date de contrat n'est JAMAIS mis en retard — pas de faux positifs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hubFetch } from "@/lib/integrations/hub-fetch";

export type RadarBasis = "contract" | "rhythm";

export type RadarItem = {
  companyId: string;
  companyName: string;
  status: "overdue" | "upcoming";
  /** Date de facture attendue (ISO date). */
  expectedDate: string;
  daysLate?: number;
  daysUntil?: number;
  /** Montant habituel (médiane des dernières factures) — l'enjeu de tréso. */
  usualAmount: number | null;
  basis: RadarBasis;
  /** Base de calcul lisible (« fin de contrat CRM » / « facturé tous les ~92 j, 5 factures »). */
  basisLabel: string;
};

export type BillingRadar = {
  hasData: boolean;
  overdue: RadarItem[];
  upcoming: RadarItem[];
  /** € en attente = somme des montants habituels des retards. */
  overdueAmount: number;
  /** Clients facturés analysés. */
  analyzed: number;
  /** Clients au rythme de facturation établi. */
  regularCount: number;
  /** Couverture de la date de fin de contrat mappée (opt-in, jamais exigée). */
  contractCoverage: { filled: number; total: number };
};

const EMPTY: BillingRadar = {
  hasData: false,
  overdue: [],
  upcoming: [],
  overdueAmount: 0,
  analyzed: 0,
  regularCount: 0,
  contractCoverage: { filled: 0, total: 0 },
};

const DAY = 86_400_000;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function computeBillingRadar(
  supabase: SupabaseClient,
  orgId: string,
  maxPerList = 10,
  /** Limite aux factures de ces outils (ex : ["pennylane"]) — pages CRM ↔ outil. */
  providers: string[] | null = null,
): Promise<BillingRadar> {
  try {
    // ── 1. Factures CLIENTS (les fournisseurs — direction "out" — sont exclus) ──
    let invQuery = supabase
      .from("invoices")
      .select("company_id, issued_at, amount_total, direction")
      .eq("organization_id", orgId)
      .not("issued_at", "is", null)
      .not("company_id", "is", null)
      .order("issued_at", { ascending: true })
      .limit(5000);
    if (providers && providers.length > 0) invQuery = invQuery.in("primary_source", providers);
    const { data: invRows } = await invQuery;
    const invoices = ((invRows ?? []) as Array<{ company_id: string; issued_at: string; amount_total: number | null; direction: string | null }>)
      .filter((i) => i.direction !== "out");
    if (invoices.length === 0) return EMPTY;

    const byCompany = new Map<string, Array<{ at: number; amount: number | null }>>();
    for (const inv of invoices) {
      const t = Date.parse(inv.issued_at);
      if (Number.isNaN(t)) continue;
      (byCompany.get(inv.company_id) ?? byCompany.set(inv.company_id, []).get(inv.company_id)!)
        .push({ at: t, amount: inv.amount_total != null ? Number(inv.amount_total) : null });
    }
    const ids = [...byCompany.keys()];

    // ── 2. Fiches entreprises + date de fin de contrat mappée (résilient :
    //    migration contract_dates facultative) ──
    type CompanyRow = { id: string; name: string | null; contract_end?: string | null };
    const companies = new Map<string, CompanyRow>();
    let contractColumns = true;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const first = await supabase
        .from("companies")
        .select("id, name, contract_end")
        .eq("organization_id", orgId)
        .in("id", chunk);
      if (first.error && /contract_end/.test(first.error.message)) {
        contractColumns = false;
        const fb = await supabase.from("companies").select("id, name").eq("organization_id", orgId).in("id", chunk);
        for (const c of ((fb.data ?? []) as unknown) as CompanyRow[]) companies.set(c.id, c);
      } else {
        for (const c of ((first.data ?? []) as unknown) as CompanyRow[]) companies.set(c.id, c);
      }
    }

    // Repli deal : fin de contrat portée par le dernier deal GAGNÉ de l'entreprise.
    const dealContractEnd = new Map<string, string>();
    if (contractColumns) {
      try {
        const { data } = await supabase
          .from("deals")
          .select("company_id, contract_end, close_date")
          .eq("organization_id", orgId)
          .eq("is_closed_won", true)
          .not("contract_end", "is", null)
          .in("company_id", ids.slice(0, 1000))
          .limit(2000);
        const best = new Map<string, { end: string; close: string }>();
        for (const d of (data ?? []) as Array<{ company_id: string; contract_end: string; close_date: string | null }>) {
          const cur = best.get(d.company_id);
          if (!cur || (d.close_date ?? "") > cur.close) best.set(d.company_id, { end: d.contract_end, close: d.close_date ?? "" });
        }
        for (const [cid, v] of best) dealContractEnd.set(cid, v.end);
      } catch {}
    }

    const now = Date.now();
    const overdue: RadarItem[] = [];
    const upcoming: RadarItem[] = [];
    let regularCount = 0;
    let contractFilled = 0;

    for (const [companyId, list] of byCompany) {
      const company = companies.get(companyId);
      const name = company?.name?.trim() || "(sans nom)";
      list.sort((a, b) => a.at - b.at);
      const last = list[list.length - 1];
      const usualAmount = (() => {
        const amounts = list.slice(-6).map((x) => x.amount).filter((a): a is number => a != null && a > 0);
        return amounts.length > 0 ? Math.round(median(amounts)) : null;
      })();

      // Fin de contrat : company d'abord, sinon dernier deal gagné.
      const contractEndRaw = company?.contract_end ?? dealContractEnd.get(companyId) ?? null;
      const contractEnd = contractEndRaw ? Date.parse(contractEndRaw) : NaN;
      if (contractEndRaw && !Number.isNaN(contractEnd)) contractFilled++;

      // Rythme observé : écart médian entre factures successives.
      const intervals: number[] = [];
      for (let i = 1; i < list.length; i++) intervals.push((list[i].at - list[i - 1].at) / DAY);
      const m = intervals.length >= 2 ? median(intervals) : null;
      const regular = m != null && m >= 20 && m <= 400;
      if (regular) regularCount++;

      // ── Ancre « contract » prioritaire : échéance dans une fenêtre utile ──
      if (!Number.isNaN(contractEnd) && contractEnd >= now - 180 * DAY && contractEnd <= now + 30 * DAY) {
        // Renouvellement facturé ? une facture émise à partir de J-30 avant l'échéance.
        const billed = list.some((x) => x.at >= contractEnd - 30 * DAY);
        if (!billed) {
          const tolerance = 15 * DAY;
          if (now > contractEnd + tolerance) {
            overdue.push({
              companyId, companyName: name, status: "overdue",
              expectedDate: new Date(contractEnd).toISOString().slice(0, 10),
              daysLate: Math.round((now - contractEnd) / DAY),
              usualAmount, basis: "contract",
              basisLabel: "fin de contrat (CRM)",
            });
          } else if (contractEnd >= now - tolerance) {
            upcoming.push({
              companyId, companyName: name, status: "upcoming",
              expectedDate: new Date(contractEnd).toISOString().slice(0, 10),
              daysUntil: Math.max(0, Math.round((contractEnd - now) / DAY)),
              usualAmount, basis: "contract",
              basisLabel: "fin de contrat (CRM)",
            });
          }
        }
        continue; // l'ancre contrat a parlé pour ce client
      }

      // ── Ancre « rhythm » : prochaine facture attendue = dernière + rythme ──
      if (!regular || m == null) continue; // pas de rythme établi → jamais de faux retard
      const expected = last.at + m * DAY;
      const tolerance = Math.max(15, m * 0.3) * DAY;
      const basisLabel = `facturé tous les ~${Math.round(m)} j (${list.length} factures)`;
      if (now > expected + tolerance) {
        overdue.push({
          companyId, companyName: name, status: "overdue",
          expectedDate: new Date(expected).toISOString().slice(0, 10),
          daysLate: Math.round((now - expected) / DAY),
          usualAmount, basis: "rhythm", basisLabel,
        });
      } else if (expected <= now + 30 * DAY) {
        upcoming.push({
          companyId, companyName: name, status: "upcoming",
          expectedDate: new Date(expected).toISOString().slice(0, 10),
          daysUntil: Math.max(0, Math.round((expected - now) / DAY)),
          usualAmount, basis: "rhythm", basisLabel,
        });
      }
    }

    overdue.sort((a, b) => (b.usualAmount ?? 0) - (a.usualAmount ?? 0));
    upcoming.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

    return {
      hasData: true,
      overdue: overdue.slice(0, maxPerList),
      upcoming: upcoming.slice(0, maxPerList),
      overdueAmount: overdue.reduce((s, r) => s + (r.usualAmount ?? 0), 0),
      analyzed: byCompany.size,
      regularCount,
      contractCoverage: { filled: contractFilled, total: byCompany.size },
    };
  } catch {
    return EMPTY;
  }
}

/** Nombre de factures attendues en retard — pour l'alerte (forecast_type). */
export async function countOverdueExpectedInvoices(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number | null> {
  const radar = await computeBillingRadar(supabase, orgId, 1000);
  return radar.hasData ? radar.overdue.length : null;
}

// ── Du closing à la 1re facture : le délai gagné → facturation, en détail ──

export type UnbilledWonDeal = {
  dealName: string;
  companyName: string;
  amount: number | null;
  closeDate: string;
  /** Jours écoulés depuis le closing sans aucune facture. */
  daysSince: number;
  /** Id HubSpot du deal + owner — pour créer la tâche « Facturer » au owner. */
  dealHubspotId: string | null;
  ownerId: string | null;
};

export type OwnerDelay = {
  ownerId: string | null;
  ownerName: string;
  /** Délai médian closing → 1re facture pour les deals de ce owner (jours). */
  medianDelay: number;
  sample: number;
  /** Deals gagnés de ce owner toujours sans facture. */
  unbilledCount: number;
};

export type WonToInvoiceDetail = {
  hasData: boolean;
  /** Délai médian closing → 1re facture (jours), sur les deals mesurés. */
  medianDelay: number | null;
  /** Deals gagnés dont la 1re facture a été trouvée (mesurés). */
  sample: number;
  /** Évolution du délai médian par mois de closing (12 derniers mois mesurés). */
  monthly: Array<{ label: string; value: number }>;
  /** Deals gagnés SANS facture après tolérance — la fuite en cours. */
  unbilled: UnbilledWonDeal[];
  unbilledAmount: number;
  unbilledCount: number;
  /** Chaîne complète : gagné → facturé → encaissé (médianes, jours). */
  chain: { toInvoice: number | null; toPaid: number | null; total: number | null; samplePaid: number };
  /** Ventilation par owner (délai médian décroissant — les retardataires d'abord). */
  byOwner: OwnerDelay[];
};

const EMPTY_WTI: WonToInvoiceDetail = {
  hasData: false, medianDelay: null, sample: 0, monthly: [], unbilled: [], unbilledAmount: 0, unbilledCount: 0,
  chain: { toInvoice: null, toPaid: null, total: null, samplePaid: 0 }, byOwner: [],
};

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * Pour chaque deal GAGNÉ (close_date synchronisée automatiquement au passage
 * en « gagné ») : première facture client émise à partir du closing → délai
 * réel closing → facturation. Les gagnés sans facture après 15 jours sont
 * listés comme fuite en cours. Jointure company_id, 100 % déterministe.
 */
export async function computeWonToInvoiceDetail(
  supabase: SupabaseClient,
  orgId: string,
  hubspotToken: string | null = null,
  maxUnbilled = 10,
  /** Limite aux factures de ces outils (ex : ["pennylane"]) — pages CRM ↔ outil. */
  providers: string[] | null = null,
): Promise<WonToInvoiceDetail> {
  try {
    const { data: wonRows } = await supabase
      .from("deals")
      .select("name, amount, close_date, company_id, hubspot_id, owner_id")
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .not("close_date", "is", null)
      .not("company_id", "is", null)
      .order("close_date", { ascending: false })
      .limit(600);
    const won = (wonRows ?? []) as Array<{
      name: string | null; amount: number | null; close_date: string; company_id: string;
      hubspot_id: string | null; owner_id: string | null;
    }>;
    if (won.length === 0) return EMPTY_WTI;

    const companyIds = [...new Set(won.map((d) => d.company_id))];

    // Factures CLIENTS des entreprises concernées (fournisseurs exclus) —
    // avec la date d'encaissement pour la chaîne complète.
    type Inv = { issued: number; paid: number | null };
    const invoicesByCompany = new Map<string, Inv[]>();
    for (let i = 0; i < companyIds.length; i += 200) {
      let q = supabase
        .from("invoices")
        .select("company_id, issued_at, paid_at, direction")
        .eq("organization_id", orgId)
        .in("company_id", companyIds.slice(i, i + 200))
        .not("issued_at", "is", null)
        .limit(5000);
      if (providers && providers.length > 0) q = q.in("primary_source", providers);
      const { data } = await q;
      for (const inv of (data ?? []) as Array<{ company_id: string; issued_at: string; paid_at: string | null; direction: string | null }>) {
        if (inv.direction === "out") continue;
        const t = Date.parse(inv.issued_at);
        if (Number.isNaN(t)) continue;
        const paid = inv.paid_at ? Date.parse(inv.paid_at) : NaN;
        (invoicesByCompany.get(inv.company_id) ?? invoicesByCompany.set(inv.company_id, []).get(inv.company_id)!)
          .push({ issued: t, paid: Number.isNaN(paid) ? null : paid });
      }
    }
    for (const list of invoicesByCompany.values()) list.sort((a, b) => a.issued - b.issued);

    const now = Date.now();
    const delays: number[] = [];
    const paidDelays: number[] = [];
    const totalDelays: number[] = [];
    const byMonth = new Map<string, number[]>();
    const byOwnerDelays = new Map<string, number[]>();
    const byOwnerUnbilled = new Map<string, number>();
    const companyNames = new Map<string, string>();
    // Noms d'entreprises pour la liste des non facturés.
    for (let i = 0; i < companyIds.length; i += 200) {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("organization_id", orgId)
        .in("id", companyIds.slice(i, i + 200));
      for (const c of (data ?? []) as Array<{ id: string; name: string | null }>) {
        if (c.name) companyNames.set(c.id, c.name);
      }
    }

    const unbilled: UnbilledWonDeal[] = [];
    let unbilledAmount = 0;
    let unbilledCount = 0;

    for (const d of won) {
      const closeAt = Date.parse(d.close_date);
      if (Number.isNaN(closeAt)) continue;
      const ownerKey = d.owner_id ?? "__none__";
      const invs = invoicesByCompany.get(d.company_id) ?? [];
      // 1re facture à partir du closing (petite tolérance amont : acompte à J-7).
      const first = invs.find((inv) => inv.issued >= closeAt - 7 * DAY);
      if (first) {
        const delay = Math.max(0, Math.round((first.issued - closeAt) / DAY));
        delays.push(delay);
        (byOwnerDelays.get(ownerKey) ?? byOwnerDelays.set(ownerKey, []).get(ownerKey)!).push(delay);
        const dt = new Date(closeAt);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(delay);
        // Chaîne complète : facture → encaissement, et cycle total.
        if (first.paid != null && first.paid >= first.issued) {
          paidDelays.push(Math.round((first.paid - first.issued) / DAY));
          totalDelays.push(Math.max(0, Math.round((first.paid - closeAt) / DAY)));
        }
      } else if (now - closeAt > 15 * DAY) {
        unbilledCount++;
        unbilledAmount += Number(d.amount) || 0;
        byOwnerUnbilled.set(ownerKey, (byOwnerUnbilled.get(ownerKey) ?? 0) + 1);
        if (unbilled.length < maxUnbilled) {
          unbilled.push({
            dealName: d.name?.trim() || "(deal sans nom)",
            companyName: companyNames.get(d.company_id) ?? "(entreprise inconnue)",
            amount: d.amount != null ? Math.round(Number(d.amount)) : null,
            closeDate: d.close_date,
            daysSince: Math.round((now - closeAt) / DAY),
            dealHubspotId: d.hubspot_id,
            ownerId: d.owner_id,
          });
        }
      }
    }

    // ── Noms des owners (HubSpot live — best-effort) ──
    const ownerNames = new Map<string, string>();
    if (hubspotToken && (byOwnerDelays.size > 0 || byOwnerUnbilled.size > 0)) {
      try {
        const res = await hubFetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
          headers: { Authorization: `Bearer ${hubspotToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          for (const o of (data.results ?? []) as Array<{ id: string; firstName?: string; lastName?: string; email?: string }>) {
            const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim() || o.email || `Owner ${o.id}`;
            ownerNames.set(String(o.id), name);
          }
        }
      } catch {}
    }
    const ownerKeys = new Set([...byOwnerDelays.keys(), ...byOwnerUnbilled.keys()]);
    const byOwner: OwnerDelay[] = [...ownerKeys]
      .map((key) => {
        const ds = byOwnerDelays.get(key) ?? [];
        return {
          ownerId: key === "__none__" ? null : key,
          ownerName: key === "__none__" ? "Sans owner" : ownerNames.get(key) ?? `Owner ${key}`,
          medianDelay: ds.length > 0 ? Math.round(median(ds)) : 0,
          sample: ds.length,
          unbilledCount: byOwnerUnbilled.get(key) ?? 0,
        };
      })
      .filter((o) => o.sample > 0 || o.unbilledCount > 0)
      .sort((a, b) => b.medianDelay - a.medianDelay);

    const monthly = [...byMonth.keys()].sort().slice(-12).map((key) => {
      const [yy, mm] = key.split("-");
      return { label: `${MONTHS_FR[Number(mm) - 1]} ${yy.slice(2)}`, value: Math.round(median(byMonth.get(key)!)) };
    });
    unbilled.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

    return {
      hasData: delays.length > 0 || unbilledCount > 0,
      medianDelay: delays.length > 0 ? Math.round(median(delays)) : null,
      sample: delays.length,
      monthly,
      unbilled,
      unbilledAmount: Math.round(unbilledAmount),
      unbilledCount,
      chain: {
        toInvoice: delays.length > 0 ? Math.round(median(delays)) : null,
        toPaid: paidDelays.length > 0 ? Math.round(median(paidDelays)) : null,
        total: totalDelays.length > 0 ? Math.round(median(totalDelays)) : null,
        samplePaid: paidDelays.length,
      },
      byOwner,
    };
  } catch {
    return EMPTY_WTI;
  }
}

/** Deals gagnés sans facture après 15 j — pour l'alerte (forecast_type). */
export async function countWonUnbilled(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number | null> {
  const detail = await computeWonToInvoiceDetail(supabase, orgId, null, 1);
  return detail.hasData ? detail.unbilledCount : null;
}
