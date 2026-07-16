import type { SupabaseClient } from "@supabase/supabase-js";

/** Config d'un serveur MCP distant à exposer à l'agent. */
export type McpServerConfig = { name: string; url: string; token?: string | null };

/**
 * Serveurs MCP actifs d'une org (POC). Résilient : si la table n'existe pas
 * encore (migration non appliquée), on renvoie une liste vide — les agents
 * fonctionnent normalement avec leurs fetchers.
 */
export async function getActiveMcpServers(
  supabase: SupabaseClient,
  orgId: string,
): Promise<McpServerConfig[]> {
  try {
    const { data, error } = await supabase
      .from("mcp_servers")
      .select("name, url, auth_token")
      .eq("organization_id", orgId)
      .eq("is_active", true);
    if (error) return [];
    return (data ?? [])
      .filter((r) => typeof r.url === "string" && /^https?:\/\//.test(r.url as string))
      .map((r) => ({
        // Le connecteur MCP exige un nom sans espaces/caractères spéciaux.
        name: String(r.name ?? "mcp").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "mcp",
        url: r.url as string,
        token: (r.auth_token as string | null) ?? null,
      }));
  } catch {
    return [];
  }
}
