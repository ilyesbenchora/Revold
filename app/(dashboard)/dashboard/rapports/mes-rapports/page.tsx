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
import { ReportDateRange } from "@/components/report-date-range";

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
      headline: `En moyenne ${v(0)} par commercial — ${v(2) ?? v(1)} contacts ne sont attribués à personne.`,
      detail: v(3) ? `L'évolution mensuelle montre ${v(3)}. Les contacts non attribués représentent un risque de perte d'opportunités car aucun commercial ne les suit activement.` : null,
    });
  }
  // ── Deals par owner ──
  if (t.includes("deals par owner") || t.includes("répartition des deals")) {
    return addCaveat({
      headline: `Top commerciaux par deals actifs : ${v(0) ?? "N/A"}. ${v(2) ? `${v(2)} deals sans propriétaire.` : ""}`,
      detail: v(1) ? `Répartition par montant pipeline : ${v(1)}. ${v(3) ? `Détail par owner : ${v(3)}.` : ""} Un déséquilibre > 2x entre commerciaux signale un risque de surcharge ou de sous-exploitation.` : null,
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
      headline: `Cycle de vente moyen : ${v(0) ?? "N/A"}. ${v(2) ? `Goulot d'étranglement : ${v(2)}.` : ""}`,
      detail: v(1) ? `Détail par pipeline : ${v(1)}. ${v(3) ? `Deals won : ${v(3)}.` : ""} Chaque jour gagné sur le cycle accélère le CA et libère de la capacité commerciale.` : null,
    });
  }
  // ── Appels volume ──
  if (t.includes("volume d'appels")) {
    return addCaveat({
      headline: `${v(0)} d'appels par jour et par commercial avec ${v(2)} de taux de connexion.`,
      detail: `Durée moyenne de ${v(1)} par owner. ${v(3) ? `Deals touchés par les appels : ${v(3)}.` : ""} Un taux de connexion bas peut indiquer des horaires d'appels à optimiser.`,
    });
  }
  // ── Appels CA ──
  if (t.includes("appels") || t.includes("téléphonique")) {
    return addCaveat({
      headline: `${v(2) ?? v(0)} des deals gagnés ont impliqué au moins un appel téléphonique.`,
      detail: `CA influencé par les appels : ${v(0)}. ${v(1) ? `Le CA moyen avec appels vs sans : ${v(1)}.` : ""} ${v(3) ? `Top commercial par CA influencé : ${v(3)}.` : ""} Le téléphone reste un levier de closing majeur.`,
    });
  }
  // ── Meetings ──
  if (t.includes("meeting")) {
    return addCaveat({
      headline: `${v(0)} meetings réalisés avec un taux de show-up de ${v(2) ?? v(1)}.`,
      detail: v(3) ? `En moyenne ${v(3)} meetings par deal fermé. ${v(1) ? `Taux de conversion meeting → deal : ${v(1)}.` : ""} Optimisez le nombre de meetings par deal pour ne pas sur-investir en temps commercial.` : null,
    });
  }
  // ── Email ──
  if (t.includes("email")) {
    return addCaveat({
      headline: `${v(0)} d'emails envoyés par semaine avec un taux de réponse de ${v(2) ?? v(1)}.`,
      detail: v(3) ? `Les commerciaux les plus actifs : ${v(3)}. ${v(1) ? `Emails reçus en retour : ${v(1)}.` : ""} Un taux de réponse élevé corrèle avec un cycle de vente plus court.` : null,
    });
  }
  // ── Social ──
  if (t.includes("social")) {
    return addCaveat({
      headline: `Le social selling a généré ${v(0)} contacts et ${v(2) ?? v(1)} de taux de conversion.`,
      detail: v(3) ? `CA total issu du social : ${v(3)}. ${v(1) ? `Nombre de contacts source social : ${v(1)}.` : ""} Le social selling est un canal à fort potentiel de développement.` : null,
    });
  }
  // ── Enrichissement ──
  if (t.includes("enrichissement") || t.includes("complétude") || t.includes("qualité")) {
    return addCaveat({
      headline: `Score global CRM : ${v(3) ?? v(0)}. Contacts ${v(0) ?? "?"}, Entreprises ${v(1) ?? "?"}, Transactions ${v(2) ?? "?"}.`,
      detail: `Un enrichissement < 60% sur un objet impacte directement le forecast, le scoring et la segmentation. Priorisez l'objet avec le taux le plus bas pour un ROI immédiat sur la qualité de vos rapports.`,
    });
  }
  // ── Orphelins ──
  if (t.includes("orphelin") || t.includes("sans contact")) {
    return addCaveat({
      headline: `${v(0)} deals sans contact et ${v(1)} sans entreprise — ${v(2)} de CA non rattaché.`,
      detail: v(3) ? `${v(3)} de deals orphelins par pipeline. Les deals sans association faussent le reporting et empêchent le suivi client post-signature.` : null,
    });
  }
  // ── Outbound ──
  if (t.includes("outbound")) {
    return addCaveat({
      headline: `L'outbound a généré ${v(0)} de CA avec ${v(1)} deals signés.`,
      detail: v(2) ? `Deal moyen outbound : ${v(2)}. ${v(3) ? `Comparaison outbound vs inbound : ${v(3)}.` : ""} Mesurez le ROI par campagne pour concentrer le budget sur les séquences les plus performantes.` : null,
    });
  }
  // ── Support ──
  if (t.includes("ticket") || t.includes("support")) {
    return addCaveat({
      headline: `${v(0)} avec ${v(1) ?? v(2)} de tickets haute priorité.`,
      detail: v(2) ? `Taux de résolution au 1er contact : ${v(2)}. ${v(3) ? `Réouvertures : ${v(3)}.` : ""} Un volume élevé de tickets critiques est un signal d'alerte pour la rétention client.` : null,
    });
  }
  // ── CSAT ──
  if (t.includes("csat") || t.includes("satisfaction")) {
    return addCaveat({
      headline: `Score CSAT proxy à ${v(0)} — satisfaction estimée à partir des résolutions et réouvertures.`,
      detail: v(1) ? `Performance par agent : ${v(1)}. Taux de réouverture : ${v(2) ?? "non mesuré"}. ${v(3) ? `Évolution : ${v(3)}.` : ""} Le CSAT proxy permet de suivre la satisfaction sans sondage explicite.` : null,
    });
  }
  // ── Facturation ──
  if (t.includes("facturation") || t.includes("facture")) {
    return addCaveat({
      headline: `${v(0)} factures émises pour ${v(1)} facturé dont ${v(2)} encaissé.`,
      detail: v(3) ? `Factures en attente : ${v(3)}. Surveillez les écarts entre CA CRM et facturation réelle pour détecter les deals signés mais non facturés.` : null,
    });
  }
  // ── MRR ──
  if (t.includes("mrr") || t.includes("récurrent")) {
    return addCaveat({
      headline: `MRR à ${v(0)} soit un ARR de ${v(1)} — churn à ${v(2)}.`,
      detail: v(3) ? `Paiements : ${v(3)}. Le MRR est l'indicateur clé de la santé SaaS. Un churn supérieur à 5% mensuel signale un problème de rétention à adresser d'urgence.` : null,
    });
  }
  // ── Paiements ──
  if (t.includes("paiement") || t.includes("succès")) {
    return addCaveat({
      headline: `${v(0)} paiements traités — taux de succès à ${v(1)} avec ${v(2)} en échec.`,
      detail: v(3) ? `Impayés : ${v(3)}. Les paiements échoués génèrent du churn involontaire. Mettez en place des relances automatiques pour récupérer le CA perdu.` : null,
    });
  }
  // ── Conv intel ──
  if (t.includes("pattern") || t.includes("conversationnel")) {
    return addCaveat({
      headline: `Les deals gagnés impliquent ${v(0)} touchpoints en moyenne — le ratio de réponse est de ${v(3) ?? v(1)}.`,
      detail: v(2) ? `Notes logées : ${v(2)}. ${v(1) ? `Meetings par deal won vs lost : ${v(1)}.` : ""} Les deals avec plus de touchpoints ont significativement plus de chances de closer.` : null,
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
      headline: `Source principale : ${v(0) ?? "Offline"}. ${v(3) ? `Autres canaux : ${v(3)}.` : ""}`,
      detail: `Organic search : ${v(1) ?? "N/A"}, direct : ${v(2) ?? "N/A"}. Une base à 90%+ OFFLINE signale une dépendance aux imports manuels. Diversifiez les sources d'acquisition (SEO, formulaires web, social) pour réduire le coût d'acquisition et améliorer la qualité des leads entrants. Les contacts OFFLINE convertissent en moyenne 3× moins que les contacts inbound.`,
    });
  }
  // ── Vélocité acquisition ──
  if (t.includes("vélocité") && t.includes("acquisition")) {
    return addCaveat({
      headline: `${v(1) ?? "?"} contacts créés ce mois (${v(3) ?? "N/A"} vs mois dernier). Tendance : ${v(0) ?? "N/A"}.`,
      detail: `Mois précédent : ${v(2) ?? "?"}. Un volume d'acquisition en baisse > 2 mois consécutifs signale un tarissement des sources. Inversement, un pic soudain (import) ne reflète pas une vraie croissance. Surveillez la tendance hors imports pour mesurer l'acquisition organique réelle.`,
    });
  }
  // ── Funnel ──
  if (t.includes("funnel") && (t.includes("lead") || t.includes("opportunity"))) {
    return addCaveat({
      headline: `${v(0) ?? "?"} leads et ${v(1) ?? "?"} opportunités — conversion à ${v(2) ?? "N/A"}.`,
      detail: `Deals créés/mois : ${v(3) ?? "N/A"}. Un ratio Lead/Opportunity > 5:1 signale un problème de qualification — soit les leads ne sont pas travaillés, soit les critères MQL sont trop permissifs. Mettez en place un scoring basé sur l'engagement (ouvertures email, visites, formulaires) pour accélérer la conversion. Chaque point de conversion gagné représente ${v(0) ? Math.round(parseInt(v(0)!.replace(/\s/g, "")) * 0.01) : "~"} opportunités supplémentaires.`,
    });
  }
  // ── Base marketing santé ──
  if (t.includes("base marketing") || t.includes("exploitabilité")) {
    return addCaveat({
      headline: `Email ${v(0) ?? "?"}, Téléphone ${v(1) ?? "?"}, Poste ${v(2) ?? "?"}, Entreprise ${v(3) ?? "?"}.`,
      detail: `Une base exploitable nécessite au minimum 80% d'emails valides, 40% de téléphones et 50% d'entreprises rattachées. Les contacts sans entreprise ne peuvent pas être segmentés par ABM. Les contacts sans téléphone limitent l'outbound multicanal. Priorisez l'enrichissement du champ avec le taux le plus bas — c'est le maillon faible de votre capacité marketing.`,
    });
  }
  // ── Pipeline montant ──
  if (t.includes("montant") && t.includes("projection")) {
    return addCaveat({
      headline: `Pipeline ouvert : ${v(0) ?? "N/A"}. ${v(1) ? `${v(1)} des deals ont un montant renseigné.` : ""} ${v(3) ? `Pipeline pondéré : ${v(3)}.` : ""}`,
      detail: `Deal moyen : ${v(2) ?? "N/A"}. Les deals sans montant renseigné rendent le forecast impossible — chaque deal sans montant est un trou dans votre projection trimestrielle. En dessous de 50% de complétude montant, le pipeline pondéré n'est pas fiable. Exigez le montant dès le stage 020% pour fiabiliser le forecast COMEX.`,
    });
  }
  // ── Revenue par pipeline ──
  if (t.includes("revenue") && t.includes("pipeline") && t.includes("contribution")) {
    return addCaveat({
      headline: `${v(0) ?? "N/A"}. ${v(2) ? `Deal moyen par pipeline : ${v(2)}.` : ""}`,
      detail: `Deals actifs : ${v(1) ?? "N/A"}. ${v(3) ? `Pipeline pondéré : ${v(3)}.` : ""} Comparez le ratio CA/deals entre pipelines — un pipeline avec un deal moyen 3× supérieur mérite plus de ressources commerciales. Le pipeline avec le deal moyen le plus élevé est votre meilleur levier de croissance.`,
    });
  }
  // ── Deals créés vs closés ──
  if (t.includes("créés vs closés") || t.includes("ratio d'efficacité")) {
    return addCaveat({
      headline: `Création : ${v(0) ?? "N/A"}. Won : ${v(1) ?? "N/A"}. Ratio : ${v(2) ?? "N/A"}.`,
      detail: `Pipeline net : ${v(3) ?? "N/A"}. Un ratio créés/closés > 3 signifie que votre pipeline grossit plus vite qu'il ne se ferme — risque de pipeline zombie. Un ratio < 1 signifie que vous consommez votre pipeline sans le renouveler. L'idéal est entre 1.5 et 2.5 : assez de création pour alimenter le funnel, sans accumulation de deals morts.`,
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

export default async function MesRapportsPage() {
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
      const kpiData = await fetchAllKpiData(hubspotToken, supabase, orgId);
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
