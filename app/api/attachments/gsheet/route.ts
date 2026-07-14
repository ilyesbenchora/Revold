import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCsv, googleSheetCsvUrl } from "@/lib/integrations/csv";
import { buildPreview } from "@/lib/attachments";

/** Récupère un Google Sheets public en CSV et renvoie un aperçu exploitable. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const shareUrl = (body.url ?? "").trim();
  const exportUrl = googleSheetCsvUrl(shareUrl);
  if (!exportUrl) return NextResponse.json({ error: "Lien Google Sheets invalide." }, { status: 400 });

  let csvText: string;
  try {
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) return NextResponse.json({ error: "Feuille inaccessible (vérifiez le partage)." }, { status: 400 });
    csvText = await res.text();
  } catch {
    return NextResponse.json({ error: "Échec de récupération de la feuille." }, { status: 400 });
  }
  if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
    return NextResponse.json(
      { error: "Feuille non publique : activez « toute personne disposant du lien » (lecture)." },
      { status: 400 },
    );
  }

  const parsed = parseCsv(csvText);
  if (parsed.columns.length === 0 || parsed.rows.length === 0) {
    return NextResponse.json({ error: "Aucune donnée exploitable dans la feuille." }, { status: 400 });
  }

  return NextResponse.json({
    columns: parsed.columns,
    rowCount: parsed.rows.length,
    preview: buildPreview(parsed),
  });
}
