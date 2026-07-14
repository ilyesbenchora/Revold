/**
 * Logo tableur (style Google Sheets / Excel) — un document vert avec une grille,
 * utilisé pour l'intégration d'import de fichiers. Évite le « G » de Google.
 */
export function SpreadsheetLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Excel / Google Sheets">
        <path d="M29 4H12a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V15L29 4z" fill="#188038" />
        <path d="M29 4l11 11H33a4 4 0 0 1-4-4V4z" fill="#0f652e" />
        <rect x="15" y="22" width="18" height="14" rx="1.5" fill="#fff" />
        <path d="M15 27h18M15 31.5h18M21 22v14M27 22v14" stroke="#188038" strokeWidth="1.4" />
      </svg>
    </span>
  );
}
