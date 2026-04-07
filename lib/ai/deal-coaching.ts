/**
 * Revold AI — Deal Coaching
 * Generates contextual per-deal recommendations using Claude API.
 */

import Anthropic from "@anthropic-ai/sdk";
import { REVOLD_SYSTEM_PROMPT } from "./system-prompt";

type DealContext = {
  name: string;
  amount: number;
  stage: string;
  days_in_stage: number;
  close_date: string | null;
  created_date: string;
  is_at_risk: boolean;
  risk_reasons: string[];
  win_probability: number | null;
  last_activity_at: string | null;
  activities: {
    type: string;
    subject: string | null;
    occurred_at: string;
  }[];
  company: {
    name: string;
    segment: string | null;
    industry: string | null;
  } | null;
};

export type CoachingAdvice = {
  priority_action: string;
  rationale: string;
  next_steps: string[];
  risk_assessment: string;
  similar_deals_insight: string;
};

const COACHING_PROMPT = `You are coaching a sales rep on a specific deal. Analyze the deal context and provide actionable coaching.

<deal>
{deal_context}
</deal>

Respond with a JSON object matching this exact schema:

{{
  "priority_action": "L'action #1 à faire aujourd'hui (1 phrase concrète)",
  "rationale": "Pourquoi cette action est prioritaire (2-3 phrases avec des données du deal)",
  "next_steps": ["Étape 1 concrète", "Étape 2", "Étape 3"],
  "risk_assessment": "Évaluation du risque en 1-2 phrases. Référencer les raisons de risque si applicables.",
  "similar_deals_insight": "Insight basé sur les benchmarks B2B SaaS pour des deals similaires (segment, montant, stage)"
}}

Rules:
- All text in French
- priority_action must be executable TODAY — not "réfléchir à" or "envisager de"
- next_steps: exactly 3 items, ordered chronologically
- Reference specific deal data (montant, jours dans l'étape, dernière activité)
- If the deal has no recent activity, the priority action should address reactivation
- If close date is approaching or passed, address urgency`;

export class DealCoach {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async coach(deal: DealContext): Promise<CoachingAdvice> {
    const userPrompt = COACHING_PROMPT.replace(
      "{deal_context}",
      JSON.stringify(deal, null, 2),
    );

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      temperature: 0.3,
      system: REVOLD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let clean = text.trim();
    if (clean.startsWith("```")) clean = clean.split("\n", 2)[1] ?? clean;
    if (clean.endsWith("```")) clean = clean.slice(0, clean.lastIndexOf("```"));

    return JSON.parse(clean.trim()) as CoachingAdvice;
  }
}
