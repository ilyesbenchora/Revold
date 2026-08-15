import Link from "next/link";
import { CATEGORY_META } from "@/lib/integrations/category-meta";
import type { ConnectableTool } from "@/lib/integrations/connect-catalog";

/**
 * Incitation au CROISEMENT DE DONNÉES — Revold ne prend sa pleine valeur qu'à
 * partir de DEUX sources connectées (CA signé vs CA facturé, deals gagnés sans
 * facture, MRR à risque sur les comptes à tickets…). Affiché en tête de la
 * bibliothèque d'outils, avec trois états :
 *   0 source  → connecter la première (le CRM en priorité),
 *   1 source  → pousser la seconde, avec les catégories complémentaires,
 *   2+        → confirmer que le cross-source est actif (ton positif, discret).
 *
 * Les canaux de communication (Slack, Teams, Gmail…) ne comptent pas : ce sont
 * des canaux de notification, pas des sources de données.
 */
export function CrossSourceNudge({
  connectedCategories,
  dataToolsCount,
}: {
  /** Catégories des outils de DONNÉES déjà connectés. */
  connectedCategories: ConnectableTool["category"][];
  /** Nombre d'outils de données connectés (hors communication). */
  dataToolsCount: number;
}) {
  // Catégories complémentaires à suggérer (celles qui manquent, dans l'ordre de
  // valeur du croisement).
  const SUGGEST_ORDER: ConnectableTool["category"][] = ["crm", "billing", "support", "phone", "ads"];
  const missing = SUGGEST_ORDER.filter((c) => !connectedCategories.includes(c)).slice(0, 3);

  if (dataToolsCount >= 2) {
    return (
      // Colonne unique (pas de flex-wrap) : la ligne de suggestion se plaçait
      // en pleine largeur, désalignée du texte principal.
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span aria-hidden className="mt-0.5 shrink-0">✓</span>
        <div className="min-w-0 flex-1">
          <p>
            <strong>Croisement de données actif</strong> — {dataToolsCount} sources connectées. Revold réconcilie tes
            outils entre eux : CA signé vs CA facturé, deals gagnés sans facture, MRR à risque…
          </p>
          {missing.length > 0 && (
            <p className="mt-1 text-[11px] text-emerald-700">
              Encore plus de valeur avec : {missing.map((c) => CATEGORY_META[c].label).join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const first = dataToolsCount === 0;

  return (
    <div className="overflow-hidden rounded-xl border-2 border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50">
      <div className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-600">
              {first ? "Première étape" : "Étape clé — il ne manque qu'un outil"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {first
                ? "Connecte au moins 2 outils pour débloquer la vraie valeur de Revold"
                : "Connecte un 2ᵉ outil pour débloquer le croisement de données"}
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
              Un outil seul te donne ses propres chiffres — que tu as déjà chez lui. C&apos;est en{" "}
              <strong className="text-slate-800">croisant deux sources</strong> que Revold révèle ce qu&apos;aucun outil
              ne voit : le CA signé dans ton CRM confronté au CA réellement facturé, les deals gagnés jamais facturés,
              le MRR à risque sur les comptes qui ouvrent des tickets, le vrai délai entre signature et encaissement.
            </p>

            {/* Exemples concrets de croisement — rend la promesse tangible */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { pair: "CRM × Facturation", value: "Deals gagnés jamais facturés, DSO réel" },
                { pair: "CRM × Service client", value: "MRR à risque sur les comptes à tickets" },
                { pair: "CRM × Téléphonie", value: "Impact des appels sur le closing" },
              ].map((x) => (
                <span
                  key={x.pair}
                  title={x.value}
                  className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                >
                  <span className="font-semibold text-fuchsia-700">{x.pair}</span>
                  <span className="text-slate-400">·</span>
                  <span className="truncate">{x.value}</span>
                </span>
              ))}
            </div>

            {!first && missing.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Tu as déjà{" "}
                <strong className="text-slate-700">
                  {connectedCategories.map((c) => CATEGORY_META[c].label).join(", ")}
                </strong>{" "}
                — le meilleur complément :{" "}
                <strong className="text-fuchsia-700">{CATEGORY_META[missing[0]].label}</strong>
                {missing.length > 1 && <> ou {missing.slice(1).map((c) => CATEGORY_META[c].label).join(", ")}</>}.
              </p>
            )}
          </div>

          {/* Compteur de progression 0/2 · 1/2 */}
          <div className="shrink-0 rounded-xl border border-fuchsia-200 bg-white px-4 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-fuchsia-600">{dataToolsCount}/2</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Sources connectées</p>
            <div className="mt-2 flex justify-center gap-1">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-6 rounded-full ${i < dataToolsCount ? "bg-fuchsia-500" : "bg-slate-200"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-fuchsia-100 bg-white/60 px-5 py-2.5">
        <span className="text-[11px] text-slate-500">
          {first ? "Commence par ton CRM, puis ajoute ta facturation." : "Choisis un outil ci-dessous pour compléter."}
        </span>
        {first && (
          <Link
            href="/dashboard/integration/connect/hubspot"
            className="ml-auto rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Connecter HubSpot →
          </Link>
        )}
      </div>
    </div>
  );
}
