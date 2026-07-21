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
  const allSwitchable = await getSwitchableBillingTools(supabase, orgId, token, "audit_paiement_facturation");
  const ledgerTools = allSwitchable.filter((t) => capabilitiesOf(t.key).includes("ledger"));

  const requested = validateSourceParam(typeof sp.source === "string" ? sp.source : null, ledgerTools);
  const activeKey = requested ?? ledgerTools[0]?.key ?? null;
  const activeLabel = ledgerTools.find((t) => t.key === activeKey)?.label ?? activeKey ?? "—";

  const pnl = activeKey ? await computePnl(supabase, orgId, activeKey) : null;

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
          <SourceToolSwitcher
            tools={ledgerTools.map((t) => ({ key: t.key, label: t.label, domain: t.domain, icon: t.icon }))}
            activeKey={activeKey ?? undefined}
          />

          {!pnl?.hasData ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm text-slate-600">
                Aucune écriture comptable synchronisée depuis {activeLabel} pour l&apos;instant.
                Lance une synchronisation depuis Intégrations → Mes outils.
              </p>
            </div>
          ) : (
            <>
              {/* ── P&L ── */}
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

              {/* ── Provisions fiscales estimées ── */}
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

              {/* ── Top charges ── */}
              {pnl.topCharges.length > 0 && (
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
              )}

              {/* ── Balance par classe ── */}
              {pnl.balanceParClasse.length > 0 && (
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
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
