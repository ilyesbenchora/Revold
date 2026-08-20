"use client";

import { useEffect, useState } from "react";

/**
 * Note d'explication MASQUABLE : « Ne plus afficher » la range définitivement
 * (préférence d'affichage par navigateur, localStorage — un simple texte
 * d'aide, pas un état métier). Rien n'est rendu tant que la préférence n'est
 * pas lue (pas de flash).
 */
export function DismissibleNote({
  storageKey,
  variant = "plain",
  children,
}: {
  /** Clé unique de la note (ex : "mapping-identifiants"). */
  storageKey: string;
  /** "warning" = encart ambre ⚠ (avertissements de règles), "plain" = texte d'aide. */
  variant?: "plain" | "warning";
  children: React.ReactNode;
}) {
  const key = `revold:note:${storageKey}`;
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  if (hidden !== false) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }

  if (variant === "warning") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
        <p className="min-w-0 flex-1 text-xs font-medium text-amber-800">{children}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 whitespace-nowrap text-[11px] font-medium text-amber-500 transition hover:text-amber-700 hover:underline"
        >
          Ne plus afficher
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 whitespace-nowrap text-[11px] font-medium text-slate-400 transition hover:text-slate-600 hover:underline"
      >
        Ne plus afficher
      </button>
    </div>
  );
}
