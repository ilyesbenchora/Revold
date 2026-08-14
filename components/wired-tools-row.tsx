"use client";

import { useEffect, useState } from "react";
import { ENTITY_SOURCE_CATEGORY } from "@/lib/reports/data-table-presets";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";
import { BrandLogo } from "@/components/brand-logo";
import { toolDomain } from "@/lib/integrations/tool-domains";

/**
 * Ligne « Câblé sur » des panneaux de vérification de câblage (alertes,
 * objectifs, tables de données, blocs de rapport) : affiche le ou les outils
 * connectés qui ALIMENTENT l'entité canonique du câblage.
 *
 * - `sourceKeys` (outils croisés choisis sur l'asset) : s'ils contiennent un
 *   outil de la catégorie de l'entité, ce sont eux qui sont affichés ;
 * - sinon, repli sur les outils connectés de la catégorie (la vraie source
 *   des données, les sourceKeys restants n'étant que des filtres croisés).
 */
export function WiredToolsRow({ entity, sourceKeys }: { entity: string; sourceKeys?: string[] | null }) {
  const [connected, setConnected] = useState<{ key: string; label: string; category: string }[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/integrations/connected")
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => { if (alive) setConnected(Array.isArray(d.tools) ? d.tools : []); })
      .catch(() => { if (alive) setConnected([]); });
    return () => { alive = false; };
  }, []);

  const cat = ENTITY_SOURCE_CATEGORY[entity];
  if (!cat) return null;
  const explicit = (sourceKeys ?? [])
    .map((k) => getConnectableTool(k))
    .filter((t): t is NonNullable<typeof t> => !!t && t.category === cat);
  const tools = explicit.length > 0 ? explicit : (connected ?? []).filter((t) => t.category === cat);
  if (tools.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">Câblé sur</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-900">
        {tools.map((t) => (
          <span key={t.key} className="inline-flex items-center gap-1">
            <BrandLogo domain={toolDomain(t.key)} alt={t.label} fallback="🔗" size={12} />
            {t.label}
          </span>
        ))}
      </dd>
    </div>
  );
}
