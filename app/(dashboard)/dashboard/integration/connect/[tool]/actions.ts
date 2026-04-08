"use server";

import { redirect } from "next/navigation";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectableTool } from "@/lib/integrations/connect-catalog";

export async function connectToolAction(toolKey: string, formData: FormData) {
  const tool = getConnectableTool(toolKey);
  if (!tool) {
    redirect(`/dashboard/integration?error=unknown_tool`);
  }

  const orgId = await getOrgId();
  if (!orgId) {
    redirect(`/dashboard/integration/connect/${toolKey}?error=no_org`);
  }

  // Collect all field values; the first password field becomes access_token,
  // everything else goes into metadata.
  const credentials: Record<string, string> = {};
  let primaryToken = "";
  for (const field of tool.fields) {
    const value = (formData.get(field.key) as string | null)?.trim() ?? "";
    if (!value) {
      redirect(`/dashboard/integration/connect/${toolKey}?error=missing_${field.key}`);
    }
    credentials[field.key] = value;
    if (field.type === "password" && !primaryToken) {
      primaryToken = value;
    }
  }
  if (!primaryToken) {
    primaryToken = Object.values(credentials)[0] ?? "";
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        organization_id: orgId,
        provider: toolKey,
        access_token: primaryToken,
        metadata: credentials,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

  if (error) {
    redirect(`/dashboard/integration/connect/${toolKey}?error=save_failed`);
  }

  redirect(`/dashboard/integration?connected=${toolKey}`);
}

export async function disconnectToolAction(toolKey: string) {
  const orgId = await getOrgId();
  if (!orgId) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("integrations")
    .delete()
    .eq("organization_id", orgId)
    .eq("provider", toolKey);
  redirect(`/dashboard/integration?disconnected=${toolKey}`);
}
