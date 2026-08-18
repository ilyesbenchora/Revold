import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ENRICHMENT_FIELD_COLUMNS,
  ENRICHMENT_FIELD_LABELS,
  type EnrichmentFields,
} from "@/lib/enrichment/settings";

/**
 * SUGGESTIONS D'ENRICHISSEMENT — deux familles :
 *  1. les CHAMPS NON COCHÉS dans Paramètres → Enrichissement : chaque donnée
 *     que Revold sait remplir mais que l'org n'a pas activée est proposée ici,
 *     avec le nombre de fiches où elle manque (une activation = une passe
 *     ciblée depuis le bloc du moteur) ;
 *  2. la donnée manquante malgré un champ ACTIF non couverte par les blocs du
 *     dessus : le secteur d'activité (NAF), rempli au prochain rafraîchissement.
 */

const FIELD_ICON: Record<keyof EnrichmentFields, string> = {
  siren: "🔑",
  siret: "🏢",
  vat: "🧾",
  employees: "👥",
  revenue: "💶",
  industry: "🏷️",
  legalForm: "⚖️",
  shareCapital: "💰",
  headOfficeAddress: "📍",
};

export async function EnrichmentSuggestions({
  supabase,
  orgId,
  fields,
}: {
  supabase: SupabaseClient;
  orgId: string;
  fields: EnrichmentFields;
}) {
  const base = () => supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  const count = async (apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<number> => {
    try {
      const { count: n, error } = await apply(base());
      return error ? 0 : n ?? 0;
    } catch {
      return 0;
    }
  };

  // ── 1. Champs décochés dans Paramètres → Enrichissement ──
  const inactive = ENRICHMENT_FIELD_LABELS.filter((f) => !fields[f.id]);
  const inactiveCounts = await Promise.all(
    inactive.map((f) =>
      count((q) => {
        const col = ENRICHMENT_FIELD_COLUMNS[f.id];
        // Hors SIREN, l'enrichissement part des fiches identifiées : le manque
        // se mesure sur les entreprises AVEC SIREN.
        return f.id === "siren" ? q.is(col, null) : q.not("siren", "is", null).is(col, null);
      }),
    ),
  );

  // ── 2. Secteur manquant alors que le champ est ACTIF (rempli au prochain
  //       rafraîchissement) — si le champ est décoché, la famille 1 le couvre. ──
  const noSector = fields.industry ? await count((q) => q.not("siren", "is", null).is("naf_code", null)) : 0;

  type Suggestion = { icon: string; title: string; detail: string; count: number | null; href: string; cta: string; badge?: string };
  const suggestions: Suggestion[] = [
    ...inactive.map((f, i): Suggestion => ({
      icon: FIELD_ICON[f.id] ?? "✨",
      title: `Activer « ${f.label} »`,
      detail: `${f.hint}. ${
        inactiveCounts[i] > 0
          ? `${inactiveCounts[i].toLocaleString("fr-FR")} entreprises n'ont pas cette donnée — coche le champ dans les réglages puis relance une passe : seuls les champs vides sont remplis.`
          : "Champ non activé dans Paramètres → Enrichissement — coche-le pour que Revold remplisse cette donnée (champs vides uniquement)."
      }`,
      count: inactiveCounts[i] > 0 ? inactiveCounts[i] : null,
      href: "/dashboard/parametres/enrichissement",
      cta: "Activer dans les réglages",
      badge: "non activé",
    })),
    ...(noSector > 0
      ? [
          {
            icon: "🏷️",
            title: "Poser le secteur d'activité (NAF)",
            detail: `${noSector.toLocaleString("fr-FR")} entreprises sans secteur — utile pour segmenter tes reportings par industrie. Rempli au prochain rafraîchissement si le champ est actif.`,
            count: noSector,
            href: "/dashboard/parametres/enrichissement",
            cta: "Vérifier les réglages",
          } satisfies Suggestion,
        ]
      : []),
  ];

  if (suggestions.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-card-border bg-slate-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Suggestions d&apos;enrichissement</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Ce qui manque à ta base pour un croisement de données complet — dont les données que Revold sait remplir mais
          qui ne sont pas activées dans Paramètres → Enrichissement.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {suggestions.map((s) => (
          <div key={s.title} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span aria-hidden className="text-lg">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">
                {s.title}
                {s.badge && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                    {s.badge}
                  </span>
                )}
                {s.count != null && (
                  <span className="ml-2 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">
                    {s.count.toLocaleString("fr-FR")}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{s.detail}</p>
            </div>
            <Link
              href={s.href}
              className="shrink-0 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
            >
              {s.cta} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
