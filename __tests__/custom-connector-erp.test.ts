// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  fetchPage,
  fetchAllRecords,
  suggestFieldMapFromSample,
  type ConnectorAuth,
} from "@/lib/integrations/custom-connector";

/**
 * FAUX ERP en process (node:http) exerçant le VRAI code du connecteur sur-mesure :
 * OAuth2 client-credentials, JSON paginé, XML/SOAP, CSV, OData nextLink, et
 * l'auto-mapping nom+valeur. Prouve le parcours de bout en bout sans dépendre
 * d'un service externe.
 */

const CLIENTS = [
  { id: "e1", code_client: "CLI-001", raison_sociale: "ACME SA", email: "contact@acme.fr", montant_total: "1500.50", siren: "552100554" },
  { id: "e2", code_client: "CLI-002", raison_sociale: "Globex", email: "info@globex.fr", montant_total: "2300", siren: "404833048" },
  { id: "e3", code_client: "CLI-003", raison_sociale: "Initech", email: "hello@initech.fr", montant_total: "980", siren: "123456782" },
];

let server: http.Server;
let base = "";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", base || "http://localhost");
    const send = (code: number, body: string, ct = "application/json") => {
      res.writeHead(code, { "content-type": ct });
      res.end(body);
    };

    // ── OAuth2 : jeton client-credentials (Basic id:secret attendu) ──
    if (url.pathname === "/oauth/token" && req.method === "POST") {
      const auth = req.headers.authorization ?? "";
      const okBasic = auth.startsWith("Basic ") && Buffer.from(auth.slice(6), "base64").toString() === "client-42:secret-xyz";
      if (!okBasic) return send(401, JSON.stringify({ error: "bad_client" }));
      return send(200, JSON.stringify({ access_token: "TKN-OAUTH", token_type: "Bearer", expires_in: 3600 }));
    }

    // ── Endpoint protégé (Bearer requis) : clients paginés (2 par page) ──
    if (url.pathname === "/api/clients") {
      if (req.headers.authorization !== "Bearer TKN-OAUTH") return send(401, JSON.stringify({ error: "unauthorized" }));
      const page = Number(url.searchParams.get("page") ?? "1");
      const slice = CLIENTS.slice((page - 1) * 2, (page - 1) * 2 + 2);
      return send(200, JSON.stringify({ data: slice, meta: { page } }));
    }

    // ── SOAP / XML ──
    if (url.pathname === "/api/factures.xml") {
      const xml = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><Factures><Facture><Numero>FA-1</Numero><MontantTTC>1200</MontantTTC><CodeClient>CLI-001</CodeClient></Facture><Facture><Numero>FA-2</Numero><MontantTTC>3400</MontantTTC><CodeClient>CLI-002</CodeClient></Facture></Factures></soap:Body></soap:Envelope>`;
      return send(200, xml, "text/xml; charset=utf-8");
    }

    // ── CSV ──
    if (url.pathname === "/api/deals.csv") {
      const csv = "external_id,name,amount,code_client\nD-1,Renouvellement ACME,5000,CLI-001\nD-2,Extension Globex,7200,CLI-002";
      return send(200, csv, "text/csv; charset=utf-8");
    }

    // ── OData : value + @odata.nextLink (page 2 sans nextLink) ──
    if (url.pathname === "/odata/Customers") {
      const skip = Number(url.searchParams.get("$skip") ?? "0");
      if (skip === 0) {
        return send(200, JSON.stringify({ value: CLIENTS.slice(0, 2), "@odata.nextLink": `${base}/odata/Customers?$skip=2` }));
      }
      return send(200, JSON.stringify({ value: CLIENTS.slice(2) }));
    }

    send(404, JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const noAuth = (): ConnectorAuth => ({ base_url: base, auth_type: "none", auth_param: null, auth_value: null, auth_config: null });

describe("connecteur sur-mesure — faux ERP", () => {
  it("OAuth2 : récupère un jeton et lit l'endpoint protégé", async () => {
    const conn: ConnectorAuth = {
      base_url: base,
      auth_type: "oauth2",
      auth_param: null,
      auth_value: null,
      auth_config: { token_url: `${base}/oauth/token`, client_id: "client-42", client_secret: "secret-xyz", auth_style: "basic" },
    };
    const out = await fetchPage(conn, "/api/clients", "data");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.records.length).toBe(2);
      expect(out.records[0].code_client).toBe("CLI-001");
    }
  });

  it("échoue proprement sans jeton (401)", async () => {
    const out = await fetchPage(noAuth(), "/api/clients", "data");
    expect(out.ok).toBe(false);
  });

  it("auto-mapping nom + valeur sur l'échantillon JSON", async () => {
    const conn: ConnectorAuth = {
      base_url: base, auth_type: "oauth2", auth_param: null, auth_value: null,
      auth_config: { token_url: `${base}/oauth/token`, client_id: "client-42", client_secret: "secret-xyz", auth_style: "basic" },
    };
    const out = await fetchPage(conn, "/api/clients", "data");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const keys = Object.keys(out.records[0]);
    const map = suggestFieldMapFromSample("companies", keys, out.records[0]);
    expect(map.custom_id).toBe("code_client"); // nom
    expect(map.name).toBe("raison_sociale"); // nom
    expect(map.siren).toBe("siren"); // nom + valeur (9 chiffres)

    // Inférence PAR VALEUR : noms ERP exotiques, reconnus à leur forme.
    const exotic = { champ_a: "552100554", champ_b: "acme.fr", ref: "X" };
    const m2 = suggestFieldMapFromSample("companies", Object.keys(exotic), exotic);
    expect(m2.siren).toBe("champ_a"); // 9 chiffres
    expect(m2.domain).toBe("champ_b"); // ressemble à un domaine
  });

  it("pagination JSON (page) : ramène les 3 enregistrements", async () => {
    const conn: ConnectorAuth = {
      base_url: base, auth_type: "oauth2", auth_param: null, auth_value: null,
      auth_config: { token_url: `${base}/oauth/token`, client_id: "client-42", client_secret: "secret-xyz", auth_style: "basic" },
    };
    const { records, error } = await fetchAllRecords(conn, { path: "/api/clients", records_path: "data", pagination: { type: "page", param: "page", size: 2 } }, { maxPages: 5 });
    expect(error).toBeNull();
    expect(records.length).toBe(3);
  });

  it("XML / SOAP : parse et détecte le tableau", async () => {
    const out = await fetchPage(noAuth(), "/api/factures.xml", null);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.records.length).toBe(2);
      expect(out.records[0].Numero).toBe("FA-1");
    }
  });

  it("CSV : chaque ligne devient un enregistrement", async () => {
    const out = await fetchPage(noAuth(), "/api/deals.csv", null);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.records.length).toBe(2);
      expect(out.records[0].code_client).toBe("CLI-001");
    }
  });

  it("OData : suit @odata.nextLink jusqu'au bout", async () => {
    const { records, error } = await fetchAllRecords(noAuth(), { path: "/odata/Customers", records_path: "value", pagination: { type: "none" } }, { maxPages: 5 });
    expect(error).toBeNull();
    expect(records.length).toBe(3);
  });
});
