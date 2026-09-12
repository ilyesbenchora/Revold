import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isThresholdMet } from "@/lib/alerts/kpi-resolver";
import { getOrgPlan, featureLocked } from "@/lib/billing/org-plan";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { computeBillingRadar } from "@/lib/audit/billing-radar";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { narrateForVoice, firstNameFromUser } from "@/lib/voice/narrate";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";
import { sanitizeBriefTeam, isBriefTeamId } from "@/lib/voice/brief-team";
import { computeTeamBrief } from "@/lib/voice/brief-team-engine";
import { poleToWorkspace } from "@/lib/workspaces";

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
      : ["alerts", "radar", "objectives", "objectives_reached", "syncs", "enrichment", "actions_done", "reconciliation", "team"],
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
  // OPT-IN : tant que « Enrichir mon CRM » n'a jamais été cliqué, AUCUN moteur
  // ne traite la file — le brief se TAIT sur la donnée (pas de fiches « à
  // traiter », pas de renvoi aux paramètres d'enrichissement : le contenu du
  // brief ne se cale QUE sur les sections de la Tour de contrôle).
  let enrichmentActivated = false;
  if (sections.has("enrichment")) {
    try {
      enrichmentActivated = (await getEnrichmentSettings(supabase, orgId)).activated;
    } catch { /* défauts : non activé */ }
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

  // ── Santé de réconciliation : lue de reconciliation_health (persistée par le
  //    cron — pas de recalcul lourd dans le brief). Score + tendance + écart
  //    signé/facturé BRUT (Σ|écart par deal|) qui révèle la compensation. ──
  let reconScore: number | null = null;
  let reconTrend: number | null = null;
  let reconGapGross = 0;
  let reconDeals = 0;
  if (sections.has("reconciliation")) {
    try {
      const { data } = await supabase
        .from("reconciliation_health")
        .select("score, deal_gap_gross, won_deals, deal_solde, day")
        .eq("organization_id", orgId)
        .order("day", { ascending: false })
        .limit(2);
      const rows = (data ?? []) as Array<{ score: number; deal_gap_gross: number; won_deals: number; deal_solde: number }>;
      if (rows[0]) {
        reconScore = rows[0].score;
        reconGapGross = Number(rows[0].deal_gap_gross) || 0;
        reconDeals = Math.max(0, (rows[0].won_deals || 0) - (rows[0].deal_solde || 0));
      }
      if (rows[1]) reconTrend = (rows[0]?.score ?? 0) - rows[1].score;
    } catch {
      /* table absente (cron pas encore passé) → section omise */
    }
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
  // ── Tuiles KPI du brief : chaque chiffre annoncé à voix haute existe aussi
  // en version VISUELLE (façon rapport) — l'orbe les affiche à droite AU
  // MOMENT où la voix les prononce (synchronisation côté client).
  type KpiTile = { key: string; label: string; value: string; sub?: string };
  const kpiTiles: KpiTile[] = [];
  let customTiles: KpiTile[] = [];
  // Brief d'équipe personnalisé (section « team ») : lu depuis les mêmes
  // réglages du compte, calculé par le moteur déterministe par pôle.
  let teamParts: string[] = [];
  let teamLabel: string | null = null;
  // ── Mémoire SERVEUR du brief (voice_tower_settings.brief_state), rattachée
  //    au compte : `ack` = accomplissements déjà entendus (l'orbe ne reste
  //    plus verte sur un autre appareil), `heard` = empreintes des chiffres
  //    d'état déjà lus avec leur date. Un chiffre INCHANGÉ (même phrase) déjà
  //    lu il y a moins de 7 jours n'est pas relu — « jamais deux fois la même
  //    annonce » ; il revient dès que sa valeur change, ou après 7 jours. ──
  let heard: Record<string, string> = {};
  const spokenKeys: string[] = [];
  let skippedHeard = 0;
  const fingerprint = (s: string) => `h:${createHash("sha1").update(s).digest("hex").slice(0, 16)}`;
  const HEARD_TTL_MS = 7 * 86400 * 1000;
  /** Vrai si la phrase (identique) a déjà été lue récemment ; sinon la marque comme lue. */
  const alreadyHeard = (sentence: string): boolean => {
    const key = fingerprint(sentence);
    const at = heard[key] ? new Date(heard[key]).getTime() : NaN;
    if (Number.isFinite(at) && now.getTime() - at < HEARD_TTL_MS) {
      skippedHeard++;
      return true;
    }
    spokenKeys.push(key);
    return false;
  };
  try {
    const { data: settingsRow } = await supabase
      .from("voice_tower_settings")
      .select("settings, brief_state")
      .eq("user_id", user.id)
      .maybeSingle();
    const briefState = ((settingsRow as { brief_state?: unknown } | null)?.brief_state ?? {}) as { ack?: Record<string, string>; heard?: Record<string, string> };
    if (briefState.ack && typeof briefState.ack === "object") for (const k of Object.keys(briefState.ack)) ack.add(k);
    if (briefState.heard && typeof briefState.heard === "object") heard = briefState.heard;
    if (sections.has("team") && !veille) {
      try {
        const teamSettings = sanitizeBriefTeam((settingsRow?.settings as { briefTeam?: unknown } | null)?.briefTeam);
        if (teamSettings.enabled) {
          // Verrou d'équipe côté serveur : un membre rattaché à un pôle n'entend
          // que le brief de SON équipe (même règle que le récap d'équipe).
          const { data: profile } = await supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle();
          const ownTeam = poleToWorkspace(profile?.pole as string | null);
          if (profile?.role !== "admin" && isBriefTeamId(ownTeam)) teamSettings.team = ownTeam;
          const res = await computeTeamBrief(supabase, orgId, await getHubSpotToken(supabase, orgId), teamSettings, crmLabel, now);
          if (res) {
            // Phrases d'équipe inchangées depuis une lecture récente : tues.
            teamParts = narrate ? res.parts.filter((p) => !alreadyHeard(p)) : res.parts;
            teamLabel = res.label;
          }
        }
      } catch {
        /* moteur d'équipe indisponible → brief sans section équipe */
      }
    }
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
            // PÉRIODE toujours dite : ces KPIs sont calculés sans filtre de
            // date → cumul historique, à contextualiser à l'écoute.
            return {
              text: `${i.label}${src ? `, via ${src}` : ""} : ${fmtCustomValue(total, i.unit ?? null)}, en cumul toutes périodes confondues`,
              tile: {
                key: `custom:${i.label}`,
                label: src ? `${i.label} · via ${src}` : i.label!,
                value: fmtCustomValue(total, i.unit ?? null),
                sub: "Cumul toutes périodes",
              },
            };
          } catch {
            return null;
          }
        }),
      );
      // Chiffres suivis déjà lus avec la même valeur récemment : tus (texte ET tuile).
      const ok = computed
        .filter((p): p is NonNullable<(typeof computed)[number]> => p !== null)
        .filter((c) => !narrate || !alreadyHeard(c.text));
      customParts = ok.map((c) => c.text);
      customTiles = ok.map((c) => c.tile);
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
    for (const a of tense.slice(0, 3)) {
      kpiTiles.push({
        key: `alert:${a.title}`,
        label: a.title,
        value: fmtCustomValue(a.current_value!, a.unit_mode),
        sub: `Seuil ${fmtCustomValue(a.threshold!, a.unit_mode)}`,
      });
    }
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
    kpiTiles.push({
      key: "radar",
      label: "Factures attendues non émises",
      value: radarAmount > 0 ? fmtCustomValue(radarAmount, "currency") : String(radarOverdue),
      sub: radarAmount > 0 ? `${radarOverdue} facture${radarOverdue > 1 ? "s" : ""}` : undefined,
    });
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
      for (const o of offTrack.slice(0, 2)) {
        const pct = objectivePct(o);
        kpiTiles.push({
          key: `obj:${o.id}`,
          label: o.title,
          value: fmtCustomValue(o.current_value!, o.unit_mode),
          sub: `sur ${fmtCustomValue(o.target!, o.unit_mode)} visé${pct != null ? ` · ${Math.round(pct)} %` : ""}`,
        });
      }
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
      for (const o of newReached.slice(0, 3)) {
        kpiTiles.push({
          key: `reached:${o.id}`,
          label: o.title,
          value: fmtCustomValue(o.current_value!, o.unit_mode),
          sub: `✓ Atteint · ${fmtCustomValue(o.target!, o.unit_mode)} visé`,
        });
      }
    }
    // Enrichissement : on ne parle que des deux états qui appellent une
    // décision — c'est fini (annoncé UNE fois), ou il reste du travail en cours.
    // Moteur jamais lancé (opt-in) : le brief se TAIT sur la donnée — le
    // contenu du brief ne se cale QUE sur les sections de la Tour de contrôle,
    // jamais sur les paramètres d'enrichissement.
    if (sections.has("enrichment") && enrichmentActivated && enrichmentRemaining != null) {
      if (enrichmentRemaining === 0 && enrichmentDone > 0 && !ack.has(`enrichment:${new Date().toISOString().slice(0, 10)}`)) {
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
    if (sections.has("reconciliation") && reconScore != null) {
      const trendTxt = reconTrend != null && reconTrend !== 0 ? ` (${reconTrend > 0 ? "+" : ""}${reconTrend} pts par rapport à la veille)` : "";
      const gapTxt = reconGapGross > 0
        ? ` Écart signé/facturé réel à traiter : ${fmtCustomValue(reconGapGross, "currency")} sur ${reconDeals} deal${reconDeals > 1 ? "s" : ""}, en cumul à date.`
        : "";
      const reconLine = `Côté réconciliation : santé ${reconScore} sur 100 à ce jour${trendTxt}.${gapTxt}`;
      // Score inchangé et déjà lu récemment : pas relu (le détail est sur la
      // page Récupération de cash).
      if (!narrate || !alreadyHeard(reconLine)) parts.push(reconLine);
    }
    if (customParts.length > 0) {
      parts.push(`Côté chiffres suivis : ${customParts.join(" ; ")}.`);
      kpiTiles.push(...customTiles);
    }
    // Brief d'équipe personnalisé : annoncé comme une famille à part
    // (« Côté Ventes… »), phrases déjà chiffrées et sourcées par le moteur.
    if (teamParts.length > 0) {
      parts.push(`Côté ${teamLabel ?? "équipe"} : ${teamParts.join(" ")}`);
      // Tuiles KPI de la section équipe (encaissements, pipeline, signés…) :
      // le chiffre fort de chaque phrase — montant € en priorité (séparateurs
      // fr-FR : espace, insécable, fine insécable), sinon le premier nombre —
      // copié TEL QUEL depuis le texte prononcé, aucune re-computation.
      // Sans chiffre dans la phrase → pas de tuile.
      let teamTiles = 0;
      for (const [i, p] of teamParts.entries()) {
        if (teamTiles >= 8) break;
        const amount = p
          .match(new RegExp("\\d[\\d \\u00a0\\u202f]*(?:,\\d+)?[ \\u00a0\\u202f]?€"))?.[0]
          ?.replace(new RegExp("[\\u00a0\\u202f]", "g"), " ")
          .replace(/ +/g, " ")
          .trim() ?? null;
        const firstNumber =
          amount ?? p.match(new RegExp("(?:^|[\\s:—])(\\d[\\d \\u00a0\\u202f]*)(?=[\\s.,;:—]|$)"))?.[1]?.trim() ?? null;
        if (!firstNumber) continue;
        const head = p.split(" : ")[0].replace(/[.…]+\s*$/, "").trim();
        const label = head.length >= 4 && head.length <= 60 ? head : `${p.slice(0, 57).trim()}…`;
        kpiTiles.push({ key: `team:${i}`, label, value: firstNumber, sub: teamLabel ?? undefined });
        teamTiles++;
      }
    }
    if (parts.length === 0) {
      parts.push(
        skippedHeard > 0
          ? "Rien de nouveau depuis ton dernier brief : tes chiffres suivis sont inchangés et tout est au vert."
          : "Rien à signaler sur le périmètre de ton brief — tout est au vert.",
      );
    }
  } else if (parts.length === 0) {
    parts.push("Mode veille : aucune exception — tout est au vert.");
  }

  // ── À TRAITER (fenêtre d'aperçu de l'orbe) : chaque action dictée par le
  //    brief devient un item structuré — l'utilisateur choisit d'exécuter
  //    maintenant (lien vers la bonne page, ou passe d'enrichissement lancée
  //    directement) ou plus tard. Aligné sur les sections réellement LUES. ──
  type BriefTodo = { key: string; label: string; detail?: string; href: string; action?: "enrichment_run" };
  const todos: BriefTodo[] = [];
  if (!veille) {
    if (sections.has("alerts") && tense.length > 0) {
      todos.push({
        key: "alerts",
        label: `${tense.length} alerte${tense.length > 1 ? "s" : ""} en tension`,
        detail: tense[0] ? `${tense[0].title} à ${fmtCustomValue(tense[0].current_value!, tense[0].unit_mode)}` : undefined,
        href: "/dashboard/mes-alertes",
      });
    }
    if (sections.has("radar") && radarOverdue > 0) {
      todos.push({
        key: "radar",
        label: `${radarOverdue} facture${radarOverdue > 1 ? "s" : ""} attendue${radarOverdue > 1 ? "s" : ""} non émise${radarOverdue > 1 ? "s" : ""}`,
        detail: radarAmount > 0 ? `≈ ${fmtCustomValue(radarAmount, "currency")} à facturer` : undefined,
        href: "/dashboard/audit/paiement-facturation",
      });
    }
    if (sections.has("syncs") && failedSyncs.length > 0) {
      todos.push({
        key: "syncs",
        label: `Synchronisation en échec : ${failedSyncs.map((s) => toolLabel(s.source)).join(", ")}`,
        detail: "Données figées — à relancer",
        href: "/dashboard/integration/mes-outils",
      });
    }
    if (sections.has("objectives") && offTrack.length > 0) {
      todos.push({
        key: "objectives",
        label: `${offTrack.length} objectif${offTrack.length > 1 ? "s" : ""} en retard`,
        detail: offTrack[0] ? offTrack[0].title : undefined,
        href: "/dashboard/mes-alertes/objectifs",
      });
    }
    // Opt-in jamais donné : aucune action d'enrichissement — le panneau ne
    // reflète que ce que le brief a réellement annoncé (sections de la Tour
    // de contrôle), jamais les paramètres d'enrichissement.
    if (sections.has("enrichment") && enrichmentActivated && (enrichmentRemaining ?? 0) > 0) {
      todos.push({
        key: "enrichment",
        label: `${enrichmentRemaining} fiche${(enrichmentRemaining ?? 0) > 1 ? "s" : ""} ${crmLabel ?? "CRM"} à enrichir`,
        detail: "Une passe peut être lancée immédiatement",
        href: "/dashboard/enrichissement",
        action: "enrichment_run",
      });
    }
    if (sections.has("reconciliation") && reconGapGross > 0) {
      todos.push({
        key: "reconciliation",
        label: `Écart signé/facturé de ${fmtCustomValue(reconGapGross, "currency")} à traiter`,
        detail: `${reconDeals} deal${reconDeals > 1 ? "s" : ""} concerné${reconDeals > 1 ? "s" : ""}`,
        href: "/dashboard/donnees",
      });
    }
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
    // Clé STABLE par jour (et non par compteur) : l'entretien continu (cron
    // 5 min) incrémente enrichmentDone en permanence — une clé par valeur ne
    // serait jamais retrouvée dans les acquittements et l'orbe restait verte
    // après l'écoute du brief. Au plus une annonce « enrichissement terminé »
    // par jour.
    achievedKeys.push(`enrichment:${new Date().toISOString().slice(0, 10)}`);
  }
  // Accompli = au moins une clé PAS encore entendue (acquittements du compte
  // + acquittements transmis par l'orbe) : sur tous les appareils.
  const achieved = achievedKeys.some((k) => !ack.has(k));

  // ── Brief LU (narrate=1, hors veille) : on mémorise côté compte ce qui
  //    vient d'être entendu — accomplissements (l'orbe redevient fuchsia
  //    partout) et chiffres d'état (pas relus tant qu'ils ne changent pas). ──
  if (narrate && !veille) {
    try {
      const day = now.toISOString();
      const prune = (m: Record<string, string>) =>
        Object.fromEntries(Object.entries(m).filter(([, d]) => now.getTime() - new Date(d).getTime() < 30 * 86400 * 1000));
      const nextAck = prune({ ...Object.fromEntries([...ack].map((k) => [k, heard[k] ?? day])), ...Object.fromEntries(achievedKeys.map((k) => [k, day])) });
      const nextHeard = prune({ ...heard, ...Object.fromEntries(spokenKeys.map((k) => [k, day])) });
      await supabase
        .from("voice_tower_settings")
        .upsert({ user_id: user.id, organization_id: orgId, brief_state: { ack: nextAck, heard: nextHeard } }, { onConflict: "user_id" });
    } catch {
      /* colonne absente (migration pas encore passée) → mémoire navigateur seule */
    }
  }

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
    todos,
    text,
    // Tuiles KPI (ordre du texte parlé) : l'orbe les fait apparaître à droite
    // au moment où la voix prononce chaque chiffre.
    kpis: kpiTiles,
    counts: {
      tenseAlerts: tense.length,
      criticalAlerts: tenseCritical.length,
      offTrackObjectives: offTrack.length,
      reachedObjectives: reached.length,
      failedSyncs: failedSyncs.length,
      customData: customParts.length,
      teamBrief: teamParts.length,
      overdueExpectedInvoices: radarOverdue,
      enrichmentRemaining,
      /** Contenu « enrichissement » FINALISÉ : plus rien en attente, base identifiée. */
      enrichmentCompleted: enrichmentRemaining === 0 && enrichmentDone > 0,
      actionsExecuted: actionsDone,
    },
  });
}
