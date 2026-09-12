// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { fetchPage, fetchAllRecords, type ConnectorAuth } from "@/lib/integrations/custom-connector";

/**
 * Cas réalistes de plusieurs types d'outils (au-delà du chemin idéal) :
 *  - SaaS moderne : pagination CURSOR + records imbriqués (results.items) + Bearer ;
 *  - ERP FR : CSV séparé par « ; » avec BOM et en-têtes accentués ;
 *  - ERP legacy SOAP : UN SEUL enregistrement (objet, pas tableau) ;
 *  - ERP header-key + pagination OFFSET ;
 *  - erreurs serveur (500 HTML) proprement remontées.
 */

let server: http.Server;
let base = "";

const ROWS = Array.from({ length: 5 }, (_, i) => ({ id: `r${i + 1}`, code_client: `CLI-${i + 1}`, raison_sociale: `Client ${i + 1}` }));

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (code: number, body: string | Buffer, ct = "application/json") => {
      res.writeHead(code, { "content-type": ct });
      res.end(body);
    };

    // SaaS moderne : cursor pagination, records dans results.items, Bearer.
    if (url.pathname === "/v2/contacts") {
      if (req.headers.authorization !== "Bearer sk_test") return send(401, JSON.stringify({ error: "unauthorized" }));
      const after = Number(url.searchParams.get("cursor") ?? "0");
      const items = ROWS.slice(after, after + 2);
      const next = after + 2 < ROWS.length ? String(after + 2) : null;
      return send(200, JSON.stringify({ results: { items }, paging: { next } }));
    }

    // ERP header-key + offset pagination.
    if (url.pathname === "/erp/clients") {
      if (req.headers["x-api-key"] !== "KEY123") return send(401, JSON.stringify({ error: "no_key" }));
      const offset = Number(url.searchParams.get("offset") ?? "0");
      return send(200, JSON.stringify({ data: ROWS.slice(offset, offset + 2) }));
    }

    // ERP FR : CSV « ; » + BOM + en-têtes accentués + montant « 1 234,56 ».
    if (url.pathname === "/export/clients.csv") {
      const csv = "﻿Code Client;Raison Sociale;Montant dû\nCLI-1;Société Ampère;1 234,56\nCLI-2;Éléctricité Générale;980,00";
      return send(200, csv, "text/csv; charset=utf-8");
    }

    // ERP legacy SOAP : UN SEUL <Facture> (objet, pas tableau).
    if (url.pathname === "/soap/facture-unique") {
      const xml = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><Reponse><Factures><Facture><Numero>FA-UNIQUE</Numero><Montant>500</Montant></Facture></Factures></Reponse></s:Body></s:Envelope>`;
      return send(200, xml, "text/xml");
    }

    // Erreur serveur avec corps HTML (pas JSON).
    if (url.pathname === "/boom") {
      return send(500, "<html><body>Internal Server Error</body></html>", "text/html");
    }

    send(404, JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const bearer = (): ConnectorAuth => ({ base_url: base, auth_type: "bearer", auth_param: null, auth_value: "sk_test", auth_config: null });
const headerKey = (): ConnectorAuth => ({ base_url: base, auth_type: "header", auth_param: "X-API-Key", auth_value: "KEY123", auth_config: null });
const noAuth = (): ConnectorAuth => ({ base_url: base, auth_type: "none", auth_param: null, auth_value: null, auth_config: null });

describe("connecteur sur-mesure — cas réalistes multi-outils", () => {
  it("SaaS : pagination CURSOR + records imbriqués results.items", async () => {
    const { records, error } = await fetchAllRecords(
      bearer(),
      { path: "/v2/contacts", records_path: "results.items", pagination: { type: "cursor", param: "cursor", cursorPath: "paging.next" } },
      { maxPages: 10 },
    );
    expect(error).toBeNull();
    expect(records.length).toBe(5);
    expect(records[0].code_client).toBe("CLI-1");
  });

  it("ERP : header-key + pagination OFFSET", async () => {
    const { records, error } = await fetchAllRecords(
      headerKey(),
      { path: "/erp/clients", records_path: "data", pagination: { type: "offset", param: "offset", size: 2 } },
      { maxPages: 10 },
    );
    expect(error).toBeNull();
    expect(records.length).toBe(5);
  });

  it("ERP FR : CSV séparé par « ; » avec BOM et en-têtes accentués", async () => {
    const out = await fetchPage(noAuth(), "/export/clients.csv", null);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.records.length).toBe(2);
    const keys = Object.keys(out.records[0]);
    // Les colonnes « ; » doivent être séparées (sinon 1 seule colonne fourre-tout).
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(out.records[0]["Code Client"]).toBe("CLI-1");
  });

  it("ERP legacy SOAP : un enregistrement unique → 1 ligne", async () => {
    const out = await fetchPage(noAuth(), "/soap/facture-unique", "Envelope.Body.Reponse.Factures.Facture");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.records.length).toBe(1);
    expect(out.records[0].Numero).toBe("FA-UNIQUE");
  });

  it("erreur 500 (corps HTML) : remontée propre, pas de crash", async () => {
    const out = await fetchPage(noAuth(), "/boom", null);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(500);
  });
});
