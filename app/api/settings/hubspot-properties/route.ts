import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty, checkHubSpotPropertyAcrossObjects } from "@/lib/integrations/hubspot-properties";

export const dynamic = "force-dynamic";

/**
 * Vérifie que des propriétés existent dans HubSpot (mapping des identifiants).
 * Body : { checks: [{ objectType: "companies"|"contacts"|"deals"|"any", name: string, label?: string, fallbackAny?: boolean }] }
 * `name` = nom interne saisi · `label` = libellé HubSpot, utilisé pour retrouver
 * le nom interne quand `name` est introuvable (→ suggestedName dans la réponse).
 * `objectType: "any"` (objet porteur inconnu) : la propriété est cherchée sur
 * les 3 objets — `foundObject` indique où elle a été trouvée.
 * `fallbackAny` (cohortes) : introuvable sur l'objet DEMANDÉ → recherche de
 * repli sur les autres objets, `foundObject` signale alors le bon objet (le
 * client peut corriger l'objet du mapping au lieu de rejeter à tort).
 * Réponse : { results: [{ objectType, name, exists, label, suggestedName, foundObject }] },
 * dans le même ordre que les checks.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { checks?: Array<{ objectType?: string; name?: string; label?: string; fallbackAny?: boolean }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const checks = (body.checks ?? [])
    .filter((c) => c && typeof c.objectType === "string" && (typeof c.name === "string" || typeof c.label === "string"))
    .slice(0, 40);
  if (checks.length === 0) return NextResponse.json({ results: [] });

  const token = await getHubSpotToken(supabase, orgId);
  const results = await Promise.all(
    checks.map(async (c) => {
      const labelHint = typeof c.label === "string" ? c.label : undefined;
      let check =
        c.objectType === "any"
          ? await checkHubSpotPropertyAcrossObjects(token, c.name ?? "", labelHint)
          : { ...(await checkHubSpotProperty(token, c.objectType as string, c.name ?? "", labelHint)), foundObject: null as string | null };
      // Repli : rien sur l'objet demandé (ni nom, ni libellé) → les autres
      // objets, pour signaler le bon objet plutôt qu'un faux « absente ».
      if (c.fallbackAny && c.objectType !== "any" && check.exists === false && !check.suggestedName) {
        const cross = await checkHubSpotPropertyAcrossObjects(token, c.name ?? "", labelHint);
        if (cross.exists === true || cross.suggestedName) check = cross;
      }
      return {
        objectType: c.objectType as string,
        name: c.name ?? "",
        exists: check.exists,
        label: check.label,
        suggestedName: check.suggestedName,
        // select/radio/checkbox = liste déroulante : les valeurs écrites sont
        // alignées sur ses options (voir alignEnumProperties côté push).
        fieldType: check.fieldType,
        foundObject: check.foundObject ?? (check.exists === true ? (c.objectType as string) : null),
      };
    }),
  );
  return NextResponse.json({ results, hasToken: !!token });
}
