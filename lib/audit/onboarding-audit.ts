/**
 * Audit d'onboarding — « qu'est-ce que Revold a détecté quand tu as branché
 * tes outils, un par un, et qu'est-ce qui manque pour que le moteur soit
 * fiable ? »
 *
 * Deux rôles :
 *  1. buildToolAudit* : le view-model par outil (volumes, méthodes de
 *     rapprochement, couverture des identifiants) depuis source_links,
 *     connector_audits et sync_logs ;
 *  2. buildOnboardingRecommendations : transforme les manques détectés en
 *     plan d'action IA (format Recommendation → RecommendationCard), y compris
 *     les actions PROCESS INTERNES côté client (ex. renseigner le SIREN dans
 *     Stripe) — l'utilisateur voit ce qu'il peut optimiser de son côté.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation, ActionStep } from "@/lib/audit/recommendations-library";
import type { ConnectorAuditReport } from "@/lib/integrations/sync/field-mapping";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import type { ConnectedToolOption } from "@/lib/integrations/tool-mappings";

export type ToolAuditData = {
  key: string;
  label: string;
  domain: string;
  icon: string;
  category: string;
  /** Entités rapprochées par type (source_links). */
  entityCounts: Record<string, number>;
  /** Rapport de la dernière sync du connecteur (null : jamais synchronisé). */
  report: ConnectorAuditReport | null;
  lastSync: { at: string; status: string; error: string | null } | null;
  /** Nombre de pages Données alimentées par cet outil (tool_mappings). */
  mappedPages: number;
};

export const MATCH_LABELS: Record<string, string> = {
  existing_link: "Déjà rapproché",
  siren: "SIREN",
  siret: "SIRET",
  vat_number: "N° TVA",
  exact_email: "Email exact",
  domain: "Domaine",
  name: "Nom",
  created: "Créé (nouveau)",
};

export const IDENTIFIER_LABELS: Record<string, string> = {
  siren: "SIREN",
  siret: "SIRET",
  vat_number: "N° TVA",
  email: "Email",
  domain: "Domaine",
  company_name: "Nom d'entreprise",
  external_id: "ID externe",
};

const ENTITY_TYPES = ["contact", "company", "deal", "invoice", "supplier_invoice", "subscription", "payment", "ticket"];

/** Charge le view-model d'audit pour chaque outil connecté. */
export async function loadToolAudits(
  supabase: SupabaseClient,
  orgId: string,
  connected: ConnectedToolOption[],
): Promise<ToolAuditData[]> {
  // Mappings de pages : combien de pages chaque outil alimente-t-il ?
  const { data: mappingRows } = await supabase
    .from("tool_mappings")
    .select("page_key, tool_keys")
    .eq("organization_id", orgId);
  const pagesPerTool = new Map<string, number>();
  for (const row of (mappingRows ?? []) as Array<{ tool_keys: string[] | null }>) {
    for (const k of row.tool_keys ?? []) {
      pagesPerTool.set(k, (pagesPerTool.get(k) ?? 0) + 1);
    }
  }

  // Rapports d'audit des connecteurs
  const { data: auditRows } = await supabase
    .from("connector_audits")
    .select("provider, report")
    .eq("organization_id", orgId);
  const reportByProvider = new Map<string, ConnectorAuditReport>();
  for (const row of (auditRows ?? []) as Array<{ provider: string; report: ConnectorAuditReport }>) {
    reportByProvider.set(row.provider, row.report);
  }

  const out: ToolAuditData[] = [];
  for (const tool of connected) {
    if (CONNECTABLE_TOOLS[tool.key]?.category === "communication") continue;

    // Comptes par type d'entité (source_links = ce qui est réellement rapproché)
    const entityCounts: Record<string, number> = {};
    for (const type of ENTITY_TYPES) {
      const { count } = await supabase
        .from("source_links")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("provider", tool.key)
        .eq("entity_type", type);
      if (count) entityCounts[type] = count;
    }

    // Dernière sync (réussie ou non)
    const { data: lastLog } = await supabase
      .from("sync_logs")
      .select("completed_at, status, error_message")
      .eq("organization_id", orgId)
      .eq("source", tool.key)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    out.push({
      key: tool.key,
      label: tool.label,
      domain: tool.domain,
      icon: tool.icon,
      category: tool.category,
      entityCounts,
      report: reportByProvider.get(tool.key) ?? null,
      lastSync: lastLog?.completed_at
        ? {
            at: lastLog.completed_at as string,
            status: (lastLog.status as string) ?? "completed",
            error: (lastLog.error_message as string | null) ?? null,
          }
        : null,
      mappedPages: pagesPerTool.get(tool.key) ?? 0,
    });
  }
  return out;
}

// ── Plan d'action IA ────────────────────────────────────────────────────────

const sum = (rec: Record<string, number> | undefined | null): number =>
  Object.values(rec ?? {}).reduce((s, n) => s + n, 0);

function step(n: number, action: string, timeframe: string, effort: ActionStep["effort"]): ActionStep {
  return { step: n, action, timeframe, effort };
}

