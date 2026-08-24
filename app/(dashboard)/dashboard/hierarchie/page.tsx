export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { HierarchyConsole } from "@/components/hierarchy-console";
import { FeatureTour } from "@/components/feature-tour";

/**
 * Enrichissement → Hiérarchie comptes : met en avant les rapprochements
 * d'entités PARENT/ENFANT (groupes multi-sociétés). Revold détecte qu'un deal
 * signé sur une entité est facturé sur une autre (correspondance de montant,
 * jamais le nom) et propose de déclarer la hiérarchie dans le CRM — validée
 * ici, elle alimente la consolidation par groupe et le garde-fou inter-entités
 * du rapprochement. Même source de vérité que la boîte Actions.
 */
export default async function HierarchiePage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  const groups = await loadCompanyGroups(supabase, orgId);

  // Groupes déclarés (≥ 2 entités) triés par taille décroissante.
  const declared = [...groups.groupRoots]
    .map((root) => ({
      root,
      name: groups.nameOf.get(root) ?? "Groupe",
      members: (groups.membersOf.get(root) ?? []).filter((id) => id !== root),
    }))
    .sort((a, b) => b.members.length - a.members.length);
  const entitiesInGroups = declared.reduce((s, g) => s + g.members.length + 1, 0);

  // Suggestions en attente (compteur serveur — la console fait le détail).
  let pendingCount: number | null = null;
  try {
    const { count, error } = await supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("source", "detector:declare_group")
      .eq("status", "pending");
    pendingCount = error ? null : (count ?? 0);
  } catch { /* table absente → console vide */ }

  const tiles = [
    { label: "Groupes déclarés", value: declared.length, sub: "≥ 2 entités reliées" },
    { label: "Entités en groupe", value: entitiesInGroups, sub: "parents + enfants" },
    { label: "À valider", value: pendingCount, sub: "hiérarchies proposées en attente" },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Hiérarchie comptes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les groupes multi-sociétés de ton portefeuille, détectés sur <span className="font-medium text-slate-700">toute la base</span> :
          facture émise par une autre entité que celle qui a signé (correspondance de montant) et fiches qui
          partagent le même domaine web — jamais déduits du nom. Revold propose le lien parent/enfant à déclarer
          dans le CRM, sens inversable avant validation.{" "}
          <span className="font-medium text-slate-700">
            Une hiérarchie validée alimente automatiquement la consolidation par groupe et le garde-fou
            inter-entités du rapprochement
          </span>{" "}
          — plus aucun rattachement manuel ensuite.
        </p>
      </header>

      {/* ── Tutoriel de prise en main (nouveaux comptes uniquement) ── */}
      <FeatureTour
        tourId="hierarchie"
        steps={[
          {
            anchor: "hierarchie-tuiles",
            title: "Tes groupes d'entreprises",
            text: "Les tuiles mesurent les hiérarchies déjà déclarées dans ton CRM et les suggestions en attente de validation.",
          },
          {
            anchor: "hierarchie-console",
            title: "Rien ne s'écrit sans toi",
            text: "Chaque suggestion montre le parent (qui facture), l'enfant (qui signe) et ce qui sera écrit dans HubSpot. Valider déclare la hiérarchie ; refuser ne touche à rien.",
          },
        ]}
      />

      {/* ── Tuiles ── */}
      <div data-tour="hierarchie-tuiles" className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <article key={t.label} className="card p-4 text-center">
            <p className="text-[10px] font-medium uppercase text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{t.value ?? "—"}</p>
            {t.sub && <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{t.sub}</p>}
          </article>
        ))}
      </div>

      {/* ── Suggestions à valider + historique (console) ── */}
      <div data-tour="hierarchie-console">
        <HierarchyConsole />
      </div>

      {/* ── Groupes déjà déclarés (synchronisés depuis le CRM) ── */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Groupes déclarés
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {declared.length} groupe{declared.length > 1 ? "s" : ""}
            </span>
          </h2>
        }
      >
        {!groups.available ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            La colonne de hiérarchie n&apos;est pas encore disponible — elle s&apos;activera au prochain déploiement
            (migration <code>company_hierarchy</code>).
          </p>
        ) : declared.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            Aucun groupe multi-entités déclaré pour l&apos;instant. Valide une suggestion ci-dessus, ou déclare un
            lien parent/enfant directement dans HubSpot — la synchronisation le reflétera ici.
          </p>
        ) : (
          <BlockDataTable
            title="Groupes déclarés"
            subtitle="parents & entités"
            team="revops"
            unit="count"
            nameLabel="Tête de groupe (parent)"
            valueLabel="Entités"
            extraColumns={["Sociétés du groupe"]}
            rows={declared.map((g) => ({
              name: g.name,
              value: g.members.length + 1,
              cells: [
                g.members.map((id) => groups.nameOf.get(id) ?? "—").slice(0, 6).join(" · ") +
                  (g.members.length > 6 ? ` · +${g.members.length - 6}` : ""),
              ],
            }))}
            footnote="Hiérarchies lues depuis le CRM à chaque synchronisation (associations parent/enfant HubSpot) — la consolidation par groupe et le rapprochement inter-entités s'appuient dessus."
          />
        )}
      </CollapsibleBlock>

      <p className="text-[11px] text-slate-400">
        Deux signaux, sur toute la base : correspondance exacte de montant entre un deal gagné d&apos;une entité et
        une facture d&apos;une autre (sens sûr : le facturier est parent), et domaine web partagé entre fiches CRM
        (sens proposé, inversable) — Revold ne déduit jamais un groupe d&apos;après la ressemblance des noms.
        Valider ici ou dans Suivi → Actions est strictement équivalent (même file, même historique).
      </p>
    </section>
  );
}
