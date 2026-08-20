"use client";

import { createContext, useContext, useState } from "react";

/**
 * Verrou d'édition des blocs de réglages (Paramètres, Mon compte) — UN SEUL
 * CTA : le bouton d'enregistrement du bloc (violet) devient le bouton du
 * verrou. Verrouillé, il affiche « ✎ Modifier… » et les champs sont
 * insaisissables (fieldset disabled) ; cliqué, le bloc passe en édition et le
 * MÊME bouton redevient « Enregistrer… » — la sauvegarde reverrouille.
 *
 * - `SettingsEditLock` : le fournisseur (fieldset + contexte). Les formulaires
 *   enfants remplacent leur bouton d'enregistrement par `SettingsSaveButton`.
 * - `fallbackCta` : pour les blocs SANS bouton d'enregistrement (réglages
 *   auto-enregistrés) — le verrou affiche lui-même le CTA unique en tête.
 */

type EditLockCtx = { editing: boolean; enterEdit: () => void; exitEdit: () => void };
const Ctx = createContext<EditLockCtx | null>(null);

/** Contexte du verrou (null hors d'un SettingsEditLock). */
export function useSettingsEditLock(): EditLockCtx | null {
  return useContext(Ctx);
}

const CTA_CLASS =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500";

export function SettingsEditLock({
  children,
  label = "✎ Modifier",
  fallbackCta = false,
}: {
  children: React.ReactNode;
  /** Libellé du CTA en mode verrouillé (ex : « ✎ Modifier le mapping »). */
  label?: string;
  /** Bloc sans bouton d'enregistrement propre : le verrou porte le CTA unique. */
  fallbackCta?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Ctx.Provider value={{ editing, enterEdit: () => setEditing(true), exitEdit: () => setEditing(false) }}>
      {fallbackCta && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
              editing
                ? "bg-accent text-white hover:bg-indigo-500"
                : "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
            }`}
          >
            {editing ? "Enregistrer" : label}
          </button>
        </div>
      )}
      {/* fieldset disabled : champs et boutons natifs inertes tant que le mode
          édition n'est pas activé — le CTA du verrou (span) reste cliquable. */}
      <fieldset disabled={!editing} className={editing ? "" : "select-none opacity-80"}>
        {children}
      </fieldset>
    </Ctx.Provider>
  );
}

/**
 * LE bouton unique d'un bloc verrouillable — remplace le bouton
 * d'enregistrement du formulaire. Verrouillé : « ✎ Modifier… » (span, non
 * désactivable par le fieldset) qui déverrouille. En édition : le vrai bouton
 * « Enregistrer… » qui appelle `onSave` — succès (≠ false) → reverrouille.
 * Hors verrou (formulaire utilisé ailleurs) : bouton d'enregistrement normal.
 */
export function SettingsSaveButton({
  editLabel = "✎ Modifier",
  label,
  busy = false,
  submit = false,
  onSave,
  className = "",
}: {
  /** Libellé en mode verrouillé (ex : « ✎ Modifier le mapping »). */
  editLabel?: string;
  /** Libellé en édition (ex : « Enregistrer le mapping », « Enregistrement… »). */
  label: string;
  busy?: boolean;
  /** Formulaire à server action : vrai bouton type=submit en édition. */
  submit?: boolean;
  /** Sauvegarde du formulaire — retourne false pour RESTER en édition (erreur). */
  onSave?: () => Promise<boolean | void> | boolean | void;
  className?: string;
}) {
  const lock = useSettingsEditLock();
  const locked = !!lock && !lock.editing;

  if (locked) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => lock!.enterEdit()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            lock!.enterEdit();
          }
        }}
        className={`${CTA_CLASS} ${className}`}
      >
        {editLabel}
      </span>
    );
  }

  if (submit) {
    // Server action : le POST re-render la page → le verrou remonte verrouillé.
    return (
      <button type="submit" disabled={busy} className={`${CTA_CLASS} disabled:opacity-50 ${className}`}>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        const ok = await onSave?.();
        if (ok !== false) lock?.exitEdit();
      }}
      className={`${CTA_CLASS} disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  );
}
