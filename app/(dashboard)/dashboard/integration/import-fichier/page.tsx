import Link from "next/link";
import { getConnectableTool, getCategoryLabel } from "@/lib/integrations/connect-catalog";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SpreadsheetLogo } from "@/components/spreadsheet-logo";
import { ImportSpreadsheetForm } from "@/components/connect-wizards/import-spreadsheet-form";
import { importSpreadsheetAction } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  no_org: "Aucune organisation associée à votre compte.",
  bad_url: "Lien Google Sheets invalide — collez l'URL complète de la feuille.",
  fetch_failed: "Impossible de récupérer la feuille. Vérifiez le lien et le partage.",
  not_public: "La feuille n'est pas accessible : activez le partage « toute personne disposant du lien » (lecture).",
  empty_file: "Fichier vide ou illisible — vérifiez que c'est bien un .csv.",
  bad_mode: "Mode d'import inconnu.",
  empty_data: "Aucune donnée détectée (pas d'en-têtes ou de lignes exploitables).",
  save_failed: "Échec de l'enregistrement. La table imported_datasets est-elle créée ?",
};

export default async function ImportSpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tool = getConnectableTool("spreadsheet")!;

  const errorKey = typeof sp.error === "string" ? sp.error : null;
  const errorReason = typeof sp.reason === "string" ? sp.reason : null;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? "Une erreur est survenue." : null;

  // Historique des imports (jeux de données déjà importés).
  const orgId = await getOrgId();
  let datasets: { id: string; name: string; source_type: string; row_count: number; created_at: string }[] = [];
  if (orgId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("imported_datasets")
      .select("id, name, source_type, row_count, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    datasets = data ?? [];
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard/integration" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Retour aux intégrations
      </Link>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <SpreadsheetLogo size={56} />
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{getCategoryLabel(tool.category)}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Importer un fichier Excel / Google Sheets</h1>
            <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Deux façons d&apos;importer</p>
          <ul className="mt-1.5 space-y-1 text-sm text-emerald-800">
            <li>• <strong>Fichier</strong> : depuis Excel, « Enregistrer sous » → CSV (.csv), puis déposez-le ici.</li>
            <li>• <strong>Google Sheets</strong> : partagez en « toute personne disposant du lien » puis collez l&apos;URL.</li>
          </ul>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">{errorMessage}</p>
            {errorReason && <p className="mt-1 text-xs text-red-600">{errorReason}</p>}
          </div>
        )}

        <ImportSpreadsheetForm action={importSpreadsheetAction} />

        <p className="mt-4 text-xs text-slate-400">
          🔒 Les données importées sont stockées dans votre espace Revold (Supabase RLS), isolées par organisation.
        </p>
      </div>

      {datasets.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Jeux de données importés</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {datasets.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {d.source_type === "gsheet" ? "Google Sheets" : "Fichier CSV"} · {d.row_count} lignes ·{" "}
                    {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  Importé
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
