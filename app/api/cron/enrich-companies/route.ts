import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/cron/monitor";
import { createClient } from "@supabase/supabase-js";
import { runEnrichmentBatch } from "@/lib/enrichment/backfill-engine";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { notifyEvent } from "@/lib/notifications/notify-event";

/**
 * Fiches restant à enrichir pour une org (mêmes critères que la page Suivi →
 * Enrichissement) : identités à chercher + effectifs/CA à (re)charger.
 * 0 = le chantier est terminé.
 */
async function remainingForOrg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  orgId: string,
): Promise<number | null> {
  const recheckBefore = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const refreshBefore = new Date(Date.now() - 90 * 86_400_000).toISOString();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = async (apply: (q: any) => any): Promise<number> => {
      const { count: n } = await apply(
        sb.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      );
      return n ?? 0;
    };
    const [identities, facts] = await Promise.all([
      count((q: unknown) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q as any)
          .is("siren", null)
          .not("name", "is", null)
          .is("candidate_siren", null)
          .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`),
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count((q: unknown) => (q as any).not("siren", "is", null).or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)),
    ]);
    return identities + facts;
  } catch {
    return null;
  }
}

export const maxDuration = 300;

/**
 * Enrichissement AUTOMATIQUE de la base (toutes les 5 min, toutes les orgs) —
 * moteur partagé lib/enrichment/backfill-engine, également enchaîné par la page
 * Suivi → Enrichissement tant qu'elle est ouverte (même code, même contrôle
 * qualité : seule la cadence change). ≈ 400 lookups par run soit ~4 800/h : une
 * base de plusieurs milliers d'entreprises est traitée en une à deux heures
 * SANS que personne n'ouvre l'application. Notification par org quand il s'est
 * passé quelque chose.
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
    if (n.identities + n.candidates + n.facts + n.duplicates === 0) continue;
    const parts: string[] = [];
    if (n.identities) parts.push(`${n.identities} identifiant${n.identities > 1 ? "s" : ""} complété${n.identities > 1 ? "s" : ""}`);
    if (n.facts) parts.push(`${n.facts} effectifs/CA mis à jour`);
    if (n.candidates) parts.push(`${n.candidates} à valider`);
    if (n.duplicates) parts.push(`${n.duplicates} doublon${n.duplicates > 1 ? "s" : ""} détecté${n.duplicates > 1 ? "s" : ""}`);
    await createInAppNotification({
      orgId,
      type: "enrichment_auto",
      title: "Enrichissement automatique",
      body: `${parts.join(" · ")} — les correspondances incertaines t'attendent dans Suivi → Enrichissement.`,
      link: "/dashboard/enrichissement",
    });

    // Chantier terminé pour cette org → événement « Enrichissement de données
    // terminé », poussé sur les canaux choisis (Paramètres → Notifications).
    // Le run a forcément avancé (on est dans la branche « il s'est passé
    // quelque chose »), donc pas de notification répétée à vide.
    const remaining = await remainingForOrg(sb, orgId);
    if (remaining === 0) {
      await notifyEvent(sb, {
        orgId,
        eventKey: "enrichment_done",
        sourceType: "enrichment_done",
        subject: "Enrichissement de données terminé",
        bodyText: `${parts.join(" · ")}. Plus aucune fiche en attente : la base est à jour (SIREN, effectifs, CA).`,
        link: "/dashboard/enrichissement",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    lookupsUsed: result.lookupsUsed,
    identities: result.identities,
    candidates: result.candidates,
    facts: result.facts,
    duplicates: result.duplicates,
    remainingIdentities: result.remainingIdentities,
    remainingFacts: result.remainingFacts,
  });
}

// Monitoring : chaque execution journalisee dans cron_runs (statut, duree, erreur).
export const GET = monitoredCron("enrich-companies", handler);
