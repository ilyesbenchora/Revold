/**
 * Mémoire de coaching entre les séances.
 *
 * À la clôture d'une séance, l'agent produit un DÉBRIEF structuré (résumé +
 * plan d'action 2-3 engagements datés) persisté en base :
 *   - coaching_sessions.summary          → résumé de la séance
 *   - coaching_commitments               → engagements suivis (pending/done/dropped)
 *
 * À la séance suivante, getCoachingMemory() + memoryDirective() injectent ce
 * contexte dans le prompt du coach : il ouvre en faisant le point sur les
 * engagements avant de proposer les pistes du jour. La boucle est fermée —
 * le coaching devient un suivi continu, pas des conversations isolées.
 *
 * Résilience : si la migration 20260725000001_coaching_memory n'est pas encore
 * appliquée (colonne summary / table coaching_commitments absentes), tout
 * échoue en silence — la clôture de séance n'est jamais bloquée.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";

export type CoachingCommitment = {
  id: string;
  title: string;
  detail: string | null;
  due_date: string | null;
  status: "pending" | "done" | "dropped";
  created_at: string;
  completed_at: string | null;
};

export type CoachingMemory = {
  lastSummary: string | null;
  lastEndedAt: string | null;
  openCommitments: CoachingCommitment[];
  recentlyDone: CoachingCommitment[];
};

const DEBRIEF_TOOL: Anthropic.Tool = {
  name: "debrief_session",
  description:
    "Débriefe la séance de coaching qui vient de se terminer : résumé fidèle (décisions, chiffres clés, " +
    "orientation retenue) + plan d'action de 1 à 3 engagements CONCRETS et vérifiables pris pendant la séance. " +
    "N'invente aucun engagement : uniquement ce qui a réellement été discuté ou décidé.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "Résumé de la séance en 3-5 phrases : sujet travaillé, diagnostic posé (avec les chiffres cités), décision/orientation retenue.",
      },
      commitments: {
        type: "array",
        description: "1 à 3 engagements concrets pris pendant la séance (0 si aucune action n'a été décidée).",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Action courte et vérifiable (ex : « Relancer les 5 deals > 30 jours sans activité »)." },
            detail: { type: "string", description: "Contexte/critère de succès en 1 phrase (optionnel)." },
            due_date: { type: "string", description: "Échéance YYYY-MM-DD si une date a été évoquée, sinon vide." },
          },
          required: ["title"],
        },
      },
    },
    required: ["summary", "commitments"],
  },
};

/**
 * Résume la séance et persiste résumé + engagements. Best-effort : retourne
 * null si l'agent ou la base échouent (la clôture de séance n'est pas bloquée).
 */
export async function summarizeAndStoreSession(
  supabase: SupabaseClient,
  orgId: string,
  category: string,
  sessionRowId: string | null,
  messages: { role: string; content: string }[],
): Promise<{ summary: string; commitments: { title: string; detail: string | null; due_date: string | null }[] } | null> {
  const { key: anthropicKey } = getAnthropicKey();
  if (!anthropicKey || messages.length < 2) return null;

  const transcript = messages
    .slice(-30)
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Coach"} : ${m.content}`)
    .join("\n\n")
    .slice(0, 60_000);

  let summary = "";
  let commitments: { title: string; detail: string | null; due_date: string | null }[] = [];
  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system:
        "Tu es un coach revenue B2B chez Revold. Tu débriefes une séance de coaching terminée pour préparer la suivante. " +
        "Sois fidèle au transcript : ne surinterprète pas, n'invente ni chiffre ni engagement. Réponds uniquement via l'outil.",
      tools: [DEBRIEF_TOOL],
      tool_choice: { type: "tool", name: "debrief_session" },
      messages: [{ role: "user", content: `Transcript de la séance :\n\n${transcript}\n\nDébriefe cette séance.` }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return null;
    const inp = toolUse.input as {
      summary?: string;
      commitments?: { title?: string; detail?: string; due_date?: string }[];
    };
    summary = (inp.summary ?? "").trim();
    commitments = (inp.commitments ?? [])
      .filter((c) => typeof c.title === "string" && c.title.trim().length > 0)
      .slice(0, 3)
      .map((c) => ({
        title: c.title!.trim().slice(0, 300),
        detail: c.detail?.trim().slice(0, 600) || null,
        due_date: c.due_date && /^\d{4}-\d{2}-\d{2}$/.test(c.due_date) ? c.due_date : null,
      }));
  } catch {
    return null;
  }
  if (!summary) return null;

  // Persistance best-effort (migration potentiellement non appliquée).
  if (sessionRowId) {
    await supabase.from("coaching_sessions").update({ summary }).eq("id", sessionRowId).eq("organization_id", orgId);
  }
  if (commitments.length > 0) {
    await supabase.from("coaching_commitments").insert(
      commitments.map((c) => ({
        organization_id: orgId,
        category,
        session_id: sessionRowId,
        title: c.title,
        detail: c.detail,
        due_date: c.due_date,
      })),
    );
  }
  return { summary, commitments };
}

