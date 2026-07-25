export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeReceivables, type AgedSide } from "@/lib/audit/receivables";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { PaiementFacturationTabs } from "@/components/paiement-facturation-tabs";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { fmt, fmtK } from "@/lib/audit/paiement-facturation-data";
import { KpiStatTiles, type StatTile } from "@/components/kpi-stat-tiles";

/**
 * Poste clients / fournisseurs — créances & dettes ouvertes, balance âgée
 * (adapté du template Lomed Cockpit sur les factures canoniques, toutes
 * sources synchronisées confondues).
 */

function SideBlock({ side, kind }: { side: AgedSide; kind: "clients" | "fournisseurs" }) {
  const isClients = kind === "clients";
  const label = isClients ? "Créances clients" : "Dettes fournisseurs";
  return (
    <CollapsibleBlock
      title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          {label}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isClients ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            {fmtK(side.total)} · {fmt(side.count)} facture{side.count > 1 ? "s" : ""}
          </span>
        </h2>
      }
    >
      {side.count === 0 && side.draftCount === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Aucune facture {isClients ? "client" : "fournisseur"} ouverte dans les sources synchronisées.
        </p>
      ) : (
        <>
          {/* Balance âgée + alerte chirurgicale */}
          <BlockDataTable
            title={`Balance âgée — ${label.toLowerCase()}`}
            subtitle="par retard d'échéance"
            team="finance"
            unit="currency"
            nameLabel="Tranche"
            valueLabel="Montant"
            extraColumns={["Factures"]}
            showTotal
            rows={side.buckets.map((b) => ({
              name: b.label,
              value: b.amount,
              cells: [b.count > 0 ? fmt(b.count) : "—"],
            }))}
            footnote={
              side.draftCount > 0
                ? `+ ${fmt(side.draftCount)} brouillon${side.draftCount > 1 ? "s" : ""} (${fmtK(side.draftTotal)}) engagé${side.draftCount > 1 ? "s" : ""} mais pas encore exigible${side.draftCount > 1 ? "s" : ""} — comptés à part.`
                : "Avoirs comptés en valeur absolue ; factures payées et annulées exclues."
            }
          />

          {side.top.length > 0 && (
            <div className="mt-4">
              <BlockDataTable
                title={`Plus gros restes dus — ${label.toLowerCase()}`}
                subtitle="top 15"
                team="finance"
                unit="currency"
                nameLabel={isClients ? "Client" : "Fournisseur"}
                valueLabel="Reste dû"
                extraColumns={["N° facture", "Échéance", "Retard"]}
                rows={side.top.map((r) => ({
                  name: r.company ?? r.number ?? "—",
                  value: r.amount,
                  cells: [r.number ?? "—", r.dueAt ?? "—", r.daysOverdue != null ? `${r.daysOverdue} j` : "—"],
                }))}
                footnote={isClients ? "À relancer en priorité par montant décroissant." : "Décaissements à anticiper dans le prévisionnel."}
              />
            </div>
          )}
        </>
      )}
    </CollapsibleBlock>
  );
}

export default async function ClientsFournisseursPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const data = await computeReceivables(supabase, orgId);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Trésorerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          Poste clients & fournisseurs : créances, dettes et balance âgée sur les factures synchronisées.
        </p>
      </header>

      <PaiementFacturationTabs />

      {!data.hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-600">
            Aucune facture ouverte dans les sources synchronisées. Dès que des factures clients ou
            fournisseurs existeront dans Pennylane (ou Stripe), la balance âgée s&apos;alimentera au prochain sync.
          </p>
        </div>
      ) : (
        <>
          {/* Lecture cockpit en un coup d'œil, avant les blocs détaillés */}
          {(() => {
            // Montant en retard = toutes les tranches échues (hors « Non échu »).
            const overdue = (s: typeof data.clients) =>
              s.buckets.filter((b) => b.label !== "Non échu").reduce((n, b) => n + b.amount, 0);
            const clientsOverdue = overdue(data.clients);
            const netPosition = data.clients.total - data.fournisseurs.total;
            const tiles: StatTile[] = [
              { label: "Créances clients", value: fmtK(data.clients.total), tone: "pos", sub: `${fmt(data.clients.count)} facture${data.clients.count > 1 ? "s" : ""} ouverte${data.clients.count > 1 ? "s" : ""}` },
              { label: "Dettes fournisseurs", value: fmtK(data.fournisseurs.total), tone: "neg", sub: `${fmt(data.fournisseurs.count)} facture${data.fournisseurs.count > 1 ? "s" : ""} à payer` },
              {
                label: "Position nette",
                value: fmtK(netPosition),
                tone: netPosition >= 0 ? "pos" : "neg",
                sub: "Créances − dettes",
                verdict: netPosition >= 0 ? { label: "Favorable", tone: "pos" } : { label: "Défavorable", tone: "neg" },
              },
              {
                label: "Créances en retard",
                value: clientsOverdue > 0 ? fmtK(clientsOverdue) : "0 €",
                tone: clientsOverdue === 0 ? "pos" : "neg",
                sub: "Échues, à relancer",
                verdict: clientsOverdue === 0 ? { label: "Rien en retard", tone: "pos" }
                  : clientsOverdue < data.clients.total / 2 ? { label: "À relancer", tone: "warn" }
                  : { label: "Majorité du poste en retard", tone: "neg" },
              },
            ];
            return <KpiStatTiles tiles={tiles} />;
          })()}

          <SideBlock side={data.clients} kind="clients" />
          <SideBlock side={data.fournisseurs} kind="fournisseurs" />
        </>
      )}
    </section>
  );
}
