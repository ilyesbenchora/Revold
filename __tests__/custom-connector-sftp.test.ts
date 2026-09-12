// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Server, utils } from "ssh2";
import { fetchPage, type ConnectorAuth } from "@/lib/integrations/custom-connector";

/**
 * Vrai serveur SFTP EN PROCESS (ssh2) : clé d'hôte générée, auth par mot de
 * passe, un fichier CSV servi. On lit via le VRAI fetchPage en sftp:// —
 * handshake SSH + SFTP get + parsing CSV de bout en bout.
 */

const FILE_PATH = "/export/clients.csv";
const FILE_CONTENT = "code_client;raison_sociale;montant\nCLI-1;Ampère SA;1 234,56\nCLI-2;Globex;980,00";

const { STATUS_CODE, OPEN_MODE } = utils.sftp;
void OPEN_MODE;

let server: Server;
let base = "";

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  server = new Server({ hostKeys: [privateKey] }, (client) => {
    client.on("authentication", (ctx) => {
      // Accepte l'utilisateur "demo" / mot de passe "password".
      if (ctx.method === "password" && ctx.username === "demo" && ctx.password === "password") return ctx.accept();
      if (ctx.method === "none") return ctx.reject(["password"]);
      return ctx.reject();
    });
    client.on("ready", () => {
      client.on("session", (accept) => {
        const session = accept();
        session.on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          const buf = Buffer.from(FILE_CONTENT, "utf8");
          const HANDLE = Buffer.from([1]);
          const readDone = new Set<string>(); // handles déjà lus (→ EOF ensuite)

          sftp.on("REALPATH", (id: number, p: string) => {
            const name = p === "." || p === "" ? FILE_PATH : p;
            sftp.name(id, [{ filename: name, longname: name, attrs: {} as never }]);
          });
          const sendAttrs = (id: number) => sftp.attrs(id, { mode: 0o100644, size: buf.length, uid: 0, gid: 0, atime: 0, mtime: 0 } as never);
          sftp.on("STAT", sendAttrs);
          sftp.on("LSTAT", sendAttrs);
          sftp.on("FSTAT", sendAttrs);
          sftp.on("OPEN", (id: number) => sftp.handle(id, HANDLE));
          sftp.on("READ", (id: number, handle: Buffer, offset: number, length: number) => {
            const key = handle.toString("hex");
            if (readDone.has(key) || offset >= buf.length) return sftp.status(id, STATUS_CODE.EOF);
            const chunk = buf.subarray(offset, Math.min(offset + length, buf.length));
            readDone.add(key);
            sftp.data(id, chunk);
          });
          sftp.on("CLOSE", (id: number) => sftp.status(id, STATUS_CODE.OK));
        });
      });
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `sftp://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => { server.close(() => r()); }));

describe("connecteur sur-mesure — SFTP réel (ssh2)", () => {
  it("lit un fichier CSV par SFTP et le parse", async () => {
    const conn: ConnectorAuth = { base_url: base, auth_type: "sftp", auth_param: "demo", auth_value: "password", auth_config: null };
    const out = await fetchPage(conn, FILE_PATH, null);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.records.length).toBe(2);
    expect(out.records[0].code_client).toBe("CLI-1");
    expect(out.records[1].raison_sociale).toBe("Globex");
  });

  it("mauvais mot de passe → échec propre", async () => {
    const conn: ConnectorAuth = { base_url: base, auth_type: "sftp", auth_param: "demo", auth_value: "WRONG", auth_config: null };
    const out = await fetchPage(conn, FILE_PATH, null);
    expect(out.ok).toBe(false);
  });
});
