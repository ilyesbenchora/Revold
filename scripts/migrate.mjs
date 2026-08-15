#!/usr/bin/env node
/**
 * Runner de migrations Supabase — automatise l'application des fichiers
 * supabase/migrations/*.sql (fini le copier-coller dans le SQL Editor, et
 * fini la dérive code déployé ↔ schéma réel).
 *
 * Fonctionnement :
 *  - table de suivi `schema_migrations` (créée au premier run) ;
 *  - BASELINE : si la table est vide, les fichiers EXISTANTS sont marqués
 *    appliqués sans être exécutés (la base a été construite à la main
 *    jusqu'ici) — seules les migrations ajoutées ENSUITE s'exécutent ;
 *  - chaque migration s'applique dans une transaction ; un échec ARRÊTE le
 *    build (on ne déploie jamais du code dont le schéma manque) ;
 *  - sans SUPABASE_DB_URL : no-op silencieux (dev local, preview sans DB).
 *
 * Usage : `npm run migrate` — exécuté au début du build Vercel (ci-build).
 * SUPABASE_DB_URL = chaîne de connexion Postgres du projet (Dashboard
 * Supabase → Settings → Database → Connection string, mode session).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.log("[migrate] SUPABASE_DB_URL absent — migrations sautées (no-op).");
  process.exit(0);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

let exitCode = 0;
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      baseline boolean NOT NULL DEFAULT false
    )
  `);
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  if (applied.size === 0 && files.length > 0) {
    console.log(
      `[migrate] Premier run : baseline de ${files.length} migrations existantes ` +
        "(marquées appliquées, NON exécutées — l'état actuel de la base fait foi).",
    );
    for (const f of files) {
      await client.query(
        "INSERT INTO schema_migrations (name, baseline) VALUES ($1, true) ON CONFLICT (name) DO NOTHING",
        [f],
      );
    }
  } else {
    const pending = files.filter((f) => !applied.has(f));
    for (const f of pending) {
      const sql = readFileSync(join(dir, f), "utf8");
      console.log(`[migrate] Application de ${f}…`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`[migrate] ÉCHEC sur ${f} : ${e.message}`);
        console.error("[migrate] Build interrompu — corrige la migration ou applique-la manuellement puis note-la dans schema_migrations.");
        exitCode = 1;
        break;
      }
    }
    if (exitCode === 0) {
      console.log(pending.length > 0 ? `[migrate] ${pending.length} migration(s) appliquée(s).` : "[migrate] Schéma à jour.");
    }
  }
} finally {
  await client.end();
}
process.exit(exitCode);
