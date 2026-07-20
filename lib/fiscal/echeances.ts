/**
 * Échéances fiscales (TVA · IS · URSSAF) d'une organisation.
 *
 * Les paramètres (périodicité, prochaine échéance, montant estimé) sont saisis
 * dans Paramètres → Organisation. Tant qu'ils ne sont pas renseignés, on retombe
 * sur les échéances standard françaises calculées à partir de la date du jour,
 * pour que la table de données « Échéances fiscales » du funnel Trésorerie affiche
 * toujours quelque chose d'exploitable.
 */

export type FiscalEcheance = { name: string; value: number };

type OrgFiscal = {
  country_code?: string | null;
  country?: string | null;
  fiscal_tva_periodicite?: string | null;
  fiscal_tva_prochaine?: string | null;
  fiscal_tva_montant?: number | null;
  fiscal_is_periodicite?: string | null;
  fiscal_is_prochaine?: string | null;
  fiscal_is_montant?: number | null;
  fiscal_urssaf_periodicite?: string | null;
  fiscal_urssaf_prochaine?: string | null;
  fiscal_urssaf_montant?: number | null;
};

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function fmtDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Prochaine occurrence du jour `day` du mois, à partir de `now` (UTC). */
function nextMonthly(now: Date, day: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  if (d.getTime() <= now.getTime()) d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** Prochaine échéance parmi une liste de (mois 0-11, jour), à partir de `now`. */
function nextQuarterly(now: Date, points: [number, number][]): Date {
  const candidates = points.flatMap(([m, day]) => [
    new Date(Date.UTC(now.getUTCFullYear(), m, day)),
    new Date(Date.UTC(now.getUTCFullYear() + 1, m, day)),
  ]);
  return candidates.filter((d) => d.getTime() > now.getTime()).sort((a, b) => a.getTime() - b.getTime())[0];
}

function line(label: string, periodicite: string | null | undefined, prochaine: string | null | undefined, fallback: Date, montant: number | null | undefined): FiscalEcheance {
  const date = prochaine ? new Date(prochaine) : fallback;
  const dateOk = !Number.isNaN(date.getTime());
  const per = periodicite ? ` · ${periodicite}` : "";
  return {
    name: `${label}${per} — échéance ${dateOk ? fmtDate(date) : "à définir"}`,
    value: Math.round(Number(montant) || 0),
  };
}

export function computeFiscalEcheances(org: OrgFiscal | null, now: Date): FiscalEcheance[] {
  const o = org ?? {};
  // Échéances standard FR (régime réel) comme repli si non paramétré.
  const tvaFallback = nextMonthly(now, 21);                             // TVA CA3 mensuelle ~ 21
  const isFallback = nextQuarterly(now, [[2, 15], [5, 15], [8, 15], [11, 15]]); // acomptes IS 15/03,15/06,15/09,15/12
  const urssafFallback = nextMonthly(now, 15);                          // URSSAF mensuelle ~ 15

  return [
    line("TVA", o.fiscal_tva_periodicite ?? "mensuelle", o.fiscal_tva_prochaine, tvaFallback, o.fiscal_tva_montant),
    line("IS (acompte)", o.fiscal_is_periodicite ?? "trimestriel", o.fiscal_is_prochaine, isFallback, o.fiscal_is_montant),
    line("URSSAF", o.fiscal_urssaf_periodicite ?? "mensuelle", o.fiscal_urssaf_prochaine, urssafFallback, o.fiscal_urssaf_montant),
  ];
}
