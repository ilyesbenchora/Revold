import { cache } from "react";
import { createSupabaseServerClient } from "./server";

/**
 * Request-scoped cached helpers.
 * React `cache()` deduplicates calls within the same server request,
 * so layout + page calling getOrgId() only hits Supabase once.
 */

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getOrgId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  return profile?.organization_id ?? null;
});

export const getProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();
  return profile;
});

export const getLatestKpi = cache(async () => {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();
  return data;
});
