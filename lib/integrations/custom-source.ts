import "server-only";
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import SftpClient from "ssh2-sftp-client";

/**
 * Sources NON-JSON des connecteurs sur-mesure — chargé en IMPORT DYNAMIQUE
 * depuis custom-connector.ts (jamais côté client : xlsx / ssh2 / xml sont des
 * dépendances Node lourdes). Couvre le gros de la friction ERP :
 *  - SOAP / API XML      → parsées en objet (détection du tableau ensuite) ;
 *  - exports CSV / XLSX  → chaque ligne devient un enregistrement ;
 *  - fichiers via SFTP   → l'ERP dépose un export, Revold le lit en lecture seule.
 */

export type ParsedPayload = unknown;

/** XML / SOAP → objet JS (préfixes de namespace retirés, attributs conservés). */
export function parseXml(text: string): ParsedPayload {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: true,
    trimValues: true,
  });
  return parser.parse(text);
}

/** CSV (texte) → tableau d'objets { colonne: valeur } via la 1ʳᵉ ligne d'en-têtes. */
export function parseCsv(text: string): Record<string, unknown>[] {
  const wb = XLSX.read(text, { type: "string", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
}

/** Classeur Excel (buffer) → tableau d'objets de la 1ʳᵉ feuille. */
export function parseXlsx(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
}

export type SourceFormat = "json" | "xml" | "csv" | "xlsx";

/** Devine le format d'après le content-type HTTP puis l'extension du chemin. */
export function detectFormat(contentType: string | null, pathHint: string): SourceFormat {
  const ct = (contentType ?? "").toLowerCase();
  const p = pathHint.toLowerCase();
  if (ct.includes("json") || p.endsWith(".json")) return "json";
  if (ct.includes("xml") || ct.includes("soap") || p.endsWith(".xml")) return "xml";
  if (p.endsWith(".xlsx") || p.endsWith(".xls") || ct.includes("spreadsheet") || ct.includes("excel")) return "xlsx";
  if (ct.includes("csv") || p.endsWith(".csv") || p.endsWith(".tsv")) return "csv";
  return "json";
}

/** Parse un contenu déjà récupéré (texte ou buffer) selon le format. */
export function parseByFormat(format: SourceFormat, text: string, buf: Buffer): ParsedPayload {
  if (format === "xml") return parseXml(text);
  if (format === "csv") return parseCsv(text);
  if (format === "xlsx") return parseXlsx(buf);
  return JSON.parse(text); // json
}

// ── SFTP : l'ERP dépose un fichier d'export, Revold le lit (lecture seule) ────
// URL : sftp://host[:port]/ ; identifiants = auth_param (user) / auth_value
// (mot de passe OU clé privée PEM). Le chemin de l'endpoint = chemin du fichier.
export type SftpConfig = { host: string; port: number; username: string; secret: string };

/** Décompose une base_url sftp:// en hôte + port. */
export function parseSftpBase(baseUrl: string): { host: string; port: number } | null {
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "sftp:") return null;
    return { host: u.hostname, port: u.port ? Number(u.port) : 22 };
  } catch {
    return null;
  }
}

/** Récupère un fichier par SFTP → Buffer (timeout court, connexion fermée). */
export async function fetchSftpFile(cfg: SftpConfig, filePath: string): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const sftp = new SftpClient();
  const isKey = cfg.secret.includes("PRIVATE KEY");
  try {
    await sftp.connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      ...(isKey ? { privateKey: cfg.secret } : { password: cfg.secret }),
      readyTimeout: 15_000,
    });
    const clean = filePath.startsWith("/") ? filePath : `/${filePath}`;
    const data = (await sftp.get(clean)) as Buffer;
    return { ok: true, buf: Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `SFTP : ${e.message}` : "SFTP : connexion impossible" };
  } finally {
    try { await sftp.end(); } catch { /* déjà fermé */ }
  }
}
