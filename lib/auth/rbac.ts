/**
 * RBAC — Role-Based Access Control pour Revold.
 *
 * 3 rôles applicatifs :
 *   - admin   : tout (gestion équipe, billing, intégrations, suppression d'org)
 *   - manager : lecture + écriture sur données + activation coachings/alertes,
 *               peut inviter des reps mais pas d'autres managers/admins
 *   - rep     : lecture + activation de ses propres coachings/alertes
 *
 * Hiérarchie : admin > manager > rep.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "admin" | "manager" | "rep";

const ORDER: Record<Role, number> = { admin: 3, manager: 2, rep: 1 };

export function roleAtLeast(actual: Role | null | undefined, required: Role): boolean {
  if (!actual) return false;
  return ORDER[actual] >= ORDER[required];
}

/**
 * Récupère le rôle du user connecté pour son org courante.
 * Renvoie null si pas authentifié ou pas de profile.
 */
export async function getCurrentRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<Role | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.role) return null;
  if (data.role !== "admin" && data.role !== "manager" && data.role !== "rep") {
    return null;
  }
  return data.role as Role;
}

/** Throw si le rôle insuffisant — usable dans les server actions / API routes. */
export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  required: Role,
): Promise<Role> {
  const role = await getCurrentRole(supabase, userId);
  if (!role || !roleAtLeast(role, required)) {
    throw new Error(`Forbidden: rôle ${required} requis`);
  }
  return role;
}

/** Génère un token random hex 32 bytes pour invitation magic link. */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type AuditAction =
  | "member.invited"
  | "member.invitation_accepted"
  | "member.invitation_revoked"
  | "member.role_changed"
  | "member.removed"
  | "billing.subscribed"
  | "billing.canceled"
  | "integration.connected"
  | "integration.disconnected"
  | "data.exported"
  | "settings.changed";

/** Trace une action dans audit_log. Best-effort — ne throw jamais. */
export async function logAudit(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    actorId: string | null;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      organization_id: args.orgId,
      actor_id: args.actorId,
      action: args.action,
      target_type: args.targetType ?? null,
      target_id: args.targetId ?? null,
      metadata: args.metadata ?? null,
      ip_address: args.ipAddress ?? null,
      user_agent: args.userAgent ?? null,
    });
  } catch (err) {
    console.warn("[audit] insert failed:", err instanceof Error ? err.message : err);
  }
}
