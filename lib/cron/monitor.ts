import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Monitoring des crons : `monitoredCron(name, handler)` wrappe un handler GET
 * de cron et journalise chaque exécution dans la table cron_runs (statut,
 * durée, résumé JSON, erreur). En cas d'échec (exception OU statut HTTP
 * non-2xx), une alerte Slack part sur SLACK_OPS_WEBHOOK si configuré.
 *
 * Best-effort STRICT : le monitoring ne fait JAMAIS échouer le cron —
 * table absente (migration non appliquée), env manquante ou erreur réseau
 * sont avalées en silence.
 */

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

async function slackAlert(name: string, message: string): Promise<void> {
  const url = process.env.SLACK_OPS_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🔴 Cron Revold « ${name} » en échec : ${message.slice(0, 500)}` }),
    });
  } catch {
    /* best-effort */
  }
}

/** Résumé JSON stocké — borné pour ne pas gonfler la table. */
function capDetail(detail: unknown): unknown {
  try {
    const s = JSON.stringify(detail);
    if (!s) return null;
    return s.length > 8000 ? { truncated: true, size: s.length } : detail;
  } catch {
    return null;
  }
}

export function monitoredCron<Req extends Request>(
  name: string,
  handler: (request: Req) => Promise<Response>,
): (request: Req) => Promise<Response> {
  return async (request: Req): Promise<Response> => {
    const sb = admin();
    const startedAt = Date.now();
    let runId: string | null = null;
    if (sb) {
      try {
        const { data } = await sb
          .from("cron_runs")
          .insert({ cron: name, status: "running", started_at: new Date(startedAt).toISOString() })
          .select("id")
          .single();
        runId = (data?.id as string | undefined) ?? null;
      } catch {
        /* table absente / réseau → monitoring muet */
      }
    }

    const finish = async (status: "ok" | "failed", detail: unknown, error: string | null) => {
      if (!sb || !runId) return;
      try {
        await sb
          .from("cron_runs")
          .update({
            status,
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            detail: capDetail(detail),
            error,
          })
          .eq("id", runId);
      } catch {
        /* best-effort */
      }
    };

    try {
      const res = await handler(request);
      let detail: unknown = null;
      try {
        detail = await res.clone().json();
      } catch {
        /* réponse non-JSON → pas de résumé */
      }
      if (res.ok) {
        await finish("ok", detail, null);
      } else {
        await finish("failed", detail, `HTTP ${res.status}`);
        await slackAlert(name, `HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finish("failed", null, message.slice(0, 1000));
      await slackAlert(name, message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
