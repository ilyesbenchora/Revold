"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect("/login?error=Veuillez+remplir+tous+les+champs");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const orgName = String(formData.get("org_name") ?? "").trim();

  if (!email || !password || !fullName || !orgName) {
    redirect("/login?mode=signup&error=Veuillez+remplir+tous+les+champs");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, org_name: orgName },
    },
  });

  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  if (data.user && !data.user.identities?.length) {
    redirect("/login?error=Cet+email+est+déjà+utilisé");
  }

  // Create organization and profile for new user
  if (data.user) {
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data: org } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
      .select("id")
      .single();

    if (org) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        organization_id: org.id,
        full_name: fullName,
        role: "admin",
      });

      // Create default pipeline stages
      await supabase.from("pipeline_stages").insert([
        { organization_id: org.id, name: "Découverte", position: 1, probability: 10 },
        { organization_id: org.id, name: "Qualification", position: 2, probability: 25 },
        { organization_id: org.id, name: "Proposition", position: 3, probability: 50 },
        { organization_id: org.id, name: "Négociation", position: 4, probability: 75 },
        { organization_id: org.id, name: "Gagné", position: 5, probability: 100, is_closed_won: true },
        { organization_id: org.id, name: "Perdu", position: 6, probability: 0, is_closed_lost: true },
      ]);
    }
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
