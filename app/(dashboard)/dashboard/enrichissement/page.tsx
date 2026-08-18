export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CompanyEnrichmentBlock } from "@/components/company-enrichment-block";
import { EnrichmentBackfillRunner } from "@/components/enrichment-backfill-runner";
import { LinkedinEnrichmentBlock } from "@/components/linkedin-enrichment-block";
import { EnrichmentSuggestions } from "@/components/enrichment-suggestions";
import { EnrichedCompaniesTable } from "@/components/enriched-companies-table";
import { HubspotPropertiesBlock } from "@/components/hubspot-properties-block";
import {
  ENRICHMENT_FIELD_COLUMNS,
  ENRICHMENT_FIELD_LABELS,
  getEnrichmentSettings,
} from "@/lib/enrichment/settings";

/**
 * Suivi → Enrichissement : l'ACTION à forte valeur ajoutée, distinguée des
 * rapports — Revold remplit et rafraîchit la donnée officielle des entreprises
 * (identifiants Sirene, effectifs URSSAF/INSEE, CA INPI), chez Revold ET dans
 * le CRM du client. La page Rapprochement données reste le CONSTAT ; ici on agit.
 */

async function count(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => any,
): Promise<number | null> {
  try {
    const base = supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    const { count: n, error } = await apply(base);
    return error ? null : (n ?? 0);
  } catch {
    return null;
  }
}

export default async function EnrichissementPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  // Server component force-dynamic : l'horloge est stable par requête.
  // eslint-disable-next-line react-hooks/purity
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const settings = await getEnrichmentSettings(supabase, orgId);

  // Tuiles CORRÉLÉES aux champs cochés dans Paramètres → Enrichissement : une
  // tuile de couverture par champ actif (un champ fraîchement coché démarre à 0).
  const activeFields = ENRICHMENT_FIELD_LABELS.filter((f) => settings.fields[f.id]);
  const FIELD_TILE: Record<string, { label: string; sub: string }> = {
    siren: { label: "Avec SIREN", sub: "la clé de tout l'enrichissement" },
    siret: { label: "Avec SIRET", sub: "établissement siège identifié" },
    vat: { label: "N° TVA connu", sub: "calculé depuis le SIREN" },
    employees: { label: "Effectif officiel connu", sub: "tranche URSSAF/INSEE datée" },
    revenue: { label: "CA officiel connu", sub: "dernier exercice déposé (INPI)" },
    industry: { label: "Secteur connu", sub: "code NAF/APE + section INSEE" },
    legalForm: { label: "Statut juridique connu", sub: "forme juridique officielle INSEE" },
    shareCapital: { label: "Capital social connu", sub: "publié au RNE (INPI)" },
    headOfficeAddress: { label: "Adresse siège connue", sub: "adresse officielle Sirene" },
  };
  const [total, fresh, toReview, ...fieldValues] = await Promise.all([
    count(supabase, orgId, (q) => q),
    count(supabase, orgId, (q) => q.gte("enriched_at", ninetyDaysAgo)),
    count(supabase, orgId, (q) => q.is("siren", null).not("candidate_siren", "is", null)),
    ...activeFields.map((f) => count(supabase, orgId, (q) => q.not(ENRICHMENT_FIELD_COLUMNS[f.id], "is", null))),
  ]);

  const tiles = [
    { label: "Entreprises", value: total, sub: "dans le modèle de données" },
    ...activeFields.map((f, i) => {
      const t = FIELD_TILE[f.id] ?? { label: f.label, sub: "" };
      const v = fieldValues[i];
      const pctOf = total && v != null ? ` — ${Math.round((v / total) * 100)} %` : "";
      return { label: t.label, value: v, sub: `${t.sub}${f.id === "siren" ? pctOf : ""}` };
    }),
    { label: "Rafraîchies < 90 j", value: fresh, sub: "données évolutives — à entretenir" },
    { label: "À valider", value: toReview, sub: "correspondances plausibles en attente" },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Enrichissement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revold remplit et rafraîchit la donnée officielle de tes entreprises — identifiants (SIREN, SIRET, TVA),
          effectifs, chiffre d&apos;affaires, statut juridique, capital social, adresse du siège — puis l&apos;écrit
          dans ton CRM.{" "}
          <span className="font-medium text-slate-700">
            L&apos;enrichissement tourne automatiquement, en continu, sur toute la base
          </span>{" "}
          : les correspondances certaines s&apos;appliquent seules, les incertaines t&apos;attendent ci-dessous.
        </p>
      </header>

      {/* ── Couverture ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <article key={t.label} className="card p-4 text-center">
            <p className="text-[10px] font-medium uppercase text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{t.value ?? "—"}</p>
            {t.sub && <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{t.sub}</p>}
          </article>
        ))}
      </div>

      {/* ── 0. Propriétés HubSpot cibles de l'enrichissement (miroir du bloc
             des Paramètres, limité aux propriétés propres à l'enrichissement). ── */}
      <HubspotPropertiesBlock />

      {/* ── 1. ÉTAT du moteur — CTA « Enrichir mon CRM » (fenêtre de
             complétion) puis historique des passes juste en dessous. ── */}
      <EnrichmentBackfillRunner
        linkedinEnabled={settings.linkedinEnabled}
        fields={settings.fields}
        hubspotSearchIds={settings.hubspotSearchIds}
      />

      {/* ── 1 bis. Source LinkedIn (bêta), bloc DÉDIÉ sous le moteur : sa
             propre barre de complétion mesure ce que cette source apporte
             (effectifs des entreprises que le registre officiel ne couvre pas). ── */}
      {settings.linkedinEnabled && <LinkedinEnrichmentBlock />}

      {/* ── 2. Le résultat, juste sous l'état : entreprises enrichies en
             panneau dépliable paginé. ── */}
      <EnrichedCompaniesTable supabase={supabase} orgId={orgId} />

      {/* ── 3. Ce que le moteur n'applique pas seul : les correspondances
             d'identité ambiguës, validées à la main. ── */}
      <CompanyEnrichmentBlock />

      {/* ── 4. En bas de page : les champs NON COCHÉS dans Paramètres →
             Enrichissement (données que Revold sait remplir mais non activées)
             + la donnée manquante malgré un champ actif (secteur NAF). ── */}
      <EnrichmentSuggestions supabase={supabase} orgId={orgId} fields={settings.fields} />

      <p className="text-[11px] text-slate-400">
        Sources : base Sirene et comptes déposés à l&apos;INPI via l&apos;API Recherche d&apos;Entreprises de l&apos;État
        (officielle, gratuite). Le CA n&apos;existe pas pour les comptes déposés en confidentialité — Revold ne devine
        jamais un chiffre.
      </p>
    </section>
  );
}
