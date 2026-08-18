export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { EnrichmentSettingsForm } from "@/components/enrichment-settings-form";
import { HubspotPropertiesBlock } from "@/components/hubspot-properties-block";
import { getEnrichmentSettings, registryForCountry } from "@/lib/enrichment/settings";

/**
 * Paramètres → Enrichissement : ce que Revold enrichit (et n'écrase jamais),
 * la recherche par SIREN/SIRET dans HubSpot, la source LinkedIn (bêta), et le
 * registre administratif utilisé selon le PAYS de l'organisation.
 */
export default async function ParametresEnrichissementPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  const settings = await getEnrichmentSettings(supabase, orgId);

  // Pays de l'organisation (Paramètres → Général) → registre administratif.
  let country: string | null = null;
  try {
    const { data } = await supabase.from("organizations").select("country").eq("id", orgId).maybeSingle();
    country = (data?.country as string | null) ?? null;
  } catch {
    /* défaut FR */
  }
  const registry = registryForCountry(country);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enrichissement : choisis ce que Revold remplit dans tes fiches entreprises — sans jamais écraser une donnée
          existante — et comment il s&apos;intègre à ton CRM.
        </p>
      </header>

      <ParametresTabs />

      {/* Registre selon le pays de l'organisation (Paramètres → Général) */}
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          registry.supported ? "border-slate-200 bg-slate-50 text-slate-600" : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <span aria-hidden className="mt-0.5">🌍</span>
        <p>
          Pays de l&apos;organisation : <strong>{country ?? "France (défaut)"}</strong> — registre administratif :{" "}
          <strong>{registry.registry}</strong>.{" "}
          {registry.supported ? (
            <>L&apos;enrichissement est actif sur ce registre (officiel, gratuit).</>
          ) : (
            <>
              Ce registre n&apos;est pas encore branché : l&apos;enrichissement automatique est en pause pour éviter les
              faux rapprochements avec le registre français. Modifie le pays dans{" "}
              <Link href="/dashboard/parametres/general" className="font-medium underline">Paramètres → Général</Link>{" "}
              s&apos;il est incorrect.
            </>
          )}
        </p>
      </div>

      <EnrichmentSettingsForm initial={settings} />

      {/* Identifiants & propriétés HubSpot : vérifie que chaque propriété cible
          (SIREN, SIRET, TVA, statut juridique, capital social, adresse du
          siège — selon les champs cochés) existe dans le portail. */}
      <HubspotPropertiesBlock showSettingsLink={false} />

      <p className="text-[11px] text-slate-400">
        Les réglages s&apos;appliquent aux prochains passages du moteur (cron horaire et page{" "}
        <Link href="/dashboard/enrichissement" className="font-medium text-accent hover:underline">Enrichissement</Link>
        ). La donnée déjà écrite n&apos;est pas retirée.
      </p>
    </section>
  );
}
