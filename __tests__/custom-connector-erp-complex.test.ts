// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import {
  fetchPage,
  fetchAllRecords,
  mapRecord,
  extraValuesFromRecord,
  suggestFieldMapFromSample,
  type ConnectorAuth,
} from "@/lib/integrations/custom-connector";
import { num, date } from "@/lib/integrations/sync/connectors/custom-rest";

/**
 * AUDIT ERP COMPLEXE — vrai serveur reproduisant les comportements pénibles du
 * réel, et vérification de la transformation CANONIQUE de bout en bout (les
 * fonctions exactes de la synchro : mapRecord + num + date + extraValues).
 *  - 429 rate-limit puis 200 (retry) ;
 *  - réponse gzip ;
 *  - records profondément imbriqués (auto-détection) ;
 *  - lignes nulles / champs manquants tolérés ;
 *  - montants « 1.234,56 » et dates « JJ/MM/AAAA » convertis correctement ;
 *  - champ métier supplémentaire (extra).
 */

let server: http.Server;
let base = "";
let hits429 = 0;

// Deals ERP complexes : montants et dates au format FR, champ métier "marge".
const DEALS = [
  { deal_ref: "OP-1", raison: "Ampère SA", code_client: "CLI-1", mnt: "12 500,50", cloture: "31/12/2026", etat: "Gagné", marge_pct: "18,5" },
  { deal_ref: "OP-2", raison: "Globex", code_client: "CLI-2", mnt: "1.234,56", cloture: "05/06/2026", etat: "En cours", marge_pct: "9" },
  null, // ligne nulle (export ERP bancal) — doit être tolérée
  { deal_ref: "OP-3", raison: null, code_client: "CLI-3", mnt: null, cloture: "", etat: "Perdu", marge_pct: null },
];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sendJson = (code: number, obj: unknown, gzip = false) => {
      const body = Buffer.from(JSON.stringify(obj));
      if (gzip) { res.writeHead(code, { "content-type": "application/json", "content-encoding": "gzip" }); res.end(gzipSync(body)); }
      else { res.writeHead(code, { "content-type": "application/json" }); res.end(body); }
    };

    // Rate-limit : 429 au 1er appel, 200 ensuite (retry attendu).
    if (url.pathname === "/api/ratelimited") {
      hits429++;
      if (hits429 === 1) { res.writeHead(429, { "retry-after": "0", "content-type": "application/json" }); return res.end(JSON.stringify({ error: "rate_limited" })); }
      return sendJson(200, { data: [{ id: 1 }, { id: 2 }] });
    }

    // Réponse gzip.
    if (url.pathname === "/api/gzip") return sendJson(200, { data: [{ id: "z1", nom: "Zip Co" }] }, true);

    // Records profondément imbriqués (Envelope > payload > result > records).
    if (url.pathname === "/api/deep") {
      return sendJson(200, { Envelope: { payload: { result: { records: DEALS.filter(Boolean) } } } });
    }

    // Deals complexes (formats FR + ligne nulle + champs manquants).
    if (url.pathname === "/api/deals") return sendJson(200, { data: DEALS });

    res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "nf" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const conn = (): ConnectorAuth => ({ base_url: base, auth_type: "none", auth_param: null, auth_value: null, auth_config: null });

describe("audit ERP complexe", () => {
  it("429 rate-limit → retry → 200", async () => {
    hits429 = 0;
    const out = await fetchPage(conn(), "/api/ratelimited", "data");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.records.length).toBe(2);
    expect(hits429).toBe(2); // un 429 puis un succès
  });

  it("réponse gzip décompressée et parsée", async () => {
    const out = await fetchPage(conn(), "/api/gzip", "data");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.records[0].nom).toBe("Zip Co");
  });

  it("records profondément imbriqués : auto-détection", async () => {
    const out = await fetchPage(conn(), "/api/deep", null);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.detectedPath).toBe("Envelope.payload.result.records");
      expect(out.records.length).toBe(3);
    }
  });

  it("transformation CANONIQUE de bout en bout (mapRecord + num + date + extra)", async () => {
    const out = await fetchPage(conn(), "/api/deals", "data");
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    // Lignes nulles tolérées (filtrées par fetchPage : ne garde que les objets).
    expect(out.records.length).toBe(3);

    // Mapping comme la synchro : correspondance des champs de l'ERP.
    const fieldMap = { external_id: "deal_ref", name: "raison", custom_id: "code_client", amount: "mnt", close_date: "cloture", status: "etat" };
    const extraFields = [{ id: "marge_pct", label: "Marge %", kind: "number" as const, source: "marge_pct" }];

    const canon = out.records.map((raw) => {
      const m = mapRecord(raw, fieldMap);
      const extra = extraValuesFromRecord(raw, extraFields);
      const status = (m.status ?? "").toLowerCase();
      return {
        external_id: m.external_id,
        name: m.name ?? m.external_id,
        amount: num(m.amount),
        close_date: date(m.close_date)?.slice(0, 10) ?? null,
        won: /gagn|won|sign|conclu/.test(status),
        lost: /perdu|lost|abandon|annul/.test(status),
        marge: extra?.marge_pct ?? null,
      };
    });

    // OP-1 : montant FR espace + virgule, date JJ/MM/AAAA, gagné, marge décimale.
    expect(canon[0]).toEqual({ external_id: "OP-1", name: "Ampère SA", amount: 12500.5, close_date: "2026-12-31", won: true, lost: false, marge: 18.5 });
    // OP-2 : montant « 1.234,56 » (point milliers), date 5 juin, marge entière.
    expect(canon[1]).toEqual({ external_id: "OP-2", name: "Globex", amount: 1234.56, close_date: "2026-06-05", won: false, lost: false, marge: 9 });
    // OP-3 : champs manquants → nulls propres, nom = ref, perdu.
    expect(canon[2]).toEqual({ external_id: "OP-3", name: "OP-3", amount: null, close_date: null, won: false, lost: true, marge: null });
  });

  it("auto-mapping reconnaît les champs de l'ERP complexe", async () => {
    const out = await fetchPage(conn(), "/api/deals", "data");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const map = suggestFieldMapFromSample("deals", Object.keys(out.records[0]), out.records[0]);
    expect(map.custom_id).toBe("code_client"); // ID de rapprochement reconnu
  });

  it("pagination bornée : ne dépasse pas maxRecords", async () => {
    const { records } = await fetchAllRecords(conn(), { path: "/api/deals", records_path: "data", pagination: { type: "none" } }, { maxRecords: 2 });
    expect(records.length).toBeLessThanOrEqual(2);
  });
});
