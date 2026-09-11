export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization } from "@/lib/kpi/page-tiles";
import { PhoneWorkBlock } from "@/components/appels/phone-work-block";
import { CallInsightsBlock } from "@/components/appels/call-insights-block";

/**
 * Page « Appels » (section Données) — même squelette que Performances mais
 * SANS sous-page : dédiée au phoning. Aucune donnée en dur : la page est
 * préparée et s'active dès qu'un outil d'appels (Aircall, Ringover,
 * CloudTalk…) est connecté et choisi comme source (même gate que les autres
 * pages Données).
 */
export default async function AppelsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // ── KPIs de phoning sur les 30 DERNIERS JOURS (la période est toujours
  // dite) — calculés sur le miroir canonique `activities` type "call"
  // (alimenté par le connecteur Aircall & co). Résilient : erreur → null (—).
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countCalls = async (apply: (q: any) => any): Promise<number | null> => {
    try {
      const { count, error } = await apply(
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("type", "call")
          .gte("occurred_at", since30),
      );
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  };
  const [calls30, sortants30, entrants30, manques30, relies30, durations] = await Promise.all([
    countCalls((q) => q),
    countCalls((q) => q.ilike("subject", "%sortant%")),
    countCalls((q) => q.ilike("subject", "%entrant%")),
    countCalls((q) => q.ilike("subject", "%manqué%")),
    countCalls((q) => q.not("contact_id", "is", null)),
    supabase
      .from("activities")
      .select("duration_minutes")
      .eq("organization_id", orgId)
      .eq("type", "call")
      .gte("occurred_at", since30)
      .not("duration_minutes", "is", null)
      .limit(2000)
      .then(({ data, error }) => (error ? null : ((data ?? []) as Array<{ duration_minutes: number }>).map((r) => Number(r.duration_minutes) || 0))),
  ]);
  const aboutis30 = calls30 != null && manques30 != null ? calls30 - manques30 : null;
  const decroche = calls30 != null && calls30 > 0 && aboutis30 != null ? Math.round((aboutis30 / calls30) * 100) : null;
  const avgMin = durations && durations.length > 0 ? Math.round((durations.reduce((s, v) => s + v, 0) / durations.length) * 10) / 10 : null;
  const reliesPct = calls30 != null && calls30 > 0 && relies30 != null ? Math.round((relies30 / calls30) * 100) : null;
  const fmtN = (v: number | null) => (v != null ? v.toLocaleString("fr-FR") : "—");

  // ── CROISEMENT deals ↔ appels (la valeur ajoutée vs les dashboards Aircall) :
  // deals ouverts BIEN TRAVAILLÉS au téléphone (≥ 2 appels sur 30 j) vs deals
  // ouverts JAMAIS APPELÉS — via le contact primaire du deal. Les deals sans
  // contact lié sont comptés à part (impossible à croiser, dit honnêtement).
  const custom = await getPageCustomization(supabase, orgId, "perf_appels");
  // Le calcul du croisement vit dans /api/appels/phone-work (période au choix,
  // composant client PhoneWorkBlock) — ici seulement le GATE : y a-t-il des
  // deals ouverts avec un contact lié à croiser ?
  let linkedDeals: Array<{ id: string }> = [];
  try {
    const { data } = await supabase
      .from("deals")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .not("contact_id", "is", null)
      .limit(1);
    linkedDeals = (data ?? []) as Array<{ id: string }>;
  } catch { /* CRM absent → bloc masqué */ }
  // ── CONVERSATIONS À SIGNAUX : le contenu (période + cohorte au choix) vit
  // dans /api/appels/call-insights (composant client CallInsightsBlock) — ici
  // seulement le GATE : la table existe-t-elle (migration appliquée) ?
  let insightsReady = false;
  try {
    const { error } = await supabase
      .from("call_insights")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    insightsReady = !error;
  } catch { /* migration pas encore appliquée → bloc masqué */ }

  const defaultTiles: DefaultTile[] = [
    { key: "appels_30j", label: "Appels", value: fmtN(calls30), raw: calls30, rawUnit: "count", tone: "accent", sub: "30 derniers jours" },
    { key: "sortants_30j", label: "Sortants", value: fmtN(sortants30), raw: sortants30, rawUnit: "count", tone: "neutral", sub: "émis — 30 derniers jours" },
    { key: "entrants_30j", label: "Entrants", value: fmtN(entrants30), raw: entrants30, rawUnit: "count", tone: "neutral", sub: "reçus — 30 derniers jours" },
    {
      key: "decroche_30j",
      label: "Taux de décroché",
      value: decroche != null ? `${decroche} %` : "—",
      raw: decroche,
      rawUnit: "percent",
      tone: decroche == null ? "neutral" : decroche >= 80 ? "pos" : decroche >= 60 ? "accent" : "neg",
      sub: `${fmtN(manques30)} manqué${(manques30 ?? 0) > 1 ? "s" : ""} — 30 derniers jours`,
      verdict: decroche == null ? undefined
        : decroche >= 80 ? { label: "Excellent (> 80 %)", tone: "pos" }
        : decroche >= 60 ? { label: "Correct", tone: "warn" }
        : { label: "Faible (< 60 %)", tone: "neg" },
    },
    {
      key: "duree_moyenne_30j",
      label: "Durée moyenne",
      value: avgMin != null ? `${avgMin.toLocaleString("fr-FR")} min` : "—",
      raw: avgMin,
      rawUnit: "count",
      tone: "neutral",
      sub: "par appel — 30 derniers jours",
    },
    {
      key: "relies_crm_30j",
      label: "Reliés au CRM",
      value: fmtN(relies30),
      raw: relies30,
      rawUnit: "count",
      tone: reliesPct != null && reliesPct < 50 ? "neg" : "pos",
      sub: reliesPct != null ? `${reliesPct} % des appels rattachés à un contact — 30 derniers jours` : "appels rattachés à un contact",
    },
  ];

  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Appels</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vos appels et conversations, croisés avec le reste de vos outils : volume, durée et taux de décroché
            reliés aux deals, aux comptes et aux tickets — pour voir ce que le phoning déclenche vraiment (pipeline
            créé, réactivation, rétention), pas seulement l&apos;activité.
          </p>
        </div>
      </header>

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_appels" categories={["phone"]}>
        {/* Tuiles KPI configurables (retrait/réajout, suggestions phoning du
            catalogue — même CTA « Personnaliser les KPIs » que partout). */}
        <ConfigurableKpiTiles
          supabase={supabase}
          orgId={orgId}
          pageKey="perf_appels"
          defaults={defaultTiles}
          tablesPageKey="perf_appels"
        />

        {/* ── Croisement deals ↔ téléphonie : PÉRIODE au choix (même barre que
               les tables de données — presets, exercice, dates custom), tables
               enrichies (temps en ligne, contact, dates). ── */}
        {(calls30 ?? 0) > 0 && linkedDeals.length > 0 && !custom.hiddenBlocks.has("travail_telephonique") && (
          <RemovableBlock pageKey="perf_appels" blockKey="travail_telephonique" label="Travail téléphonique des deals">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Travail téléphonique des deals
              </h2>
            }
          >
            <p className="text-sm text-slate-500">
              Le croisement que ni l&apos;outil d&apos;appels ni le CRM ne montrent seuls : quels deals ouverts sont
              réellement travaillés au téléphone — et lesquels n&apos;ont jamais été appelés malgré leur montant.
            </p>
            <div className="mt-4">
              <PhoneWorkBlock />
            </div>
          </CollapsibleBlock>
          </RemovableBlock>
        )}

        {/* ── Conversations à signaux (transcriptions — mots-clés business) :
               période + cohorte au choix, même consultation que les tables. ── */}
        {insightsReady && (calls30 ?? 0) > 0 && !custom.hiddenBlocks.has("conversations_signaux") && (
          <RemovableBlock pageKey="perf_appels" blockKey="conversations_signaux" label="Conversations à signaux">
            <CallInsightsBlock />
          </RemovableBlock>
        )}

        {calls30 === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-2xl" aria-hidden>📞</p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Outil de phoning connecté — les appels arrivent à la prochaine synchronisation.
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Les tuiles ci-dessus se rempliront automatiquement (volume, décroché, durées, rattachement CRM).
              Tu peux aussi ajouter des KPIs de phoning depuis «&nbsp;Personnaliser les KPIs&nbsp;» — ils sont
              recalculables par période comme partout ailleurs.
            </p>
          </div>
        )}
      </PageSourcesGate>

      <PageDataTables pageKey="perf_appels" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_appels" categories={["phone"]} />

      <CreateAlertModal hideTrigger />
    </section>
  );
}
