/**
 * Pièces jointes de données pour les agents conversationnels.
 *
 * Un attachement représente un tableur (fichier CSV/Excel exporté, ou Google
 * Sheets) réduit à : ses colonnes, un aperçu texte des premières lignes, et le
 * nombre total de lignes. Cet aperçu est injecté dans le contexte de l'agent
 * pour qu'il raisonne dessus. Partagé entre le chat et l'agenda de coaching.
 */

import type { ParsedCsv } from "./integrations/csv";

export type AttachmentSource = "file" | "gsheet";

export type Attachment = {
  id: string;
  name: string;
  source: AttachmentSource;
  columns: string[];
  rowCount: number;
  preview: string;
};

const MAX_PREVIEW_ROWS = 40;
const MAX_PREVIEW_CHARS = 4000;
const MAX_TOTAL_CONTEXT = 14000;

/** Construit un aperçu texte tabulaire (en-têtes + premières lignes). */
export function buildPreview(parsed: ParsedCsv): string {
  const { columns, rows } = parsed;
  const head = columns.join(" | ");
  const body = rows
    .slice(0, MAX_PREVIEW_ROWS)
    .map((r) => columns.map((c) => (r[c] ?? "").replace(/\s+/g, " ")).join(" | "))
    .join("\n");
  let text = body ? `${head}\n${body}` : head;
  if (rows.length > MAX_PREVIEW_ROWS) text += `\n… (+${rows.length - MAX_PREVIEW_ROWS} lignes non affichées)`;
  return text.slice(0, MAX_PREVIEW_CHARS);
}

/** Bloc de contexte à ajouter au system prompt de l'agent. */
export function attachmentsSystemBlock(list: Attachment[]): string {
  if (!list.length) return "";
  const blocks = list
    .map(
      (a) =>
        `### Fichier joint : ${a.name} (${a.rowCount} lignes ; colonnes : ${a.columns.join(", ")})\n${a.preview}`,
    )
    .join("\n\n");
  const intro = `\n\nL'utilisateur a joint ${list.length} fichier(s) de données (Excel / CSV / Google Sheets). Traite-les comme une source de contexte prioritaire : analyse-les, croise-les avec les autres sources connectées quand c'est pertinent, et cite-les explicitement dans ta réponse.\n\n`;
  return (intro + blocks).slice(0, MAX_TOTAL_CONTEXT);
}

/** Valide/normalise un attachement reçu du client (données non fiables). */
export function sanitizeAttachment(raw: unknown): Attachment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.slice(0, 200) : null;
  const preview = typeof o.preview === "string" ? o.preview.slice(0, MAX_PREVIEW_CHARS) : "";
  if (!name || !preview) return null;
  const columns = Array.isArray(o.columns)
    ? o.columns.filter((c): c is string => typeof c === "string").slice(0, 100)
    : [];
  const rowCount = typeof o.rowCount === "number" && Number.isFinite(o.rowCount) ? Math.max(0, Math.floor(o.rowCount)) : 0;
  const source: AttachmentSource = o.source === "gsheet" ? "gsheet" : "file";
  const id = typeof o.id === "string" ? o.id.slice(0, 60) : `${Date.now()}`;
  return { id, name, source, columns, rowCount, preview };
}

export function sanitizeAttachments(raw: unknown, max = 8): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeAttachment)
    .filter((a): a is Attachment => a !== null)
    .slice(0, max);
}
