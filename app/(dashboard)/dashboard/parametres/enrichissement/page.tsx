export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { EnrichmentSettingsForm } from "@/components/enrichment-settings-form";
import { IdentifierMappingForm, type HubSpotPropertyStatus } from "@/components/identifier-mapping-form";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty } from "@/lib/integrations/hubspot-properties";
import {
  ENRICHMENT_HUBSPOT_PROPERTIES,
  getEnrichmentSettings,
  registryForCountry,
} from "@/lib/enrichment/settings";

/**
 * Paramètres → Enrichissement : cette page ENREGISTRE ce que Revold enrichit
 * (et n'écrase jamais) — le LANCEMENT se fait depuis la page Enrichissement.
 * En dessous : le mapping des propriétés CRM cibles de l'enrichissement —
 * même bloc que « Mapping des identifiants » (Modèle de données), restreint
 * aux champs d'enrichissement (SIREN, SIRET, TVA, statut juridique, capital
 * social, adresse du siège) — pour VALIDER que chaque propriété existe bien
 * dans HubSpot avant d'écrire dedans.
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

  // ── Mapping des propriétés CRM de l'enrichissement (mêmes données que le
  // bloc Mapping des identifiants : identifier_field_mapping, provider hubspot,
  // restreint aux champs d'enrichissement). ──
  const enrichCanonicals = ENRICHMENT_HUBSPOT_PROPERTIES.map((p) => p.canonical);
  let savedMappings: Array<{ provider: string; canonical_field: string; provider_field: string; object_type?: string | null }> = [];
  try {
    const { data } = await supabase
      .from("identifier_field_mapping")
      .select("provider, canonical_field, provider_field, object_type")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot");
    savedMappings = ((data ?? []) as typeof savedMappings).filter((m) => enrichCanonicals.includes(m.canonical_field));
  } catch {
    /* table absente → défauts */
  }

  // Vérification serveur : chaque propriété cible existe-t-elle dans le CRM ?
  const hubspotToken = await getHubSpotToken(supabase, orgId);
  const hubspotPropertyStatus: HubSpotPropertyStatus = {};
  if (hubspotToken) {
    await Promise.all(
      ENRICHMENT_HUBSPOT_PROPERTIES.map(async (p) => {
        const saved = savedMappings.find((m) => m.canonical_field === p.canonical);
        const name = saved?.provider_field?.trim() || p.fallback;
        try {
          const check = await checkHubSpotProperty(hubspotToken, "companies", name);
          hubspotPropertyStatus[p.canonical] = {
            exists: check.exists,
            label: check.label,
            suggestedName: check.suggestedName,
          };
        } catch {
          hubspotPropertyStatus[p.canonical] = { exists: null, label: null, suggestedName: null };
        }
      }),
    );
  }

  // Une ligne par champ d'enrichissement écrit dans le CRM : les customs
  // (vérifiables/créables) + les natifs (toujours présents, lecture seule).
  const enrichmentIdentifiers = [
    ...ENRICHMENT_HUBSPOT_PROPERTIES.map((p) => ({
      canonicalField: p.canonical,
      label: p.label,
      defaultProviderField: p.fallback,
      hint: "Propriété custom HubSpot sur les fiches Entreprise (à créer dans HubSpot si inexistante)",
      native: false,
    })),
    {
      canonicalField: "official_employee_range",
      label: "Nombre d'employés",
      defaultProviderField: "numberofemployees",
      hint: "Propriété native HubSpot — remplie par l'enrichissement (champs vides uniquement)",
      native: true,
    },
    {
      canonicalField: "official_revenue",
      label: "Chiffre d'affaires",
      defaultProviderField: "annualrevenue",
      hint: "Propriété native HubSpot — remplie par l'enrichissement (champs vides uniquement)",
      native: true,
    },
  ];
  const mappingRows = [
    { provider: "hubspot", label: "HubSpot", icon: "🟠", domain: "hubspot.com", identifiers: enrichmentIdentifiers },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enrichissement : choisis ce que Revold remplit dans tes fiches entreprises — sans jamais écraser une donnée
          existante — et vérifie les propriétés CRM cibles. Le lancement se fait depuis la page{" "}
          <Link href="/dashboard/enrichissement" className="font-medium text-accent hover:underline">Enrichissement</Link>.
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

      {/* ── Propriétés CRM cibles de l'enrichissement — même bloc que le
             « Mapping des identifiants » du Modèle de données, restreint aux
             champs d'enrichissement : chaque propriété est vérifiée dans le
             CRM (✓ dans le CRM / ⚠ absente) avant d'être écrite. ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Propriétés CRM de l&apos;enrichissement</h2>
        <p className="text-sm text-slate-500">
          Dans quelle propriété HubSpot chaque donnée enrichie est écrite (champs vides uniquement). Revold vérifie que
          la propriété existe bien dans ton CRM — statut juridique, capital social et adresse du siège comprises.
        </p>
        {hubspotToken ? (
          <IdentifierMappingForm
            rows={mappingRows}
            savedMappings={savedMappings}
            disabledProviders={[]}
            hubspotPropertyStatus={hubspotPropertyStatus}
            allowExtraCustomIds={false}
          />
        ) : (
          <div className="card p-6 text-center">
            <p className="text-sm text-slate-500">
              HubSpot n&apos;est pas connecté — connecte ton CRM pour vérifier et mapper les propriétés cibles.
            </p>
            <Link href="/dashboard/integration" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
              Connecter HubSpot →
            </Link>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Les réglages s&apos;appliquent aux prochains passages du moteur (cron horaire et page{" "}
        <Link href="/dashboard/enrichissement" className="font-medium text-accent hover:underline">Enrichissement</Link>
        ). La donnée déjà écrite n&apos;est pas retirée.
      </p>
    </section>
  );
}
