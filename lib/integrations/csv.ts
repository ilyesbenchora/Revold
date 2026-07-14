/**
 * Minimal CSV parser (RFC 4180-ish) — no external dependency.
 *
 * Handles quoted fields, escaped quotes (""), commas/semicolons and newlines
 * inside quotes, and both LF / CRLF line endings. The delimiter is auto-detected
 * from the header line (comma vs semicolon — Excel FR exporte souvent en `;`).
 *
 * Used to ingest Excel/CSV files and Google Sheets (exportées en CSV) importées
 * via la page /dashboard/integration/import-fichier.
 */

export type ParsedCsv = {
  columns: string[];
  rows: Record<string, string>[];
};

function detectDelimiter(headerLine: string): string {
  const comma = (headerLine.match(/,/g) ?? []).length;
  const semi = (headerLine.match(/;/g) ?? []).length;
  const tab = (headerLine.match(/\t/g) ?? []).length;
  if (tab > comma && tab > semi) return "\t";
  return semi > comma ? ";" : ",";
}

/** Parse le CSV en lignes de champs, en respectant les guillemets. */
function tokenize(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore — géré par le \n suivant
    } else {
      field += c;
    }
  }
  // Dernier champ / dernière ligne (sans newline final)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse un texte CSV en { columns, rows }. Les lignes entièrement vides sont
 * ignorées. `maxRows` borne le nombre de lignes de données conservées.
 */
export function parseCsv(text: string, maxRows = 5000): ParsedCsv {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const firstBreak = clean.indexOf("\n");
  const headerLine = firstBreak === -1 ? clean : clean.slice(0, firstBreak);
  const delim = detectDelimiter(headerLine);

  const grid = tokenize(clean, delim).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (grid.length === 0) return { columns: [], rows: [] };

  const columns = grid[0].map((h, idx) => h.trim() || `col_${idx + 1}`);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < grid.length && rows.length < maxRows; i++) {
    const cells = grid[i];
    const obj: Record<string, string> = {};
    columns.forEach((col, idx) => {
      obj[col] = (cells[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return { columns, rows };
}

/**
 * Convertit une URL de partage Google Sheets en URL d'export CSV.
 * Retourne null si l'URL ne ressemble pas à un Google Sheets.
 */
export function googleSheetCsvUrl(shareUrl: string): string | null {
  const idMatch = shareUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const gidMatch = shareUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
