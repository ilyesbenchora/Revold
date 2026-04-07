/**
 * Rule-based deal risk detection
 * Flags deals as at-risk based on configurable rules.
 * Called by the cron job after KPI computation.
 */

type DealForRisk = {
  id: string;
  name: string;
  amount: number;
  days_in_stage: number;
  last_activity_at: string | null;
  close_date: string | null;
  is_closed_won: boolean;
  is_closed_lost: boolean;
};

type RiskResult = {
  deal_id: string;
  is_at_risk: boolean;
  risk_reasons: string[];
};

const RULES = {
  INACTIVITY_DAYS: 14,
  STAGNATION_DAYS: 21,
  CLOSE_DATE_BUFFER_DAYS: 7,
} as const;

export function detectRisks(deals: DealForRisk[]): RiskResult[] {
  const now = Date.now();

  return deals
    .filter((d) => !d.is_closed_won && !d.is_closed_lost)
    .map((deal) => {
      const reasons: string[] = [];

      // Rule 1: No activity in 14+ days
      if (deal.last_activity_at) {
        const daysSince = (now - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > RULES.INACTIVITY_DAYS) {
          reasons.push(`Inactivité depuis ${Math.round(daysSince)} jours`);
        }
      } else {
        reasons.push("Aucune activité enregistrée");
      }

      // Rule 2: Stagnation in stage
      if (deal.days_in_stage > RULES.STAGNATION_DAYS) {
        reasons.push(`Stagnation dans l'étape depuis ${deal.days_in_stage} jours`);
      }

      // Rule 3: Close date passed or within buffer
      if (deal.close_date) {
        const closeDate = new Date(deal.close_date).getTime();
        const daysUntilClose = (closeDate - now) / (1000 * 60 * 60 * 24);
        if (daysUntilClose < 0) {
          reasons.push(`Date de close dépassée de ${Math.round(Math.abs(daysUntilClose))} jours`);
        } else if (daysUntilClose < RULES.CLOSE_DATE_BUFFER_DAYS) {
          reasons.push(`Close prévue dans ${Math.round(daysUntilClose)} jours`);
        }
      }

      return {
        deal_id: deal.id,
        is_at_risk: reasons.length > 0,
        risk_reasons: reasons,
      };
    });
}
