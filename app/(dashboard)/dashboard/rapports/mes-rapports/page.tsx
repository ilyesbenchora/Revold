export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchAllKpiData, computeMetricValues } from "@/lib/reports/report-kpis";
import { getTabCounts } from "@/lib/reports/report-tab-counts";
import { RapportsTabs } from "@/components/rapports-tabs";
import { DISPLAY_CATEGORY_LABELS } from "@/lib/reports/report-suggestions";
import Link from "next/link";
import { DeactivateReportButton } from "@/components/deactivate-report-button";
import { KpiVisual } from "@/components/kpi-visual";
import { ReportInsight } from "@/components/report-insight";
import { ReportDateRange, resolvePresetDates } from "@/components/report-date-range";

type ReportInsight = { headline: string; detail: string | null; caveat: string | null };

/** Generate a percutant analysis from the report's KPI values */
function generateInsight(title: string, metrics: string[], values: (string | null)[]): ReportInsight | null {
  const filled = metrics
    .map((m, i) => ({ label: m, value: values[i] }))
    .filter((kv): kv is { label: string; value: string } => kv.value !== null);
  if (filled.length === 0) return null;

  const missing = metrics.filter((_, i) => values[i] === null);
  const missingCount = missing.length;
  const totalCount = metrics.length;

  // Caveat about missing data
  let caveat: string | null = null;
  if (missingCount > 0) {
    caveat = missingCount === 1
      ? `1 indicateur sur ${totalCount} n'a pas pu être calculé (${missing[0]}). Ce résultat est partiel et doit être interprété avec cette limite.`
      : `${missingCount} indicateurs sur ${totalCount} n'ont pas pu être calculés (${missing.slice(0, 2).join(", ")}${missingCount > 2 ? "…" : ""}). Les résultats ci-dessus sont partiels.`;
  }

  const v = (idx: number) => filled[idx]?.value ?? null;
  const t = title.toLowerCase();

  function addCaveat(result: { headline: string; detail: string | null }): ReportInsight {
    return { ...result, caveat };
  }

  // ── Attribution contacts ──
  if (t.includes("contacts par owner") || t.includes("répartition des contacts")) {
    return addCaveat({
      headline: `${v(0)} par commercial. ${v(2) ?? v(1)} contacts non attribués.`,
      detail: `**Décision** : ${v(2) && parseInt((v(2) ?? "0").replace(/\s/g, "")) > 100 ? "Lancer un workflow d'attribution automatique — chaque contact non attribué est une opportunité perdue." : "Le volume de contacts non attribués est maîtrisé."} ${v(3) ? `\n\n**Tendance** : ${v(3)}. Un pic d'import non suivi d'attribution crée une dette de suivi commercial.` : ""}\n\n**Action immédiate** : filtrer les contacts sans owner dans HubSpot, les attribuer par segment ou round-robin, puis créer un workflow qui empêche toute future création sans attribution.`,
    });
  }
  // ── Deals par owner ──
  if (t.includes("deals par owner") || t.includes("répartition des deals")) {
    return addCaveat({
      headline: `Top deals actifs : ${v(0) ?? "N/A"}. ${v(2) ? `${v(2)} deals orphelins.` : ""}`,
      detail: `**Analyse de charge** : ${v(1) ?? "N/A"}. ${v(3) ? `\n\n**Détail par montant** : ${v(3)}.` : ""}\n\n**Décision** : un commercial avec 3× plus de deals que la moyenne est en surcharge — son closing rate va baisser. Inversement, un commercial avec peu de deals sous-utilise sa capacité. Rééquilibrez la charge pour maximiser le taux de closing global. Les deals sans owner doivent être attribués sous 24h.`,
    });
  }
  // ── Entreprises par owner ──
  if (t.includes("entreprises") && t.includes("owner")) {
    return addCaveat({
      headline: `Vos comptes sont répartis à ${v(0)} avec ${v(2)} entreprises sans owner.`,
      detail: v(3) ? `Le secteur dominant est ${v(3)}. Le revenu annuel moyen par owner est de ${v(1)}. Les entreprises non attribuées risquent d'être négligées dans le suivi commercial.` : null,
    });
  }
  // ── Closed Won ──
  if (t.includes("closed won") || t.includes("volume et montant")) {
    return addCaveat({
      headline: `${v(0)} deals signés ce mois pour ${v(1)} de CA — deal moyen à ${v(2)}.`,
      detail: v(3) ? `L'évolution par rapport au mois précédent est de ${v(3)}. Surveillez la tendance pour anticiper les variations de revenus et ajuster les objectifs commerciaux.` : null,
    });
  }
  // ── CA par pipeline ──
  if (t.includes("par pipeline") && t.includes("ca")) {
    return addCaveat({
      headline: `Le top pipeline génère ${v(0)} de CA avec un taux de conversion de ${v(3) ?? v(2)}.`,
      detail: `${v(1)} deals ont été gagnés sur ce pipeline avec un deal moyen de ${v(2)}. Comparez les performances entre pipelines pour identifier les circuits de vente les plus rentables.`,
    });
  }
  // ── Leaderboard ──
  if (t.includes("leaderboard") || t.includes("ca par commercial")) {
    return addCaveat({
      headline: `En moyenne ${v(0)} de CA signé par commercial pour ${v(1)} deals gagnés.`,
      detail: `Le deal moyen s'élève à ${v(2)}. ${v(3) ? `CA total réalisé : ${v(3)}.` : ""} Identifiez les top performers pour répliquer leurs méthodes et accompagnez ceux en dessous de la moyenne.`,
    });
  }
  // ── Forecast ──
  if (t.includes("forecast")) {
    return addCaveat({
      headline: `Pipeline weighted de ${v(0)} contre ${v(1)} réalisé — écart de ${v(2)}.`,
      detail: v(3) ? `Le pipeline pondéré par owner est de ${v(3)}. Un écart important entre forecast et réalisé indique un problème de qualification des opportunités ou de surestimation des montants.` : null,
    });
  }
  // ── Pipeline stagnant ──
  if (t.includes("stagnant") || t.includes("bloqué")) {
    return addCaveat({
      headline: `${v(0)} deals bloqués depuis plus de 30 jours — ${v(1)} de pipeline en danger.`,
      detail: v(2) ? `Les deals les plus importants bloqués représentent ${v(2)}. ${v(3) ? `L'étape où les deals stagnent le plus : ${v(3)}.` : ""} Chaque jour de stagnation réduit la probabilité de closing.` : null,
    });
  }
  // ── Conversion par stage ──
  if (t.includes("conversion par stage") || t.includes("taux de conversion")) {
    return addCaveat({
      headline: `Taux de conversion global de ${v(2) ?? v(0)} — principale perte sur ${v(1) ?? "les premières étapes"}.`,
      detail: v(3) ? `L'évolution mensuelle des conversions montre ${v(3)}. Concentrez vos efforts de coaching sur les étapes où la déperdition est la plus forte pour maximiser le passage en closing.` : null,
    });
  }
  // ── Vélocité ──
  if (t.includes("vélocité") || t.includes("cycle de vente")) {
    return addCaveat({
      headline: `Cycle moyen : ${v(0) ?? "N/A"}. Goulot : ${v(2) ?? "non identifié"}.`,
      detail: `**Par pipeline** : ${v(1) ?? "N/A"}. ${v(3) ? `**Won** : ${v(3)}.` : ""}\n\n**Décision** : concentrez vos efforts de coaching sur le stage bloquant — c'est là que le pipeline stagne et que les deals meurent silencieusement. Chaque jour gagné sur ce stage se traduit directement en CA anticipé. Si un pipeline a un cycle 2× plus long qu'un autre, auditez les étapes intermédiaires : trop de validation interne, manque de relance, ou décideur non identifié.`,
    });
  }
  // ── Appels volume ──
  if (t.includes("volume d'appels") || (t.includes("activité") && t.includes("owner"))) {
    return addCaveat({
      headline: `Appels : ${v(0) ?? "N/A"}. Emails : ${v(1) ?? "N/A"}. Meetings : ${v(2) ?? "N/A"}.`,
      detail: `${v(3) ? `**Communication** : ${v(3)}.` : ""}\n\n**Décision** : les commerciaux avec un volume d'activité < 50% de la moyenne de l'équipe nécessitent un plan d'action immédiat. Croisez ce rapport avec le closing rate par owner — un faible volume d'activité corrélé à un bon closing indique un commercial efficient, tandis qu'un faible volume + faible closing signale un problème de motivation ou de compétence à adresser en coaching.`,
    });
  }
  // ── Appels CA ──
  if (t.includes("appels") && t.includes("closing")) {
    return addCaveat({
      headline: `Deals won avec appels : ${v(0) ?? "N/A"} appels/deal vs ${v(1) ?? "N/A"} sur deals lost.`,
      detail: `**CA influencé** : ${v(2) ?? "N/A"}. ${v(3) ? `Closing avec appels : ${v(3)}.` : ""}\n\n**Décision** : si le delta appels/deal entre won et lost est > 2, le téléphone est votre levier de closing N°1 — imposez un minimum de 3 appels par deal avant le stage 030%. Si le delta est faible, le problème de closing est ailleurs (qualification, pricing, timing).`,
    });
  }
  // ── Impact meetings ──
  if (t.includes("impact") && t.includes("meeting")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"}. ${v(3) ? `${v(3)} deals won avec 3+ meetings.` : ""}`,
      detail: `**Pipeline avec meetings** : ${v(1) ?? "N/A"}. Moyenne : ${v(2) ?? "N/A"}.\n\n**Décision** : les deals avec 3+ meetings closent 2.5× mieux. Si vos commerciaux font en moyenne < 2 meetings par deal, le plan d'action est clair : imposer un RDV de qualification + un RDV de présentation technique avant toute proposition commerciale. Le coût d'un meeting est négligeable vs le CA d'un deal gagné.`,
    });
  }
  // ── Enrichissement ──
  if (t.includes("enrichissement") || t.includes("complétude") || t.includes("qualité")) {
    return addCaveat({
      headline: `Contacts ${v(0) ?? "?"} · Entreprises ${v(1) ?? "?"} · Transactions ${v(2) ?? "?"}. Score global : ${v(3) ?? "?"}.`,
      detail: `**Décision** : l'objet avec le taux le plus bas est votre priorité N°1 d'enrichissement. En dessous de 50%, le scoring, la segmentation et le forecast sont compromis. **Plan d'action** : (1) identifiez les 5 champs les plus impactants par objet, (2) lancez une campagne d'enrichissement progressive ciblée sur les contacts/deals actifs uniquement, (3) mettez en place des champs obligatoires sur les formulaires de création pour empêcher la dégradation future.`,
    });
  }
  // ── Orphelins ──
  if (t.includes("orphelin") || t.includes("sans contact")) {
    return addCaveat({
      headline: `${v(0) ?? "?"} deals sans contact · ${v(1) ?? "?"} sans entreprise · ${v(2) ?? "?"} de CA non rattaché.`,
      detail: `${v(3) ? `**Par pipeline** : ${v(3)}.` : ""}\n\n**Décision** : chaque deal orphelin est invisible dans vos rapports par segment, par industrie et par account. Le CA non rattaché fausse votre forecast par vertical. **Action** : créez un workflow HubSpot qui bloque le passage au stage 020% si aucun contact n'est associé au deal. Pour les deals existants, lancez un audit de rattrapage ciblé sur les deals > 10K€.`,
    });
  }
  // ── Outbound ──
  if (t.includes("outbound")) {
    return addCaveat({
      headline: `Outbound : ${v(0) ?? "N/A"} contacts prospectés. Conversion : ${v(1) ?? "N/A"}.`,
      detail: `**CA outbound** : ${v(2) ?? "N/A"}. ${v(3) ? `Séquences : ${v(3)}.` : ""}\n\n**Décision** : calculez le coût par lead outbound (licence outil + temps commercial / leads générés) et comparez-le au CAC inbound. Si le CAC outbound est > 2× l'inbound, concentrez le budget sur les séquences top 20% par taux de conversion. Un taux de conversion outbound < 2% signale un problème de ciblage ICP.`,
    });
  }
  // ── Facturation ──
  if (t.includes("facturation") || t.includes("facture") || t.includes("réconciliation")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"} facturé. Écart CRM : ${v(1) ?? "N/A"}. En attente : ${v(2) ?? "N/A"}.`,
      detail: `${v(3) ? `**MRR** : ${v(3)}.` : ""}\n\n**Décision** : un écart > 10% entre CA CRM et CA facturé signale des deals marqués Won mais non facturés — risque de reporting gonflé au board. Les factures en attente > 30 jours sont un signal de churn ou de litige. **Action** : automatisez la création de facture au passage en stage Won, et créez une alerte pour toute facture impayée > 15 jours.`,
    });
  }

  // ── Activité commerciale par owner ──
  if (t.includes("activité") && t.includes("owner")) {
    return addCaveat({
      headline: `Top performers en appels : ${v(0) ?? "N/A"}. Emails : ${v(1) ?? "N/A"}.`,
      detail: `Meetings par owner : ${v(2) ?? "N/A"}. ${v(3) ? `Communication : ${v(3)}.` : ""} Les commerciaux avec le plus d'activités multicanales closent en moyenne 30% de plus — la consistance prime sur le volume.`,
    });
  }
  // ── Impact meetings ──
  if (t.includes("impact") && t.includes("meeting")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"} deals avec au moins un RDV. ${v(3) ? `${v(3)} avec 3+ meetings.` : ""}`,
      detail: `Pipeline avec meetings : ${v(1) ?? "N/A"}. En moyenne ${v(2) ?? "?"} meetings par deal. Les deals avec 3+ meetings ont un taux de closing 2.5× supérieur — investir du temps en early stage paie.`,
    });
  }
  // ── Pipeline par stage ──
  if (t.includes("pipeline par stage") || t.includes("répartition du pipeline")) {
    return addCaveat({
      headline: `Concentration pipeline : ${v(2) ?? "N/A"}. ${v(3) ? `${v(3)}.` : ""}`,
      detail: `Répartition par stage : ${v(0) ?? "N/A"}. ${v(1) ? `Montants : ${v(1)}.` : ""} Une forte concentration sur les premiers stages signale un pipeline immature — priorisez le push des deals mid-funnel.`,
    });
  }
  // ── Santé pipeline ──
  if (t.includes("santé du pipeline") || t.includes("par pipeline")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"}. ${v(1) ? `Montant : ${v(1)}.` : ""}`,
      detail: `Pipeline pondéré : ${v(2) ?? "N/A"}. ${v(3) ? `Owners actifs : ${v(3)}.` : ""} Comparez les pipelines par ratio CA pondéré / deals actifs pour identifier les pipelines les plus rentables.`,
    });
  }
  // ── Contacts lifecycle ──
  if (t.includes("lifecycle")) {
    return addCaveat({
      headline: `Répartition lifecycle : ${v(0) ?? "N/A"}.`,
      detail: `${v(1) ? `Contacts attribués : ${v(1)}.` : ""} ${v(2) ? `Orphelins : ${v(2)}.` : ""} ${v(3) ? `Conversion contact→deal : ${v(3)}.` : ""} Un ratio Lead/Opportunity déséquilibré signale un blocage dans le funnel de qualification.`,
    });
  }

  // ── Acquisition / source ──
  if (t.includes("acquisition") && t.includes("source")) {
    return addCaveat({
      headline: `Source principale : ${v(0) ?? "Offline"}. Autres : ${v(3) ?? "N/A"}.`,
      detail: `**Organic** : ${v(1) ?? "N/A"} · **Direct** : ${v(2) ?? "N/A"}.\n\n**Décision** : une base à 90%+ OFFLINE est un signal d'alerte stratégique — vous dépendez des imports manuels (fichiers, salons, partenaires). Les contacts OFFLINE convertissent en moyenne 3× moins car ils n'ont jamais exprimé d'intérêt spontané. **Plan d'action** : (1) lancer un site web avec formulaires de contact/démo pour capter l'inbound, (2) investir en SEO sur vos mots-clés métier, (3) tracker les sources en créant une propriété "canal d'acquisition" obligatoire. Objectif : passer sous 70% OFFLINE en 6 mois.`,
    });
  }
  // ── Vélocité acquisition ──
  if (t.includes("vélocité") && t.includes("acquisition")) {
    return addCaveat({
      headline: `Ce mois : ${v(1) ?? "?"} contacts (${v(3) ?? "N/A"} vs mois dernier).`,
      detail: `**Tendance** : ${v(0) ?? "N/A"}. Mois précédent : ${v(2) ?? "?"}.\n\n**Décision** : une baisse > 2 mois consécutifs signale un tarissement des sources — urgence marketing. Un pic isolé (import) ne reflète pas une vraie croissance. **Action** : séparez le volume d'import du volume organique dans vos dashboards. Fixez un objectif mensuel de contacts organiques (hors import) et mesurez-le séparément. La vélocité organique est votre vrai indicateur de santé marketing.`,
    });
  }
  // ── Funnel ──
  if (t.includes("funnel") && (t.includes("lead") || t.includes("opportunity"))) {
    return addCaveat({
      headline: `${v(0) ?? "?"} leads · ${v(1) ?? "?"} opportunités · Conversion : ${v(2) ?? "N/A"}.`,
      detail: `**Deals/mois** : ${v(3) ?? "N/A"}.\n\n**Décision** : un ratio Lead/Opportunity > 5:1 = problème de qualification. Vos leads stagnent sans être travaillés ou vos critères MQL sont trop larges. **Plan d'action** : (1) implémenter un lead scoring basé sur l'engagement (ouvertures email + visites web + formulaires), (2) définir un SLA de premier contact < 24h entre marketing et sales, (3) purger les leads > 6 mois sans activité. Chaque point de conversion gagné = ~${v(0) ? Math.round(parseInt((v(0) ?? "0").replace(/\s/g, "")) * 0.01) : "?"} opportunités supplémentaires.`,
    });
  }
  // ── Base marketing santé ──
  if (t.includes("base marketing") || t.includes("exploitabilité")) {
    return addCaveat({
      headline: `Email ${v(0) ?? "?"} · Tél ${v(1) ?? "?"} · Poste ${v(2) ?? "?"} · Entreprise ${v(3) ?? "?"}.`,
      detail: `**Seuils d'exploitabilité** : Email ≥ 80% (OK pour emailing), Téléphone ≥ 40% (outbound possible), Poste ≥ 50% (segmentation ABM), Entreprise ≥ 60% (reporting par compte).\n\n**Décision** : le champ avec le taux le plus bas est votre maillon faible. Les contacts sans entreprise sont invisibles dans tout rapport ABM. Les contacts sans téléphone bloquent l'outbound multicanal. **Action immédiate** : identifiez le champ critique, lancez un enrichissement ciblé sur les 500 contacts les plus récents, puis rendez ce champ obligatoire à la création.`,
    });
  }
  // ── Pipeline montant ──
  if (t.includes("montant") && t.includes("projection")) {
    return addCaveat({
      headline: `Pipeline : ${v(0) ?? "N/A"}. Deals avec montant : ${v(1) ?? "?"}. Pondéré : ${v(3) ?? "N/A"}.`,
      detail: `**Deal moyen** : ${v(2) ?? "N/A"}.\n\n**Décision** : en dessous de 50% de complétude montant, votre forecast est aveugle — le pipeline pondéré n'a aucune valeur pour le COMEX. **Plan d'action** : (1) rendez le montant obligatoire dès le stage 020%, (2) pour les deals existants sans montant, lancez un sprint de rattrapage avec les commerciaux, (3) créez un rapport hebdomadaire "deals sans montant" envoyé aux managers. Objectif : 80% de complétude montant en 30 jours.`,
    });
  }
  // ── Revenue par pipeline ──
  if (t.includes("revenue") && t.includes("pipeline") && t.includes("contribution")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"}. Deal moyen : ${v(2) ?? "N/A"}.`,
      detail: `**Deals actifs** : ${v(1) ?? "N/A"}. ${v(3) ? `**Pondéré** : ${v(3)}.` : ""}\n\n**Décision** : le pipeline avec le deal moyen le plus élevé est votre meilleur levier de croissance — concentrez-y vos meilleurs commerciaux. Un pipeline avec beaucoup de deals mais un faible deal moyen est un pipeline de volume — adaptez le process (automatisation, self-service). **Action** : pour chaque pipeline, calculez le ratio CA/temps commercial investi. Le pipeline avec le meilleur ratio mérite une augmentation de 20% des ressources au prochain trimestre.`,
    });
  }
  // ── Deals créés vs closés ──
  if (t.includes("créés vs closés") || t.includes("ratio d'efficacité")) {
    return addCaveat({
      headline: `Créés : ${v(0) ?? "N/A"} · Won : ${v(1) ?? "N/A"} · Ratio : ${v(2) ?? "N/A"}.`,
      detail: `**Pipeline net** : ${v(3) ?? "N/A"}.\n\n**Décision** : ratio optimal entre 1.5 et 2.5. Au-dessus de 3 = pipeline zombie — vos deals s'accumulent sans se fermer, ce qui fausse le forecast et démotive les commerciaux. En dessous de 1 = vous consommez votre pipeline sans le renouveler, alerte pour le Q+1. **Action** : si ratio > 3, lancez un audit des deals > 60 jours dans le même stage — marquez-les à risque ou perdus. Si ratio < 1.5, augmentez l'effort de prospection immédiatement.`,
    });
  }

  // ── Fallback ──
  const headline = filled.slice(0, 2).map((kv) => `${kv.label} à ${kv.value}`).join(" et ");
  return addCaveat({
    headline: headline + ".",
    detail: filled.length > 2 ? filled.slice(2).map((kv) => `${kv.label} : ${kv.value}`).join(". ") + "." : null,
  });
}

