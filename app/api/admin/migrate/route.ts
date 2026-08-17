import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ADMIN — Exécution de migrations SQL dans le runtime Vercel, où les
 * identifiants Postgres de l'intégration Supabase↔Vercel sont disponibles
 * (POSTGRES_URL_NON_POOLING — introuvables en clair via `vercel env pull`,
 * variables sensibles).
 *
 * Sécurité : Authorization: Bearer <CRON_SECRET> obligatoire (même garde que
 * les crons). Équivalent en pouvoir à la clé service-role déjà en env.
 * Usage : corps de requête = SQL brut (migrations idempotentes de
 * supabase/migrations, collées telles quelles).
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "POSTGRES_URL absent du runtime" }, { status: 500 });

  const sql = await request.text();
  if (!sql.trim()) return NextResponse.json({ error: "SQL vide" }, { status: 400 });

  const { Client } = await import("pg");
  // Le paramètre sslmode de l'URL Supabase prime sur l'option `ssl` dans les
  // versions récentes de pg → on le retire pour que rejectUnauthorized:false
  // s'applique (chaîne de certificats Supabase auto-signée côté runtime).
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur SQL" }, { status: 500 });
  } finally {
    try {
      await client.end();
    } catch {}
  }
}
