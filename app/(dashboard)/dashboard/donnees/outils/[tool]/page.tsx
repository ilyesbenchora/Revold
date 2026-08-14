export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Audit qualité → sous-page dédiée par outil connecté (onglet dynamique :
 * une page apparaît dès qu'un outil est connecté à Revold). Contient le hub
 * synchronisé de l'outil (entités + enrichissement) et ses points d'attention.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { buildToolHubs, getAuditableTools } from "@/lib/audit/tool-hubs";
import { computeObjectSummaries } from "@/lib/audit/object-summaries";
import { BlockDataTable, type BlockTableRow } from "@/components/data-tables/block-data-table";
import { BrandLogo } from "@/components/brand-logo";
import { HubspotTransactionsBlocks } from "@/components/hubspot-transactions-blocks";
import { BillingRadarBlocks } from "@/components/billing/billing-radar-blocks";
import { ConfigurableKpiTiles, type DefaultTile } from "@/components/kpi-tiles/configurable-kpi-tiles";

export default async function DonneesOutilPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { tool: toolKey } = await params;

  const supabase = await createSupabaseServerClient();
  const tools = await getAuditableTools(supabase, orgId);
  const tool = tools.find((t) => t.key === toolKey);
  if (!tool) notFound();

  const hubs = await buildToolHubs(supabase, orgId, { only: toolKey });
  const hub = hubs.find((h) => h.key === toolKey) ?? null;

  const rows: BlockTableRow[] = [];
  for (const e of hub?.entities ?? []) {
    rows.push({ name: e.label, value: e.count, unit: "count" });
    if (e.enrichmentPct != null && e.count > 0) {
      rows.push({ name: `${e.label} — enrichissement`, value: e.enrichmentPct, unit: "percent" });
    }
  }

  // ── HubSpot : tuiles cockpit (déplacées depuis la vue d'ensemble de
  //    Rapprochement données — ce sont des volumes de CET outil). ──
  let crmTiles: DefaultTile[] = [];
  if (toolKey === "hubspot") {
    const [snapshot, summaries] = await Promise.all([getHubspotSnapshot(), computeObjectSummaries(supabase, orgId)]);
    const contactsTotal = snapshot.totalContacts;
    const contactsCompany = Math.max(0, contactsTotal - snapshot.orphansCount);
    const companiesTotal = snapshot.totalCompanies;
    const companiesDomain = Math.max(0, companiesTotal - snapshot.companiesNoDomain);
    const dealsTotal = snapshot.totalDeals;
    const dealsAmount = Math.max(0, dealsTotal - snapshot.dealsNoAmount);
    const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);
    const toneForPct = (p: number): DefaultTile["tone"] => (p >= 80 ? "pos" : p >= 50 ? "accent" : "neg");
    const allMetrics = summaries.flatMap((s) => s.metrics.map((m) => m.pct));
    const avgFill = allMetrics.length > 0 ? Math.round(allMetrics.reduce((n, p) => n + p, 0) / allMetrics.length) : null;
    if (contactsTotal > 0 || companiesTotal > 0 || dealsTotal > 0) {
      crmTiles = [
        { key: "contacts", label: "Contacts", value: contactsTotal.toLocaleString("fr-FR"), tone: toneForPct(pct(contactsCompany, contactsTotal)), sub: `${pct(contactsCompany, contactsTotal)} % liés à une entreprise` },
        { key: "entreprises", label: "Entreprises", value: companiesTotal.toLocaleString("fr-FR"), tone: toneForPct(pct(companiesDomain, companiesTotal)), sub: `${pct(companiesDomain, companiesTotal)} % avec domaine` },
        { key: "transactions", label: "Transactions", value: dealsTotal.toLocaleString("fr-FR"), tone: toneForPct(pct(dealsAmount, dealsTotal)), sub: `${pct(dealsAmount, dealsTotal)} % avec montant` },
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
      ];
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Identité de la page : « CRM ↔ Outil » pour les outils tiers ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo domain={tool.domain} alt={tool.toolLabel} fallback={tool.icon} size={36} />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tool.label}</h2>
            <p className="text-xs text-slate-500">
              {tool.category === "crm"
                ? "Entités synchronisées et qualité du rapprochement pour cet outil."
                : "Rapprochement des données entre ton CRM et cet outil : entités synchronisées, factures attendues, closing → facture."}
            </p>
          </div>
        </div>
        <Link href="/dashboard/integration" className="text-xs font-medium text-accent hover:underline">
          Gérer les intégrations →
        </Link>
      </div>

      {/* ── HubSpot : tuiles cockpit en haut de page (Contacts, Entreprises,
             Transactions, Complétude) — configurables comme partout. ── */}
      {crmTiles.length > 0 && (
        <ConfigurableKpiTiles supabase={supabase} orgId={orgId} pageKey="outil_hubspot" defaults={crmTiles} />
      )}

      {/* ── Radar de facturation + closing → 1re facture : rapprochement
             CRM × outil de facturation, scopé aux factures de CET outil. ── */}
      {tool.category === "billing" && (
        <BillingRadarBlocks
          supabase={supabase}
          orgId={orgId}
          hubspotToken={await getHubSpotToken(supabase, orgId)}
          provider={toolKey}
          toolLabel={tool.toolLabel}
          crmLabel={tools.find((t) => t.category === "crm")?.toolLabel ?? "le CRM"}
        />
      )}

      {/* ── Entités synchronisées ── */}
      {rows.length > 0 ? (
        <BlockDataTable
          title={`Hub ${tool.toolLabel}`}
          subtitle={hub?.category ?? ""}
          team="revops"
          unit="count"
          nameLabel="Entité"
          valueLabel="Valeur"
          rows={rows}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">Hub {tool.toolLabel} : aucune donnée synchronisée.</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Lance une synchronisation depuis{" "}
            <Link href="/dashboard/integration" className="font-medium text-fuchsia-600 hover:underline">
              Intégrations → Mes outils
            </Link>{" "}
            pour alimenter cette page.
          </p>
        </div>
      )}

      {/* ── Points d'attention (gaps qualité de l'outil) ── */}
      {hub && hub.gaps.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-800">Points d&apos;attention</p>
          <p className="mb-3 text-[10px] text-slate-400">
            Champs faiblement renseignés ou données manquantes détectés sur ce hub.
          </p>
          <ul className="space-y-2">
            {hub.gaps.map((g, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    g.severity === "critical" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {g.severity === "critical" ? "Critique" : "Vigilance"}
                </span>
                <span className="min-w-0 flex-1 text-slate-700">
                  <span className="font-medium">{g.entity}</span> — {g.field}
                </span>
                {g.pct > 0 && <span className="shrink-0 tabular-nums text-slate-500">{g.pct} %</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── HubSpot : audit transactions (migré de l'ancienne sous-page Transactions) ── */}
      {toolKey === "hubspot" && <HubspotTransactionsBlocks supabase={supabase} orgId={orgId} />}
    </div>
  );
}
