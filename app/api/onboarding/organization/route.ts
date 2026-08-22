import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Onboarding : COMPLÈTE la fiche de l'organisation (nom, effectif, secteur) —
 * appelé par la modale bloquante affichée au premier accès à la plateforme
 * quand ces informations manquent. getOrgId() crée l'org au besoin (policies
 * bootstrap 20260822000001), puis on range les infos + le user_metadata.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { org_name?: string; employees_range?: string; industry?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const orgName = (body.org_name ?? "").trim().slice(0, 120);
  const employees = (body.employees_range ?? "").trim().slice(0, 40);
  const industry = (body.industry ?? "").trim().slice(0, 80);
  if (!orgName || !employees || !industry) {
    return NextResponse.json({ error: "Nom de l'entreprise, effectif et secteur sont obligatoires." }, { status: 400 });
  }

  // Crée l'organisation au besoin (nouveau compte) — sinon la retrouve.
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json(
      { error: "Impossible de créer l'organisation — réessaie, et contacte le support si ça persiste." },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({ name: orgName, employees_range: employees, industry })
    .eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // user_metadata : getOrgId et le compte réutilisent org_name.
  try {
    await supabase.auth.updateUser({ data: { org_name: orgName, employees_range: employees, industry } });
  } catch {
    /* métadonnées best effort — l'org est la source de vérité */
  }

  return NextResponse.json({ ok: true });
}
