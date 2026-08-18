import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { ENRICHMENT_HUBSPOT_PROPERTIES, getEnrichmentSettings } from "@/lib/enrichment/settings";

export const dynamic = "force-dynamic";

/**
 * Vérifie que les propriétés HubSpot cibles de l'enrichissement existent dans
 * le portail (lecture seule — la création se fait à l'enregistrement des
 * Paramètres → Enrichissement et au lancement d'une passe). Alimente le bloc
 * « Propriétés HubSpot » de la page Enrichissement et des Paramètres.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const settings = await getEnrichmentSettings(supabase, orgId);
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ connected: false, properties: [] });

  const { data: mapped } = await supabase
    .from("identifier_field_mapping")
    .select("canonical_field, provider_field")
    .eq("organization_id", orgId)
    .eq("provider", "hubspot");
  const propFor = (canonical: string, fallback: string) =>
    (mapped ?? []).find((m) => m.canonical_field === canonical)?.provider_field?.trim() || fallback;

  const targets = ENRICHMENT_HUBSPOT_PROPERTIES.filter((p) => settings.fields[p.field]);
  const properties = await Promise.all(
    targets.map(async (p) => {
      const name = propFor(p.canonical, p.fallback);
      try {
        const res = await fetch(`https://api.hubapi.com/crm/v3/properties/companies/${encodeURIComponent(name)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = (await res.json()) as { hasUniqueValue?: boolean };
          return {
            field: p.field,
            name,
            label: p.label,
            status: "exists" as const,
            // L'unicité n'importe que pour les identifiants cherchables.
            uniqueValue: !p.unique || d.hasUniqueValue === true,
          };
        }
        if (res.status === 404) return { field: p.field, name, label: p.label, status: "missing" as const, uniqueValue: false };
        return { field: p.field, name, label: p.label, status: "error" as const, uniqueValue: false };
      } catch {
        return { field: p.field, name, label: p.label, status: "error" as const, uniqueValue: false };
      }
    }),
  );

  return NextResponse.json({ connected: true, properties });
}
