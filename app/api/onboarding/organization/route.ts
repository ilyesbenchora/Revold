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

  let body: { org_name?: string; employees_range?: string; industry?: string; pole?: string; role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const orgName = (body.org_name ?? "").trim().slice(0, 120);
  const employees = (body.employees_range ?? "").trim().slice(0, 40);
  const industry = (body.industry ?? "").trim().slice(0, 80);
  // Étape 2 : équipe (« all » = CEO/direction → pôle null, tous les espaces) + rôle.
  const POLES = new Set(["all", "sales", "marketing", "cs", "finance"]);
  const ROLES = new Set(["admin", "manager", "rep"]);
  const poleRaw = (body.pole ?? "").trim();
  const roleRaw = (body.role ?? "").trim();
  if (!orgName || !employees || !industry || !POLES.has(poleRaw) || !ROLES.has(roleRaw)) {
    return NextResponse.json(
      { error: "Nom de l'entreprise, effectif, secteur, équipe et rôle sont obligatoires." },
      { status: 400 },
    );
  }
  const pole = poleRaw === "all" ? null : poleRaw;

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

  // ── Équipe + rôle sur le profil. GARDE-FOU : si l'utilisateur est le seul
  // admin (ou l'unique membre) de l'org, le rôle reste « admin » — une
  // organisation sans administrateur serait ingérable.
  let effectiveRole = roleRaw;
  if (roleRaw !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "admin")
      .neq("id", user.id);
    if ((count ?? 0) === 0) effectiveRole = "admin";
  }
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ pole, role: effectiveRole })
    .eq("id", user.id);
  if (profErr && !/pole/.test(profErr.message)) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  if (profErr) {
    // Colonne pole absente (migration non appliquée) : on pose au moins le rôle.
    await supabase.from("profiles").update({ role: effectiveRole }).eq("id", user.id);
  }

  // user_metadata : getOrgId et le compte réutilisent org_name.
  try {
    await supabase.auth.updateUser({ data: { org_name: orgName, employees_range: employees, industry } });
  } catch {
    /* métadonnées best effort — l'org est la source de vérité */
  }

  return NextResponse.json({ ok: true, role: effectiveRole, pole });
}
