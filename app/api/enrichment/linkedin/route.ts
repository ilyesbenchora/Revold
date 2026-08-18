import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/supabase/cached";
import { getEnrichmentSettings } from "@/lib/enrichment/settings";
import { countLinkedInRemaining, getLinkedInEnrichToken, runLinkedInBatch } from "@/lib/enrichment/linkedin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Source LinkedIn (bêta) — état et lots, SÉPARÉS du moteur Sirene : le bloc
 * dédié de la page Enrichissement affiche sa propre barre de complétion.
 * Périmètre : uniquement les entreprises sans effectif officiel.
 */

async function context() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const orgId = await getOrgId();
  if (!orgId) return { error: NextResponse.json({ error: "Organisation introuvable" }, { status: 400 }) };
  // Service role : lecture du token OAuth LinkedIn + écriture des colonnes
  // d'état (scope org imposé partout).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return { sb, orgId };
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { sb, orgId } = ctx;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (apply: (q: any) => any): Promise<number | null> => {
    try {
      const { count: n, error } = await apply(
        sb.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      );
      return error ? null : (n ?? 0);
    } catch {
      return null;
    }
  };

  const [settings, token, scope, viaLinkedin, remaining] = await Promise.all([
    getEnrichmentSettings(sb, orgId),
    getLinkedInEnrichToken(sb, orgId),
    // Périmètre LinkedIn : les entreprises dont le registre officiel ne publie
    // PAS l'effectif (les autres sont déjà couvertes par Sirene).
    count((q) => q.is("official_employee_range", null).not("name", "is", null)),
    count((q) => q.is("official_employee_range", null).not("linkedin_employee_count", "is", null)),
    countLinkedInRemaining(sb, orgId),
  ]);

  // Dernière avancée du scan LinkedIn (indépendante du moteur Sirene).
  let lastActivityAt: string | null = null;
  try {
    const { data } = await sb
      .from("companies")
      .select("linkedin_checked_at")
      .eq("organization_id", orgId)
      .not("linkedin_checked_at", "is", null)
      .order("linkedin_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastActivityAt = (data?.linkedin_checked_at as string | undefined) ?? null;
  } catch {
    lastActivityAt = null;
  }

  const total = scope ?? 0;
  const processed = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100;

  return NextResponse.json({
    enabled: settings.linkedinEnabled,
    connected: token != null,
    scope: total,
    viaLinkedin: viaLinkedin ?? 0,
    remaining,
    processed,
    pct,
    lastActivityAt,
    inProgress: token != null && remaining > 0,
  });
}

/** Un appel = un lot (~20 pages LinkedIn) ; l'UI boucle tant qu'il en reste. */
export async function POST() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { sb, orgId } = ctx;

  const settings = await getEnrichmentSettings(sb, orgId);
  if (!settings.linkedinEnabled) {
    return NextResponse.json({ error: "Source LinkedIn désactivée (Paramètres → Enrichissement)." }, { status: 400 });
  }
  const result = await runLinkedInBatch(sb, { orgId, budget: 20 });
  return NextResponse.json({ ok: true, ...result });
}
