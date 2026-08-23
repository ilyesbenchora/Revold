import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PERSONA_SCRIPTS } from "@/lib/ai/agents/persona-scripts";

export const maxDuration = 30;

/**
 * Synthèse vocale des réponses d'agent (ElevenLabs, voix FR du persona).
 *
 * POST { text, agentKey } → audio/mpeg. La voix est celle définie dans
 * PERSONA_SCRIPTS (même voix que la vidéo de bio) ; à défaut, la voix
 * d'Alix (reporting). Sans clé ELEVENLABS_API_KEY, 503 → le client bascule
 * sur la synthèse du navigateur (speechSynthesis).
 */

// Voix de repli si l'agent n'a pas de persona vocal dédié.
const FALLBACK_VOICE = "MtmOw0YCJmdnFGEjqlkh"; // Clarris — FR jeune, douce

// Voix de la TOUR DE CONTRÔLE : Claire — FR conversationnelle, diction nette.
const TOWER_VOICE = "NEjemlRxgWmL5ZGJetsB"; // Claire — Conversationnel, FR standard

// Longueur max lue à voix haute (coût + latence) : on coupe à la fin de la
// dernière phrase complète avant la limite.
const MAX_CHARS = 1800;

function truncateAtSentence(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(0, MAX_CHARS);
  const lastEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf(".\n"));
  return lastEnd > MAX_CHARS * 0.5 ? cut.slice(0, lastEnd + 1) : cut;
}

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS non configuré" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; agentKey?: string };
  try {
    body = (await request.json()) as { text?: string; agentKey?: string };
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Texte vide" }, { status: 400 });

  const isTower = body.agentKey === "tower";
  const persona = body.agentKey && !isTower ? PERSONA_SCRIPTS[body.agentKey] : undefined;
  const voiceId = isTower ? TOWER_VOICE : persona?.elevenVoiceId ?? FALLBACK_VOICE;
  const settings = persona?.voiceSettings ?? {};

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: truncateAtSentence(text),
        // multilingual v2 partout (tour ET agents) : c'est le modèle des vidéos
        // de bio de la homepage — même voix + même modèle = même rendu. turbo
        // v2.5 (essayé pour la latence) rendait le français moins fluide, avec
        // des glissements d'accent — inacceptable à l'oreille.
        model_id: "eleven_multilingual_v2",
        voice_settings: isTower
          ? { stability: 0.55, similarity_boost: 0.8, style: 0.1 }
          : {
              stability: settings.stability ?? 0.5,
              similarity_boost: settings.similarity_boost ?? 0.75,
              style: settings.style ?? 0,
            },
      }),
    },
  );

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error(`[tts] ElevenLabs ${res.status}`, detail.slice(0, 300));
    return NextResponse.json({ error: "Synthèse vocale indisponible" }, { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
