/**
 * POST /api/integrations/praiz/webhook
 *
 * Receiver pour les webhooks Praiz (conversation intelligence).
 *
 * SETUP côté Praiz :
 *   1. Contacter hello@praiz.io pour obtenir l'accès API webhooks
 *   2. Configurer l'URL : https://revold.io/api/integrations/praiz/webhook?org=<UUID>
 *   3. Récupérer le webhook_secret fourni par Praiz
 *   4. L'enregistrer dans Revold via /dashboard/integration/connect/praiz
 *
 * PAYLOAD attendu (basé sur la doc Praiz) :
 * {
 *   "request_id": "uuid",
 *   "datetime": "ISO8601",
 *   "video": {
 *     "id": "string",
 *     "title": "Demo XYZ",
 *     "duration": 1820,
 *     "transcript_url": "https://...",
 *     "user_email": "sales@org.com",
 *     "source": "google_meet" | "zoom" | "aircall" | ...,
 *     "url": "https://praiz.io/...",
 *     "created_date": "ISO8601"
 *   },
 *   "participants": [
 *     { "first_name": "...", "last_name": "...", "email": "...", "phone_number": "..." }
 *   ],
 *   "template": {
 *     "fields": [
 *       { "name": "talk_ratio", "type": "number", "extracted_value": 65 },
 *       { "name": "sentiment", "type": "string", "extracted_value": "positive" },
 *       { "name": "objections", "type": "list", "extracted_value": ["price", "timing"] },
 *       { "name": "next_steps", "type": "list", "extracted_value": ["envoyer devis", ...] }
 *     ]
 *   }
 * }
 *
 * AUTH : Bearer token (webhook_secret) dans header Authorization
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const maxDuration = 60;

type PraizPayload = {
  request_id?: string;
  datetime?: string;
  video?: {
    id?: string;
    title?: string;
    duration?: number;
    transcript_url?: string;
    user_email?: string;
    source?: string;
    url?: string;
    created_date?: string;
  };
  participants?: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
  }>;
  template?: {
    fields?: Array<{ name: string; type?: string; description?: string; extracted_value?: unknown }>;
  };
};

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  // ── 1. Identifier l'org ──
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) {
    return NextResponse.json({ error: "Missing org param" }, { status: 400 });
  }

  // ── 2. Service role pour bypass RLS ──
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 3. Récupère le webhook_secret pour cette org ──
  const { data: integration } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("provider", "praiz")
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Praiz integration not configured for this org" }, { status: 404 });
  }

  const webhookSecret = (integration.metadata as { webhook_secret?: string } | null)?.webhook_secret;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // ── 4. Vérifier l'auth (Bearer token) ──
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${webhookSecret}`;
  if (!timingSafeEqual(authHeader, expected)) {
    console.warn("[praiz webhook] auth failed", { orgId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 5. Parser le payload ──
  let payload: PraizPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.video?.id) {
    return NextResponse.json({ error: "Missing video.id" }, { status: 400 });
  }

  // ── 6. Extraire les insights depuis template.fields ──
  const insights: Record<string, unknown> = {};
  const scores: Record<string, number> = {};
  for (const field of payload.template?.fields ?? []) {
    if (!field.name || field.extracted_value === undefined || field.extracted_value === null) continue;
    insights[field.name] = field.extracted_value;
    // Normalise les scores numériques 0-100
    if (field.type === "number" && typeof field.extracted_value === "number") {
      const lower = field.name.toLowerCase();
      if (lower.includes("score") || lower.includes("ratio") || lower.includes("likelihood")) {
        scores[field.name] = Number(field.extracted_value);
      }
    }
  }

  // ── 7. Cross-link avec HubSpot (best-effort par email participant) ──
  let hubspotContactId: string | null = null;
  let hubspotCompanyId: string | null = null;
  let hubspotDealId: string | null = null;

  const externalParticipants = (payload.participants ?? []).filter(
    (p) => p.email && !p.email.toLowerCase().includes(payload.video?.user_email?.toLowerCase() ?? "@@@@"),
  );
  if (externalParticipants.length > 0 && externalParticipants[0].email) {
    // Match avec hubspot via le token de l'org
    const { data: hsRow } = await supabase
      .from("integrations")
      .select("access_token")
      .eq("organization_id", orgId)
      .eq("provider", "hubspot")
      .eq("is_active", true)
      .single();

    if (hsRow?.access_token) {
      try {
        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${hsRow.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: externalParticipants[0].email }] }],
            properties: ["email", "associatedcompanyid"],
            limit: 1,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const contact = data.results?.[0];
          if (contact) {
            hubspotContactId = contact.id ?? null;
            hubspotCompanyId = contact.properties?.associatedcompanyid ?? null;
          }
        }
      } catch (err) {
        console.warn("[praiz webhook] hubspot cross-link failed", { orgId, err });
      }
    }
  }

  // ── 8. Upsert dans conversations ──
  const { error } = await supabase
    .from("conversations")
    .upsert(
      {
        organization_id: orgId,
        provider: "praiz",
        provider_id: payload.video.id,
        title: payload.video.title ?? null,
        source: payload.video.source ?? null,
        duration_seconds: payload.video.duration ?? null,
        recorded_at: payload.video.created_date ? new Date(payload.video.created_date).toISOString() : null,
        recording_url: payload.video.url ?? null,
        transcript_url: payload.video.transcript_url ?? null,
        user_email: payload.video.user_email ?? null,
        participants: payload.participants ?? [],
        insights,
        scores,
        hubspot_contact_id: hubspotContactId,
        hubspot_company_id: hubspotCompanyId,
        hubspot_deal_id: hubspotDealId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,provider_id" },
    );

  if (error) {
    console.error("[praiz webhook] upsert failed", { orgId, err: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, video_id: payload.video.id });
}

// GET = healthcheck pour debug + obtenir l'URL/secret à donner à Praiz
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  return NextResponse.json({
    status: "ok",
    message: "Praiz webhook endpoint",
    your_webhook_url: orgId
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://revold.io"}/api/integrations/praiz/webhook?org=${orgId}`
      : "Add ?org=<your-org-uuid> to get the URL",
    auth_header: "Authorization: Bearer <webhook_secret>",
    setup: [
      "1. Contact hello@praiz.io pour obtenir l'accès API",
      "2. Génère un webhook_secret aléatoire (32+ chars)",
      "3. Configure dans Praiz : URL ci-dessus + header Authorization: Bearer <secret>",
      "4. Enregistre le secret dans Revold via /dashboard/integration/connect/praiz",
    ],
  });
}
