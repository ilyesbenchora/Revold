"use client";

/**
 * Petit « i » d'aide contextuelle : au survol (ou au focus clavier), une
 * infobulle précise à quoi correspond le réglage — utilisé dans les panneaux
 * de vérification du câblage (tables, alertes, objectifs).
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <span tabIndex={0} className="group relative inline-flex cursor-help align-middle outline-none">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-300 transition group-hover:text-slate-500 group-focus:text-slate-500"
        aria-label="Aide"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-60 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
