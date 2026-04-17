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
  const {
    team,
    categoryId,
    displayCategory,
    title,
    description,
    expectedValue,
    metrics,
    icon,
    filters,
  } = body;

  if (!team || !categoryId || !title || !Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const reportId = `custom_${team}_${categoryId}_${Date.now()}`;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("activated_reports").upsert(
    {
      organization_id: orgId,
      report_id: reportId,
      report_type: "single",
      title,
      display_category: displayCategory || categoryId,
      metrics,
      icon: icon || "📊",
      description: description || "",
      expected_value: expectedValue || "",
      activated_by: user.id,
      activated_at: new Date().toISOString(),
      is_custom: true,
      team,
      filters: filters ?? {},
    },
    { onConflict: "organization_id,report_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportId });
}
