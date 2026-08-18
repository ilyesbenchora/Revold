export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { AgentPrefsSettings, type AgentPrefRow } from "@/components/agent-prefs-settings";
import { listAgentsBySection } from "@/lib/ai/agents/registry";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

/**
 * Paramètres → Agents : personnalité et ton de chaque agent (injectés dans son
 * system prompt) + insights d'usage (sujets les plus abordés, volume,
 * profondeur des échanges — calculés sur les conversations synchronisées de
 * l'utilisateur).
 */
export default async function ParametresAgentsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const agents = listAgentsBySection("donnees");

  // Préférences enregistrées — PAR UTILISATEUR (résilient : migration absente → défauts).
  const prefsByKey = new Map<string, { tone: string | null; personality: string | null; insights: boolean }>();
  try {
    const { data } = userId
      ? await supabase
          .from("agent_prefs")
          .select("agent_key, tone, personality, insights_enabled")
          .eq("organization_id", orgId)
          .eq("user_id", userId)
      : { data: [] };
    for (const r of data ?? []) {
      prefsByKey.set(r.agent_key as string, {
        tone: (r.tone as string | null) ?? null,
        personality: (r.personality as string | null) ?? null,
        insights: Boolean(r.insights_enabled),
      });
    }
  } catch {
    /* table absente */
  }

  // Insights d'usage : conversations synchronisées de l'utilisateur, par agent.
  const insightsByKey = new Map<string, { conversations: number; messages: number; depth: number; topics: string[] }>();
  if (userId) {
    try {
      const { data } = await supabase
        .from("agent_conversations")
        .select("agent_key, payload, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(300);
      for (const r of data ?? []) {
        const key = r.agent_key as string;
        const payload = r.payload as { title?: string; messages?: unknown[] } | null;
        const cur = insightsByKey.get(key) ?? { conversations: 0, messages: 0, depth: 0, topics: [] };
        cur.conversations += 1;
        cur.messages += Array.isArray(payload?.messages) ? payload.messages.length : 0;
        if (payload?.title && cur.topics.length < 5) cur.topics.push(payload.title);
        insightsByKey.set(key, cur);
      }
      for (const v of insightsByKey.values()) {
        v.depth = v.conversations > 0 ? Math.round((v.messages / v.conversations) * 10) / 10 : 0;
      }
    } catch {
      /* table absente → insights vides */
    }
  }

  const rows: AgentPrefRow[] = agents.map((a) => {
    const persona = getAgentPersona(a.key);
    const prefs = prefsByKey.get(a.key);
    return {
      agentKey: a.key,
      label: a.label,
      role: persona.role,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      personaImage: personaImagePath(a.key),
      tone: prefs?.tone ?? null,
      personality: prefs?.personality ?? null,
      insightsEnabled: prefs?.insights ?? false,
      insights: insightsByKey.get(a.key) ?? { conversations: 0, messages: 0, depth: 0, topics: [] },
    };
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Agents : personnalise le ton et la personnalité de chaque agent — appliqués à toutes ses réponses (chat,
          routines, séances) — et active les insights d&apos;usage (sujets les plus abordés, profondeur des échanges).
          Ces réglages te sont propres : chaque membre du compte a les siens.
        </p>
      </header>

      <ParametresTabs />

      <AgentPrefsSettings agents={rows} />
    </section>
  );
}
