import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { checkHubSpotProperty } from "@/lib/integrations/hubspot-properties";

export const dynamic = "force-dynamic";

/**
 * Vérifie que des propriétés existent dans HubSpot (mapping des identifiants).
 * Body : { checks: [{ objectType: "companies"|"contacts"|"deals", name: string, label?: string }] }
 * `name` = nom interne saisi · `label` = libellé HubSpot, utilisé pour retrouver
 * le nom interne quand `name` est introuvable (→ suggestedName dans la réponse).
 * Réponse : { results: [{ objectType, name, exists, label, suggestedName }] },
 * dans le même ordre que les checks.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { checks?: Array<{ objectType?: string; name?: string; label?: string }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const checks = (body.checks ?? [])
    .filter((c) => c && typeof c.objectType === "string" && (typeof c.name === "string" || typeof c.label === "string"))
    .slice(0, 20);
  if (checks.length === 0) return NextResponse.json({ results: [] });

  const token = await getHubSpotToken(supabase, orgId);
  const results = await Promise.all(
    checks.map(async (c) => {
      const check = await checkHubSpotProperty(
        token,
        c.objectType as string,
        c.name ?? "",
        typeof c.label === "string" ? c.label : undefined,
      );
      return {
        objectType: c.objectType as string,
        name: c.name ?? "",
        exists: check.exists,
        label: check.label,
        suggestedName: check.suggestedName,
      };
    }),
  );
  return NextResponse.json({ results, hasToken: !!token });
}
