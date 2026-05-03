/**
 * Slack relay — workaround pour les routines Claude Code remote (CCR)
 * dont le sandbox bloque les requêtes sortantes vers hooks.slack.com.
 *
 * Les routines POST sur cet endpoint avec un secret en header, on forwarde
 * vers le webhook Slack stocké côté Vercel (qui n'a aucune restriction outbound).
 *
 * Sécurité : SLACK_RELAY_SECRET (32 bytes hex random) + rate limit implicite
 * Vercel + le webhook lui-même est secret (URL non publiée).
 *
 * Usage par les routines :
 *   curl -X POST https://revold.io/api/admin/slack-relay \
 *     -H 'x-slack-relay-secret: <secret>' \
 *     -H 'Content-Type: application/json' \
 *     -d '<payload Slack avec text/blocks>'
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.SLACK_RELAY_SECRET;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!expectedSecret || !webhookUrl) {
    return NextResponse.json(
      { error: "relay disabled: SLACK_RELAY_SECRET or SLACK_WEBHOOK_URL missing" },
      { status: 503 },
    );
  }

  if (req.headers.get("x-slack-relay-secret") !== expectedSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await req.text();
  if (!payload) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `slack ${res.status}: ${txt.slice(0, 200)}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 },
    );
  }
}
