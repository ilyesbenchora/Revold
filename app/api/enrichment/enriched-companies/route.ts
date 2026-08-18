import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Entreprises ENRICHIES — pagination SERVEUR sur TOUTE la base (le détail
 * affiché dans l'Historique des enrichissements). Périmètre volontairement
 * large : toute fiche touchée par le moteur (identité posée OU faits chargés),
 * pour coller aux compteurs de l'historique — pas seulement les N plus
 * récentes.
 * GET ?page=0&pageSize=15 → { rows, total, page, pageSize }
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const pageSizeRaw = Number(url.searchParams.get("pageSize")) || 15;
  const pageSize = Math.min(100, Math.max(5, pageSizeRaw));

  const FULL =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, activity_label, legal_form, enriched_at";
  const BASE =
    "name, legal_name, siren, siret, vat_number, official_employee_range, official_revenue, official_revenue_year, enriched_at";

  const run = (cols: string) =>
    supabase
      .from("companies")
      .select(cols, { count: "exact" })
      .eq("organization_id", orgId)
      // Fiche touchée par le moteur : identité posée OU passage de faits daté.
      .or("siren.not.is.null,enriched_at.not.is.null")
      .order("enriched_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);

  let { data, error, count } = await run(FULL);
  // Colonnes récentes absentes (migration non appliquée) → colonnes de base.
  if (error && /activity_label|legal_form/.test(error.message)) {
    ({ data, error, count } = await run(BASE));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
}