type ActivatedReport = {
  id: string;
  report_id: string;
  report_type: string;
  title: string;
  display_category: string;
  description: string;
  expected_value: string;
  metrics: string[];
  icon: string;
  activated_at: string;
};

/** Clean raw metric values: remove "Won:", "Lost:", "Out:", "In:" prefixes,
 *  split compound values into separate lines, remove colons. */
function cleanValue(raw: string): string {
  return raw
    .replace(/\bWon\s*:\s*/gi, "")
    .replace(/\bLost\s*:\s*/gi, "")
    .replace(/\bOut\s*:\s*/gi, "")
    .replace(/\bIn\s*:\s*/gi, "")
    .replace(/\bAvec\s*:\s*/gi, "")
    .replace(/\bSans\s*:\s*/gi, "")
    .replace(/\bTop\s*:\s*/gi, "")
    .replace(/\s*\/\s*/g, "  ·  ")
    .replace(/\s*,\s*/g, "  ·  ")
    .trim();
}

type PageProps = { searchParams: Promise<{ period?: string }> };

export default async function MesRapportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const _period = params.period || "all_time";
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();

  let activatedReports: ActivatedReport[] = [];
  try {
    const { data } = await supabase
      .from("activated_reports")
      .select("*")
      .eq("organization_id", orgId)
      .order("activated_at", { ascending: false });
    activatedReports = (data ?? []) as ActivatedReport[];
  } catch {}

  const hubspotToken = await getHubSpotToken(supabase, orgId);

  let kpiValues: Record<string, string | null> = {};
  let kpiError: string | null = null;
  if (hubspotToken && activatedReports.length > 0) {
    try {
      const dateFilter = resolvePresetDates(_period);
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId, dateFilter);
      kpiValues = computeMetricValues(kpiData);
    } catch (err) {
      kpiError = String(err).slice(0, 200);
    }
  }

  // Auto-fix: update metrics in DB if they reference keys that don't exist in kpiValues
  const computedKeys = new Set(Object.keys(kpiValues));
  for (const report of activatedReports) {
    const metrics = (report.metrics as string[]) ?? [];
    if (computedKeys.size > 0 && metrics.some((m) => !computedKeys.has(m))) {
      const fixed = metrics.filter((m) => computedKeys.has(m));
      if (fixed.length > 0 && fixed.length !== metrics.length) {
        report.metrics = fixed;
        supabase.from("activated_reports").update({ metrics: fixed }).eq("id", report.id).then(() => {});
      }
    }
  }

  const tabCounts = await getTabCounts(supabase, orgId);
  tabCounts.myCount = activatedReports.length;

  const noToken = !hubspotToken;
  const catLabels = DISPLAY_CATEGORY_LABELS as Record<string, string>;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mes rapports</h1>
        <p className="mt-1 text-sm text-slate-500">KPIs en temps réel depuis votre CRM.</p>
      </header>

      <RapportsTabs myCount={tabCounts.myCount} singleCount={tabCounts.singleCount} multiCount={tabCounts.multiCount} />

      {noToken && activatedReports.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Token HubSpot non trouvé.{" "}
            <Link href="/dashboard/parametres/integrations" className="underline">Configurer →</Link>
          </p>
        </div>
      )}
      {kpiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-800">Erreur CRM : {kpiError}</p>
        </div>
      )}

      {activatedReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Aucun rapport activé</p>
          <p className="mt-1 text-xs text-slate-500">Activez des rapports depuis les suggestions.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/dashboard/rapports/integration-unique" className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500">
              Intégration unique
            </Link>
            <Link href="/dashboard/rapports/integrations-multiples" className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-xs font-medium text-white hover:opacity-90">
              Intégrations multiples
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {activatedReports.map((report) => {
            const catLabel = catLabels[report.display_category] ?? report.display_category;
            const metrics = (report.metrics as string[]) ?? [];
            const isMulti = report.report_type === "multi";
            const metricValues = metrics.map((m) => kpiValues[m] ?? null);
            const nonNullCount = metricValues.filter((v) => v !== null).length;
            const allReady = nonNullCount === metrics.length && metrics.length > 0;

            return (
              <article
                key={report.id}
                className="card overflow-hidden transition hover:shadow-md"
              >
                {/* Color bar */}
                <div className={`h-1 ${isMulti ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500" : "bg-accent"}`} />

                {/* Header */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{report.icon || "📊"}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-semibold text-slate-900 leading-snug">{report.title}</h3>
                      {report.expected_value ? (
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{report.expected_value}</p>
                      ) : report.description ? (
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed line-clamp-1">{report.description}</p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          isMulti ? "bg-fuchsia-50 text-fuchsia-600" : "bg-indigo-50 text-indigo-600"
                        }`}>
                          {catLabel}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          allReady ? "bg-emerald-50 text-emerald-700" : nonNullCount > 0 ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {allReady ? `${Math.round((nonNullCount / metrics.length) * 100)}% fiable` : nonNullCount > 0 ? `${Math.round((nonNullCount / metrics.length) * 100)}% fiable` : "En attente"}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(report.activated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Date range */}
                  <div className="mt-3">
                    <ReportDateRange />
                  </div>
                </div>

                {/* KPIs */}
                {metrics.length > 0 && (
                  <div className="px-5 pb-4">
                    <div className="space-y-1.5">
                      {metrics.map((metric, idx) => (
                        <KpiVisual key={idx} label={metric} value={metricValues[idx]} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-card-border px-5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      allReady
                        ? "bg-emerald-50 text-emerald-700"
                        : nonNullCount > 0
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`h-1 w-1 rounded-full ${
                        allReady ? "bg-emerald-500" : nonNullCount > 0 ? "bg-blue-500" : "bg-amber-500"
                      }`} />
                      {allReady
                        ? `${metrics.length} KPIs synchronisés`
                        : nonNullCount > 0
                          ? `${nonNullCount} sur ${metrics.length} KPIs`
                          : "En attente"}
                    </span>
                    <DeactivateReportButton reportId={report.report_id} />
                  </div>
                  {(() => {
                    const insight = generateInsight(report.title, metrics, metricValues);
                    return insight ? <ReportInsight headline={insight.headline} detail={insight.detail} caveat={insight.caveat} /> : null;
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
