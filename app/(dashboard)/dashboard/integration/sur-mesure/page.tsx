export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { CustomConnectorWizard } from "@/components/custom-connector-wizard";
import { customProvider, PAGE_REQUIREMENTS } from "@/lib/integrations/custom-connector";

/**
 * Intégrations → Outil sur mesure : brancher un logiciel ABSENT du catalogue
 * (ERP maison, application métier développée en interne). Le client déclare
 * les endpoints une fois, Revold teste en direct, détecte les champs et
 * rapproche les données du CRM par l'ID de rapprochement.
 */
export default async function SurMesurePage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  const supabase = await createSupabaseServerClient();

  let connectors: Array<{ id: string; key: string; label: string; base_url: string; auth_type: string; auth_param: string | null; last_sync_at: string | null; last_error: string | null }> = [];
  let endpointCounts: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from("custom_connectors")
      .select("id, key, label, base_url, auth_type, auth_param, last_sync_at, last_error")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    connectors = (data ?? []) as typeof connectors;
    if (connectors.length > 0) {
      const { data: eps } = await supabase
        .from("custom_connector_endpoints")
        .select("connector_id")
        .in("connector_id", connectors.map((c) => c.id));
      endpointCounts = (eps ?? []).reduce<Record<string, number>>((acc, e) => {
        const k = e.connector_id as string;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    }
  } catch {
    /* migration non appliquée → assistant vierge */
  }

  // Pages réellement rattachées, lues dans la MÊME table que le bloc
  // « Outil source par page » (tool_mappings) : une seule source de vérité.
  const pagesByConnector: Record<string, string[]> = {};
  if (connectors.length > 0) {
    try {
      const { data: mappings } = await supabase
        .from("tool_mappings")
        .select("page_key, tool_keys")
        .eq("organization_id", orgId)
        .in("page_key", PAGE_REQUIREMENTS.map((p) => p.key));
      for (const c of connectors) {
        const provider = customProvider(c.key);
        pagesByConnector[c.id] = (mappings ?? [])
          .filter((m) => ((m.tool_keys as string[]) ?? []).includes(provider))
          .map((m) => PAGE_REQUIREMENTS.find((p) => p.key === m.page_key)?.label ?? (m.page_key as string));
      }
    } catch {
      /* mapping indisponible → simplement pas affiché */
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <Link href="/dashboard/integration/bibliotheque" className="text-xs text-slate-500 hover:text-slate-900">
          ← Bibliothèque d&apos;outils
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Connecter un outil sur mesure</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Ton ERP maison ou ton logiciel métier n&apos;est pas dans la bibliothèque ? Déclare son API une fois : Revold
          la teste en direct, détecte les champs disponibles et rapproche ses données de ton CRM grâce à{" "}
          <Link href="/dashboard/parametres/modele-donnees" className="font-medium text-accent hover:underline">
            l&apos;ID de rapprochement
          </Link>{" "}
          — le code client que tes équipes partagent entre les deux outils. Factures, abonnements et tickets
          alimentent alors les mêmes analyses cross-source que Stripe ou Pennylane.
        </p>
      </header>

      {connectors.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Outils sur mesure connectés</h2>
          {connectors.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {c.base_url} · {endpointCounts[c.id] ?? 0} endpoint{(endpointCounts[c.id] ?? 0) > 1 ? "s" : ""} ·{" "}
                  {c.last_sync_at
                    ? `dernière synchro le ${new Date(c.last_sync_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : "jamais synchronisé"}
                </p>
                {c.last_error && <p className="mt-0.5 text-[11px] text-rose-600">⚠ {c.last_error}</p>}
                <p className="mt-1 text-[11px] text-slate-600">
                  {pagesByConnector[c.id]?.length ? (
                    <>
                      Alimente : <span className="font-medium text-slate-800">{pagesByConnector[c.id].join(" · ")}</span>
                    </>
                  ) : (
                    <>
                      Aucune page ne l&apos;utilise encore —{" "}
                      <Link href="/dashboard/parametres/integrations" className="font-medium text-accent hover:underline">
                        sélectionne-le dans « Outil source par page »
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                source : custom_{c.key}
              </span>
            </div>
          ))}
        </div>
      )}

      <CustomConnectorWizard />

      <div className="card bg-slate-50/60 p-4">
        <p className="text-xs font-semibold text-slate-700">Comment ça marche, concrètement</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-500">
          <li>Tu donnes l&apos;URL de l&apos;API de ton outil et sa clé d&apos;authentification.</li>
          <li>
            Pour chaque type de donnée (clients, factures…), tu colles le chemin de l&apos;endpoint et tu cliques
            « Tester » : Revold appelle l&apos;API, affiche un enregistrement réel et repère les champs disponibles.
          </li>
          <li>
            Tu associes chaque champ de ton outil au modèle Revold. Le champ obligatoire est{" "}
            <span className="font-medium text-slate-600">l&apos;ID de rapprochement</span> : le code client que
            l&apos;outil partage avec le CRM.
          </li>
          <li>
            Revold synchronise dans ses tables canoniques : tes factures « maison » se croisent avec les deals HubSpot,
            exactement comme celles de Stripe (écart signé/facturé, impayés, MRR à risque…).
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-slate-400">
          Ton outil n&apos;expose pas d&apos;API ? Deux alternatives : l&apos;
          <Link href="/dashboard/integration/import-fichier" className="underline hover:text-slate-600">import de fichier</Link>{" "}
          (CSV / Google Sheets, même rapprochement par ID) ou un serveur{" "}
          <Link href="/dashboard/integration/mcp" className="underline hover:text-slate-600">MCP</Link> pour les agents.
        </p>
      </div>
    </section>
  );
}
