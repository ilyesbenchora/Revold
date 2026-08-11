// Statistiques RÉELLES de rapprochement, calculées sur source_links :
//  - répartition par méthode de match (paginée — le select non paginé plafonnait à 1000) ;
//  - % d'entités multi-sources (reliées à ≥ 2 outils) ;
//  - taux de rapprochement CRM × outil : part des enregistrements d'un outil
//    dont l'entité canonique est reliée au CRM (hubspot_id posé sur
//    contacts/companies — même définition que les orphelins de l'Audit qualité).

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderMatchRate = {
  provider: string;
  /** Enregistrements contact+company synchronisés depuis cet outil. */
  total: number;
  /** Dont l'entité canonique est reliée au CRM. */
  matched: number;
  pct: number;
};

export type SourceLinkStats = {
  totalLinks: number;
  /** Occurrences par match_method (siren, vat_number, exact_email, domain, name, siret, existing_link, created). */
  methodStats: Record<string, number>;
  /** % d'entités reliées à ≥ 2 outils — null si aucun lien. */
  multiSourcePct: number | null;
  providerRates: ProviderMatchRate[];
};

const PAGE = 1000;
const MAX_ROWS = 20000;

type LinkRow = { internal_id: string; provider: string; entity_type: string; match_method: string | null };

export async function loadSourceLinkStats(
  supabase: SupabaseClient,
  orgId: string,
  crmProvider = "hubspot",
): Promise<SourceLinkStats> {
  const empty: SourceLinkStats = { totalLinks: 0, methodStats: {}, multiSourcePct: null, providerRates: [] };
  try {
    // ── Scan paginé de source_links ──
    const rows: LinkRow[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from("source_links")
        .select("internal_id, provider, entity_type, match_method")
        .eq("organization_id", orgId)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      const chunk = (data ?? []) as LinkRow[];
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    if (rows.length === 0) return empty;

    // ── Répartition par méthode ──
    const methodStats: Record<string, number> = {};
    for (const r of rows) {
      if (!r.match_method) continue;
      methodStats[r.match_method] = (methodStats[r.match_method] ?? 0) + 1;
    }

    // ── Multi-source : entités reliées à ≥ 2 outils ──
    const byInternal = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!byInternal.has(r.internal_id)) byInternal.set(r.internal_id, new Set());
      byInternal.get(r.internal_id)!.add(r.provider);
    }
    const totalEntities = byInternal.size;
    const multi = [...byInternal.values()].filter((s) => s.size >= 2).length;
    const multiSourcePct = totalEntities > 0 ? Math.round((multi / totalEntities) * 100) : null;

    // ── Taux CRM × outil (contacts + companies uniquement) ──
    const providers = [...new Set(rows.map((r) => r.provider))].filter((p) => p !== crmProvider);
    const crmLinked = new Set(
      rows.filter((r) => r.provider === crmProvider).map((r) => `${r.entity_type}:${r.internal_id}`),
    );

    const providerRates: ProviderMatchRate[] = [];
    for (const provider of providers) {
      const pRows = rows.filter(
        (r) => r.provider === provider && (r.entity_type === "contact" || r.entity_type === "company"),
      );
      if (pRows.length === 0) continue;

      // 1. Rapide : l'entité a aussi un lien CRM dans source_links.
      let matched = pRows.filter((r) => crmLinked.has(`${r.entity_type}:${r.internal_id}`)).length;

      // 2. Complément : le miroir CRM pose hubspot_id sur contacts/companies sans
      //    forcément passer par source_links — on vérifie les non-matchés restants.
      const unmatched = pRows.filter((r) => !crmLinked.has(`${r.entity_type}:${r.internal_id}`));
      const crmLinkedIds = new Set<string>();
      for (const entityType of ["contact", "company"] as const) {
        const ids = [...new Set(unmatched.filter((r) => r.entity_type === entityType).map((r) => r.internal_id))];
        const table = entityType === "contact" ? "contacts" : "companies";
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { data: linkedRows } = await supabase
            .from(table)
            .select("id")
            .eq("organization_id", orgId)
            .in("id", chunk)
            .not("hubspot_id", "is", null);
          for (const row of (linkedRows ?? []) as Array<{ id: string }>) crmLinkedIds.add(row.id);
        }
      }
      matched += unmatched.filter((r) => crmLinkedIds.has(r.internal_id)).length;

      providerRates.push({
        provider,
        total: pRows.length,
        matched: Math.min(matched, pRows.length),
        pct: Math.round((Math.min(matched, pRows.length) / pRows.length) * 100),
      });
    }

    return { totalLinks: rows.length, methodStats, multiSourcePct, providerRates };
  } catch {
    return empty;
  }
}
