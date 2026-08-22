export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getSwitchableBillingTools, capabilitiesOf, validateSourceParam } from "@/lib/audit/source-switch";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { SourceToolSwitcher } from "@/components/source-tool-switcher";
import { computePnl } from "@/lib/audit/pnl";
import { fmtK } from "@/lib/audit/paiement-facturation-data";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";
import { RemovableBlock } from "@/components/data-tables/removable-block";
import { PageDataTables } from "@/components/data-tables/page-data-tables";
import { getPageCustomization, hiddenBlockList } from "@/lib/kpi/page-tiles";
import { blockPreviewMeta } from "@/lib/kpi/block-previews";

// Clé de personnalisation propre à la sous-page (tuiles, blocs masqués, tables) —
// catalogue de KPIs et filtre d'outils hérités de la page Trésorerie parente.
const PAGE_KEY = "audit_paiement_facturation_comptabilite";

/**
 * Sous-page « Comptabilité » de la section Trésorerie.
 *
 * Regroupe les blocs reconstruits depuis les écritures comptables (capacité
 * `ledger` — Pennylane…) : P&L, top comptes de charges, balance par classe et
 * provisions fiscales estimées. Sortis de la Vue d'ensemble pour la garder
 * légère (flux bancaires + facturation).
 */
export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const sp = (await searchParams) ?? {};
  // Seuls les outils avec écritures comptables (capacité ledger) sont proposés ici.
  const allSwitchable = await getSwitchableBillingTools(supabase, orgId, token, ["audit_paiement_facturation_comptabilite", "audit_paiement_facturation"]);
  const ledgerTools = allSwitchable.filter((t) => capabilitiesOf(t.key).includes("ledger"));

  const requested = validateSourceParam(typeof sp.source === "string" ? sp.source : null, ledgerTools);
  const activeKey = requested ?? ledgerTools[0]?.key ?? null;
  const activeLabel = ledgerTools.find((t) => t.key === activeKey)?.label ?? activeKey ?? "—";

  const pnl = activeKey ? await computePnl(supabase, orgId, activeKey) : null;

  // Personnalisation de la page : tuiles masquées/ajoutées + blocs retirés.
  const custom = await getPageCustomization(supabase, orgId, PAGE_KEY);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Comptabilité : P&amp;L, balance et provisions reconstruits depuis vos écritures synchronisées.
        </p>
      </header>

      <PaiementFacturationTabs />

      {ledgerTools.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucun outil comptable connecté. Connecte Pennylane pour alimenter cette page
            depuis vos écritures comptables réelles.
          </p>
        </div>
      ) : (
        <>
          {!pnl?.hasData ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm text-slate-600">
                Aucune écriture comptable synchronisée depuis {activeLabel} pour l&apos;instant.
                Lance une synchronisation depuis Intégrations → Mes outils.
              </p>
            </div>
          ) : (
            <>
              {/* ── Tuiles KPI configurables (1 ligne) : lecture cockpit + KPIs ajoutés ── */}
              {(() => {
                const defaults: DefaultTile[] = [
                  { key: "produits", label: "Produits (classe 7)", value: pnl.produits > 0 ? fmtK(pnl.produits) : "—", raw: Math.round(pnl.produits), rawUnit: "currency", tone: "pos", sub: "CA + autres produits comptabilisés" },
                  { key: "charges", label: "Charges (classe 6)", value: pnl.charges > 0 ? fmtK(pnl.charges) : "—", raw: Math.round(pnl.charges), rawUnit: "currency", tone: "neg", sub: "Charges comptabilisées" },
                  {
                    key: "resultat",
                    label: "Résultat",
                    value: fmtK(pnl.resultat),
                    raw: Math.round(pnl.resultat),
                    rawUnit: "currency",
                    tone: pnl.resultat >= 0 ? "pos" : "neg",
                    sub: "Produits − charges",
                    verdict: pnl.resultat >= 0 ? { label: "Bénéficiaire", tone: "pos" } : { label: "Déficitaire", tone: "neg" },
                  },
                  {
                    key: "taux_marge_comptable",
                    label: "Taux de marge comptable",
                    value: pnl.tauxMarge != null ? `${pnl.tauxMarge} %` : "—",
                    raw: pnl.tauxMarge,
                    rawUnit: "percent",
                    tone: pnl.tauxMarge == null ? "neutral" : pnl.tauxMarge >= 40 ? "pos" : pnl.tauxMarge >= 25 ? "accent" : "neg",
                    sub: "Résultat / produits",
                    verdict: pnl.tauxMarge == null ? undefined
                      : pnl.tauxMarge >= 40 ? { label: "Excellent (> 40 %)", tone: "pos" }
                      : pnl.tauxMarge >= 25 ? { label: "Correct", tone: "warn" }
                      : { label: "Faible (< 25 %)", tone: "neg" },
                  },
                ];
                return (
                  <ConfigurableKpiTiles
                    supabase={supabase}
                    orgId={orgId}
                    pageKey={PAGE_KEY}
                    defaults={defaults}
                    customization={custom}
                    tablesPageKey={PAGE_KEY}
                    hiddenBlocks={hiddenBlockList(custom, blockPreviewMeta)}
                  />
                );
              })()}
              {/* ── P&L ── */}
              {!custom.hiddenBlocks.has("pnl") && (
              <RemovableBlock pageKey={PAGE_KEY} blockKey="pnl" label="P&L comptable">
              <CollapsibleBlock
                title={
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    P&amp;L comptable
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{activeLabel}</span>
                  </h2>
                }
              >
                <BlockDataTable
                  title={`P&L comptable (${activeLabel})`}
                  subtitle={`écritures · ${activeLabel}`}
                  team="finance"
                  unit="currency"
                  nameLabel="Indicateur"
                  extraColumns={["Détail"]}
                  rows={[
                    { name: "Produits (classe 7)", value: pnl.produits > 0 ? pnl.produits : null, unit: "currency", tone: "pos", cells: ["CA + autres produits comptabilisés"] },
                    { name: "Charges (classe 6)", value: pnl.charges > 0 ? pnl.charges : null, unit: "currency", tone: "neg", cells: ["Charges comptabilisées"] },
                    { name: "Résultat", value: pnl.hasData ? pnl.resultat : null, unit: "currency", tone: "auto", cells: ["Produits − charges"] },
                    { name: "Taux de marge comptable", value: pnl.tauxMarge, unit: "percent", tone: "auto", cells: ["Résultat / produits"] },
                  ]}
                  footnote="Reconstruit depuis les écritures comptables synchronisées — la marge la plus fiable disponible."
                />
              </CollapsibleBlock>
              </RemovableBlock>
              )}

              {/* ── Provisions fiscales estimées ── */}
              {!custom.hiddenBlocks.has("provisions_fiscales") && (
              <RemovableBlock pageKey={PAGE_KEY} blockKey="provisions_fiscales" label="Provisions fiscales (estimation)">
              <CollapsibleBlock
                title={
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    Provisions fiscales (estimation)
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">{activeLabel}</span>
                  </h2>
                }
              >
                <BlockDataTable
                  title={`Provisions fiscales (${activeLabel})`}
                  subtitle={`écritures · ${activeLabel}`}
                  team="finance"
                  unit="currency"
                  nameLabel="Indicateur"
                  extraColumns={["Détail"]}
                  rows={[
                    { name: "TVA collectée", value: pnl.fiscal.tvaCollectee !== 0 ? pnl.fiscal.tvaCollectee : null, unit: "currency", cells: ["Comptes 4457x (sur ventes)"] },
                    { name: "TVA déductible", value: pnl.fiscal.tvaDeductible !== 0 ? pnl.fiscal.tvaDeductible : null, unit: "currency", cells: ["Comptes 4456x (sur achats)"] },
                    { name: "TVA nette à provisionner", value: pnl.fiscal.tvaCollectee !== 0 || pnl.fiscal.tvaDeductible !== 0 ? pnl.fiscal.tvaNette : null, unit: "currency", tone: "auto", cells: ["Collectée − déductible"] },
                    { name: "IS estimé", value: pnl.fiscal.isEstime, unit: "currency", tone: "neg", cells: ["15 % ≤ 42 500 € puis 25 % — si bénéfice"] },
                  ]}
                  footnote="Approximations d'aide à la décision depuis vos comptes — pas des déclarations officielles, à confirmer avec votre expert-comptable."
                />
              </CollapsibleBlock>
              </RemovableBlock>
              )}

              {/* ── Top charges ── */}
              {pnl.topCharges.length > 0 && !custom.hiddenBlocks.has("top_charges") && (
              <RemovableBlock pageKey={PAGE_KEY} blockKey="top_charges" label="Top comptes de charges">
                <CollapsibleBlock
                  title={
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      Top comptes de charges
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{activeLabel}</span>
                    </h2>
                  }
                >
                  <BlockDataTable
                    title={`Top comptes de charges (${activeLabel})`}
                    subtitle={`écritures · ${activeLabel}`}
                    team="finance"
                    unit="currency"
                    nameLabel="Compte"
                    extraColumns={["N°"]}
                    rows={pnl.topCharges.map((c) => ({
                      name: c.label ?? `Compte ${c.account}`,
                      value: c.total,
                      unit: "currency" as const,
                      tone: "neg" as const,
                      cells: [c.account],
                    }))}
                    footnote="Principaux postes de charges par compte comptable (PCG)."
                  />
                </CollapsibleBlock>
              </RemovableBlock>
              )}

              {/* ── Balance par classe ── */}
              {pnl.balanceParClasse.length > 0 && !custom.hiddenBlocks.has("balance_classe") && (
              <RemovableBlock pageKey={PAGE_KEY} blockKey="balance_classe" label="Balance par classe">
                <CollapsibleBlock
                  title={
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      Balance par classe
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{activeLabel}</span>
                    </h2>
                  }
                >
                  <BlockDataTable
                    title={`Balance par classe (${activeLabel})`}
                    subtitle={`écritures · ${activeLabel}`}
                    team="finance"
                    unit="currency"
                    nameLabel="Classe"
                    extraColumns={["Débit", "Crédit"]}
                    rows={pnl.balanceParClasse.map((b) => ({
                      name: `${b.classe} — ${b.label}`,
                      value: b.solde,
                      unit: "currency" as const,
                      tone: "auto" as const,
                      cells: [fmtK(b.debit), fmtK(b.credit)],
                    }))}
                    footnote="Balance générale synthétique reconstruite (solde = débit − crédit par classe de comptes)."
                  />
                </CollapsibleBlock>
              </RemovableBlock>
              )}
            </>
          )}

          {/* ── Tables & graphiques ajoutés par l'utilisateur (funnel unique) ── */}
          <PageDataTables pageKey={PAGE_KEY} />

          {/* Outil source des blocs — rappel discret en bas de page, switch au clic */}
          <SourceToolSwitcher
            tools={ledgerTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
            activeKey={activeKey ?? undefined}
          />
        </>
      )}
    </section>
  );
}
