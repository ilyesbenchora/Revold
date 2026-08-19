import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeysChain } from "@/lib/integrations/tool-mappings";
import { basePageKey } from "@/lib/kpi/tile-catalog";
import { customSourceCoverage, type SourceCoverage } from "@/lib/integrations/custom-health";

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
  const url = new URL(request.url);
  const pageKey = url.searchParams.get("page_key");
  // `?coverage=1` : joint la couverture de rattachement des connecteurs SUR
  // MESURE (part des enregistrements reliés à une entreprise) — le funnel
  // l'affiche au choix de la source. Opt-in : les autres appels ne paient rien.
  const wantCoverage = url.searchParams.get("coverage") === "1";

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
    // Chaîne de fallback : mapping de la sous-page (Trésorerie → Paiement…)
    // s'il existe, sinon celui de la page parente. Une sous-page hérite donc
    // du réglage « Outil source par page » de sa section tant qu'elle n'a pas
    // le sien.
    const chain = [MAPPING_ALIASES[pageKey] ?? pageKey];
    const base = basePageKey(pageKey);
    if (base !== pageKey) chain.push(MAPPING_ALIASES[base] ?? base);
    // Tableaux de bord personnalisés (board_<id>) : héritage de la Vue
    // d'ensemble des tableaux, comme le gate de la page.
    if (pageKey.startsWith("board_")) chain.push("tableau_bord");
    const mapped = await getToolKeysChain(supabase, orgId, chain);
    if (mapped.length > 0) tools = tools.filter((t) => mapped.includes(t.key));
  }

  // Couverture de rattachement + champs MÉTIER supplémentaires des connecteurs
  // sur mesure (opt-in `coverage=1` — le funnel en fait des KPIs dynamiques).
  const coverageByKey = new Map<string, SourceCoverage[]>();
  const extraByKey = new Map<string, Array<{ entity: string; id: string; label: string; kind: string }>>();
  if (wantCoverage && tools.some((t) => t.key.startsWith("custom_"))) {
    await Promise.all([
      ...tools
        .filter((t) => t.key.startsWith("custom_"))
        .map(async (t) => {
          const cov = await customSourceCoverage(supabase, orgId, t.key);
          if (cov.length > 0) coverageByKey.set(t.key, cov);
        }),
      (async () => {
        try {
          const { data: eps } = await supabase
            .from("custom_connector_endpoints")
            .select("entity, extra_fields, is_active, custom_connectors(key)")
            .eq("organization_id", orgId);
          for (const ep of eps ?? []) {
            if (ep.is_active === false) continue;
            const connKey = (ep.custom_connectors as { key?: string } | null)?.key;
            if (!connKey) continue;
            const providerKey = `custom_${connKey}`;
            const fields = Array.isArray(ep.extra_fields) ? ep.extra_fields : [];
            for (const f of fields as Array<{ id?: string; label?: string; kind?: string }>) {
              if (!f?.id || !f.label) continue;
              const list = extraByKey.get(providerKey) ?? [];
              list.push({ entity: String(ep.entity), id: f.id, label: f.label, kind: f.kind === "number" ? "number" : "label" });
              extraByKey.set(providerKey, list);
            }
          }
        } catch {
          /* colonne extra_fields absente (migration non appliquée) → rien */
        }
      })(),
    ]);
  }

  return NextResponse.json({
    tools: tools.map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      category: t.category,
      ...(coverageByKey.has(t.key) ? { coverage: coverageByKey.get(t.key) } : {}),
      ...(extraByKey.has(t.key) ? { extraFields: extraByKey.get(t.key) } : {}),
    })),
  });
}
