export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { SettingsEditLock } from "@/components/settings-edit-lock";
import { EnrichmentSettingsForm } from "@/components/enrichment-settings-form";
import { GroupSignalsSettings } from "@/components/group-signals-settings";
import { isNameMatchEnabled, isDomainMatchEnabled } from "@/lib/actions/engine";
import { IdentifierMappingForm, type HubSpotPropertyStatus } from "@/components/identifier-mapping-form";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty } from "@/lib/integrations/hubspot-properties";
import {
  ENRICHMENT_HUBSPOT_PROPERTIES,
  ENRICHMENT_CRM_TARGETS,
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
  const [nameMatchEnabled, domainMatchEnabled] = await Promise.all([
    isNameMatchEnabled(supabase, orgId),
    isDomainMatchEnabled(supabase, orgId),
  ]);

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
  const enrichCanonicals = [
    ...ENRICHMENT_HUBSPOT_PROPERTIES.map((p) => p.canonical),
    ...ENRICHMENT_CRM_TARGETS.map((p) => p.canonical),
  ];
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
      [...ENRICHMENT_HUBSPOT_PROPERTIES, ...ENRICHMENT_CRM_TARGETS].map(async (p) => {
        const saved = savedMappings.find((m) => m.canonical_field === p.canonical);
        const name = saved?.provider_field?.trim() || p.fallback;
        try {
          const check = await checkHubSpotProperty(hubspotToken, "companies", name);
          hubspotPropertyStatus[p.canonical] = {
            exists: check.exists,
            label: check.label,
            suggestedName: check.suggestedName,
            // Liste déroulante → badge + note « valeurs alignées sur les options ».
            fieldType: check.fieldType,
          };
        } catch {
          hubspotPropertyStatus[p.canonical] = { exists: null, label: null, suggestedName: null, fieldType: null };
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
    // Cibles CRM remappables de l'effectif et du CA : défaut = propriété
    // NATIVE HubSpot, remplaçable par une custom — y compris un menu déroulant
    // de tranches (la valeur officielle tombe alors dans la bonne tranche).
    // L'enrichissement écrit CETTE cible ET la propriété dédiée ci-dessus.
    ...ENRICHMENT_CRM_TARGETS.map((p) => ({
      canonicalField: p.canonical,
      label: p.label,
      defaultProviderField: p.fallback,
      hint:
        "Défaut : propriété native HubSpot — remplaçable par une propriété custom, y compris un menu déroulant de tranches (la valeur officielle est mise dans la bonne tranche). Champs vides uniquement.",
      native: false,
    })),
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
          Pays de l&apos;organisation : <strong>{country ?? "France (défaut)"}</strong> — registre administratif adapté.{" "}
          {registry.supported ? null : (
            <>
              Ce registre n&apos;est pas encore branché : l&apos;enrichissement automatique est en pause pour éviter les
              faux rapprochements avec le registre français. Modifie le pays dans{" "}
              <Link href="/dashboard/parametres/general" className="font-medium underline">Paramètres → Général</Link>{" "}
              s&apos;il est incorrect.
            </>
          )}
        </p>
      </div>

      {/* Un champ n'est COCHABLE que si sa propriété CRM cible est vérifiée
          (✓ dans le CRM) dans le bloc « Propriétés CRM » ci-dessous — sans
          HubSpot connecté (pas de vérification possible), pas de verrou. */}
      <SettingsEditLock>
        <EnrichmentSettingsForm
          initial={settings}
          fieldVerified={
            hubspotToken
              ? Object.fromEntries(
                  ENRICHMENT_HUBSPOT_PROPERTIES.map((p) => {
                    // Effectif / CA : deux cibles possibles (propriété CRM
                    // remappable OU propriété dédiée) — cochable si l'UNE des
                    // deux est vérifiée dans le CRM.
                    const alt = ENRICHMENT_CRM_TARGETS.find((t) => t.field === p.field);
                    const ok =
                      hubspotPropertyStatus[p.canonical]?.exists === true ||
                      (alt ? hubspotPropertyStatus[alt.canonical]?.exists === true : false);
                    return [p.field, ok];
                  }),
                )
              : null
          }
        />
      </SettingsEditLock>

      {/* ── Signaux de rapprochement de groupe : visibilité des signaux (montant,
             domaine, SIREN/SIRET) + opt-in « ressemblance de nom ». Verrou
             d'édition (✎ Modifier) comme les autres blocs — réglage auto-enregistré. ── */}
      <SettingsEditLock>
        <GroupSignalsSettings initialNameMatch={nameMatchEnabled} initialDomainMatch={domainMatchEnabled} />
      </SettingsEditLock>

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
          <SettingsEditLock label="✎ Modifier le mapping">
            <IdentifierMappingForm
              rows={mappingRows}
              savedMappings={savedMappings}
              disabledProviders={[]}
              hubspotPropertyStatus={hubspotPropertyStatus}
              allowExtraCustomIds={false}
            />
          </SettingsEditLock>
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
