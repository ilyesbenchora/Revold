import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SUGGESTIONS D'ENRICHISSEMENT — seule la suggestion NON couverte par les
 * blocs du dessus s'affiche : le secteur d'activité (NAF). Les ID de
 * rapprochement, la validation en attente, les effectifs et le CA sont déjà
 * portés par le moteur et les blocs dédiés de la page.
 */
export async function EnrichmentSuggestions({ supabase, orgId }: { supabase: SupabaseClient; orgId: string }) {
  const count = async (apply: (q: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<number> => {
    try {
      const { count: n, error } = await apply(base());
      return error ? 0 : n ?? 0;
    } catch {
      return 0;
    }
  };
  const base = () => supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", orgId);

  const noSector = await count((q) => q.not("siren", "is", null).is("naf_code", null));

  const suggestions = [
    noSector > 0 && {
      icon: "🏷️",
      title: "Poser le secteur d'activité (NAF)",
      detail: `${noSector.toLocaleString("fr-FR")} entreprises sans secteur — utile pour segmenter tes reportings par industrie. Rempli au prochain rafraîchissement si le champ est actif.`,
      count: noSector,
      href: "/dashboard/parametres/enrichissement",
      cta: "Vérifier les réglages",
    },
  ].filter((s): s is Exclude<typeof s, false> => Boolean(s));

  if (suggestions.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-card-border bg-slate-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Suggestions d&apos;enrichissement</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Ce qui manque à ta base pour un croisement de données complet — seules les suggestions pertinentes s&apos;affichent.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {suggestions.map((s) => (
          <div key={s.title} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span aria-hidden className="text-lg">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">
                {s.title}
                <span className="ml-2 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">
                  {s.count.toLocaleString("fr-FR")}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{s.detail}</p>
            </div>
            {s.href && s.cta && (
              <Link
                href={s.href}
                className="shrink-0 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
              >
                {s.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
