export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { loadCompanyGroups } from "@/lib/reconciliation/company-groups";
import { loadCompanyEstablishments } from "@/lib/reconciliation/company-establishments";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { HierarchyConsole } from "@/components/hierarchy-console";
import { HierarchySyncRunner } from "@/components/hierarchy-sync-runner";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { isHierarchyActivated } from "@/lib/actions/engine";
import { EstablishmentList } from "@/components/reconciliation/establishment-breakdown";
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

  // Deals gagnés analysables (miroir du filtre du détecteur) : explique un vide
  // dans la console — 0 deal gagné vs deals analysés sans signal fiable.
  let wonDealsCount: number | null = null;
  try {
    const { count, error } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_closed_won", true)
      .not("company_id", "is", null);
    wonDealsCount = error ? null : (count ?? 0);
  } catch { /* non bloquant */ }

  // Périmètre de la synchronisation HubSpot (runner) : entreprises CRM + état.
  let crmCompaniesCount = 0;
  try {
    const { count } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("hubspot_id", "is", null);
    crmCompaniesCount = count ?? 0;
  } catch { /* non bloquant */ }
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  // Opt-in : la détection de suggestions ne démarre qu'au premier clic sur
  // « Lancer le rapprochement » — avant, le bloc à valider reste vide.
  const hierarchyActivated = await isHierarchyActivated(supabase, orgId);
  const linkedChildrenCount = groups.available
    ? [...groups.rootOf.entries()].filter(([id, root]) => id !== root).length
    : 0;

  const tiles = [
    { label: "Groupes déclarés", value: declared.length, sub: "≥ 2 sociétés reliées" },
    { label: "Entités en groupe", value: entitiesInGroups, sub: "parents + enfants" },
    { label: "À valider", value: pendingCount, sub: "hiérarchies proposées en attente" },
    { label: "Multi-établissements", value: establishments.available ? establishments.multiSiret.size : null, sub: "1 SIREN, plusieurs SIRET" },
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
      <div data-tour="hierarchie-tuiles" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <article key={t.label} className="card p-4 text-center">
            <p className="text-[10px] font-medium uppercase text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{t.value ?? "—"}</p>
            {t.sub && <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{t.sub}</p>}
          </article>
        ))}
      </div>

      {/* ── Compteurs à zéro : le dire EXPLICITEMENT (pas un dysfonctionnement,
             la base ne contient simplement pas encore de hiérarchie). ── */}
      {groups.available && declared.length === 0 && (pendingCount ?? 0) === 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Les compteurs sont à zéro — c&apos;est normal au premier passage.</p>
          <p className="mt-0.5 text-xs leading-relaxed">
            Aucune hiérarchie parent/enfant n&apos;a encore été déclarée dans ta base (ni dans HubSpot, ni via une
            validation Revold) : la page n&apos;a donc rien à afficher — ce n&apos;est pas un dysfonctionnement.
            Pour démarrer : <strong>1.</strong> lance le rapprochement dans Revold ci-dessous (lecture seule — il
            importe les hiérarchies « Société mère / Entreprise enfant » déjà posées dans le CRM),{" "}
            <strong>2.</strong> puis « Relancer la détection » : les suggestions arrivent dans la table de
            validation, et c&apos;est elle qui écrit dans HubSpot.
          </p>
        </div>
      )}

      {/* ── Synchronisation à la demande des hiérarchies HubSpot (barre de
             complétion, bilan honnête — zéro association trouvée = dit tel quel). ── */}
      <HierarchySyncRunner
        total={crmCompaniesCount}
        linkedChildren={linkedChildrenCount}
        hubspotConnected={Boolean(hubspotToken)}
      />

      {/* ── Suggestions à valider + historique (console) ── */}
      <div data-tour="hierarchie-console">
        <HierarchyConsole hierarchyAvailable={groups.available} wonDealsCount={wonDealsCount} activated={hierarchyActivated} />
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

      {/* ── Établissements (facette SIRET) : le niveau EN DESSOUS du groupe —
             un même SIREN qui facture depuis plusieurs SIRET. Déjà consolidé en
             un compte (aucune action) ; séparé des groupes pour la lisibilité.
             Ne s'affiche que si ≥ 1 entité multi-établissements sur la base. */}
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

      <p className="text-[11px] text-slate-400">
        Quatre signaux, sur toute la base, du plus sûr au plus faible : correspondance exacte de montant entre un
        deal gagné d&apos;une entité et une facture d&apos;une autre (sens sûr : le facturier est parent), même SIREN
        avec des SIRET d&apos;établissements distincts (registre officiel via l&apos;enrichissement — siège parent,
        agence enfant), domaine web partagé entre fiches CRM (sens proposé, inversable), et noms structurellement
        apparentés — préfixe ou marqueur « groupe/holding », jamais de ressemblance floue (signal faible, badge
        ambre, à confirmer avant validation). Valider ici ou dans Suivi → Actions est strictement équivalent
        (même file, même historique).
      </p>
    </section>
  );
}
