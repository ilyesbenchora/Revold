import { NextResponse } from "next/server";
import { getOrgId, getAuthUser } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  const user = await getAuthUser();
  if (!orgId || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const { reportId, reportType, title, displayCategory, metrics, icon, description, expectedValue } = body;
  if (!reportId || !title) {
    return NextResponse.json({ error: "reportId et title requis" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activated_reports").upsert(
    {
      organization_id: orgId,
      report_id: reportId,
      report_type: reportType || "single",
      title,
      display_category: displayCategory || "",
      metrics: metrics || [],
      icon: icon || "📊",
      description: description || "",
      expected_value: expectedValue || "",
      activated_by: user.id,
      activated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,report_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get("reportId");
  if (!reportId) {
    return NextResponse.json({ error: "reportId requis" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("activated_reports")
    .delete()
    .eq("organization_id", orgId)
    .eq("report_id", reportId);

  return NextResponse.json({ ok: true });
}
