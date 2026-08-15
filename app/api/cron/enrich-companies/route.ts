import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/cron/monitor";
import { createClient } from "@supabase/supabase-js";
import { runEnrichmentBatch } from "@/lib/enrichment/backfill-engine";
import { createInAppNotification } from "@/lib/notifications/in-app";

export const maxDuration = 300;

/**
 * Enrichissement AUTOMATIQUE de la base (toutes les 10 min, toutes les orgs) —
 * moteur partagé lib/enrichment/backfill-engine (aussi déclenché à la demande
 * depuis Suivi → Enrichissement, « Enrichir toute ma base »). ≈ 400 lookups par
 * run soit ~2 400/h : une base de plusieurs milliers d'entreprises est traitée
 * en quelques heures SANS que personne n'ouvre l'application. Notification par
 * org quand il s'est passé quelque chose.
 */
async function handler(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 400 lookups ≈ 200 s (throttle 200 ms + écritures) — sous maxDuration 300 s.
  const result = await runEnrichmentBatch(sb, { budget: 400 });
  if (result.unavailable) return NextResponse.json({ ok: true, skipped: "migration enrichment_scale absente" });

  for (const [orgId, n] of Object.entries(result.perOrg)) {
    if (n.identities + n.candidates + n.facts === 0) continue;
    const parts: string[] = [];
    if (n.identities) parts.push(`${n.identities} identité${n.identities > 1 ? "s" : ""} complétée${n.identities > 1 ? "s" : ""}`);
    if (n.facts) parts.push(`${n.facts} effectifs/CA mis à jour`);
    if (n.candidates) parts.push(`${n.candidates} à valider`);
    await createInAppNotification({
      orgId,
      type: "enrichment_auto",
      title: "Enrichissement automatique",
      body: `${parts.join(" · ")} — les correspondances incertaines t'attendent dans Suivi → Enrichissement.`,
      link: "/dashboard/enrichissement",
    });
  }

  return NextResponse.json({
    ok: true,
    lookupsUsed: result.lookupsUsed,
    identities: result.identities,
    candidates: result.candidates,
    facts: result.facts,
    remainingIdentities: result.remainingIdentities,
    remainingFacts: result.remainingFacts,
  });
}

// Monitoring : chaque execution journalisee dans cron_runs (statut, duree, erreur).
export const GET = monitoredCron("enrich-companies", handler);
