import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Préférences par agent (Paramètres → Agents) : ton + personnalité injectés
 * dans le system prompt, et activation des insights d'usage.
 */
export type AgentPrefs = {
  agentKey: string;
  tone: string | null;
  personality: string | null;
  insightsEnabled: boolean;
};

export const AGENT_TONES: { id: string; label: string; directive: string }[] = [
  { id: "direct", label: "Direct", directive: "Ton DIRECT et synthétique : va droit au but, phrases courtes, zéro détour — le chiffre puis l'action." },
  { id: "pedagogue", label: "Pédagogue", directive: "Ton PÉDAGOGUE : explique pas à pas, définis chaque terme technique, illustre avec des exemples concrets." },
  { id: "challenger", label: "Challenger", directive: "Ton CHALLENGER : questionne les choix de l'utilisateur, joue l'avocat du diable, pousse à viser plus haut — toujours constructif." },
  { id: "chaleureux", label: "Chaleureux", directive: "Ton CHALEUREUX et encourageant : positif, motivant, célèbre les progrès — sans jamais édulcorer les chiffres." },
];

export function toneDirective(tone: string | null | undefined): string | null {
  return AGENT_TONES.find((t) => t.id === tone)?.directive ?? null;
}

/** Charge les préférences d'un agent pour UN utilisateur — résilient (table absente → null). */
export async function getAgentPrefs(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  agentKey: string,
): Promise<AgentPrefs | null> {
  try {
    const { data, error } = await supabase
      .from("agent_prefs")
      .select("agent_key, tone, personality, insights_enabled")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("agent_key", agentKey)
      .maybeSingle();
    if (error || !data) return null;
    return {
      agentKey: data.agent_key as string,
      tone: (data.tone as string | null) ?? null,
      personality: (data.personality as string | null) ?? null,
      insightsEnabled: Boolean(data.insights_enabled),
    };
  } catch {
    return null;
  }
}

/** Directive system prompt issue des préférences (null si rien à injecter). */
export function prefsDirective(prefs: AgentPrefs | null): string | null {
  if (!prefs) return null;
  const parts: string[] = [];
  const tone = toneDirective(prefs.tone);
  if (tone) parts.push(`- ${tone}`);
  if (prefs.personality?.trim()) parts.push(`- Personnalité voulue par l'utilisateur : ${prefs.personality.trim()}`);
  if (parts.length === 0) return null;
  return `\n\nPRÉFÉRENCES DE L'UTILISATEUR pour cet agent (à respecter dans toutes tes réponses) :\n${parts.join("\n")}`;
}
