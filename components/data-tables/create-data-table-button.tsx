"use client";

/**
 * Bouton « Créer une table de données » à placer en haut de page (header).
 * Émet l'event que PageDataTables écoute pour ouvrir le builder. Un jumeau
 * existe en bas de page dans la section Tables de données.
 */
export function CreateDataTableButton({ variant = "solid" }: { variant?: "solid" | "soft" }) {
  function fire() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("revold:open-data-table"));
  }

  const cls =
    variant === "soft"
      ? "border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
      : "bg-accent text-white hover:bg-indigo-500";

  return (
    <button
      type="button"
      onClick={fire}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${cls}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </svg>
      Créer une table de données
    </button>
  );
}
