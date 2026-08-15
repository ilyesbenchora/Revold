export const dynamic = "force-dynamic";

import Link from "next/link";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgent } from "@/lib/ai/agents/registry";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";
import { CoachingAgendaSection } from "@/components/agents/coaching-agenda-section";

/**
 * Suivi → Séances : le CADRAGE en amont d'une séance de travail avec un agent
 * de Mon équipe IA (objectifs, points de douleur, cadence, prochain rendez-vous).
 *
 * Remplace l'ancienne section « Coachs IA » : la mécanique d'accompagnement
 * (mémoire entre séances, engagements, style d'entretien, plan de
 * développement) vit désormais sur les agents experts eux-mêmes — un seul
 * roster, plus de doublon de domaines.
 */

// Agents pouvant tenir une séance, dans l'ordre des priorités dirigeant.
const SESSION_AGENTS = ["performance", "paiement-facturation", "service-client"];

export default async function SeancesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  // Prochains rendez-vous déjà programmés (toutes catégories confondues).
  let upcoming: Array<{ category: string; next_meeting_at: string | null; next_meeting_time: string | null }> = [];
  try {
    const { data } = await supabase
      .from("coaching_agendas")
      .select("category, next_meeting_at, next_meeting_time")
      .eq("organization_id", orgId)
      .not("next_meeting_at", "is", null)
      .order("next_meeting_at", { ascending: true });
    upcoming = (data ?? []) as typeof upcoming;
  } catch {
    /* table absente → page utilisable quand même */
  }

  const agents = SESSION_AGENTS.map((key) => ({ key, def: getAgent(key), persona: getAgentPersona(key) })).filter(
    (a) => a.def,
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Séances</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Cadre une séance de travail avec un agent : ce que tu veux obtenir, ce qui bloque, à quelle fréquence et
          quand. L&apos;agent s&apos;en sert pour ouvrir la séance au bon endroit, garde la mémoire d&apos;une fois sur
          l&apos;autre et suit les engagements pris.
        </p>
      </header>

      {upcoming.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-900">Prochains rendez-vous</p>
          <ul className="mt-2 space-y-1">
            {upcoming.map((u) => {
              const persona = getAgentPersona(u.category);
              const label = getAgent(u.category)?.label ?? u.category;
              return (
                <li key={`${u.category}-${u.next_meeting_at}`} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">
                    {new Date(u.next_meeting_at!).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    {u.next_meeting_time && ` à ${u.next_meeting_time}`}
                  </span>{" "}
                  — {persona.name} · {label}
                  <Link href={`/dashboard/agents/${u.category}`} className="ml-2 text-accent hover:underline">
                    Ouvrir la séance →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {agents.map((a) => (
        <CoachingAgendaSection key={a.key} agentKey={a.key} />
      ))}

      <p className="text-[11px] text-slate-400">
        Le style d&apos;échange (direct et chiffré, ou pédagogue) se règle agent par agent depuis sa page — il
        s&apos;adapte à qui l&apos;utilise : un dirigeant et un manager n&apos;attendent pas la même chose.
      </p>
    </section>
  );
}
