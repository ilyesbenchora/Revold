export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { loadSourceLinkStats } from "@/lib/integrations/source-link-stats";
import { BrandLogo } from "@/components/brand-logo";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { ToolAuditCard } from "@/components/tool-audit-card";
import { RecommendationCard } from "@/components/recommendation-card";
import { loadToolAudits, buildOnboardingRecommendations } from "@/lib/audit/onboarding-audit";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { BlocksManager } from "@/components/data-tables/blocks-manager";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { HBarChart } from "@/components/charts/hbar-chart";
import { computeObjectSummaries } from "@/lib/audit/object-summaries";
import { computeUnmatchedReport, computeWonDealsReadiness, type UnmatchedCause } from "@/lib/audit/unmatched-companies";
import Link from "next/link";

/** Badges des causes de non-rapprochement (diagnostic entreprises). */
const CAUSE_BADGES: Record<UnmatchedCause, { label: string; cls: string }> = {
  missing_identifiers: { label: "SIREN / SIRET absent", cls: "bg-rose-50 text-rose-700" },
  name_mismatch: { label: "Nom différent", cls: "bg-amber-50 text-amber-700" },
  email_mismatch: { label: "Email différent", cls: "bg-indigo-50 text-indigo-700" },
  no_candidate: { label: "Aucune correspondance", cls: "bg-slate-100 text-slate-600" },
};

