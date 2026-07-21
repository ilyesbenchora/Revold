import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { runAgentTurn, type AgentMessage } from "@/lib/ai/agents/agent-runtime";
import { getAgent, buildSystemPrompt } from "@/lib/ai/agents/registry";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { sendWhatsAppText, buildAgentMenu, resolveAgentChoice } from "@/lib/integrations/whatsapp";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

export const maxDuration = 60;

/** Vérification du webhook (handshake Meta). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !token) return new NextResponse("Bad Request", { status: 400 });

  // On valide si le verify_token correspond à une intégration WhatsApp active.
  const supabase = createSupabaseAdminClient();
  const { data: match } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("provider", "whatsapp")
    .eq("is_active", true);
  const ok = (match ?? []).some((r) => (r.metadata as { verify_token?: string } | null)?.verify_token === token);
  return ok && challenge ? new NextResponse(challenge, { status: 200 }) : new NextResponse("Forbidden", { status: 403 });
}

type WaMessage = { from: string; id: string; text?: { body: string }; type: string };

/** Réception des messages entrants → routage vers l'agent choisi. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // On ACK toujours (Meta ré-essaie sinon) et on traite au mieux.
  try {
    await handleIncoming(body);
  } catch (err) {
    console.error("[whatsapp] handler error", err);
  }
  return NextResponse.json({ ok: true });
}

async function handleIncoming(body: unknown) {
  const entry = (body as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: WaMessage[] } }[] }
    | undefined;
  const value = entry?.changes?.[0]?.value;
  const phoneNumberId = value?.metadata?.phone_number_id;
  const msg = value?.messages?.[0];
  if (!phoneNumberId || !msg || msg.type !== "text" || !msg.text?.body) return;

  const supabase = createSupabaseAdminClient();

  // Retrouve l'org via le phone_number_id.
  const { data: integ } = await supabase
    .from("integrations")
    .select("organization_id, access_token, metadata")
    .eq("provider", "whatsapp")
    .eq("is_active", true);
  const row = (integ ?? []).find(
    (r) => (r.metadata as { phone_number_id?: string } | null)?.phone_number_id === phoneNumberId,
  );
  if (!row) return;
  const orgId = row.organization_id as string;
  const accessToken =
    (row.metadata as { access_token?: string } | null)?.access_token ?? (row.access_token as string);
  const from = msg.from;
  const text = msg.text.body.trim();

  const reply = (t: string) => sendWhatsAppText(phoneNumberId, accessToken, from, t);

  // Session (par numéro).
  const { data: sess } = await supabase
    .from("whatsapp_sessions")
    .select("id, agent_key, messages, last_msg_id")
    .eq("organization_id", orgId)
    .eq("wa_from", from)
    .maybeSingle();

  // Anti-doublon (Meta ré-essaie les webhooks).
  if (sess?.last_msg_id === msg.id) return;

  const agentKey: string | null = sess?.agent_key ?? null;
  let history: AgentMessage[] = Array.isArray(sess?.messages) ? (sess!.messages as AgentMessage[]) : [];

  async function persist(nextAgent: string | null, nextHistory: AgentMessage[]) {
    await supabase.from("whatsapp_sessions").upsert(
      {
        organization_id: orgId,
        wa_from: from,
        agent_key: nextAgent,
        messages: nextHistory.slice(-16),
        last_msg_id: msg!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,wa_from" },
    );
  }

  // Commande « menu » → re-choix d'agent.
  if (/^(menu|agents?|changer)$/i.test(text) || !agentKey) {
    const choice = agentKey === null ? resolveAgentChoice(text) : null;
    if (agentKey === null && choice) {
      const persona = getAgentPersona(choice);
      history = [];
      await persist(choice, history);
      await reply(`✅ Tu discutes maintenant avec ${persona.name}, ${persona.role}. Pose ta première question !`);
      return;
    }
    await persist(null, []);
    await reply(buildAgentMenu());
    return;
  }

  const agent = getAgent(agentKey);
  if (!agent) {
    await persist(null, []);
    await reply(buildAgentMenu());
    return;
  }

  // Exécute un tour d'agent.
  const { key: anthropicKey } = getAnthropicKey();
  if (!anthropicKey) {
    await reply("Service temporairement indisponible. Réessaie plus tard.");
    return;
  }
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const client = new Anthropic({ apiKey: anthropicKey });
  const messages: AgentMessage[] = [...history, { role: "user" as const, content: text }].slice(-16);

  const system =
    buildSystemPrompt(agent) +
    "\n\nContexte : la conversation a lieu sur WhatsApp. Réponds de façon concise (pas de tableaux markdown ni de blocs de code), en texte simple adapté à la messagerie.";

  try {
    const result = await runAgentTurn({
      client,
      system,
      tools: agent.tools,
      messages,
      ctx: { supabase, orgId, hubspotToken, sources: [] },
      maxSteps: 5,
    });
    const answer = result.text?.trim() || "Je n'ai pas de réponse pour l'instant.";
    const nextHistory: AgentMessage[] = [...messages, { role: "assistant" as const, content: answer }];
    await persist(agentKey, nextHistory);
    await reply(answer);
  } catch (err) {
    console.error("[whatsapp] agent turn failed", err);
    await reply("Désolé, une erreur est survenue. Réessaie dans un instant.");
  }
}
