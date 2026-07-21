import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeys } from "@/lib/integrations/tool-mappings";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/connected — outils connectés pour les sélecteurs
 * « données à croiser » (funnels, alertes).
 *
 * - Les outils de COMMUNICATION (Slack, Teams, Gmail, WhatsApp…) sont exclus
 *   d'office : ce sont des canaux de notification, jamais des sources de
 *   données à croiser.
 * - `?page_key=` : si la page a un mapping « Outil source par page »
 *   (Paramètres → Intégrations), il est LA source de vérité — seuls les
 *   outils mappés sont retournés. Sans mapping : tous les outils connectés.
 *   Ajouter/retirer un outil dans les paramètres se répercute donc
 *   automatiquement dans les pages.
 */
export async function GET(request: Request) {
  const pageKey = new URL(request.url).searchParams.get("page_key");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tools: [] });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ tools: [] });

  let tools = (await getConnectedTools(supabase, orgId)).filter(
    (t) => t.category !== "communication",
  );

  if (pageKey) {
    // Les funnels utilisent perf_ventes / perf_marketing ; les mappings des
    // paramètres stockent audit_perf_ventes / audit_perf_marketing.
    const MAPPING_ALIASES: Record<string, string> = {
      perf_ventes: "audit_perf_ventes",
      perf_marketing: "audit_perf_marketing",
    };
    const mapped = await getToolKeys(supabase, orgId, MAPPING_ALIASES[pageKey] ?? pageKey);
    if (mapped.length > 0) tools = tools.filter((t) => mapped.includes(t.key));
  }

  return NextResponse.json({
    tools: tools.map((t) => ({ key: t.key, label: t.label, icon: t.icon, category: t.category })),
  });
}
