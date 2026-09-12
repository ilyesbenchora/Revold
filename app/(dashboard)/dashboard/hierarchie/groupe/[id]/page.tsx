export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";

/**
 * Fiche HIÉRARCHIE d'un groupe (façon fiche HubSpot, version hiérarchie des
 * comptes) : on isole UN groupe pour ne voir QUE sa structure — la mère, ses
 * filiales, les SIREN, les deals associés par entité et le montant consolidé.
 */

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(v));
const fmt = (n: number) => n.toLocaleString("fr-FR");

type Deal = { name: string | null; amount: number; stage: string | null; pipeline: string | null };
type Entity = { id: string; name: string; siren: string | null; ca: number; deals: Deal[] };

function DealTable({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return <p className="mt-1 text-[11px] text-slate-400">Aucun deal associé.</p>;
  const shown = [...deals].sort((a, b) => b.amount - a.amount).slice(0, 8);
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-500">
            <th className="px-2.5 py-1.5">Deal</th>
            <th className="px-2.5 py-1.5">Pipeline · étape</th>
            <th className="px-2.5 py-1.5 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((d, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              <td className="max-w-[220px] truncate px-2.5 py-1.5 font-medium text-slate-700">{d.name ?? "Deal sans nom"}</td>
              <td className="px-2.5 py-1.5 text-slate-500">{d.pipeline ?? "—"}{d.stage ? ` · ${d.stage}` : ""}</td>
              <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-slate-700">{eur(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {deals.length > shown.length && (
        <p className="px-2.5 py-1.5 text-[10px] text-slate-400">+ {deals.length - shown.length} autre{deals.length - shown.length > 1 ? "s" : ""} deal{deals.length - shown.length > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

function EntityCard({ e, role }: { e: Entity; role: "mere" | "filiale" }) {
  return (
    <article className={`rounded-xl border bg-white p-4 ${role === "mere" ? "border-indigo-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${role === "mere" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
              {role === "mere" ? "Société mère" : "Filiale"}
            </span>
            <p className="truncate text-sm font-semibold text-slate-900">{e.name}</p>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-indigo-700">{e.siren ? `SIREN ${e.siren}` : "SIREN —"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Deals associés</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{e.ca > 0 ? eur(e.ca) : "—"}</p>
          <p className="text-[10px] text-slate-400">{e.deals.length} deal{e.deals.length > 1 ? "s" : ""}</p>
        </div>
      </div>
      <DealTable deals={e.deals} />
    </article>
  );
}

export default async function GroupeHierarchiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  const groups = await loadCompanyGroups(supabase, orgId);
  if (!groups.available) {
    return <p className="p-8 text-center text-sm text-slate-500">La hiérarchie n&apos;est pas encore disponible.</p>;
  }
  // L'id peut être la mère OU un membre : on remonte à la racine du groupe.
  const rootId = groups.rootOf.get(id) ?? id;
  const members = (groups.membersOf.get(rootId) ?? []).filter((m) => m !== rootId);
  if (!groups.groupRoots.has(rootId) && members.length === 0) notFound();

  const ids = [rootId, ...members];
  const sirenOf = new Map<string, string | null>();
  const caOf = new Map<string, number>();
  const dealsOf = new Map<string, Deal[]>();
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const [{ data: comps }, { data: dealRows }] = await Promise.all([
        supabase.from("companies").select("id, siren").in("id", chunk),
        supabase
          .from("deals")
          .select("name, amount, company_id, pipeline_stages(name, pipeline_name)")
          .eq("organization_id", orgId)
          .not("amount", "is", null)
          .in("company_id", chunk)
          .limit(5000),
      ]);
      for (const c of (comps ?? []) as Array<{ id: string; siren: string | null }>) sirenOf.set(c.id, c.siren);
      type Row = {
        name: string | null; amount: number | null; company_id: string | null;
        pipeline_stages: { name: string | null; pipeline_name: string | null } | Array<{ name: string | null; pipeline_name: string | null }> | null;
      };
      for (const d of (dealRows ?? []) as unknown as Row[]) {
        if (!d.company_id) continue;
        const st = (Array.isArray(d.pipeline_stages) ? d.pipeline_stages[0] : d.pipeline_stages) ?? null;
        const amount = Number(d.amount) || 0;
        caOf.set(d.company_id, (caOf.get(d.company_id) ?? 0) + amount);
        (dealsOf.get(d.company_id) ?? dealsOf.set(d.company_id, []).get(d.company_id)!).push({
          name: d.name,
          amount,
          stage: st?.name ?? null,
          pipeline: st?.pipeline_name ?? null,
        });
      }
    }
  } catch { /* montants indisponibles → fiche lisible sans montants */ }

  const toEntity = (eid: string): Entity => ({
    id: eid,
    name: groups.nameOf.get(eid) ?? "Entreprise",
    siren: sirenOf.get(eid) ?? null,
    ca: caOf.get(eid) ?? 0,
    deals: dealsOf.get(eid) ?? [],
  });
  const rootEntity = toEntity(rootId);
  const childEntities = members.map(toEntity).sort((a, b) => b.ca - a.ca);
  const allEntities = [rootEntity, ...childEntities];

  const totalCa = allEntities.reduce((s, e) => s + e.ca, 0);
  const totalDeals = allEntities.reduce((s, e) => s + e.deals.length, 0);
  const withSiren = allEntities.filter((e) => e.siren).length;

  return (
    <section className="space-y-6">
      <Link href="/dashboard/hierarchie" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-indigo-600">
        ← Hiérarchie comptes
      </Link>

      {/* ── En-tête « fiche » du groupe ── */}
      <header className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Groupe multi-sociétés</p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">{rootEntity.name}</h1>
          <p className="mt-0.5 font-mono text-xs text-indigo-700">{rootEntity.siren ? `SIREN ${rootEntity.siren}` : "SIREN —"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Sociétés reliées", value: fmt(members.length + 1), sub: "mère + filiales" },
              { label: "Deals associés", value: fmt(totalDeals), sub: "tous statuts" },
              { label: "Montant consolidé", value: totalCa > 0 ? eur(totalCa) : "—", sub: "cumul du groupe" },
              { label: "Identifiées (SIREN)", value: `${withSiren}/${allEntities.length}`, sub: "rapprochées au registre" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{t.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{t.value}</p>
                <p className="text-[9px] leading-tight text-slate-400">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Structure du groupe : mère puis filiales indentées ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Structure du groupe</h2>
        <EntityCard e={rootEntity} role="mere" />
        {childEntities.length > 0 && (
          <div className="space-y-2 border-l-2 border-indigo-100 pl-4">
            {childEntities.map((c) => (
              <EntityCard key={c.id} e={c} role="filiale" />
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        Hiérarchie lue depuis le CRM (associations parent/enfant). Le montant par entité = deals associés (tous
        statuts) ; le montant consolidé cumule la mère et ses filiales. Pour modifier la structure, ajuste le lien
        parent/enfant dans ton CRM — la synchronisation le reflétera ici.
      </p>
    </section>
  );
}
