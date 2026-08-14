import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { AGENTS } from "@/lib/ai/agents/registry";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * « Tour de contrôle » vocale Revold (orbe de la home) : transforme une demande
 * dictée en { agent ciblé + demande reformulée } — l'UI redirige vers la page
 * de chat de l'agent avec la demande exécutée automatiquement.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { transcript?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const transcript = (body.transcript || "").trim().slice(0, 600);
  if (!transcript) return NextResponse.json({ error: "Transcription vide" }, { status: 400 });

  const { key: anthropicKey, reason } = getAnthropicKey();
  if (!anthropicKey) return NextResponse.json({ error: reason ?? "ANTHROPIC_API_KEY manquante" }, { status: 500 });

  const agents = Object.values(AGENTS);
  const roster = agents
    .map((a) => {
      const p = getAgentPersona(a.key);
      return `- ${a.key} : ${a.label} (${p.name}) — ${a.tagline}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey: anthropicKey });
  try {
    const resp = await client.messages.create({
      // Dispatch = simple routage : le modèle rapide suffit (latence vocale).
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Tu es la tour de contrôle vocale de Revold (plateforme Revenue Intelligence). " +
        "L'utilisateur dicte une demande ; tu la routes vers l'agent ou le coach le plus pertinent du roster, " +
        "et tu reformules sa demande en une instruction claire et complète que cet agent exécutera telle quelle. " +
        "Reste fidèle à l'intention : ne rajoute rien, n'invente pas de chiffres. " +
        `Roster des agents :\n${roster}\n` +
        "Si la demande est incompréhensible ou sans rapport avec le revenue/l'entreprise, appelle clarify. Réponds uniquement via un outil.",
      tools: [
        {
          name: "dispatch",
          description: "Route la demande vocale vers l'agent pertinent avec l'instruction à exécuter.",
          input_schema: {
            type: "object",
            properties: {
              agent_key: { type: "string", enum: agents.map((a) => a.key), description: "Clé exacte de l'agent/coach pertinent." },
              request: { type: "string", description: "La demande reformulée en instruction claire (français), exécutée telle quelle par l'agent." },
              say: { type: "string", description: "Confirmation orale TRÈS courte, style tour de contrôle (ex : « Je briefe Chloé sur ton closing rate, on y va. »)." },
            },
            required: ["agent_key", "request", "say"],
          },
        },
        {
          name: "clarify",
          description: "Demande incompréhensible ou hors sujet : demander à reformuler.",
          input_schema: {
            type: "object",
            properties: { say: { type: "string", description: "Question de clarification courte, à l'oral." } },
            required: ["say"],
          },
        },
      ],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: `Demande dictée : « ${transcript} »` }],
    });

    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return NextResponse.json({ error: "Routage impossible" }, { status: 422 });

    if (toolUse.name === "clarify") {
      const inp = toolUse.input as { say?: string };
      return NextResponse.json({ clarify: inp.say?.trim() || "Je n'ai pas compris — reformule ta demande ?" });
    }

    const inp = toolUse.input as { agent_key?: string; request?: string; say?: string };
    const agent = inp.agent_key ? AGENTS[inp.agent_key] : null;
    if (!agent) return NextResponse.json({ error: "Agent inconnu" }, { status: 422 });
    const persona = getAgentPersona(agent.key);
    return NextResponse.json({
      agentKey: agent.key,
      agentLabel: agent.label,
      personaName: persona.name,
      request: (inp.request || transcript).trim(),
      say: (inp.say || `Je t'ouvre ${persona.name}.`).trim(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur de routage" }, { status: 500 });
  }
}
