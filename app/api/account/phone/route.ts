import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Mobile du compte — destinataire des canaux SMS et WhatsApp
 * (Paramètres → Notifications). Stocké sur le profil ET dans les métadonnées
 * auth pour rester lisible même si la migration n'est pas encore appliquée.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const raw = String(body.phone ?? "").trim();
  // Vide = retrait du numéro (les canaux mobiles se désactivent d'eux-mêmes).
  const phone = raw ? raw.replace(/[^\d+]/g, "") : null;
  if (phone && !/^\+\d{8,15}$/.test(phone)) {
    return NextResponse.json(
      { error: "Format international attendu, ex : +33612345678" },
      { status: 400 },
    );
  }

  await supabase.auth.updateUser({ data: { phone } });

  const { error } = await supabase.from("profiles").update({ phone }).eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "Colonne phone absente — applique la migration notification_prefs.", needsMigration: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, phone });
}
