/**
 * ENDPOINT TEMPORAIRE — à supprimer après application des migrations.
 * Protégé par MIGRATION_SECRET (header `x-migration-secret`).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "endpoint disabled" }, { status: 503 });
  }
  if (req.headers.get("x-migration-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sql = await req.text();
  if (!sql.trim()) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    return NextResponse.json({ error: "POSTGRES_URL_NON_POOLING missing" }, { status: 500 });
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const start = Date.now();
  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({ ok: true, durationMs: Date.now() - start });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      },
      { status: 500 },
    );
  } finally {
    await client.end().catch(() => {});
  }
}