/** Charge la mémoire de coaching d'une catégorie (dernier résumé + engagements). */
export async function getCoachingMemory(
  supabase: SupabaseClient,
  orgId: string,
  category: string,
): Promise<CoachingMemory> {
  const empty: CoachingMemory = { lastSummary: null, lastEndedAt: null, openCommitments: [], recentlyDone: [] };
  try {
    const [{ data: sessions }, { data: rows }] = await Promise.all([
      supabase
        .from("coaching_sessions")
        .select("summary, ended_at")
        .eq("organization_id", orgId)
        .eq("category", category)
        .not("summary", "is", null)
        .order("ended_at", { ascending: false })
        .limit(1),
      supabase
        .from("coaching_commitments")
        .select("id, title, detail, due_date, status, created_at, completed_at")
        .eq("organization_id", orgId)
        .eq("category", category)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const last = sessions?.[0] as { summary: string | null; ended_at: string | null } | undefined;
    const commitments = (rows ?? []) as CoachingCommitment[];
    return {
      lastSummary: last?.summary ?? null,
      lastEndedAt: last?.ended_at ?? null,
      openCommitments: commitments.filter((c) => c.status === "pending"),
      recentlyDone: commitments.filter((c) => c.status === "done").slice(0, 5),
    };
  } catch {
    return empty;
  }
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : null;

/** Bloc de prompt injecté au coach quand une mémoire existe ("" sinon). */
export function memoryDirective(memory: CoachingMemory): string {
  if (!memory.lastSummary && memory.openCommitments.length === 0) return "";
  const parts: string[] = ["\n\nMÉMOIRE DE COACHING (séances précédentes — utilise-la, ne la réexplique pas à l'utilisateur) :"];
  if (memory.lastSummary) {
    parts.push(`Dernière séance${memory.lastEndedAt ? ` (${fmtDate(memory.lastEndedAt)})` : ""} : ${memory.lastSummary}`);
  }
  if (memory.openCommitments.length > 0) {
    parts.push(
      "Engagements EN COURS pris lors des séances précédentes :\n" +
        memory.openCommitments
          .map((c) => `- ${c.title}${c.due_date ? ` (échéance ${fmtDate(c.due_date)})` : ""}${c.detail ? ` — ${c.detail}` : ""}`)
          .join("\n"),
    );
  }
  if (memory.recentlyDone.length > 0) {
    parts.push("Engagements récemment ACCOMPLIS : " + memory.recentlyDone.map((c) => c.title).join(" · "));
  }
  parts.push(
    "Méthode : intègre ce point d'étape À L'INTÉRIEUR de ta contextualisation d'ouverture (engagements en cours : fait / " +
      "pas fait / blocage ?), AVANT de livrer le plan d'action de la séance. Relie le plan à ce qui a déjà été décidé — " +
      "tu es dans un suivi continu, pas une première rencontre. En fin de séance, propose 1 à 3 nouveaux engagements concrets.",
  );
  return parts.join("\n");
}