/** Libellés utilisateur des méthodes de rapprochement (match_method). */
const MATCH_METHOD_LABELS: Record<string, string> = {
  siren: "SIREN",
  siret: "SIRET",
  vat_number: "N° TVA",
  exact_email: "Email exact",
  domain: "Domaine",
  name: "Nom d'entreprise",
  existing_link: "Lien existant",
  created: "Nouvelle fiche (aucune correspondance)",
};

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // ── Tout depuis HubSpot (snapshot) ──
  // Pour les "with X" on dérive depuis les "no X" du snapshot (total - noX)
  const contactsTotal = snapshot.totalContacts;
  const contactsCompany = Math.max(0, contactsTotal - snapshot.orphansCount);
  const companiesTotal = snapshot.totalCompanies;
  const companiesDomain = Math.max(0, companiesTotal - snapshot.companiesNoDomain);
  const dealsTotal = snapshot.totalDeals;
  const dealsAmount = Math.max(0, dealsTotal - snapshot.dealsNoAmount);

  const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);

  // ── Rapprochement inter-outils : stats RÉELLES mesurées sur source_links.
  //    (Les volumes bruts par outil vivent désormais dans les onglets dédiés
  //    par outil — la vue d'ensemble analyse le CROISEMENT des données.) ──
  const [connectedTools, linkStats] = await Promise.all([
    getConnectedTools(supabase, orgId),
    loadSourceLinkStats(supabase, orgId),
  ]);
  const reconTools = connectedTools.filter((t) => {
    const def = CONNECTABLE_TOOLS[t.key];
    return t.key !== "hubspot" && def && def.category !== "communication";
  });
  // Taux CRM × outil — un outil connecté sans donnée rapprochée apparaît
  // quand même, à 0, avec l'invite de sync (même règle que les Paramètres).
  const toolRates = reconTools.map((t) => {
    const rate = linkStats.providerRates.find((pr) => pr.provider === t.key);
    return {
      provider: t.key,
      label: t.label,
      icon: t.icon,
      domain: t.domain,
      total: rate?.total ?? 0,
      matched: rate?.matched ?? 0,
      pct: rate?.pct ?? 0,
    };
  });
  const ratedTools = toolRates.filter((t) => t.total > 0);
  const globalTotal = ratedTools.reduce((s, t) => s + t.total, 0);
  const globalMatched = ratedTools.reduce((s, t) => s + t.matched, 0);
  const globalRate = globalTotal > 0
    ? { total: globalTotal, matched: globalMatched, pct: Math.round((globalMatched / globalTotal) * 100) }
    : null;
  const methodItems = Object.entries(linkStats.methodStats)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: MATCH_METHOD_LABELS[k] ?? k, value: v }));

  // ── Audit onboarding (ex-onglet dédié, désormais dans la vue d'ensemble) :
  //    ce que Revold a détecté outil par outil + plan d'action IA. ──
  const auditTools = connectedTools.filter((t) => CONNECTABLE_TOOLS[t.key]?.category !== "communication");
  const toolAudits = auditTools.length > 0 ? await loadToolAudits(supabase, orgId, auditTools, hubspotToken) : [];
  const onboardingRecos = buildOnboardingRecommendations(toolAudits);

  // Synthèse par objet (volumes + complétude) — les CARTES vivent désormais
  // dans la sous-page HubSpot ; ici on n'en garde que la matière pour la
  // tuile « Complétude moyenne ».
  const summaries = await computeObjectSummaries(supabase, orgId);

  // ── Entreprises non rapprochées CRM × facturation : cause + action corrective.
  //    Périmètre volontairement limité aux entreprises DÉJÀ vues côté
  //    facturation (les seules réellement facturées). ──
  const unmatched = await computeUnmatchedReport(supabase, orgId);

  // ── Anticipation : deals GAGNÉS (les prochains facturés) — leurs fiches
  //    portent-elles les identifiants de rapprochement cochés en paramètres ? ──
  const wonReadiness = await computeWonDealsReadiness(supabase, orgId);

  // Personnalisation de la page : tuiles KPI masquées/ajoutées + blocs masqués.
  const custom = await getPageCustomization(supabase, orgId, "audit_donnees");

  // Tuiles par défaut (mêmes valeurs qu'avant — désormais masquables/remplaçables).
  const allMetrics = summaries.flatMap((s) => s.metrics.map((m) => m.pct));
  const avgFill = allMetrics.length > 0 ? Math.round(allMetrics.reduce((n, p) => n + p, 0) / allMetrics.length) : null;
  // Code couleur des tuiles : vert ≥ 80 %, indigo ≥ 50 %, rouge en dessous.
  const toneForPct = (p: number): DefaultTile["tone"] => (p >= 80 ? "pos" : p >= 50 ? "accent" : "neg");
  const contactsPct = pct(contactsCompany, contactsTotal);
  const companiesPct = pct(companiesDomain, companiesTotal);
  const dealsPct = pct(dealsAmount, dealsTotal);
  const defaultTiles: DefaultTile[] = (contactsTotal > 0 || companiesTotal > 0 || dealsTotal > 0)
    ? [
        { key: "contacts", label: "Contacts", value: contactsTotal.toLocaleString("fr-FR"), tone: toneForPct(contactsPct), sub: `${contactsPct} % liés à une entreprise` },
        { key: "entreprises", label: "Entreprises", value: companiesTotal.toLocaleString("fr-FR"), tone: toneForPct(companiesPct), sub: `${companiesPct} % avec domaine` },
        { key: "transactions", label: "Transactions", value: dealsTotal.toLocaleString("fr-FR"), tone: toneForPct(dealsPct), sub: `${dealsPct} % avec montant` },
        {
          key: "completude",
          label: "Complétude moyenne",
          value: avgFill != null ? `${avgFill} %` : "—",
          tone: avgFill == null ? "neutral" : avgFill >= 80 ? "pos" : avgFill >= 50 ? "accent" : "neg",
          sub: `${allMetrics.length} propriétés clés confondues`,
          verdict: avgFill == null ? undefined
            : avgFill >= 80 ? { label: "Base saine (> 80 %)", tone: "pos" }
            : avgFill >= 50 ? { label: "À enrichir", tone: "warn" }
            : { label: "Base incomplète (< 50 %)", tone: "neg" },
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ── BANDEAU DIAGNOSTIC SNAPSHOT (si erreur) ── */}
      {snapshot.status === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-900">⚠ Erreur de récupération des données HubSpot</p>
          <p className="mt-1 text-xs text-rose-800">
            Le snapshot n&apos;a pas pu être chargé : {snapshot.error ?? "erreur inconnue"}.
            Les compteurs HubSpot sont à 0 par défaut. Vérifiez la connexion HubSpot dans
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations</Link>.
          </p>
        </div>
      )}
      {snapshot.status === "no-token" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">🔌 HubSpot non connecté</p>
          <p className="mt-1 text-xs text-amber-800">
            Connectez votre portail HubSpot via OAuth pour alimenter cette page.
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations →</Link>
          </p>
        </div>
      )}

      {/* Blocs pilotés par « Outil source par page » — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey="audit_donnees" categories={["crm", "billing", "support"]}>

      {/* Lecture cockpit en un coup d'œil : tuiles KPI configurables */}
      <ConfigurableKpiTiles
        supabase={supabase}
        orgId={orgId}
        pageKey="audit_donnees"
        defaults={defaultTiles}
        customization={custom}
      />

      {/* ── RAPPROCHEMENT INTER-OUTILS : la donnée croisée, pas les volumes
             bruts (les hubs par outil vivent dans leurs onglets dédiés). ── */}
      {toolRates.length > 0 && !custom.hiddenBlocks.has("crm_match_rate") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="crm_match_rate" label="Taux de rapprochement réel avec le CRM">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Taux de rapprochement réel avec le CRM
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Part des enregistrements de chaque outil connecté reliés à une entité HubSpot —
                  règles configurables dans{" "}
                  <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
                    Paramètres → Modèle de données
                  </Link>
                  .
                </p>
              </div>
              {/* Taux global — tous outils confondus */}
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${globalRate == null ? "text-slate-400" : "text-slate-900"}`}>
                  {globalRate ? `${globalRate.pct} %` : "—"}
                </p>
                <p className="text-[10px] text-slate-400">
                  global{globalRate ? ` (${globalRate.matched}/${globalRate.total})` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {toolRates.map((t) => (
                <div key={t.provider} className="flex items-center gap-3">
                  <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={24} />
                  <div className="min-w-0 flex-1">
                    {t.total === 0 ? (
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                        <span className="text-[11px] text-slate-400">
                          Aucun enregistrement rapproché — lance une synchronisation depuis Intégrations
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-medium text-slate-700">{t.label} × HubSpot</span>
                          <span className="font-bold tabular-nums text-slate-900">
                            {t.pct} % <span className="font-normal text-slate-400">({t.matched}/{t.total})</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${t.pct >= 70 ? "bg-emerald-500" : t.pct >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${t.pct}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* KPIs de détail : santé du croisement inter-outils */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {linkStats.multiSourcePct != null ? `${linkStats.multiSourcePct} %` : "—"}
                </p>
                <p className="text-[10px] text-slate-400">entités multi-sources (≥ 2 outils)</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {linkStats.totalLinks.toLocaleString("fr-FR")}
                </p>
                <p className="text-[10px] text-slate-400">liens de rapprochement mesurés</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {methodItems[0]?.label ?? "—"}
                </p>
                <p className="text-[10px] text-slate-400">méthode de rapprochement dominante</p>
              </div>
            </div>
          </div>
        </RemovableBlock>
      )}

      {/* Répartition des rapprochements par méthode (SIREN, TVA, email…) */}
      {methodItems.length > 0 && !custom.hiddenBlocks.has("match_methods") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="match_methods" label="Méthodes de rapprochement">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-800">Méthodes de rapprochement</p>
            <p className="mb-3 text-[10px] text-slate-400">
              Comment les enregistrements des outils ont été reliés entre eux — mesuré sur les liens réels.
              «&nbsp;Nouvelle fiche (aucune correspondance)&nbsp;» = aucune de tes règles (SIREN, SIRET, TVA, email,
              domaine, nom) n&apos;a trouvé d&apos;équivalent dans les autres outils : Revold a donc créé une fiche —
              soit l&apos;entité n&apos;existe réellement que dans cet outil, soit l&apos;identifiant de rapprochement
              manque d&apos;un côté (à compléter dans l&apos;outil source).
            </p>
            <HBarChart unit="count" colorize items={methodItems} />
          </div>
        </RemovableBlock>
      )}

      {/* ── DEALS GAGNÉS : anticiper le rapprochement AVANT la facture — seules
             les entreprises gagnées seront facturées ; on vérifie qu'elles
             portent les identifiants cochés dans les paramètres. ── */}
      {wonReadiness.hasData && !custom.hiddenBlocks.has("won_readiness") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="won_readiness" label="Deals gagnés — prêts pour le rapprochement">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Deals gagnés : prêts pour le rapprochement ?
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Seules les entreprises avec un deal gagné seront facturées. On vérifie EN AMONT que leur
                  fiche CRM porte les identifiants de rapprochement cochés dans{" "}
                  <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
                    tes paramètres
                  </Link>{" "}
                  — pour que la facture, une fois émise, se rapproche toute seule.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${wonReadiness.items.length === 0 ? "text-emerald-600" : "text-slate-900"}`}>
                  {wonReadiness.readyCount}/{wonReadiness.totalCompanies}
                </p>
                <p className="text-[10px] text-slate-400">fiches prêtes</p>
              </div>
            </div>

            {/* Identifiants réellement contrôlés = règles cochées en paramètres */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400">Identifiants contrôlés :</span>
              {wonReadiness.activeIdentifiers.map((l) => (
                <span key={l} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {l}
                </span>
              ))}
            </div>

            {wonReadiness.items.length === 0 ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                ✓ Toutes les entreprises gagnées portent au moins un identifiant fort — leurs factures se
                rapprocheront automatiquement.
              </p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-slate-100">
                  {wonReadiness.items.map((it, i) => (
                    <li key={`${it.companyName}-${i}`} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{it.companyName}</span>
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {it.dealsCount} deal{it.dealsCount > 1 ? "s" : ""} gagné{it.dealsCount > 1 ? "s" : ""}
                          {it.totalAmount > 0 && <> · {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(it.totalAmount)}</>}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Manquants :</span>
                        {it.missing.map((m) => (
                          <span key={m} className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{m}</span>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-slate-700">
                        <span aria-hidden>💡</span> Renseigne {it.missing.slice(0, 2).join(" et ")} sur la fiche CRM
                        avant la facturation — le rapprochement sera automatique.
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-slate-400">
                  Facturation électronique obligatoire en septembre : le SIREN devient l&apos;identifiant pivot —
                  enrichir ces fiches maintenant, c&apos;est un rapprochement sans friction au moment de la facture.
                </p>
              </>
            )}
          </div>
        </RemovableBlock>
      )}

      {/* ── ENTREPRISES NON RAPPROCHÉES : le diagnostic par CAUSE + l'action
             corrective concrète (nom différent, email différent, SIREN absent). ── */}
      {unmatched.hasData && !custom.hiddenBlocks.has("unmatched_companies") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="unmatched_companies" label="Entreprises non rapprochées">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Entreprises non rapprochées CRM × facturation
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Entreprises vues dans tes outils de facturation/paiement mais SANS lien avec une fiche CRM —
                  avec la cause diagnostiquée et l&apos;action qui corrige.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-2xl font-bold tabular-nums ${unmatched.items.length === 0 ? "text-emerald-600" : "text-slate-900"}`}>
                  {unmatched.items.length === 0 ? "0" : Object.values(unmatched.counts).reduce((s, n) => s + n, 0)}
                </p>
                <p className="text-[10px] text-slate-400">non rapprochées</p>
              </div>
            </div>

            {unmatched.items.length === 0 ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                ✓ Toutes les entreprises facturées sont reliées au CRM — rien à corriger.
              </p>
            ) : (
              <>
                {/* Répartition par cause */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(CAUSE_BADGES) as UnmatchedCause[])
                    .filter((c) => unmatched.counts[c] > 0)
                    .map((c) => (
                      <span key={c} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CAUSE_BADGES[c].cls}`}>
                        {CAUSE_BADGES[c].label} · {unmatched.counts[c]}
                      </span>
                    ))}
                </div>

                <ul className="mt-3 divide-y divide-slate-100">
                  {unmatched.items.map((it, i) => (
                    <li key={`${it.provider}-${it.label}-${i}`} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <BrandLogo domain={CONNECTABLE_TOOLS[it.provider]?.domain ?? ""} alt={it.providerLabel} fallback={CONNECTABLE_TOOLS[it.provider]?.icon ?? "🔗"} size={16} />
                        <span className="text-xs font-semibold text-slate-900">{it.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CAUSE_BADGES[it.cause].cls}`}>
                          {CAUSE_BADGES[it.cause].label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{it.detail}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-700">
                        <span aria-hidden>💡</span> {it.action}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-slate-400">
                  Facturation électronique obligatoire en septembre : le SIREN devient l&apos;identifiant pivot des
                  factures — enrichir le CRM maintenant (SIREN, SIRET, N° TVA) fiabilise le rapprochement automatique.
                  Règles dans{" "}
                  <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-fuchsia-600 hover:underline">
                    Paramètres → Modèle de données
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </RemovableBlock>
      )}

      {/* ── Audit onboarding : ce que Revold a détecté outil par outil (ex-onglet dédié) ── */}
      {toolAudits.length > 0 && !custom.hiddenBlocks.has("audit_outils") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="audit_outils" label="Audit par outil">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Audit par outil</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Volumes importés, méthodes de rapprochement réellement utilisées et couverture de vos
                identifiants (SIREN, N° TVA, email). Le mapping des champs se configure dans{" "}
                <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-accent hover:underline">
                  Paramètres → Modèle de données
                </Link>
                .
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {toolAudits.map((tool) => (
                <ToolAuditCard key={tool.key} tool={tool} />
              ))}
            </div>
          </div>
        </RemovableBlock>
      )}

      {/* ── Plan d'action IA issu de l'audit ── */}
      {onboardingRecos.length > 0 && !custom.hiddenBlocks.has("plan_action") && (
        <RemovableBlock pageKey="audit_donnees" blockKey="plan_action" label="Plan d'action IA">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Plan d&apos;action IA</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Les actions détectées par l&apos;audit — configuration Revold ET optimisations de process
                internes dans vos outils. Activez une action pour la transformer en coaching IA suivi.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {onboardingRecos.map((reco) => (
                <RecommendationCard key={reco.id} reco={reco} />
              ))}
            </div>
          </div>
        </RemovableBlock>
      )}

      {/* Ajouter un bloc : réafficher un bloc masqué ou créer depuis les suggestions.
          (Blocs supprimés de la page — « Synthèse par objet CRM », « Complétude
          des propriétés clés », cartes objets déplacées vers la page HubSpot :
          on filtre leurs éventuels masquages.) */}
      <BlocksManager
        pageKey="audit_donnees"
        tablesPageKey="audit_donnees"
        hiddenBlocks={hiddenBlockList(custom, (key) => ({
          crm_match_rate: { view: "chart-bar", description: "Taux de rapprochement réel CRM × outil + santé du croisement" },
          match_methods: { view: "chart-bar", description: "Répartition des méthodes de rapprochement (SIREN, TVA, email…)" },
          won_readiness: { view: "table", description: "Deals gagnés : fiches prêtes pour le rapprochement (identifiants cochés)" },
          unmatched_companies: { view: "table", description: "Entreprises non rapprochées CRM × facturation : cause + action corrective" },
          audit_outils: { view: "table", description: "Audit par outil : volumes, rapprochements, identifiants, sync" },
          plan_action: { view: "table", description: "Plan d'action IA issu de l'audit d'onboarding" },
        }[key])).filter((h) => !["synthese_objets", "completude_bars", "objets_cards", "dedup_rules"].includes(h.key))}
      />

      </PageSourcesGate>

      <PageDataTables pageKey="audit_donnees" />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey="audit_donnees" />

    </div>
  );
}
