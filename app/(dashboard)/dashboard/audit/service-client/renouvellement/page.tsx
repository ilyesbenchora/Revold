export const dynamic = "force-dynamic";

import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { ServiceClientTabs } from "@/components/service-client-tabs";
import { fetchServiceClientData } from "@/lib/audit/service-client-data";
import { fetchRenewalProductsData } from "@/lib/audit/renewal-products-data";
import { fetchPaiementFacturationFor, fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { PageSourcesGate, PageSourcesFooter } from "@/components/page-sources-gate";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";

// Clé de personnalisation propre à la sous-page (tuiles masquées/renommées,
// KPIs ajoutés) — catalogue de KPIs service client hérité de la page parente.
const PAGE_KEY = "audit_service_client_renouvellement";
// Sources : réglage propre à la sous-page, héritage Vue d'ensemble sinon.
const SOURCE_KEYS = [PAGE_KEY, "audit_service_client"];

export default async function ServiceClientRenouvellementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  const [scData, billing, snapshot, custom, prd] = await Promise.all([
    fetchServiceClientData(supabase, orgId),
    fetchPaiementFacturationFor(supabase, orgId, token),
    getHubspotSnapshot(),
    getPageCustomization(supabase, orgId, PAGE_KEY),
    fetchRenewalProductsData(supabase, orgId),
  ]);

  // ── KPIs renouvellement ──
  // Annual subs : celles dont la fréquence est annuelle (renouvellement plus rare mais critique)
  const annualSubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f.includes("year") || f.includes("annu");
  });
  const monthlySubs = billing.subscriptions.filter((s) => {
    const f = (s.properties.hs_billing_frequency ?? "").toLowerCase();
    return f === "" || f.includes("month") || f.includes("mens");
  });

  // Renewal rate proxy = % de subs actives parmi le total (incl. annulées)
  const renewalRate = billing.subscriptions.length > 0
    ? Math.round((billing.activeSubsCount / billing.subscriptions.length) * 100)
    : null;

  // GRR (Gross Revenue Retention) ≈ 100 - churn rate (sans tenir compte expansion)
  const grr = billing.churnRate != null ? Math.max(0, 100 - billing.churnRate) : null;

  // ARR sécurisé = subs actives × ARPU annuel
  const arpu = billing.activeSubsCount > 0 ? billing.mrr / billing.activeSubsCount : 0;
  const arrSecured = arpu * 12 * billing.activeSubsCount;

  // Risque renouvellement = subs avec problèmes santé (past_due, ticket urgent, etc.)
  const pastDueSubs = billing.subscriptions.filter((s) => s.properties.hs_subscription_status === "past_due").length;
  const renewalAtRisk = pastDueSubs + scData.urgentTickets;
  const arrAtRisk = arpu * 12 * renewalAtRisk;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Service Client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Renouvellement indexé sur les produits : base renouvelable par produit, rétention, GRR et exposition.
        </p>
      </header>

      <ServiceClientTabs />

      {/* Blocs pilotés par « Outil source par page » (réglage propre à la
          sous-page, héritage Vue d'ensemble sinon) — rien sans outil choisi. */}
      <PageSourcesGate supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} categories={["crm", "support"]}>

      {/* Lecture cockpit en un coup d'œil, avant les blocs détaillés —
          tuiles configurables (CTA « Personnaliser les KPIs », ✎, masquage). */}
      {(() => {
        const tiles: DefaultTile[] = [
          {
            key: "base_renouvelable_produits",
            label: "Base renouvelable (produits)",
            value: prd.recurringAmount > 0 ? fmtK(prd.recurringAmount) : "—",
            raw: prd.recurringAmount > 0 ? prd.recurringAmount : null,
            rawUnit: "currency",
            tone: prd.recurringAmount > 0 ? "pos" : "neutral",
            sub: prd.recurringPct != null ? `${prd.recurringPct} % du CA produits` : "CA récurrent des line items",
          },
          {
            key: "produits_recurrents",
            label: "Produits récurrents",
            value: prd.distinctProducts > 0 ? `${prd.recurringProducts} / ${prd.distinctProducts}` : "—",
            raw: prd.distinctProducts > 0 ? prd.recurringProducts : null,
            rawUnit: "count",
            tone: prd.recurringProducts > 0 ? "accent" : "neutral",
            sub: prd.oneShotProducts > 0 ? `${prd.oneShotProducts} produit${prd.oneShotProducts > 1 ? "s" : ""} one-shot` : "Catalogue vendu (line items)",
          },
          {
            key: "renewal_rate",
            label: "Renewal rate",
            value: renewalRate != null ? `${renewalRate} %` : "—",
            raw: renewalRate,
            rawUnit: "percent",
            tone: renewalRate == null ? "neutral" : renewalRate >= 90 ? "pos" : renewalRate >= 70 ? "accent" : "neg",
            sub: "Subs actives / total",
            verdict: renewalRate == null ? undefined
              : renewalRate >= 90 ? { label: "Excellent (> 90 %)", tone: "pos" }
              : renewalRate >= 70 ? { label: "Correct", tone: "warn" }
              : { label: "Fragile (< 70 %)", tone: "neg" },
          },
          {
            key: "grr",
            label: "GRR",
            value: grr != null ? `${grr} %` : "—",
            raw: grr,
            rawUnit: "percent",
            tone: grr == null ? "neutral" : grr >= 95 ? "pos" : grr >= 85 ? "accent" : "neg",
            sub: "Gross Revenue Retention",
          },
          {
            key: "arr_securise",
            label: "ARR sécurisé",
            value: arrSecured > 0 ? fmtK(arrSecured) : "—",
            raw: Math.round(arrSecured),
            rawUnit: "currency",
            tone: "pos",
            sub: `${fmt(billing.activeSubsCount)} subs actives`,
          },
          {
            key: "arr_risque",
            label: "ARR à risque",
            value: arrAtRisk > 0 ? fmtK(arrAtRisk) : "0 €",
            raw: Math.round(arrAtRisk),
            rawUnit: "currency",
            tone: arrAtRisk === 0 ? "pos" : "neg",
            sub: `${renewalAtRisk} compte${renewalAtRisk > 1 ? "s" : ""} exposé${renewalAtRisk > 1 ? "s" : ""}`,
            verdict: arrAtRisk === 0 ? { label: "Rien d'exposé", tone: "pos" }
              : arrAtRisk < arrSecured * 0.1 ? { label: "Exposition limitée", tone: "warn" }
              : { label: "Exposition forte", tone: "neg" },
          },
        ];
        return (
          <ConfigurableKpiTiles
            supabase={supabase}
            orgId={orgId}
            pageKey={PAGE_KEY}
            defaults={tiles}
            customization={custom}
            tablesPageKey={PAGE_KEY}
            hiddenBlocks={hiddenBlockList(custom, (key) => {
              const m = ({
                renouvellement_par_produit: { view: "table", description: "Base renouvelable produit par produit : CA récurrent, ventes, fréquence" },
                mix_recurrent_one_shot: { view: "table", description: "Mix récurrent vs one-shot du catalogue vendu" },
                retention: { view: "table", description: "Renewal rate, GRR, churn rate, customers actifs" },
                cohortes_frequence: { view: "table", description: "Mix subs annuelles / mensuelles" },
                arr_securise_risque: { view: "table", description: "ARR sécurisé vs à risque, subs exposées" },
                engagement_pre_renouvellement: { view: "table", description: "Conversations, proxy CSAT, feedback collecté" },
              } as Record<string, { view: string; description: string }>)[key];
              const c = blockPreviewMeta(key);
              return m ? { ...m, preview: c?.preview } : c;
            })}
          />
        );
      })()}

      {/* ── Indexation PRODUITS : la base renouvelable se lit produit par
          produit (line items CRM), avant les vues globales abonnements. ── */}
      {!custom.hiddenBlocks.has("renouvellement_par_produit") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="renouvellement_par_produit" label="Renouvellement par produit">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Renouvellement par produit
          </h2>
        }
      >
        {prd.lineItemsTotal === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun produit (line item) associé aux transactions du CRM pour l&apos;instant.
            L&apos;analyse par produit s&apos;activera dès que des produits seront rattachés aux deals.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Base renouvelable lue produit par produit : le CA récurrent est celui qui
              revient à échéance — plus la fréquence est longue (annuelle), plus le
              renouvellement est critique car il n&apos;offre qu&apos;une fenêtre par an.
            </p>
            <div className="mt-4">
              <BlockDataTable
                title="Renouvellement par produit"
                subtitle="base renouvelable"
                team="csm"
                unit="currency"
                nameLabel="Produit"
                valueLabel="CA récurrent"
                extraColumns={["CA total", "Ventes", "Récurrentes", "Fréquence"]}
                rows={prd.products.slice(0, 12).map((p) => ({
                  name: p.name,
                  value: p.recurringAmount > 0 ? p.recurringAmount : null,
                  unit: "currency" as const,
                  cells: [fmtK(p.amount), p.count, p.recurringCount, p.frequency ?? "One-shot"],
                }))}
                showTotal
                footnote={prd.products.length > 12
                  ? `Top 12 produits sur ${prd.products.length} — tri par CA récurrent décroissant.`
                  : "Tri par CA récurrent décroissant ; « — » = produit sans récurrence (one-shot)."}
              />
            </div>
          </>
        )}
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("mix_recurrent_one_shot") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="mix_recurrent_one_shot" label="Mix récurrent vs one-shot">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Mix récurrent vs one-shot
          </h2>
        }
      >
        {prd.lineItemsTotal === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun produit (line item) associé aux transactions du CRM pour l&apos;instant.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Part du catalogue vendu qui se renouvelle : plus le mix est récurrent,
              plus le revenu est prévisible — le one-shot doit être re-signé à chaque fois.
            </p>
            <div className="mt-4">
              <BlockDataTable
                title="Mix récurrent vs one-shot"
                subtitle="catalogue vendu"
                team="csm"
                unit="count"
                nameLabel="Indicateur"
                valueLabel="Valeur"
                extraColumns={["Détail"]}
                rows={[
                  { name: "CA récurrent (base renouvelable)", value: prd.recurringAmount > 0 ? prd.recurringAmount : null, unit: "currency", cells: ["Line items avec fréquence de facturation"] },
                  { name: "CA one-shot", value: prd.totalAmount - prd.recurringAmount > 0 ? prd.totalAmount - prd.recurringAmount : null, unit: "currency", cells: ["À re-signer, non renouvelable"] },
                  { name: "% récurrent du CA produits", value: prd.recurringPct, unit: "percent", cells: ["+ de récurrent = + de prévisibilité"] },
                  { name: "CA récurrent annuel", value: prd.annualRecurringAmount > 0 ? prd.annualRecurringAmount : null, unit: "currency", cells: ["Renouvellement critique 1× par an"] },
                  { name: "Produits récurrents", value: prd.recurringProducts, unit: "count", cells: [`Sur ${prd.distinctProducts} produits vendus`] },
                ]}
                footnote="Unités hétérogènes (montants, % et volume) : pas de total agrégé."
              />
            </div>
          </>
        )}
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("retention") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="retention" label="Taux de renouvellement & rétention">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Taux de renouvellement & rétention
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="Taux de renouvellement & rétention"
          subtitle="rétention"
          team="csm"
          unit="percent"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "Renewal rate", value: renewalRate, unit: "percent", cells: ["Active / total subs"] },
            { name: "GRR", value: grr, unit: "percent", cells: ["Gross Revenue Retention"] },
            { name: "Churn rate", value: billing.churnRate ?? null, unit: "percent", cells: ["Cible top quartile : < 5%"] },
            { name: "Customers actifs", value: snapshot.customersCount, unit: "count", cells: ["Lifecycle = customer"] },
          ]}
          footnote="Unités hétérogènes (taux et volume) : pas de total agrégé."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("cohortes_frequence") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="cohortes_frequence" label="Cohortes par fréquence">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Cohortes par fréquence
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Les subs annuelles ont un poids ARR plus élevé mais un cycle de renouvellement
          critique : 1 seule échéance par an, donc moins d&apos;opportunités de remédiation.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Cohortes par fréquence"
            subtitle="mix annuel / mensuel"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Subs annuelles", value: annualSubs.length, unit: "count", cells: ["Renewal critique 1× par an"] },
              { name: "Subs mensuelles", value: monthlySubs.length, unit: "count", cells: ["Renewal continu"] },
              {
                name: "% annuel dans le mix",
                value:
                  billing.subscriptions.length > 0
                    ? Math.round((annualSubs.length / billing.subscriptions.length) * 100)
                    : null,
                unit: "percent",
                cells: ["+ d'annuel = + de stabilité revenue"],
              },
            ]}
            footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("arr_securise_risque") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="arr_securise_risque" label="ARR sécurisé vs à risque">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            ARR sécurisé vs à risque
          </h2>
        }
      >
        {/* Données du bloc + alerte chirurgicale. */}
        <BlockDataTable
          title="ARR sécurisé vs à risque"
          subtitle="ARR"
          team="csm"
          unit="currency"
          nameLabel="Indicateur"
          valueLabel="Valeur"
          extraColumns={["Détail"]}
          rows={[
            { name: "ARR sécurisé", value: arrSecured > 0 ? arrSecured : null, unit: "currency", cells: ["Subs actives healthy"] },
            { name: "ARR à risque", value: arrAtRisk > 0 ? arrAtRisk : null, unit: "currency", cells: ["Past due + tickets urgents"] },
            { name: "Subs à risque", value: renewalAtRisk, unit: "count", cells: ["À traiter en CSM proactif"] },
          ]}
          footnote="Unités hétérogènes (montants et volume) : pas de total agrégé."
        />
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      {!custom.hiddenBlocks.has("engagement_pre_renouvellement") && (
      <RemovableBlock pageKey={PAGE_KEY} blockKey="engagement_pre_renouvellement" label="Engagement pré-renouvellement">
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Engagement pré-renouvellement
          </h2>
        }
      >
        <p className="text-sm text-slate-500">
          Indicateurs d&apos;engagement à surveiller dans les 90 jours avant échéance :
          plus le compte est actif, plus la probabilité de renouvellement augmente.
        </p>
        {/* Données du bloc + alerte chirurgicale. */}
        <div className="mt-4">
          <BlockDataTable
            title="Engagement pré-renouvellement"
            subtitle="engagement"
            team="csm"
            unit="count"
            nameLabel="Indicateur"
            valueLabel="Valeur"
            extraColumns={["Détail"]}
            rows={[
              { name: "Conversations entrantes", value: snapshot.totalConversations, unit: "count", cells: ["Engagement Inbox"] },
              { name: "Tickets résolus < 24h (proxy CSAT)", value: scData.csatProxy ?? null, unit: "percent", cells: ["Proxy CSAT"] },
              { name: "Feedback collecté", value: snapshot.feedbackCount, unit: "count", cells: ["CSAT/NPS submissions"] },
            ]}
            footnote="Unités hétérogènes (volumes et %) : pas de total agrégé."
          />
        </div>
      </CollapsibleBlock>
      </RemovableBlock>
      )}

      </PageSourcesGate>

      <PageDataTables pageKey={PAGE_KEY} />

      <PageSourcesFooter supabase={supabase} orgId={orgId} pageKey={SOURCE_KEYS} />
    </section>
  );
}
