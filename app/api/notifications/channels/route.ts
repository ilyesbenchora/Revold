/**
 * GET  /api/notifications/channels       — liste les canaux configurés pour l'org
 * POST /api/notifications/channels       — upsert un canal (email/slack/teams/webhook)
 *   body: { type, config, enabled?, digest_daily_enabled?, digest_daily_time?, digest_weekly_enabled?, digest_weekly_day? }
 * DELETE /api/notifications/channels?type=email — supprime un canal
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["email", "slack", "teams", "webhook"] as const;

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_channels")
    .select("*")
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channels: data ?? [] });
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, config, enabled, digest_daily_enabled, digest_daily_time, digest_weekly_enabled, digest_weekly_day } = body;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid channel type" }, { status: 400 });
  }

  // Validation config selon le type
  if (type === "email") {
    const recipients = config?.recipients;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Email recipients required" }, { status: 400 });
    }
    for (const r of recipients) {
      if (typeof r !== "string" || !/.+@.+\..+/.test(r)) {
        return NextResponse.json({ error: `Email invalide : ${r}` }, { status: 400 });
      }
    }
  } else if (type === "slack" || type === "teams") {
    const url = config?.webhook_url;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return NextResponse.json({ error: `Webhook URL HTTPS requis pour ${type}` }, { status: 400 });
    }
  } else if (type === "webhook") {
    const url = config?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return NextResponse.json({ error: "URL HTTPS requis pour webhook" }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_channels")
    .upsert(
      {
        organization_id: orgId,
        type,
        config: config ?? {},
        enabled: enabled ?? true,
        ...(digest_daily_enabled !== undefined && { digest_daily_enabled }),
        ...(digest_daily_time && { digest_daily_time }),
        ...(digest_weekly_enabled !== undefined && { digest_weekly_enabled }),
        ...(digest_weekly_day && { digest_weekly_day }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,type" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data });
}

export async function DELETE(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "type query param required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notification_channels")
    .delete()
    .eq("organization_id", orgId)
    .eq("type", type);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
