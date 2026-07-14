"use server";

import { redirect } from "next/navigation";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCsv, googleSheetCsvUrl } from "@/lib/integrations/csv";

const BASE = "/dashboard/integration/import-fichier";

/**
 * Importe un jeu de données depuis un fichier CSV/Excel (collé en texte) ou un
 * Google Sheets public. Parse le CSV, stocke le dataset dans `imported_datasets`
 * et (dé)marque l'intégration `spreadsheet` comme active.
 */
export async function importSpreadsheetAction(formData: FormData) {
  const orgId = await getOrgId();
  if (!orgId) redirect(`${BASE}?error=no_org`);

  const mode = String(formData.get("mode") ?? "");
  const name = (formData.get("name") as string | null)?.trim() || "Import tableur";

  let csvText = "";
  let sourceRef = "";

  if (mode === "gsheet") {
    const shareUrl = (formData.get("sheet_url") as string | null)?.trim() ?? "";
    const exportUrl = googleSheetCsvUrl(shareUrl);
    if (!exportUrl) redirect(`${BASE}?error=bad_url`);
    sourceRef = shareUrl;
    try {
      const res = await fetch(exportUrl!, { redirect: "follow" });
      if (!res.ok) redirect(`${BASE}?error=fetch_failed`);
      csvText = await res.text();
    } catch {
      redirect(`${BASE}?error=fetch_failed`);
    }
    // Google renvoie une page HTML de connexion si la feuille n'est pas publique.
    if (/^\s*<(?:!doctype|html)/i.test(csvText)) {
      redirect(`${BASE}?error=not_public`);
    }
  } else if (mode === "csv") {
    const file = formData.get("file");
    if (!file || typeof file === "string" || file.size === 0) {
      redirect(`${BASE}?error=empty_file`);
    }
    const f = file as File;
    sourceRef = f.name || "fichier.csv";
    csvText = await f.text();
    if (!csvText.trim()) redirect(`${BASE}?error=empty_file`);
  } else {
    redirect(`${BASE}?error=bad_mode`);
  }

  const { columns, rows } = parseCsv(csvText);
  if (columns.length === 0 || rows.length === 0) {
    redirect(`${BASE}?error=empty_data`);
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error: insertError } = await supabase.from("imported_datasets").insert({
    organization_id: orgId,
    name,
    source_type: mode,
    source_ref: sourceRef.slice(0, 1000),
    columns,
    rows,
    row_count: rows.length,
    created_at: nowIso,
  });
  if (insertError) {
    redirect(`${BASE}?error=save_failed&reason=${encodeURIComponent(insertError.message)}`);
  }

  // Marque l'intégration "spreadsheet" comme active pour qu'elle apparaisse
  // dans les outils connectés (page intégration + paramètres).
  await supabase.from("integrations").upsert(
    {
      organization_id: orgId,
      provider: "spreadsheet",
      access_token: "file-import",
      metadata: { last_import: name, last_source: sourceRef.slice(0, 300), last_rows: rows.length },
      is_active: true,
      updated_at: nowIso,
    },
    { onConflict: "organization_id,provider" },
  );

  redirect(`/dashboard/integration?connected=spreadsheet&imported=${encodeURIComponent(name)}`);
}
