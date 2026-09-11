export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { CreateAlertModal } from "@/components/create-alert-modal";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization } from "@/lib/kpi/page-tiles";
import { CALL_KEYWORD_GROUPS } from "@/lib/integrations/call-keywords";

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
  type OpenDeal = { id: string; name: string | null; amount: number | null; contact_id: string | null; last_contacted_at: string | null };
  let openDeals: OpenDeal[] = [];
  try {
    const { data } = await supabase
      .from("deals")
      .select("id, name, amount, contact_id, last_contacted_at")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(300);
    openDeals = (data ?? []) as OpenDeal[];
  } catch { /* CRM absent → bloc masqué */ }
  const callAgg = new Map<string, { n: number; last: number }>();
  try {
    const ids = [...new Set(openDeals.map((d) => d.contact_id).filter((v): v is string => !!v))];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("activities")
        .select("contact_id, occurred_at")
        .eq("organization_id", orgId)
        .eq("type", "call")
        .in("contact_id", ids)
        .gte("occurred_at", since30)
        .limit(5000);
      for (const c of (data ?? []) as Array<{ contact_id: string | null; occurred_at: string | null }>) {
        if (!c.contact_id) continue;
        const t = c.occurred_at ? new Date(c.occurred_at).getTime() : 0;
        const cur = callAgg.get(c.contact_id) ?? { n: 0, last: 0 };
        cur.n += 1;
        if (t > cur.last) cur.last = t;
        callAgg.set(c.contact_id, cur);
      }
    }
  } catch { /* pas d'appels → listes vides */ }
  const linkedDeals = openDeals.filter((d) => d.contact_id);
  const dealsSansContact = openDeals.length - linkedDeals.length;
  const dealCalls = linkedDeals.map((d) => ({ ...d, calls: callAgg.get(d.contact_id!) ?? { n: 0, last: 0 } }));
  const bienTravailles = dealCalls.filter((d) => d.calls.n >= 2).sort((a, b) => b.calls.n - a.calls.n).slice(0, 8);
  const jamaisAppeles = dealCalls.filter((d) => d.calls.n === 0 && (d.amount ?? 0) > 0).slice(0, 8);
  const fmtEur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const fmtDay = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  // ── CONVERSATIONS À SIGNAUX (transcriptions Aircall AI) : appels des 30
  // derniers jours dont la conversation mentionne un mot-clé business —
  // devis, facturation, prix, résiliation… Résilient : table absente → null.
  type CallInsight = { id: string; contact_id: string | null; occurred_at: string | null; transcript_available: boolean; keywords: string[]; snippet: string | null };
  let insights: CallInsight[] | null = null;
  let transcriptsChecked = 0;
  let transcriptsAvailable = 0;
  try {
    const { data, error } = await supabase
      .from("call_insights")
      .select("id, contact_id, occurred_at, transcript_available, keywords, snippet")
      .eq("organization_id", orgId)
      .gte("occurred_at", since30)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (!error) {
      const rows = (data ?? []) as CallInsight[];
      transcriptsChecked = rows.length;
      transcriptsAvailable = rows.filter((r) => r.transcript_available).length;
      insights = rows.filter((r) => (r.keywords?.length ?? 0) > 0).slice(0, 10);
    }
  } catch { /* migration pas encore appliquée */ }
  // Noms des contacts des conversations affichées (1 requête groupée).
  const insightContactNames = new Map<string, string>();
  try {
    const ids = [...new Set((insights ?? []).map((i) => i.contact_id).filter((v): v is string => !!v))];
    if (ids.length > 0) {
      const { data } = await supabase.from("contacts").select("id, full_name, email").in("id", ids);
      for (const c of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        insightContactNames.set(c.id, c.full_name?.trim() || c.email || "Contact");
      }
    }
  } catch { /* noms absents → « Contact » */ }
  const KEYWORD_LABELS = Object.fromEntries(CALL_KEYWORD_GROUPS.map((g) => [g.key, g.label]));
  const keywordCounts = CALL_KEYWORD_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    n: (insights ?? []).filter((i) => i.keywords.includes(g.key)).length,
  })).filter((k) => k.n > 0);

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
            Performance du phoning : volume d&apos;appels, durée moyenne, taux de décroché, activité par commercial —
            dédiée à ton outil d&apos;appels (Aircall, Ringover, CloudTalk…).
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

        {/* ── Croisement deals ↔ téléphonie (30 derniers jours) ── */}
        {(calls30 ?? 0) > 0 && linkedDeals.length > 0 && !custom.hiddenBlocks.has("travail_telephonique") && (
          <RemovableBlock pageKey="perf_appels" blockKey="travail_telephonique" label="Travail téléphonique des deals">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Travail téléphonique des deals
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                  30 derniers jours
                </span>
              </h2>
            }
          >
            <p className="text-sm text-slate-500">
              Le croisement que ni l&apos;outil d&apos;appels ni le CRM ne montrent seuls : quels deals ouverts sont
              réellement travaillés au téléphone — et lesquels n&apos;ont jamais été appelés malgré leur montant.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BlockDataTable
                title="Deals bien travaillés au téléphone"
                subtitle="≥ 2 appels sur 30 j"
                team="sales"
                unit="count"
                nameLabel="Deal"
                valueLabel="Appels (30 j)"
                extraColumns={["Montant", "Dernier appel"]}
                rows={bienTravailles.map((d) => ({
                  name: d.name?.trim() || "Deal sans nom",
                  value: d.calls.n,
                  unit: "count" as const,
                  tone: "pos" as const,
                  cells: [d.amount ? fmtEur(d.amount) : "—", d.calls.last > 0 ? fmtDay(d.calls.last) : "—"],
                }))}
                emptyLabel="Aucun deal ouvert avec au moins 2 appels sur les 30 derniers jours."
                footnote="Appels rattachés via le contact primaire du deal — plus il y a d'appels, plus le deal est réellement travaillé."
              />
              <BlockDataTable
                title="Deals ouverts jamais appelés"
                subtitle="0 appel sur 30 j"
                team="sales"
                unit="currency"
                nameLabel="Deal"
                valueLabel="Montant"
                extraColumns={["Dernier contact CRM"]}
                rows={jamaisAppeles.map((d) => ({
                  name: d.name?.trim() || "Deal sans nom",
                  value: d.amount,
                  unit: "currency" as const,
                  tone: "neg" as const,
                  cells: [d.last_contacted_at ? fmtDay(new Date(d.last_contacted_at).getTime()) : "jamais"],
                }))}
                emptyLabel="Tous les deals ouverts (avec contact lié) ont été appelés sur les 30 derniers jours."
                footnote={`Triés par montant décroissant — l'argent sans effort téléphonique.${dealsSansContact > 0 ? ` ${dealsSansContact.toLocaleString("fr-FR")} deal${dealsSansContact > 1 ? "s" : ""} sans contact lié : non croisables (associer un contact dans HubSpot).` : ""}`}
              />
            </div>
          </CollapsibleBlock>
          </RemovableBlock>
        )}

        {/* ── Conversations à signaux (transcriptions — mots-clés business) ── */}
        {insights !== null && (calls30 ?? 0) > 0 && !custom.hiddenBlocks.has("conversations_signaux") && (
          <RemovableBlock pageKey="perf_appels" blockKey="conversations_signaux" label="Conversations à signaux">
          <CollapsibleBlock
            title={
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                Conversations à signaux
                <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                  30 derniers jours
                </span>
              </h2>
            }
          >
            <p className="text-sm text-slate-500">
              La mine d&apos;or des conversations : les appels dont la transcription mentionne un sujet business —
              devis, facturation, prix, contrat, résiliation — rattachés au contact CRM. Détection déterministe
              par mots-clés, aucun contenu inventé.
            </p>
            {keywordCounts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {keywordCounts.map((k) => (
                  <span key={k.key} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600">
                    {k.label} · {k.n}
                  </span>
                ))}
              </div>
            )}
            {(insights?.length ?? 0) > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {(insights ?? []).map((i) => (
                  <li key={i.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {i.keywords.map((k) => (
                        <span key={k} className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                          {KEYWORD_LABELS[k] ?? k}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {i.contact_id ? insightContactNames.get(i.contact_id) ?? "Contact" : "Contact non relié"}
                        {i.occurred_at ? ` · ${fmtDay(new Date(i.occurred_at).getTime())}` : ""}
                      </span>
                    </div>
                    {i.snippet && <p className="mt-1.5 text-xs italic leading-relaxed text-slate-600">« {i.snippet} »</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                {transcriptsChecked === 0
                  ? "Les transcriptions s'analysent au fil des synchronisations (10 appels par passage) — reviens après le prochain passage."
                  : transcriptsAvailable === 0
                    ? "Aucune transcription disponible sur les appels analysés — la transcription nécessite l'add-on Aircall AI (conversation intelligence) sur ton compte Aircall."
                    : "Aucun mot-clé business détecté dans les conversations transcrites des 30 derniers jours."}
              </p>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              {transcriptsChecked > 0
                ? `${transcriptsAvailable.toLocaleString("fr-FR")} conversation${transcriptsAvailable > 1 ? "s" : ""} transcrite${transcriptsAvailable > 1 ? "s" : ""} sur ${transcriptsChecked.toLocaleString("fr-FR")} appel${transcriptsChecked > 1 ? "s" : ""} analysé${transcriptsChecked > 1 ? "s" : ""} (30 j). `
                : ""}
              Mots-clés surveillés : {CALL_KEYWORD_GROUPS.map((g) => g.label.toLowerCase()).join(", ")}.
            </p>
          </CollapsibleBlock>
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
