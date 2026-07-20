"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PATH = "/dashboard/parametres/general";

/** Valeur texte nettoyée, ou null si vide (échéance non renseignée → repli standard). */
function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string | null)?.trim();
  return v ? v : null;
}
/** Montant numérique, ou null si vide/invalide. */
function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Persiste la section « Organisation » (nom, slug, devise, année fiscale, fuseau,
 * objectif, portal HubSpot, pays, SIREN, TVA, secteur). Le plan est en lecture
 * seule (non modifiable ici).
 */
export async function updateOrganisation(formData: FormData) {
  const orgId = await getOrgId();
  if (!orgId) redirect(`${PATH}?error=no_org`);

  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    currency: str(formData, "currency"),
    fiscal_year_start: num(formData, "fiscal_year_start"),
    timezone: str(formData, "timezone"),
    quarterly_target: num(formData, "quarterly_target"),
    hubspot_portal_id: str(formData, "hubspot_portal_id"),
    country: str(formData, "country"),
    siren: str(formData, "org_siren"),
    vat: str(formData, "org_vat"),
    industry: str(formData, "industry"),
    updated_at: new Date().toISOString(),
  };
  // name/slug sont NOT NULL : on ne les écrase que si une valeur est fournie.
  const name = str(formData, "org_name");
  const slug = str(formData, "org_slug");
  if (name) patch.name = name;
  if (slug) patch.slug = slug;

  const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);

  if (error) redirect(`${PATH}?error=org_save`);

  revalidatePath(PATH);
  redirect(`${PATH}?saved=org`);
}

/**
 * Persiste la section « Fiscalité & échéances » (Paramètres → Organisation) sur
 * la ligne `organizations`. Alimente ensuite la table « Échéances fiscales » du
 * funnel Trésorerie via /api/fiscal/echeances.
 */
export async function updateFiscalSettings(formData: FormData) {
  const orgId = await getOrgId();
  if (!orgId) redirect(`${PATH}?error=no_org`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      fiscal_tva_periodicite: str(formData, "fiscal_tva_periodicite"),
      fiscal_tva_prochaine: str(formData, "fiscal_tva_prochaine"),
      fiscal_tva_montant: num(formData, "fiscal_tva_montant"),
      fiscal_is_periodicite: str(formData, "fiscal_is_periodicite"),
      fiscal_is_prochaine: str(formData, "fiscal_is_prochaine"),
      fiscal_is_montant: num(formData, "fiscal_is_montant"),
      fiscal_urssaf_periodicite: str(formData, "fiscal_urssaf_periodicite"),
      fiscal_urssaf_prochaine: str(formData, "fiscal_urssaf_prochaine"),
      fiscal_urssaf_montant: num(formData, "fiscal_urssaf_montant"),
    })
    .eq("id", orgId);

  if (error) redirect(`${PATH}?error=fiscal_save`);

  revalidatePath(PATH);
  redirect(`${PATH}?saved=fiscal`);
}
