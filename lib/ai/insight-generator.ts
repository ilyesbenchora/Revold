/**
 * Revold AI — Insight Generator
 * TypeScript adaptation of the Ringo LLM Insight Generator.
 * Uses Claude API to transform RevOps metrics into strategic insights.
 */

import Anthropic from "@anthropic-ai/sdk";
import { REVOLD_SYSTEM_PROMPT } from "./system-prompt";

// ── Types ──

type OrgContext = {
  org_name: string;
  industry: string;
  segment: string;
  quarterly_target: number;
  team_size: number;
  currency: string;
};

type KpiSnapshot = {
  closing_rate: number;
  pipeline_coverage: number;
  sales_cycle_days: number;
  weighted_forecast: number;
  deal_velocity: number;
  mql_to_sql_rate: number;
  lead_velocity_rate: number;
  funnel_leakage_rate: number;
  inactive_deals_pct: number;
  data_completeness: number;
  deal_stagnation_rate: number;
  duplicate_contacts_pct: number;
  orphan_contacts_pct: number;
  activities_per_deal: number;
  sales_score: number;
  marketing_score: number;
  crm_ops_score: number;
};

type DealAtRisk = {
  name: string;
  amount: number;
  stage: string;
  days_in_stage: number;
  risk_reasons: string[];
};

export type GeneratedInsight = {
  category: "pipeline" | "deal_risk" | "forecast" | "coaching" | "marketing" | "crm_ops";
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  recommendation: string;
};

// ── Prompt template ──

const INSIGHT_PROMPT = `Analyze the following RevOps data and produce strategic insights.

<context>
{context}
</context>

Respond with a JSON object matching this exact schema:

{{
  "insights": [
    {{
      "category": "pipeline | deal_risk | forecast | coaching | marketing | crm_ops",
      "severity": "critical | warning | info",
      "title": "Titre court (max 15 mots)",
      "body": "2-3 phrases avec des chiffres spécifiques du contexte",
      "recommendation": "Action spécifique et concrète à exécuter"
    }}
  ]
}}

Rules:
- Generate exactly 3-5 insights, sorted by severity (critical first) then revenue impact
- Cover at least 2 different categories
- Every number must come from the provided metrics
- All text in French
- Each recommendation must be actionable this week`;

// ── Generator ──

export class InsightGenerator {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(
    kpis: KpiSnapshot,
    orgContext: OrgContext,
    dealsAtRisk: DealAtRisk[] = [],
    period: string = "Cette semaine",
  ): Promise<GeneratedInsight[]> {
    const context = JSON.stringify(
      {
        organization: orgContext,
        period,
        scorecards: {
          sales_engine: { score: kpis.sales_score },
          marketing_engine: { score: kpis.marketing_score },
          crm_ops: { score: kpis.crm_ops_score },
        },
        sales_metrics: {
          closing_rate: kpis.closing_rate,
          pipeline_coverage: kpis.pipeline_coverage,
          sales_cycle_days: kpis.sales_cycle_days,
          weighted_forecast: kpis.weighted_forecast,
          deal_velocity: kpis.deal_velocity,
        },
        marketing_metrics: {
          mql_to_sql_rate: kpis.mql_to_sql_rate,
          lead_velocity_rate: kpis.lead_velocity_rate,
          funnel_leakage_rate: kpis.funnel_leakage_rate,
        },
        crm_hygiene_metrics: {
          data_completeness: kpis.data_completeness,
          inactive_deals_pct: kpis.inactive_deals_pct,
          deal_stagnation_rate: kpis.deal_stagnation_rate,
          duplicate_contacts_pct: kpis.duplicate_contacts_pct,
          orphan_contacts_pct: kpis.orphan_contacts_pct,
          activities_per_deal: kpis.activities_per_deal,
        },
        deals_at_risk: dealsAtRisk.slice(0, 5),
      },
      null,
      2,
    );

    const userPrompt = INSIGHT_PROMPT.replace("{context}", context);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.3,
      system: REVOLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let clean = text.trim();
    if (clean.startsWith("```")) clean = clean.split("\n", 2)[1] ?? clean;
    if (clean.endsWith("```")) clean = clean.slice(0, clean.lastIndexOf("```"));
    clean = clean.trim();

    const parsed = JSON.parse(clean);
    return parsed.insights as GeneratedInsight[];
  }
}
