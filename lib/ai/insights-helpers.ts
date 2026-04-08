import { INSIGHT_LIBRARY, type InsightContext, type Severity, type InsightCategory } from "./insights-library";

export type DismissedInsightView = {
  key: string;
  category: InsightCategory;
  severity: Severity;
  title: string;
  body: string;
  recommendation: string;
  dismissedAt: string;
};

/**
 * Build full insight content from dismissed template keys + current CRM context.
 * Skips templates that no longer match (e.g., the issue was resolved).
 */
export function buildDismissedInsights(
  ctx: InsightContext,
  dismissals: Array<{ template_key: string; status: string; dismissed_at: string }>,
): DismissedInsightView[] {
  return dismissals
    .map((d) => {
      const tpl = INSIGHT_LIBRARY.find((t) => t.key === d.template_key);
      if (!tpl) return null;
      const built = tpl.build(ctx);
      return {
        key: tpl.key,
        category: tpl.category,
        severity: tpl.severity,
        ...built,
        dismissedAt: d.dismissed_at,
      };
    })
    .filter((x): x is DismissedInsightView => x !== null);
}
