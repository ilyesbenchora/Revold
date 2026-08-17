export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CompanyEnrichmentBlock } from "@/components/company-enrichment-block";
import { CompanyFinancialsBlock } from "@/components/company-financials-block";
import { EnrichmentBackfillRunner } from "@/components/enrichment-backfill-runner";
import { EnrichmentSuggestions } from "@/components/enrichment-suggestions";
import { EnrichedCompaniesTable } from "@/components/enriched-companies-table";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";

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
  const [total, withSiren, withEmployees, withRevenue, fresh, toReview] = await Promise.all([
    count(supabase, orgId, (q) => q),
    count(supabase, orgId, (q) => q.not("siren", "is", null)),
    count(supabase, orgId, (q) => q.not("official_employee_range", "is", null)),
    count(supabase, orgId, (q) => q.not("official_revenue", "is", null)),
    count(supabase, orgId, (q) => q.gte("enriched_at", ninetyDaysAgo)),
    count(supabase, orgId, (q) => q.is("siren", null).not("candidate_siren", "is", null)),
  ]);
  const sirenPct = total ? Math.round(((withSiren ?? 0) / total) * 100) : 0;

  const tiles = [
    { label: "Entreprises", value: total, sub: "dans le modèle de données" },
    { label: "Avec SIREN", value: withSiren, sub: total ? `${sirenPct} % — la clé de tout l'enrichissement` : "" },
    { label: "Effectif officiel connu", value: withEmployees, sub: "tranche URSSAF/INSEE datée" },
    { label: "CA officiel connu", value: withRevenue, sub: "dernier exercice déposé (INPI)" },
    { label: "Rafraîchies < 90 j", value: fresh, sub: "données évolutives — à entretenir" },
    { label: "À valider", value: toReview, sub: "correspondances plausibles en attente" },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Enrichissement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revold remplit et rafraîchit la donnée officielle de tes entreprises — identifiants (SIREN, SIRET, TVA),
          effectifs et chiffre d&apos;affaires — puis l&apos;écrit dans ton CRM.{" "}
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

      {/* ── 1. ÉTAT du moteur (accélération silencieuse tant que la page est
             ouverte) — CTA « Enrichir mon CRM » en bas du bloc. ── */}
      <EnrichmentBackfillRunner linkedinEnabled={settings.linkedinEnabled} />

      {/* ── 2. Le résultat, juste sous l'état : entreprises enrichies en
             panneau dépliable paginé. ── */}
      <EnrichedCompaniesTable supabase={supabase} orgId={orgId} />

      {/* ── 3. Ce que le moteur n'applique pas seul : les correspondances
             d'identité ambiguës, validées à la main. ── */}
      <CompanyEnrichmentBlock />

      {/* ── 4. Complément : effectifs & CA des entreprises SANS SIREN
             (recherche par nom, SIREN jamais stocké). ── */}
      <CompanyFinancialsBlock />

      {/* ── 5. En bas de page : la seule suggestion non couverte par les blocs
             ci-dessus (secteur d'activité). ── */}
      <EnrichmentSuggestions supabase={supabase} orgId={orgId} />

      <p className="text-[11px] text-slate-400">
        Sources : base Sirene et comptes déposés à l&apos;INPI via l&apos;API Recherche d&apos;Entreprises de l&apos;État
        (officielle, gratuite). Le CA n&apos;existe pas pour les comptes déposés en confidentialité — Revold ne devine
        jamais un chiffre.
      </p>
    </section>
  );
}
