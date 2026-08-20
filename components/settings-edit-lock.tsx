"use client";

import { useState } from "react";

/**
 * Verrou d'édition des blocs de réglages (Paramètres, Mon compte) : par
 * défaut le bloc est INSAISISSABLE — champs et CTA d'enregistrement désactivés
 * (fieldset disabled + pointer-events-none). Cliquer « ✎ Modifier » (ou le
 * libellé fourni, ex. « Modifier le mapping ») déverrouille : les champs
 * redeviennent éditables et le CTA « Enregistrer » du formulaire reprend la
 * main. « Terminer » reverrouille sans toucher aux données.
 * Protège contre les modifications accidentelles — les droits d'accès par
 * page restent gérés par ailleurs (page_access).
 */
export function SettingsEditLock({
  children,
  label = "✎ Modifier",
}: {
  children: React.ReactNode;
  /** Libellé du CTA de déverrouillage (ex : « ✎ Modifier le mapping »). */
  label?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        {editing && (
          <span className="text-[11px] text-amber-600">
            Mode édition — pense à enregistrer tes changements.
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            editing
              ? "border-slate-200 bg-white text-slate-500 hover:text-slate-700"
              : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
          }`}
        >
          {editing ? "Terminer" : label}
        </button>
      </div>
      {/* fieldset disabled : TOUS les champs et boutons du bloc sont inertes
          tant que le mode édition n'est pas activé. */}
      <fieldset
        disabled={!editing}
        className={editing ? "" : "pointer-events-none select-none opacity-80"}
        aria-label={editing ? undefined : "Bloc verrouillé — cliquer Modifier pour éditer"}
      >
        {children}
      </fieldset>
    </div>
  );
}
