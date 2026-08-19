import Link from "next/link";

/**
 * Message « Aucun outil source choisi pour cette page » — partagé entre le
 * gate serveur (PageSourcesGate) et le funnel de création de tables
 * (PageDataTables) : même texte partout, une seule source de vérité.
 * Composant PLAIN (ni serveur ni client) : importable des deux côtés.
 */
export function NoPageSourcesNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">
        Aucun outil source choisi pour cette page.
      </p>
      <p className="mt-1.5 text-xs text-slate-500">
        Les blocs s&apos;activent dès qu&apos;un outil est sélectionné dans{" "}
        <Link href="/dashboard/parametres/integrations" className="font-medium text-fuchsia-600 hover:underline">
          Paramètres → Intégrations → Outil source par page
        </Link>
        {" "}— c&apos;est la source de vérité de l&apos;affichage.
      </p>
    </div>
  );
}
