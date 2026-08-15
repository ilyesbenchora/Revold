import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/cron/monitor";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getAgent, buildSystemPrompt } from "@/lib/ai/agents/registry";
import { runAgentTurn, type ReportSpec, type ChartProposal } from "@/lib/ai/agents/agent-runtime";
import { ROUTINE_REPORT_DIRECTIVE, FREQUENCY_LABELS, type RoutineFrequency } from "@/lib/ai/agents/routine-catalog";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getToolKeysBatch } from "@/lib/integrations/tool-mappings";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { isRoutineRowDue, type RoutineRow } from "@/lib/agents/routines-server";
import { savedReportToRow } from "@/lib/agents/saved-reports-server";

export const maxDuration = 300;

// Un rapport de routine = plusieurs appels d'outils (~30-90 s). On borne le
// batch pour tenir dans les 300 s ; les routines restantes partent au tick
// suivant (cron toutes les 15 min).
const MAX_PER_RUN = 6;

/**
 * Exécution SERVEUR des routines d'agents : les rapports programmés sont
 * générés même si personne n'a Revold ouvert (l'ancien modèle exécutait la
 * routine à l'ouverture de la page — mono-joueur). Pour chaque routine échue :
 * question posée à l'agent avec la directive « rapport visuel », rapport
 * enregistré dans saved_reports (badge Routine, visible par toute l'équipe),
 * notification in-app, last_run_at/last_error mis à jour.
 */
async function handler(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: anthropicKey } = getAnthropicKey();
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });

  // Service role : le cron traverse toutes les orgs (bypass RLS).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("agent_routines")
    .select("*")
    .eq("active", true)
    .order("last_run_at", { ascending: true, nullsFirst: true });
  // Migration non appliquée → no-op silencieux (jamais d'échec de cron).
  if (error) return NextResponse.json({ ok: true, skipped: "table absente" });

  const now = new Date();
  const due = ((data ?? []) as RoutineRow[]).filter((r) => isRoutineRowDue(r, now)).slice(0, MAX_PER_RUN);
  if (due.length === 0) return NextResponse.json({ ok: true, executed: 0 });

  const client = new Anthropic({ apiKey: anthropicKey });
  const results: Array<{ id: string; label: string; ok: boolean; error?: string }> = [];

  for (const routine of due) {
    // ── Claim optimiste : l'occurrence est consommée AVANT l'exécution (pas de
    //    double rapport si deux runs se chevauchent — la condition sur l'ancien
    //    last_run_at fait office de verrou).
    let claim = supabase
      .from("agent_routines")
      .update({ last_run_at: now.toISOString(), last_error: null })
      .eq("id", routine.id);
    claim = routine.last_run_at === null ? claim.is("last_run_at", null) : claim.eq("last_run_at", routine.last_run_at);
    const { data: claimed } = await claim.select("id");
    if (!claimed || claimed.length === 0) continue; // déjà prise par un autre run

    try {
      const agent = getAgent(routine.agent_key);
      if (!agent) throw new Error(`Agent inconnu : ${routine.agent_key}`);

      // Sources de l'agent : même source de vérité que l'UI (Paramètres →
      // Intégrations → Outils sources par agent). Vide = périmètre par défaut.
      const mappingKey = `agent_${routine.agent_key}`;
      const mappings = await getToolKeysBatch(supabase, routine.organization_id, [mappingKey]);
      const sources = mappings[mappingKey] ?? [];

      const hubspotToken = await getHubSpotToken(supabase, routine.organization_id);
      const system =
        buildSystemPrompt(agent) +
        `\n\nSources sélectionnées pour cette conversation : ${sources.length ? sources.join(", ") : "aucune sélection explicite (utilise la source configurée par défaut)"}.`;

      const result = await runAgentTurn({
        client,
        system,
        tools: agent.tools,
        messages: [{ role: "user", content: routine.prompt + ROUTINE_REPORT_DIRECTIVE }],
        ctx: { supabase, orgId: routine.organization_id, hubspotToken, sources },
      });

      const report = (result.report ?? null) as ReportSpec | null;
      const chart = (result.chartProposal ?? null) as ChartProposal | null;
      if (!report && !chart) throw new Error("L'agent n'a pas renvoyé de rapport visuel");
      const title = report?.title || chart?.title || routine.label;

      const { error: saveError } = await supabase.from("saved_reports").insert(
        savedReportToRow(
          {
            agentKey: routine.agent_key,
            agentLabel: agent.label,
            title,
            summary: report?.summary || chart?.summary,
            report,
            chart,
            alert: {
              title,
              description: report?.summary || chart?.summary || `Rapport généré par la routine « ${routine.label} ».`,
              category: "revops",
              channels: [],
            },
            origin: "routine",
            routineLabel: routine.label,
            routineId: routine.id,
            analysis: typeof result.text === "string" ? result.text : undefined,
          },
          routine.organization_id,
          null,
        ),
      );
      if (saveError) throw new Error(`Enregistrement du rapport : ${saveError.message}`);

      await createInAppNotification({
        orgId: routine.organization_id,
        userId: null,
        type: "routine_executed",
        title: `Routine exécutée : ${routine.label}`,
        body: `${agent.label} a généré le rapport « ${title} » (${FREQUENCY_LABELS[routine.frequency as RoutineFrequency] ?? routine.frequency} à ${routine.time_of_day}).`,
        link: `/dashboard/agents/${routine.agent_key}`,
      });

      results.push({ id: routine.id, label: routine.label, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      await supabase
        .from("agent_routines")
        .update({ last_error: message.slice(0, 500) })
        .eq("id", routine.id);
      results.push({ id: routine.id, label: routine.label, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, executed: results.filter((r) => r.ok).length, results });
}

// Monitoring : chaque execution journalisee dans cron_runs (statut, duree, erreur).
export const GET = monitoredCron("run-routines", handler);