/**
 * Transforme les manques détectés à l'onboarding en recommandations activables
 * en coaching IA. Chaque reco inclut les actions PROCESS côté client (dans
 * l'outil source) ET les actions de configuration côté Revold.
 */
export function buildOnboardingRecommendations(tools: ToolAuditData[]): Recommendation[] {
  const recos: Recommendation[] = [];

  for (const t of tools) {
    const isBilling = t.category === "billing";
    const r = t.report;

    // 1. Outil connecté mais jamais synchronisé (hors HubSpot qui a son ETL)
    if (t.key !== "hubspot" && !t.lastSync && sum(t.entityCounts as Record<string, number>) === 0) {
      recos.push({
        id: `onboarding.${t.key}.never_synced`,
        category: "donnees",
        severity: "warning",
        title: `${t.label} connecté mais jamais synchronisé`,
        painPoint: `${t.label} est branché mais aucune donnée n'a encore été importée : aucun bloc ne peut s'alimenter, aucun croisement n'est possible.`,
        currentState: `0 entité importée depuis ${t.label} — identifiants sauvegardés, sync jamais lancée.`,
        impact: "Tant que la première sync n'a pas tourné, les KPIs, alertes et croisements qui dépendent de cet outil restent vides.",
        actionPlan: [
          step(1, `Lancer la première synchronisation depuis Paramètres → Intégrations → ${t.label} → « Synchroniser »`, "Aujourd'hui", "S"),
          step(2, "Vérifier le rapport d'import dans Audit qualité → Audit onboarding (volumes, rapprochements)", "Aujourd'hui", "S"),
          step(3, "Choisir les pages alimentées par cet outil (Paramètres → Intégrations → Outil source par page)", "Cette semaine", "S"),
        ],
        coachingCategory: "integration",
        color: "from-amber-500 to-orange-600",
      });
      continue; // sans sync, les autres diagnostics n'ont pas de matière
    }

    // 2. Dernière sync en échec
    if (t.lastSync?.status === "failed") {
      recos.push({
        id: `onboarding.${t.key}.sync_failed`,
        category: "donnees",
        severity: "critical",
        title: `La synchronisation ${t.label} échoue`,
        painPoint: `La dernière sync de ${t.label} s'est terminée en erreur : les données affichées ne se rafraîchissent plus.`,
        currentState: `Dernière erreur : ${t.lastSync.error?.slice(0, 140) ?? "inconnue"}`,
        impact: "Des blocs et KPIs calculés sur des données périmées, sans que personne ne s'en aperçoive.",
        actionPlan: [
          step(1, `Vérifier les identifiants ${t.label} dans Paramètres → Intégrations (clé expirée, permissions)`, "Aujourd'hui", "S"),
          step(2, "Relancer la synchronisation et vérifier le statut dans les logs", "Aujourd'hui", "S"),
          step(3, "Si l'erreur persiste, vérifier les permissions de la clé API (lecture sur toutes les ressources)", "Cette semaine", "M"),
        ],
        coachingCategory: "integration",
        color: "from-rose-500 to-red-600",
      });
    }

    if (!r) continue;

    // 3. Aucun identifiant fort (SIREN/TVA) dans les payloads → matching faible
    const sirenCov = r.identifier_coverage?.siren;
    const vatCov = r.identifier_coverage?.vat_number;
    const strongPresent = (sirenCov?.present ?? 0) + (vatCov?.present ?? 0);
    const totalRecords = Math.max(sirenCov?.total ?? 0, vatCov?.total ?? 0);
    const strongMatches = (r.company_match?.siren ?? 0) + (r.company_match?.vat_number ?? 0) + (r.company_match?.siret ?? 0);
    const weakMatches = (r.company_match?.domain ?? 0) + (r.company_match?.name ?? 0);
    const createdCompanies = r.company_match?.created ?? 0;

    if (isBilling && totalRecords >= 5 && strongPresent === 0) {
      const path = sirenCov?.path ?? "metadata.siren";
      recos.push({
        id: `onboarding.${t.key}.no_strong_identifier`,
        category: "donnees",
        severity: "critical",
        title: `${t.label} : aucun SIREN ni N° TVA détecté — rapprochement fragile`,
        painPoint: `Sur ${totalRecords} clients ${t.label}, aucun ne porte de SIREN ou de N° TVA. Le rapprochement avec votre CRM repose donc sur l'email, le domaine ou le nom — des méthodes bien moins fiables. La réconciliation CA signé ↔ CA facturé en dépend directement.`,
        currentState: `0 % de SIREN (champ attendu : ${path}) · rapprochements forts : ${strongMatches}, faibles : ${weakMatches}, entreprises créées sans match : ${createdCompanies}`,
        impact: "Sans identifiant fort, des factures restent orphelines ou rattachées à la mauvaise entreprise : les KPIs cross-source (revenue leakage, CRM vs facturé) perdent leur fiabilité.",
        actionPlan: [
          step(1, `Process interne : renseigner le SIREN de chaque client dans ${t.label} (champ ${path}) au moment de la création du compte — l'ajouter à votre checklist d'onboarding client`, "Cette semaine", "M"),
          step(2, "Vérifier le chemin du champ dans Paramètres → Modèle de données → Mapping des identifiants (si votre SIREN est stocké ailleurs, corrigez le chemin : la prochaine sync l'utilisera)", "Aujourd'hui", "S"),
          step(3, `Relancer la synchronisation ${t.label} puis contrôler le taux de SIREN dans ce même audit`, "Cette semaine", "S"),
          step(4, "Compléter le stock existant : export clients, enrichissement SIREN (societe.com / API INSEE), réimport", "Dans 30 jours", "L"),
        ],
        coachingCategory: "cross-source",
        color: "from-fuchsia-500 to-purple-600",
      });
    }

    // 4. Clients sans email → contacts impossibles à rapprocher
    const noEmail = Object.entries(r.unmatched ?? {})
      .filter(([k]) => k.includes("sans_email"))
      .reduce((s, [, n]) => s + n, 0);
    if (noEmail > 0) {
      recos.push({
        id: `onboarding.${t.key}.contacts_no_email`,
        category: "donnees",
        severity: noEmail >= 10 ? "warning" : "info",
        title: `${t.label} : ${noEmail} client${noEmail > 1 ? "s" : ""} sans email, ignoré${noEmail > 1 ? "s" : ""} à l'import`,
        painPoint: `${noEmail} client${noEmail > 1 ? "s" : ""} ${t.label} n'ont pas d'adresse email : impossible de les rapprocher d'un contact CRM, ils sont ignorés par la synchronisation.`,
        currentState: `${noEmail} record${noEmail > 1 ? "s" : ""} sans email sur cette source — leurs factures/paiements restent non rattachés à un contact.`,
        impact: "Du chiffre d'affaires « anonyme » : des paiements réels qui n'apparaissent dans aucune vue client, faussant churn et LTV.",
        actionPlan: [
          step(1, `Process interne : rendre l'email obligatoire à la création d'un client dans ${t.label}`, "Cette semaine", "S"),
          step(2, "Compléter les emails manquants sur le stock existant (en commençant par les clients à plus fort volume facturé)", "Dans 14 jours", "M"),
          step(3, "Relancer la synchronisation pour intégrer les clients complétés", "Dans 14 jours", "S"),
        ],
        coachingCategory: "data",
        color: "from-sky-500 to-blue-600",
      });
    }

    // 5. Majorité d'entreprises créées sans match → doublons probables
    const totalCompanies = sum(r.company_match);
    if (totalCompanies >= 10 && createdCompanies / totalCompanies > 0.5 && strongMatches + weakMatches > 0) {
      recos.push({
        id: `onboarding.${t.key}.companies_created`,
        category: "donnees",
        severity: "warning",
        title: `${t.label} : ${Math.round((createdCompanies / totalCompanies) * 100)} % des entreprises créées sans rapprochement`,
        painPoint: `${createdCompanies} entreprises issues de ${t.label} n'ont matché aucune entreprise existante et ont été créées : si elles existent déjà dans votre CRM sous un autre nom/domaine, ce sont des doublons.`,
        currentState: `${createdCompanies}/${totalCompanies} créations · matches forts : ${strongMatches} · matches faibles : ${weakMatches}`,
        impact: "Des doublons d'entreprises divisent votre vision client : deux fiches pour le même compte, KPIs par compte faussés.",
        actionPlan: [
          step(1, "Vérifier les règles de rapprochement actives dans Paramètres → Modèle de données (activer domaine + nom si pertinent)", "Aujourd'hui", "S"),
          step(2, `Ajouter un identifiant fort (SIREN/TVA) dans ${t.label} pour sécuriser les prochains rapprochements`, "Cette semaine", "M"),
          step(3, "Passer en revue les entreprises récemment créées et fusionner les doublons évidents", "Dans 14 jours", "M"),
        ],
        coachingCategory: "cross-source",
        color: "from-violet-500 to-indigo-600",
      });
    }

    // 6. Outil synchronisé mais alimentant aucune page
    if (t.mappedPages === 0 && sum(t.entityCounts as Record<string, number>) > 0) {
      recos.push({
        id: `onboarding.${t.key}.no_page_mapping`,
        category: "donnees",
        severity: "info",
        title: `${t.label} synchronisé mais n'alimente aucune page`,
        painPoint: `Les données ${t.label} sont importées mais aucune page ne les utilise : le réglage « Outil source par page » (source de vérité de l'affichage) ne référence pas cet outil.`,
        currentState: `${sum(t.entityCounts as Record<string, number>)} entités importées · 0 page alimentée`,
        impact: "Des données à jour mais invisibles : les blocs restent sur « 0 source » alors que la matière existe.",
        actionPlan: [
          step(1, `Sélectionner ${t.label} dans Paramètres → Intégrations → Outil source par page, pour chaque page pertinente`, "Aujourd'hui", "S"),
          step(2, "Vérifier que les blocs de ces pages affichent bien les données attendues", "Aujourd'hui", "S"),
        ],
        coachingCategory: "integration",
        color: "from-emerald-500 to-teal-600",
      });
    }
  }

  const SEV_ORDER = { critical: 0, warning: 1, info: 2 } as const;
  return recos.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}
