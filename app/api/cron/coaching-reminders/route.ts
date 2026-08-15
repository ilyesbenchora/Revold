import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/cron/monitor";
import { createClient } from "@supabase/supabase-js";
import { notifyEvent } from "@/lib/notifications/notify-event";

export const maxDuration = 120;

/**
 * RAPPELS INTELLIGENTS DE COACHING — déclenchés par l'état réel du programme,
 * pas par un simple calendrier :
 *  1. séance prévue demain ou aujourd'hui (coaching_agendas) ;
 *  2. engagement de séance dépassé (coaching_commitments) ;
 *  3. étape de développement en retard — le message porte l'évolution du KPI
 *     témoin depuis l'ouverture du plan, pour dire s'il faut agir ou ajuster.
 * Chaque rappel passe par notifyEvent : l'utilisateur choisit ses canaux dans
 * Paramètres → Notifications.
 */
const COACH_BY_CATEGORY: Record<string, string> = {
  commercial: "coaching-ventes",
  marketing: "coaching-marketing",
  data: "coaching-data",
  "data-model": "coaching-data-model",
};
const coachLink = (category: string) => `/dashboard/agents/${COACH_BY_CATEGORY[category] ?? "coaching-ventes"}`;

async function handler(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  let sent = 0;

  // ── 1. Séances prévues aujourd'hui / demain ──
  try {
    const { data: agendas } = await supabase
      .from("coaching_agendas")
      .select("organization_id, category, objectives, next_meeting_at, next_meeting_time")
      .in("next_meeting_at", [today, tomorrow]);
    for (const a of (agendas ?? []) as Array<{ organization_id: string; category: string; objectives: string | null; next_meeting_at: string; next_meeting_time: string | null }>) {
      const when = a.next_meeting_at === today ? "aujourd'hui" : "demain";
      sent += await notifyEvent(supabase, {
        orgId: a.organization_id,
        eventKey: "coaching_meeting_due",
        sourceType: "coaching_meeting_due",
        subject: `Séance de coaching ${when}${a.next_meeting_time ? ` à ${a.next_meeting_time}` : ""}`,
        bodyText: [
          `Ta séance de coaching a lieu ${when}${a.next_meeting_time ? ` à ${a.next_meeting_time}` : ""}.`,
          a.objectives ? `Objectif de la séance : ${a.objectives.slice(0, 300)}` : "",
          "Ouvre ton coach pour démarrer : il a déjà préparé le point sur tes engagements.",
        ]
          .filter(Boolean)
          .join("\n"),
        link: coachLink(a.category),
      });
    }
  } catch {
    /* jamais bloquant */
  }

  // ── 2. Engagements dépassés ──
  try {
    const { data: commits } = await supabase
      .from("coaching_commitments")
      .select("id, organization_id, category, title, due_date")
      .eq("status", "pending")
      .lt("due_date", today)
      .limit(200);
    for (const c of (commits ?? []) as Array<{ id: string; organization_id: string; category: string; title: string; due_date: string }>) {
      const days = Math.floor((Date.parse(today) - Date.parse(c.due_date)) / 86_400_000);
      // Un seul rappel : à J+1, puis à J+7 — pas de harcèlement quotidien.
      if (days !== 1 && days !== 7) continue;
      sent += await notifyEvent(supabase, {
        orgId: c.organization_id,
        eventKey: "coaching_commitment_overdue",
        sourceType: "coaching_commitment_overdue",
        sourceId: c.id,
        subject: `Engagement de coaching en retard : ${c.title.slice(0, 80)}`,
        bodyText: [
          `L'action « ${c.title} » décidée en séance devait être faite le ${c.due_date} (${days} jour${days > 1 ? "s" : ""} de retard).`,
          "Marque-la comme faite ou abandonne-la depuis ton plan d'action — ton coach en tiendra compte à la prochaine séance.",
        ].join("\n"),
        link: coachLink(c.category),
      });
    }
  } catch {
    /* tables absentes → rien */
  }

  // ── 3. Étapes de développement en retard, avec la preuve business ──
  try {
    const { data: steps } = await supabase
      .from("development_steps")
      .select("id, organization_id, plan_id, title, due_date, status")
      .in("status", ["todo", "doing"])
      .lt("due_date", today)
      .limit(200);
    const stepRows = (steps ?? []) as Array<{ id: string; organization_id: string; plan_id: string; title: string; due_date: string }>;
    if (stepRows.length > 0) {
      const { data: plans } = await supabase
        .from("development_plans")
        .select("id, title, category, objective_id, baseline_value, status")
        .in("id", [...new Set(stepRows.map((s) => s.plan_id))]);
      const planById = new Map(
        ((plans ?? []) as Array<{ id: string; title: string; category: string; objective_id: string | null; baseline_value: number | null; status: string }>)
          .map((p) => [p.id, p]),
      );
      const objIds = [...new Set([...planById.values()].map((p) => p.objective_id).filter((x): x is string => !!x))];
      const { data: objs } = objIds.length
        ? await supabase.from("objectives").select("id, title, current_value, target, unit_mode").in("id", objIds)
        : { data: [] };
      const objById = new Map(
        ((objs ?? []) as Array<{ id: string; title: string; current_value: number | null; target: number | null; unit_mode: string | null }>)
          .map((o) => [o.id, o]),
      );

      for (const s of stepRows) {
        const plan = planById.get(s.plan_id);
        if (!plan || plan.status !== "active") continue;
        const days = Math.floor((Date.parse(today) - Date.parse(s.due_date)) / 86_400_000);
        if (days !== 3 && days !== 10) continue; // rappel espacé, pas quotidien
        const obj = plan.objective_id ? objById.get(plan.objective_id) : null;
        let witness = "";
        if (obj) {
          const delta =
            obj.current_value != null && plan.baseline_value != null
              ? Math.round((obj.current_value - plan.baseline_value) * 100) / 100
              : null;
          witness =
            delta == null
              ? `KPI témoin : ${obj.title}.`
              : delta === 0
                ? `KPI témoin « ${obj.title} » : inchangé depuis l'ouverture du plan — c'est le signe qu'il faut ajuster le plan, pas seulement rattraper l'étape.`
                : `KPI témoin « ${obj.title} » : ${delta > 0 ? "+" : ""}${delta} depuis l'ouverture du plan.`;
        }
        sent += await notifyEvent(supabase, {
          orgId: s.organization_id,
          eventKey: "development_step_stalled",
          sourceType: "development_step_stalled",
          sourceId: s.id,
          subject: `Étape en retard : ${s.title.slice(0, 80)}`,
          bodyText: [
            `Plan de développement « ${plan.title} » : l'étape « ${s.title} » devait être franchie le ${s.due_date} (${days} jours de retard).`,
            witness,
            "Ouvre ton coach pour débloquer l'étape ou revoir le plan.",
          ]
            .filter(Boolean)
            .join("\n"),
          link: coachLink(plan.category),
        });
      }
    }
  } catch {
    /* tables absentes → rien */
  }

  return NextResponse.json({ ok: true, sent });
}

export const GET = monitoredCron("coaching-reminders", handler);
