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

    // ── Taux CRM × outil ──
    // Priorité aux liens contact/company. Pour les outils qui ne synchronisent
    // pas ces entités (ex : Pennylane → factures/abonnements), on mesure la part
    // de leurs documents rattachés à une entreprise reliée au CRM.
    const providers = [...new Set(rows.map((r) => r.provider))].filter((p) => p !== crmProvider);
    const crmLinked = new Set(
      rows.filter((r) => r.provider === crmProvider).map((r) => `${r.entity_type}:${r.internal_id}`),
    );

    /** ids d'entités (contacts/companies) confirmées reliées au CRM (hubspot_id posé). */
    async function crmLinkedEntityIds(table: "contacts" | "companies", ids: string[]): Promise<Set<string>> {
      const out = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase
          .from(table)
          .select("id")
          .eq("organization_id", orgId)
          .in("id", chunk)
          .not("hubspot_id", "is", null);
        for (const row of (data ?? []) as Array<{ id: string }>) out.add(row.id);
      }
      return out;
    }

    const providerRates: ProviderMatchRate[] = [];
    for (const provider of providers) {
      const allPRows = rows.filter((r) => r.provider === provider);
      const ccRows = allPRows.filter((r) => r.entity_type === "contact" || r.entity_type === "company");

      if (ccRows.length > 0) {
        // 1. Rapide : l'entité a aussi un lien CRM dans source_links.
        let matched = ccRows.filter((r) => crmLinked.has(`${r.entity_type}:${r.internal_id}`)).length;

        // 2. Complément : le miroir CRM pose hubspot_id sur contacts/companies sans
        //    forcément passer par source_links — on vérifie les non-matchés restants.
        const unmatched = ccRows.filter((r) => !crmLinked.has(`${r.entity_type}:${r.internal_id}`));
        const crmIds = new Set<string>();
        for (const entityType of ["contact", "company"] as const) {
          const ids = [...new Set(unmatched.filter((r) => r.entity_type === entityType).map((r) => r.internal_id))];
          const table = entityType === "contact" ? "contacts" : "companies";
          for (const id of await crmLinkedEntityIds(table, ids)) crmIds.add(id);
        }
        matched += unmatched.filter((r) => crmIds.has(r.internal_id)).length;

        providerRates.push({
          provider,
          total: ccRows.length,
          matched: Math.min(matched, ccRows.length),
          pct: Math.round((Math.min(matched, ccRows.length) / ccRows.length) * 100),
        });
        continue;
      }

      // Repli documents : factures / abonnements → company_id → entreprise reliée au CRM.
      const docRows = allPRows.filter((r) => r.entity_type === "invoice" || r.entity_type === "subscription");
      if (docRows.length === 0) {
        providerRates.push({ provider, total: 0, matched: 0, pct: 0 });
        continue;
      }
      let matched = 0;
      let total = 0;
      for (const entityType of ["invoice", "subscription"] as const) {
        const ids = [...new Set(docRows.filter((r) => r.entity_type === entityType).map((r) => r.internal_id))];
        if (ids.length === 0) continue;
        const table = entityType === "invoice" ? "invoices" : "subscriptions";
        const docs: Array<{ id: string; company_id: string | null }> = [];
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { data } = await supabase
            .from(table)
            .select("id, company_id")
            .eq("organization_id", orgId)
            .in("id", chunk);
          docs.push(...((data ?? []) as Array<{ id: string; company_id: string | null }>));
        }
        total += docs.length;
        const companyIds = [...new Set(docs.map((d) => d.company_id).filter((c): c is string => !!c))];
        const linkedCompanies = await crmLinkedEntityIds("companies", companyIds);
        matched += docs.filter((d) => d.company_id && linkedCompanies.has(d.company_id)).length;
      }
      providerRates.push({
        provider,
        total,
        matched,
        pct: total > 0 ? Math.round((matched / total) * 100) : 0,
      });
    }

    return { totalLinks: rows.length, methodStats, multiSourcePct, providerRates };
  } catch {
    return empty;
  }
}
