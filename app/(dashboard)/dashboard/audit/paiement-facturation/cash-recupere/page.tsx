export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { CashRecoveryBlock } from "@/components/roi/cash-recovery-block";

/**
 * Trésorerie → CASH RÉCUPÉRÉ : la page du cash réellement rattrapé.
 *  - Relances & cash récupéré (ROI prouvable ligne à ligne) ;
 *  - Réconciliation signé × encaissé PAR ENTREPRISE (rapprochée par
 *    company_id du moteur — SIREN/TVA à l'origine du lien) : le rapport de la
 *    capture marketing, sur les vraies données — l'écart révélé, c'est le
 *    cash à aller chercher.
 */

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));

export default async function CashRecuperePage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }
  const supabase = await createSupabaseServerClient();

  // ── Signé (deals gagnés) et encaissé (factures payées) par entreprise ──
  const signedOf = new Map<string, number>();
  const cashedOf = new Map<string, number>();
  try {
    const [{ data: won }, { data: paid }] = await Promise.all([
      supabase
        .from("deals")
        .select("amount, company_id")
        .eq("organization_id", orgId)
        .eq("is_closed_won", true)
        .not("amount", "is", null)
        .not("company_id", "is", null)
        .limit(5000),
      supabase
        .from("invoices")
        .select("amount_paid, company_id")
        .eq("organization_id", orgId)
        .not("company_id", "is", null)
        .limit(5000),
    ]);
    for (const d of (won ?? []) as Array<{ amount: number | null; company_id: string }>) {
      signedOf.set(d.company_id, (signedOf.get(d.company_id) ?? 0) + (Number(d.amount) || 0));
    }
    for (const i of (paid ?? []) as Array<{ amount_paid: number | null; company_id: string }>) {
      cashedOf.set(i.company_id, (cashedOf.get(i.company_id) ?? 0) + (Number(i.amount_paid) || 0));
    }
  } catch { /* tables absentes → bloc vide honnête */ }

  // Entreprises avec du signé : écart = signé − encaissé, trié par écart.
  const gaps = [...signedOf.entries()]
    .map(([id, signed]) => ({ id, signed, cashed: cashedOf.get(id) ?? 0 }))
    .map((r) => ({ ...r, gap: r.signed - r.cashed }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 25);
  const totalGap = gaps.reduce((s, r) => s + Math.max(0, r.gap), 0);

  // Noms + SIREN des entreprises affichées.
  const nameOf = new Map<string, { name: string; siren: string | null }>();
  if (gaps.length > 0) {
    try {
      const { data } = await supabase
        .from("companies")
        .select("id, name, siren")
        .in("id", gaps.map((g) => g.id));
      for (const c of (data ?? []) as Array<{ id: string; name: string | null; siren: string | null }>) {
        nameOf.set(c.id, { name: c.name ?? "Entreprise sans nom", siren: c.siren });
      }
    } catch { /* noms absents → tirets */ }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cash récupéré : relances d&apos;impayés prouvables ligne à ligne, et écarts signé × encaissé révélés
          entreprise par entreprise — le cash à aller chercher.
        </p>
      </header>

      <PaiementFacturationTabs />

      {/* ── Relances & cash récupéré (ROI) ── */}
      <CashRecoveryBlock />

      {/* ── Réconciliation signé × encaissé (rapport de la capture marketing,
             sur les vraies données) ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Réconciliation signé × encaissé
            {totalGap > 0 && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                {eur(totalGap)} d&apos;écart révélé
              </span>
            )}
          </h2>
        }
      >
        {gaps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Aucun deal gagné rattaché à une entreprise pour l&apos;instant — la réconciliation s&apos;activera à la
            prochaine synchronisation.
          </p>
        ) : (
          <BlockDataTable
            title="Signé (CRM) × encaissé, par entreprise"
            subtitle="rapproché par SIREN / N° TVA"
            team="finance"
            unit="currency"
            nameLabel="Entreprise"
            valueLabel="Écart"
            extraColumns={["SIREN", "Signé (CRM)", "Encaissé"]}
            rows={gaps.map((r) => {
              const meta = nameOf.get(r.id);
              return {
                name: meta?.name ?? "Entreprise sans nom",
                value: Math.round(r.gap),
                unit: "currency" as const,
                // Écart > 0 = cash manquant (rose) ; ≤ 0 = couvert (vert).
                tone: (r.gap > 0 ? "neg" : "pos") as "neg" | "pos",
                cells: [meta?.siren ?? "—", eur(r.signed), eur(r.cashed)],
              };
            })}
            footnote="Signé = deals gagnés du CRM · Encaissé = factures payées (montants encaissés) — rapprochés entreprise par entreprise via le moteur de résolution d'entités (SIREN / N° TVA / ID custom). Un écart positif est du cash signé jamais encaissé : à relancer ci-dessus."
          />
        )}
      </CollapsibleBlock>
    </section>
  );
}
