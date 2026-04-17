import { NextResponse } from "next/server";
import { getOrgId, getAuthUser } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  filterImplementedKpis,
  MAX_KPIS_PER_REPORT,
} from "@/lib/reports/implemented-kpis";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  const user = await getAuthUser();
  if (!orgId || !user) {
    return NextResponse.json(
      { error: "Session expirée. Reconnectez-vous." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

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
  } = body as {
    team?: string;
    categoryId?: string;
    displayCategory?: string;
    title?: string;
    description?: string;
    expectedValue?: string;
    metrics?: unknown;
    icon?: string;
    filters?: unknown;
  };

  if (!team || !categoryId || !title?.trim() || !Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json(
      { error: "Équipe, catégorie, titre et au moins un KPI sont requis." },
      { status: 400 },
    );
  }

  const submitted = metrics.filter((m): m is string => typeof m === "string");
  const validMetrics = filterImplementedKpis(submitted);
  const rejected = submitted.filter((m) => !validMetrics.includes(m));

  if (validMetrics.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun KPI sélectionné n'est calculable actuellement. Choisissez des KPIs marqués « disponibles ».",
        rejected,
      },
      { status: 400 },
    );
  }

  if (validMetrics.length > MAX_KPIS_PER_REPORT) {
    return NextResponse.json(
      { error: `Maximum ${MAX_KPIS_PER_REPORT} KPIs par rapport.` },
      { status: 400 },
    );
  }

  const reportId = `custom_${team}_${categoryId}_${Date.now()}`;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("activated_reports").upsert(
    {
      organization_id: orgId,
      report_id: reportId,
      report_type: "single",
      title: title.trim(),
      display_category: displayCategory || categoryId,
      metrics: validMetrics,
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
    console.error("[create-custom] supabase upsert failed", {
      orgId,
      userId: user.id,
      reportId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: `Erreur enregistrement : ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reportId,
    metrics: validMetrics,
    droppedCount: rejected.length,
  });
}
