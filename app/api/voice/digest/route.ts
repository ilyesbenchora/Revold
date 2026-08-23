import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { computeBillingRadar } from "@/lib/audit/billing-radar";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { narrateForVoice, firstNameFromUser } from "@/lib/voice/narrate";

/** Libellé lisible d'un provider (« pennylane » → « Pennylane »). */
function toolLabel(key: string): string {
  return CONNECTABLE_TOOLS[key]?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Entités du modèle alimentées par les outils de facturation/banque : leur
 *  table porte primary_source (pennylane, stripe…) — on NOMME la source. */
const BILLING_ENTITY_TABLES: Record<string, string> = {
  invoices: "invoices",
  subscriptions: "subscriptions",
  bank_transactions: "bank_transactions",
  payments: "payments",
};

/** Format lisible à voix haute d'une valeur (unit_mode d'alerte/objectif ou unité custom). */
function fmtCustomValue(v: number, unit: string | null): string {
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
  return new Intl.NumberFormat("fr-FR").format(v);
}

/** Date courte lisible à voix haute (« 12 septembre »). */
function dateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export const dynamic = "force-dynamic";

/**
 * Brief de la tour de contrôle vocale (orbe de la home) — 100 % DÉTERMINISTE
 * (aucun LLM : fiable, instantané, gratuit) :
 *  - alertes actives en tension (valeur actuelle face au seuil — alertes
 *    techniques comprises, elles vivent dans la même table avec source_key) ;
 *  - objectifs qui décrochent ou atteints (progression chiffrée, échéance) ;
 *  - radar de facturation (nombre, montant, clients concernés) ;
 *  - synchronisations en échec (outil + date du run).
 * Chaque famille de données est ANNONCÉE (« Côté alertes… », « Facturation… »)
 * pour que l'écoute suive les transitions — pas une dictée monotone.
 * `?mode=veille` : exceptions uniquement (alertes critiques + syncs en échec).
 * `?sections=alerts,objectives,syncs` : contenu personnalisé du brief
 * (Paramètres → Tour de contrôle) — les sections absentes ne sont pas lues.
 * Renvoie aussi le STATUT de santé qui teinte l'anneau de l'orbe (calculé sur
 * TOUTES les données, indépendamment des sections choisies).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Tour de contrôle vocale : réservée aux plans Business et Scale.
  const plan = await getOrgPlan(supabase, orgId);
  if (featureLocked(plan, "voice_control_tower")) {
    return NextResponse.json({ error: "La tour de contrôle vocale est disponible à partir du plan Business." }, { status: 403 });
  }

  const url = new URL(request.url);
  const veille = url.searchParams.get("mode") === "veille";
  // narrate=1 : le brief va être LU → mise en récit par l'agent. Jamais posé
  // par le polling de statut de l'orbe (anneau de santé), qui doit rester
  // instantané et gratuit.
  const narrate = url.searchParams.get("narrate") === "1";
  // Accomplissements DÉJÀ ENTENDUS (clés acquittées par l'orbe) : jamais
  // répétés — le brief n'annonce que les nouvelles atteintes/exécutions.
  const ack = new Set((url.searchParams.get("ack") ?? "").split(",").filter(Boolean));
  // Sections choisies dans Paramètres → Tour de contrôle (défaut : toutes).
  const sectionsParam = url.searchParams.get("sections");
  const sections = new Set(
    sectionsParam != null
      ? sectionsParam.split(",").filter(Boolean)
      : ["alerts", "radar", "objectives", "objectives_reached", "syncs", "enrichment", "actions_done"],
  );
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86400 * 1000).toISOString().slice(0, 10);

  const [alertsRes, objectivesRes, syncRes] = await Promise.all([
    // unit_mode → chiffres lisibles (€ / %) ; source_key → alertes TECHNIQUES
    // (posées sur une tuile/bloc/table), lues avec les alertes classiques.
    supabase
      .from("alerts")
      .select("title, severity, threshold, direction, current_value, unit_mode, source_key")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(200),
    supabase
      .from("objectives")
      .select("id, title, target, current_value, direction, date_to, unit_mode")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(100),
    supabase
      .from("sync_logs")
      .select("source, status, started_at")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(60),
  ]);

  // ── Outil CRM connecté (HubSpot…) : nommé dans le brief — une organisation
  //    peut connecter beaucoup d'outils, on dit toujours OÙ ça s'est passé. ──
  let crmLabel: string | null = null;
  try {
    const { data: ints } = await supabase
      .from("integrations")
      .select("provider")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .limit(50);
    const crm = (ints ?? [])
      .map((i) => i.provider as string)
      .find((p) => CONNECTABLE_TOOLS[p]?.category === "crm");
    if (crm) crmLabel = toolLabel(crm);
  } catch {}

  // ── Alertes en tension : seuil atteint sur la dernière valeur connue ──
  type AlertRow = {
    title: string;
    severity: string | null;
    threshold: number | null;
    direction: string | null;
    current_value: number | null;
    unit_mode: string | null;
    source_key: string | null;
  };
  const alerts = (alertsRes.data ?? []) as AlertRow[];
  const tense = alerts.filter(
    (a) => a.threshold != null && a.current_value != null && isThresholdMet(a.current_value, a.threshold, a.direction ?? "above"),
  );
  const tenseCritical = tense.filter((a) => a.severity === "critical");
  const tenseTechnical = tense.filter((a) => a.source_key != null);

  // ── Objectifs qui décrochent ──
  type ObjRow = {
    id: string;
    title: string;
    target: number | null;
    current_value: number | null;
    direction: string | null;
    date_to: string | null;
    unit_mode: string | null;
  };
  const objectives = (objectivesRes.data ?? []) as ObjRow[];
  const objectivePct = (o: ObjRow): number | null => {
    if (o.target == null || o.current_value == null || o.target === 0) return null;
    return (o.direction === "below" ? (o.current_value > 0 ? o.target / o.current_value : 1) : o.current_value / o.target) * 100;
  };
  const offTrack = objectives.filter((o) => {
    const pct = objectivePct(o);
    const deadlineSoon = !!o.date_to && o.date_to <= in30d;
    return pct != null && pct < 60 && deadlineSoon;
  });

  // ── Objectifs ATTEINTS : cible franchie (≥ 100 %) sur un objectif actif ──
  const reached = objectives.filter((o) => {
    const pct = objectivePct(o);
    return pct != null && pct >= 100;
  });

  // ── Syncs en échec : dernier run par outil ──
  type SyncRow = { source: string; status: string; started_at: string | null };
  const lastBySource = new Map<string, SyncRow>();
  for (const s of (syncRes.data ?? []) as SyncRow[]) {
    if (!lastBySource.has(s.source)) lastBySource.set(s.source, s);
  }
  const failedSyncs = [...lastBySource.values()].filter((s) => s.status === "failed");

  // ── Radar de facturation : factures attendues non émises (rythme observé /
  //    fin de contrat CRM) — une exception de trésorerie, lue avec les alertes. ──
  let radarOverdue = 0;
  let radarAmount = 0;
  let radarTop: string[] = [];
  try {
    const radar = await computeBillingRadar(supabase, orgId, 1000);
    radarOverdue = radar.overdue.length;
    radarAmount = radar.overdueAmount;
    // Les 2 plus gros clients concernés (triés par montant habituel) : le
    // brief NOMME où est l'argent au lieu d'un simple compteur.
    radarTop = radar.overdue
      .slice(0, 2)
      .map((i) => `${i.companyName}${i.usualAmount ? ` (${fmtCustomValue(i.usualAmount, "currency")} habituels)` : ""}`);
  } catch {}

  // ── Enrichissement de données : reste-t-il des fiches à traiter ? ──
  //    « Terminé » = plus aucune entreprise en attente d'identité ni de faits.
  let enrichmentRemaining: number | null = null;
  let enrichmentDone = 0;
  if (sections.has("enrichment")) {
    try {
      const recheckBefore = new Date(now.getTime() - 30 * 86400 * 1000).toISOString();
      const refreshBefore = new Date(now.getTime() - 90 * 86400 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countCompanies = async (apply: (q: any) => any): Promise<number> => {
        const { count } = await apply(
          supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        );
        return count ?? 0;
      };
      const [identities, facts, enriched] = await Promise.all([
        // Identités restant à chercher (mêmes critères que la page Enrichissement).
        countCompanies((q) =>
          q
            .is("siren", null)
            .not("name", "is", null)
            .is("candidate_siren", null)
            .or(`sirene_checked_at.is.null,sirene_checked_at.lt.${recheckBefore}`),
        ),
        // Effectifs / CA restant à (re)charger.
        countCompanies((q) => q.not("siren", "is", null).or(`enriched_at.is.null,enriched_at.lt.${refreshBefore}`)),
        countCompanies((q) => q.not("siren", "is", null)),
      ]);
      enrichmentRemaining = identities + facts;
      enrichmentDone = enriched;
    } catch {
      enrichmentRemaining = null;
    }
  }

  // ── Actions exécutées dans les outils sur les dernières 24 h ──
  let actionsDone = 0;
  let actionsAuto = 0;
  let actionsSample: string[] = [];
  let actionsLatestAt: string | null = null;
  if (sections.has("actions_done")) {
    try {
      const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      const { data: doneRows } = await supabase
        .from("action_items")
        .select("title, decided_by, decided_at")
        .eq("organization_id", orgId)
        .eq("status", "executed")
        .gte("decided_at", since)
        .limit(500);
      const rows = (doneRows ?? []) as Array<{ title: string | null; decided_by: string | null; decided_at: string | null }>;
      actionsDone = rows.length;
      actionsAuto = rows.filter((r) => !r.decided_by).length;
      actionsSample = rows.map((r) => r.title?.trim()).filter((t): t is string => !!t).slice(0, 2);
      // Dernière exécution : identifie la « fournée » (clé d'acquittement de l'orbe).
      actionsLatestAt = rows.map((r) => r.decided_at).filter((d): d is string => !!d).sort().pop() ?? null;
    } catch {}
  }

  // ── Données personnalisées du brief (KPIs câblés dans Paramètres → Tour de
  //    contrôle) : recalculées EN DIRECT via le même moteur déterministe que
  //    les tables de données. Best-effort : un KPI en erreur est simplement omis.
  type CustomItem = {
    label?: string;
    enabled?: boolean;
    unit?: string | null;
    query?: { entity?: string; groupBy?: string; measure?: string; field?: string | null };
  };
  let customParts: string[] = [];
  try {
    const { data: settingsRow } = await supabase
      .from("voice_tower_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();
    const rawItems = (settingsRow?.settings as { briefCustom?: unknown } | null)?.briefCustom;
    const enabled = (Array.isArray(rawItems) ? (rawItems as CustomItem[]) : [])
      .filter((i) => i?.enabled !== false && i?.label && i?.query?.entity && i?.query?.groupBy && i?.query?.measure)
      .slice(0, 8);
    if (enabled.length > 0) {
      const hubspotToken = await getHubSpotToken(supabase, orgId);
      // Source de chaque entité NOMMÉE dans le brief (« via Pennylane ») :
      // entités billing/banque → primary_source réel des lignes ; sinon CRM.
      const entitySource = async (entity: string): Promise<string | null> => {
        const table = BILLING_ENTITY_TABLES[entity];
        if (!table) return crmLabel;
        try {
          const { data } = await supabase
            .from(table)
            .select("primary_source")
            .eq("organization_id", orgId)
            .not("primary_source", "is", null)
            .limit(100);
          const uniq = [...new Set((data ?? []).map((r) => r.primary_source as string))];
          return uniq.length > 0 ? uniq.map(toolLabel).join(" + ") : crmLabel;
        } catch {
          return crmLabel;
        }
      };
      const computed = await Promise.all(
        enabled.map(async (i) => {
          try {
            const result = await computeAggregate(supabase, orgId, [], hubspotToken, {
              entity: i.query!.entity!,
              groupBy: i.query!.groupBy!,
              measure: i.query!.measure!,
              field: i.query!.field ?? null,
              pipeline: null,
              granularity: null,
              date_from: null,
              date_to: null,
            });
            if (result.error) return null;
            const rows = ((result.rows as { value?: number }[] | undefined) ?? []);
            const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
            const src = await entitySource(i.query!.entity!);
            return `${i.label}${src ? `, via ${src}` : ""} : ${fmtCustomValue(total, i.unit ?? null)}`;
          } catch {
            return null;
          }
        }),
      );
      customParts = computed.filter((p): p is string => p !== null);
    }
  } catch {
    /* réglages absents (migration) ou moteur indisponible → brief sans custom */
  }

  // ── Statut de santé (teinte l'anneau de l'orbe) ──
  const status: "ok" | "warn" | "critical" =
    tenseCritical.length > 0 || failedSyncs.length > 0
      ? "critical"
      : tense.length > 0 || offTrack.length > 0 || radarOverdue > 0
        ? "warn"
        : "ok";

  // ── Texte du brief, prêt à lire à voix haute ──
  // Chaque famille de données est ANNONCÉE (« Côté alertes… », « Sur la
  // facturation… ») : à l'écoute, on suit les transitions au lieu d'une dictée
  // monotone — puis les CHIFFRES : valeur face au seuil, progression, montants.
  const parts: string[] = [];
  if (sections.has("alerts") && tense.length > 0) {
    // Détail chiffré des 3 premières : « MRR à 42 000 € (seuil 45 000 €) ».
    const details = tense
      .slice(0, 3)
      .map((a) => `${a.title} à ${fmtCustomValue(a.current_value!, a.unit_mode)} pour un seuil à ${fmtCustomValue(a.threshold!, a.unit_mode)}`)
      .join(" ; ");
    const qualif = [
      tenseCritical.length > 0 ? `${tenseCritical.length} critique${tenseCritical.length > 1 ? "s" : ""}` : null,
      tenseTechnical.length > 0 ? `${tenseTechnical.length} technique${tenseTechnical.length > 1 ? "s" : ""}` : null,
    ].filter(Boolean);
    parts.push(
      `Côté alertes : ${tense.length} en tension${qualif.length > 0 ? ` dont ${qualif.join(" et ")}` : ""} — ${details}${tense.length > 3 ? ` ; et ${tense.length - 3} autre${tense.length - 3 > 1 ? "s" : ""}` : ""}.`,
    );
  }
  if (sections.has("radar") && radarOverdue > 0) {
    parts.push(
      `Sur la facturation : ${radarOverdue} facture${radarOverdue > 1 ? "s" : ""} attendue${radarOverdue > 1 ? "s" : ""} non émise${radarOverdue > 1 ? "s" : ""}${radarAmount > 0 ? `, environ ${fmtCustomValue(radarAmount, "currency")} à facturer` : ""}${radarTop.length > 0 ? ` — en premier ${radarTop.join(" et ")}` : ""}. Le détail est sur la page Trésorerie.`,
    );
  }
  if (sections.has("syncs") && failedSyncs.length > 0) {
    const list = failedSyncs
      .map((s) => `${s.source}${dateFr(s.started_at) ? ` depuis le ${dateFr(s.started_at)}` : ""}`)
      .join(", ");
    parts.push(`Côté connexions : synchronisation en échec pour ${list} — données figées, à relancer depuis les intégrations.`);
  }
  if (!veille) {
    if (sections.has("objectives") && offTrack.length > 0) {
      // « CA T3 : 61 000 € sur 100 000 € (61 %), échéance le 30 septembre ».
      const details = offTrack
        .slice(0, 2)
        .map((o) => {
          const pct = objectivePct(o);
          return `${o.title} à ${fmtCustomValue(o.current_value!, o.unit_mode)} sur ${fmtCustomValue(o.target!, o.unit_mode)} visé${pct != null ? ` (${Math.round(pct)} %)` : ""}${dateFr(o.date_to) ? `, échéance le ${dateFr(o.date_to)}` : ""}`;
        })
        .join(" ; ");
      parts.push(`Côté objectifs : ${offTrack.length} en retard à moins de 30 jours de l'échéance — ${details}.`);
    }
    // Atteintes/exécutions : SEULEMENT les nouvelles — un accomplissement déjà
    // entendu (clé acquittée par l'orbe) n'est jamais répété.
    const newReached = reached.filter((o) => !ack.has(`obj:${o.id}`));
    if (sections.has("objectives_reached") && newReached.length > 0) {
      const details = newReached
        .slice(0, 3)
        .map((o) => `${o.title} (${fmtCustomValue(o.current_value!, o.unit_mode)} pour ${fmtCustomValue(o.target!, o.unit_mode)} visé)`)
        .join(", ");
      parts.push(`Bonne nouvelle côté objectifs : ${newReached.length} atteint${newReached.length > 1 ? "s" : ""} — ${details}.`);
    }
    // Enrichissement : on ne parle que des deux états qui appellent une
    // décision — c'est fini (annoncé UNE fois), ou il reste du travail en cours.
    if (sections.has("enrichment") && enrichmentRemaining != null) {
      if (enrichmentRemaining === 0 && enrichmentDone > 0 && !ack.has(`enrichment:${enrichmentDone}`)) {
        parts.push(`Sur la donnée : enrichissement terminé sur ${crmLabel ?? "ton CRM"}, ${enrichmentDone} entreprise${enrichmentDone > 1 ? "s" : ""} identifiée${enrichmentDone > 1 ? "s" : ""} via l'API Sirene — plus rien en attente.`);
      } else if (enrichmentRemaining > 0) {
        parts.push(`Sur la donnée : enrichissement en cours, ${enrichmentRemaining} fiche${enrichmentRemaining > 1 ? "s" : ""} ${crmLabel ? `${crmLabel} ` : ""}encore à traiter.`);
      }
    }
    if (sections.has("actions_done") && actionsDone > 0 && !(actionsLatestAt && ack.has(`actions:${actionsLatestAt}`))) {
      parts.push(
        `Côté actions : ${actionsDone} exécutée${actionsDone > 1 ? "s" : ""} dans ${crmLabel ?? "tes outils"} depuis hier${actionsAuto > 0 ? `, dont ${actionsAuto} en automatique` : ""}${actionsSample.length > 0 ? ` — par exemple ${actionsSample.join(" et ")}` : ""}.`,
      );
    }
    // Indicateurs suivis (Paramètres → Tour de contrôle) : valeurs en direct,
    // chaque chiffre porte sa source (« via Pennylane »).
    if (customParts.length > 0) parts.push(`Côté chiffres suivis : ${customParts.join(" ; ")}.`);
    if (parts.length === 0) parts.push("Rien à signaler sur le périmètre de ton brief — tout est au vert.");
  } else if (parts.length === 0) {
    parts.push("Mode veille : aucune exception — tout est au vert.");
  }

  // ── Contenus du brief COCHÉS finalisés/exécutés/atteints (orbe verte) ──
  // Chaque accomplissement porte une CLÉ stable : l'orbe acquitte ces clés à
  // l'écoute du brief (elle redevient fuchsia) et ne repasse au vert que pour
  // une clé NOUVELLE — nouvel objectif atteint, nouvelle fournée d'actions
  // exécutées, enrichissement re-terminé. Sections décochées = jamais de clé.
  const achievedKeys: string[] = [];
  if (sections.has("objectives_reached")) for (const o of reached) achievedKeys.push(`obj:${o.id}`);
  if (sections.has("actions_done") && actionsDone > 0 && actionsLatestAt) achievedKeys.push(`actions:${actionsLatestAt}`);
  if (sections.has("enrichment") && enrichmentRemaining === 0 && enrichmentDone > 0) {
    achievedKeys.push(`enrichment:${enrichmentDone}`);
  }
  const achieved = achievedKeys.length > 0;

  // ── Mise en récit parlée (lecture uniquement) : l'app a calculé, l'agent
  // raconte — contexte, transitions, rythme posé. Repli : texte déterministe.
  let text = parts.join(" ");
  if (narrate) {
    const narrated = await narrateForVoice({ kind: "brief", firstName: firstNameFromUser(user), facts: text });
    if (narrated) text = narrated;
  }

  return NextResponse.json({
    status,
    achieved,
    achievedKeys,
    text,
    counts: {
      tenseAlerts: tense.length,
      criticalAlerts: tenseCritical.length,
      offTrackObjectives: offTrack.length,
      reachedObjectives: reached.length,
      failedSyncs: failedSyncs.length,
      customData: customParts.length,
      overdueExpectedInvoices: radarOverdue,
      enrichmentRemaining,
      /** Contenu « enrichissement » FINALISÉ : plus rien en attente, base identifiée. */
      enrichmentCompleted: enrichmentRemaining === 0 && enrichmentDone > 0,
      actionsExecuted: actionsDone,
    },
  });
}
