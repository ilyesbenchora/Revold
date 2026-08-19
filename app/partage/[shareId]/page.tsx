export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { RevoldLogo } from "@/components/revold-logo";
import { DataPreview } from "@/components/data-tables/blocks-manager";
import { getPageCustomization, resolveAddedTiles } from "@/lib/kpi/page-tiles";
import { computeAggregate } from "@/lib/ai/agents/tool-library";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { parseStoredPeriod, computePeriod, presetLabel, storedPeriodLabel } from "@/lib/reports/periods";

/**
 * Page PUBLIQUE d'un tableau de bord partagé — /partage/<jeton>.
 * Lecture seule, sans authentification : le jeton (uuid non devinable) est le
 * secret. Rendu 100 % serveur via service role, périmètre strictement borné à
 * l'organisation du partage ; tuiles et tables sont RECALCULÉES en direct par
 * le même moteur déterministe que l'app (chiffres réels, jamais figés).
 * Aucune édition, aucun drill-down, aucune navigation vers l'app.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Jamais indexé par les moteurs de recherche.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type TableRow = {
  title: string | null;
  entity: string;
  group_by: string;
  measure: string;
  field: string | null;
  unit_mode: string | null;
  view: string | null;
  pipeline: string | null;
  period_preset: string | null;
  sources: string[] | null;
};

function fmtTile(v: number | null, unit: string | null): string {
  if (v == null) return "—";
  if (unit === "percent") return `${v.toLocaleString("fr-FR")} %`;
  if (unit === "currency")
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  return v.toLocaleString("fr-FR");
}

/** Bornes + libellé de la période enregistrée sur une table. */
function periodOf(raw: string | null): { from: string | null; to: string | null; label: string | null } {
  const stored = parseStoredPeriod(raw);
  if (stored.kind === "custom") return { from: stored.from, to: stored.to, label: storedPeriodLabel(raw ?? "") };
  if (stored.kind === "preset" && stored.preset !== "all") {
    const p = computePeriod(stored.preset, new Date());
    return { from: p.from, to: p.to, label: presetLabel(stored.preset) };
  }
  return { from: null, to: null, label: null };
}

export default async function SharedBoardPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;

  const notFound = (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <RevoldLogo />
        <p className="mt-4 text-sm font-medium text-slate-700">Ce lien de partage n&apos;existe plus.</p>
        <p className="mt-1 text-xs text-slate-400">Il a peut-être été révoqué par son propriétaire.</p>
      </div>
    </main>
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !UUID_RE.test(shareId)) return notFound;
  // Service role : la page est publique, le périmètre est borné par le partage.
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  type ShareRow = { organization_id: string; page_key: string; title: string | null };
  let share: ShareRow | null = null;
  try {
    const { data } = await admin
      .from("board_shares")
      .select("organization_id, page_key, title")
      .eq("id", shareId)
      .maybeSingle();
    share = (data as unknown as ShareRow | null) ?? null;
  } catch { /* table absente */ }
  if (!share) return notFound;
  const orgId = share.organization_id;
  const pageKey = share.page_key;

  // ── Titre du tableau : celui figé au partage, sinon le nom du board. ──
  let title = share.title?.trim() || "Tableau de bord";
  if (!share.title && pageKey.startsWith("board_")) {
    try {
      const { data } = await admin
        .from("custom_dashboards")
        .select("name")
        .eq("organization_id", orgId)
        .eq("id", pageKey.slice(6))
        .maybeSingle();
      if (data?.name) title = data.name as string;
    } catch {}
  }

  // ── Tuiles KPI : mêmes résolveurs que la page interne (valeurs en direct). ──
  const cust = await getPageCustomization(admin, orgId, pageKey);
  const tiles = await resolveAddedTiles(admin, orgId, cust.added);

  // ── Tables de données : recalcul déterministe de chaque bloc. ──
  let tableRows: TableRow[] = [];
  try {
    const { data } = await admin
      .from("page_data_tables")
      .select("title, entity, group_by, measure, field, unit_mode, view, pipeline, period_preset, sources")
      .eq("organization_id", orgId)
      .eq("page_key", pageKey)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(12);
    tableRows = (data ?? []) as TableRow[];
  } catch { /* table absente */ }

  const hubspotToken = await getHubSpotToken(admin, orgId);
  const computed = await Promise.all(
    tableRows.map(async (t) => {
      const period = periodOf(t.period_preset);
      try {
        const res = await computeAggregate(admin, orgId, Array.isArray(t.sources) ? t.sources : [], hubspotToken, {
          entity: t.entity,
          groupBy: t.group_by,
          measure: t.measure,
          field: t.field,
          pipeline: t.pipeline,
          date_from: period.from,
          date_to: period.to,
        });
        const rows = ((res.rows as { group: string; value: number }[] | undefined) ?? []).map((r) => ({
          name: r.group,
          value: r.value,
        }));
        return { t, rows, periodLabel: period.label };
      } catch {
        return { t, rows: [] as { name: string; value: number }[], periodLabel: period.label };
      }
    }),
  );

  const generatedAt = new Date().toLocaleString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <RevoldLogo />
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Rapport partagé en lecture seule — chiffres recalculés en direct le {generatedAt}.
            </p>
          </div>
        </header>

        {/* ── Tuiles KPI ── */}
        {tiles.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.rowId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-medium text-slate-500">{t.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-indigo-600">{t.value}</p>
                {t.meta && <p className="mt-0.5 truncate text-[9px] text-slate-400">{t.meta}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── Tables & graphiques ── */}
        {computed.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {computed.map(({ t, rows, periodLabel }, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{t.title ?? "Sans titre"}</h2>
                  {periodLabel && <span className="shrink-0 text-[10px] text-slate-400">{periodLabel}</span>}
                </div>
                <div className="mt-3">
                  {rows.length === 0 ? (
                    <p className="text-xs text-slate-400">Aucune donnée sur la période.</p>
                  ) : t.view === "bloc" ? (
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-slate-900">
                        {fmtTile(rows.reduce((s, r) => s + (Number(r.value) || 0), 0), t.unit_mode)}
                      </p>
                      <DataPreview rows={rows} view="bar" unit={t.unit_mode ?? "count"} />
                    </div>
                  ) : (
                    <DataPreview rows={rows} view={t.view ?? "table"} unit={t.unit_mode ?? "count"} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tiles.length === 0 && computed.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Ce tableau ne contient encore aucun bloc.
          </p>
        )}

        <footer className="border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
          Généré par <span className="font-semibold text-slate-500">Revold</span> — revenue intelligence câblée sur
          les données réelles. Les chiffres sont recalculés à chaque ouverture.
        </footer>
      </div>
    </main>
  );
}
