export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";
import { loadCompanyEstablishments } from "@/lib/reconciliation/company-establishments";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { GroupBigPicture, type BigPictureGroup } from "@/components/reconciliation/group-big-picture";
import { EstablishmentList } from "@/components/reconciliation/establishment-breakdown";
import { PageNavTabs } from "@/components/page-nav-tabs";
import { HIERARCHIE_NAV } from "@/lib/settings/page-nav";

/**
 * Hiérarchie comptes → GROUPES DÉCLARÉS : la vue « big picture » des groupes
 * multi-sociétés déjà déclarés (holding en bandeau, filiales indentées,
 * montants des deals associés cumulés sur la mère) + les multi-établissements
 * (SIRET). La validation des suggestions vit dans l'onglet « Hiérarchies à
 * valider ».
 */
export default async function GroupesDeclaresPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  const [groups, establishments] = await Promise.all([
    loadCompanyGroups(supabase, orgId),
    loadCompanyEstablishments(supabase, orgId),
  ]);

  // Groupes déclarés (≥ 2 entités) triés par taille décroissante.
  const declared = [...groups.groupRoots]
    .map((root) => ({
      root,
      name: groups.nameOf.get(root) ?? "Groupe",
      members: (groups.membersOf.get(root) ?? []).filter((id) => id !== root),
    }))
    .sort((a, b) => b.members.length - a.members.length);
  const entitiesInGroups = declared.reduce((s, g) => s + g.members.length + 1, 0);

  // ── Tags de hiérarchie (Paramètres → Enrichissement) : propriétés CRM
  // personnalisées des fiches Entreprise, affichées en tags à côté des
  // montants et utilisables en filtres — stockage partagé avec les cohortes
  // (cohort_mappings, clé hiertag_). ──
  let tagDefs: Array<{ key: string; label: string; prop: string }> = [];
  try {
    const { data } = await supabase.from("cohort_mappings").select("mappings").eq("organization_id", orgId).maybeSingle();
    const all = Array.isArray(data?.mappings) ? (data.mappings as Array<Record<string, unknown>>) : [];
    tagDefs = all
      .filter((m) => typeof m.key === "string" && (m.key as string).startsWith("hiertag_") && typeof m.api_name === "string" && (m.api_name as string).trim())
      .map((m) => ({ key: m.key as string, label: ((m.label as string) || (m.api_name as string)).trim(), prop: (m.api_name as string).trim() }))
      .slice(0, 4);
  } catch { /* table absente → pas de tags */ }

  // ── Vue « big picture » : SIREN + montant des DEALS ASSOCIÉS à chaque
  // entité (tous statuts — un deal rattaché suffit) ; sans deal, aucune
  // information de montant. Le cumul des filiales remonte sur la mère.
  const groupIds = declared.flatMap((g) => [g.root, ...g.members]);
  const sirenOf = new Map<string, string | null>();
  const tagsOf = new Map<string, Record<string, string>>();
  const caOf = new Map<string, number>();
  type DealInfo = { name: string | null; amount: number; stage: string | null; pipeline: string | null };
  const dealsOf = new Map<string, DealInfo[]>();
  if (groupIds.length > 0) {
    try {
      for (let i = 0; i < groupIds.length; i += 400) {
        const chunk = groupIds.slice(i, i + 400);
        const [{ data: comps }, { data: dealRows }] = await Promise.all([
          supabase.from("companies").select(tagDefs.length > 0 ? "id, siren, raw_data" : "id, siren").in("id", chunk),
          supabase
            .from("deals")
            // Étape + pipeline de CHAQUE deal associé : affichés sous l'entité.
            .select("name, amount, company_id, pipeline_stages(name, pipeline_name)")
            .eq("organization_id", orgId)
            .not("amount", "is", null)
            .in("company_id", chunk)
            .limit(5000),
        ]);
        for (const c of (comps ?? []) as unknown as Array<{ id: string; siren: string | null; raw_data?: unknown }>) {
          sirenOf.set(c.id, c.siren);
          if (tagDefs.length > 0) {
            const props = ((c.raw_data as { properties?: Record<string, unknown> } | null)?.properties ?? {}) as Record<string, unknown>;
            const rec: Record<string, string> = {};
            for (const def of tagDefs) {
              const v = props[def.prop];
              if (v != null && String(v).trim()) rec[def.key] = String(v).trim().slice(0, 60);
            }
            if (Object.keys(rec).length > 0) tagsOf.set(c.id, rec);
          }
        }
        type Row = {
          name: string | null; amount: number | null; company_id: string | null;
          pipeline_stages: { name: string | null; pipeline_name: string | null } | Array<{ name: string | null; pipeline_name: string | null }> | null;
        };
        for (const d of (dealRows ?? []) as Row[]) {
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
    } catch { /* SIREN/montants absents → la vue reste lisible sans montants */ }
  }
  const node = (id: string, name: string) => ({
    id,
    name,
    siren: sirenOf.get(id) ?? null,
    ca: caOf.get(id) ?? 0,
    deals: dealsOf.get(id) ?? [],
    tags: tagsOf.get(id),
  });
  const bigGroups: BigPictureGroup[] = declared.map((g) => {
    const root = node(g.root, g.name);
    const children = g.members.map((id) => node(id, groups.nameOf.get(id) ?? "—"));
    return { root, children, total: root.ca + children.reduce((s, c) => s + c.ca, 0) };
  });

  return (
    <section className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Hiérarchie comptes</h1>
          <Link
            href="/dashboard/hierarchie/contacts-sans-entreprise"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            Contacts sans entreprise →
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Les groupes multi-sociétés déjà déclarés dans ton CRM — holding, filiales et montants des deals associés,
          consolidés par groupe. La validation des nouvelles suggestions se fait dans l&apos;onglet{" "}
          <span className="font-medium text-slate-700">Hiérarchies à valider</span>.
        </p>
      </header>

      <PageNavTabs nav={HIERARCHIE_NAV} />

      {/* ── Tuiles de synthèse ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Groupes déclarés", value: declared.length, sub: "≥ 2 sociétés reliées" },
          { label: "Entités en groupe", value: entitiesInGroups, sub: "parents + enfants" },
          { label: "Multi-établissements", value: establishments.available ? establishments.multiSiret.size : null, sub: "1 SIREN, plusieurs SIRET" },
        ].map((t) => (
          <article key={t.label} className="card p-4 text-center">
            <p className="text-[10px] font-medium uppercase text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{t.value ?? "—"}</p>
            {t.sub && <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{t.sub}</p>}
          </article>
        ))}
      </div>

      {/* ── Groupes déclarés en big picture ── */}
      {!groups.available ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          La colonne de hiérarchie n&apos;est pas encore disponible — elle s&apos;activera au prochain déploiement
          (migration <code>company_hierarchy</code>).
        </p>
      ) : declared.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
          Aucun groupe multi-entités déclaré pour l&apos;instant. Valide une suggestion dans l&apos;onglet
          « Hiérarchies à valider », ou déclare un lien parent/enfant directement dans HubSpot — la synchronisation
          le reflétera ici.
        </p>
      ) : (
        <>
          <GroupBigPicture groups={bigGroups} tagDefs={tagDefs.map(({ key, label }) => ({ key, label }))} />
          <p className="text-[10px] text-slate-400">
            Hiérarchies lues depuis le CRM à chaque synchronisation (associations parent/enfant HubSpot) — la
            consolidation par groupe et le rapprochement inter-entités s&apos;appuient dessus. Montant = deals
            associés à chaque entité (tous statuts, source CRM) — sans deal rattaché, aucun montant n&apos;est
            affiché ; le cumul des filiales remonte sur l&apos;entreprise mère.
          </p>
        </>
      )}

      {/* ── Établissements (facette SIRET) : déjà consolidés, détail par site ── */}
      {establishments.available && establishments.multiSiret.size > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              Établissements
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                {establishments.multiSiret.size} entité{establishments.multiSiret.size > 1 ? "s" : ""}
              </span>
            </h2>
          }
        >
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            L&apos;autre visage du multi-entités : une <strong>même entité légale</strong> (SIREN) qui facture depuis
            <strong> plusieurs sites</strong> (SIRET). Contrairement aux groupes de sociétés ci-dessus, ces
            établissements sont <strong>déjà rapprochés</strong> dans un seul compte Revold — rien à déclarer, tu vois
            juste le détail par site (club, agence…), sur toute la base.
          </p>
          <EstablishmentList data={establishments} variant="hierarchy" />
        </CollapsibleBlock>
      )}
    </section>
  );
}
