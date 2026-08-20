import { createHash, randomBytes, createHmac } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Clés d'API Revold (`rvk_<64 hex>`) : générées une seule fois, stockées en
 * hash SHA-256. L'authentification /api/v1 lit `Authorization: Bearer rvk_…`.
 */

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `rvk_${randomBytes(32).toString("hex")}`;
  return { key, prefix: `${key.slice(0, 12)}…`, hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Authentifie une requête /api/v1 par sa clé — renvoie l'organization_id ou null. */
export async function authenticateApiKey(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(rvk_[a-f0-9]{64})$/i);
  if (!m) return null;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("api_keys")
      .select("id, organization_id, revoked_at")
      .eq("key_hash", hashApiKey(m[1]))
      .maybeSingle();
    if (!data || data.revoked_at) return null;
    // Best-effort : trace la dernière utilisation.
    void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return data.organization_id as string;
  } catch {
    return null;
  }
}

/** Signature HMAC-SHA256 d'un payload webhook (header x-revold-signature). */
export function signWebhookPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}
