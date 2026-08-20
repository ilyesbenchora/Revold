export const dynamic = "force-dynamic";

import Link from "next/link";
import { ParametresTabs } from "@/components/parametres-tabs";
import { DataPrivacyBlock } from "@/components/data-privacy-block";
import { AccountSecurityBlock } from "@/components/security/account-security-block";
import { ApiKeysBlock } from "@/components/security/api-keys-block";
import { WebhooksBlock } from "@/components/security/webhooks-block";
import { getAuthUser, getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/rbac";

// Sous-traitants effectifs (traitement de données) — la même liste que la page
// publique /legal/rgpd, tenue à jour ici pour les clients connectés.
const SUBPROCESSORS: Array<{ name: string; role: string; region: string }> = [
  { name: "Supabase", role: "Base de données & authentification", region: "UE (Francfort)" },
  { name: "Vercel", role: "Hébergement de l'application", region: "UE/US (edge)" },
  { name: "Anthropic", role: "Agents IA (données de contexte à la demande, jamais entraînées)", region: "US — DPA signé" },
  { name: "Resend", role: "Envoi des emails de notification", region: "US — DPA signé" },
];

export default async function ParametresSecuriteApiPage() {
  const user = await getAuthUser();
  if (!user) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const role = await getCurrentRole(supabase, user.id);
  const isAdmin = role === "admin";

  // Demande de suppression en attente (RGPD) — résilient si migration absente.
  let pendingDeletionSince: string | null = null;
  try {
    if (orgId) {
      const { data } = await supabase
        .from("data_requests")
        .select("created_at")
        .eq("organization_id", orgId)
        .eq("kind", "deletion")
        .eq("status", "pending")
        .maybeSingle();
      pendingDeletionSince = (data?.created_at as string | undefined) ?? null;
    }
  } catch {}

  // Journal d'audit RÉEL (audit_log, alimenté par l'app) — admins seulement.
  type AuditRow = { action: string; actor_id: string | null; created_at: string; metadata: Record<string, unknown> | null };
  let auditRows: AuditRow[] = [];
  const actorNames = new Map<string, string>();
  if (isAdmin && orgId) {
    try {
      const { data } = await supabase
        .from("audit_log")
        .select("action, actor_id, created_at, metadata")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(15);
      auditRows = (data ?? []) as AuditRow[];
      const ids = [...new Set(auditRows.map((r) => r.actor_id).filter((x): x is string => !!x))];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        for (const p of profs ?? []) actorNames.set(p.id as string, (p.full_name as string) ?? "");
      }
    } catch {}
  }
  const passwordChangedAt =
    ((user.user_metadata as { password_changed_at?: string } | null)?.password_changed_at as string | undefined) ?? null;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestion de la sécurité du compte, accès API et webhooks pour intégrer Revold à votre stack.
        </p>
      </header>

      <ParametresTabs />

      {/* ── Données & conformité RGPD — câblé au réel ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Données & conformité RGPD
        </h2>
        <p className="text-sm text-slate-500">
          Export immédiat, suppression sur demande tracée, sous-traitants effectifs. Détail public :{" "}
          <Link href="/legal/securite" className="font-medium text-accent hover:underline">Sécurité & Conformité</Link>
          {" · "}
          <Link href="/legal/rgpd" className="font-medium text-accent hover:underline">RGPD</Link>
          {" · "}
          <Link href="/legal/dpa" className="font-medium text-accent hover:underline">DPA</Link>.
        </p>
        <DataPrivacyBlock pendingDeletionSince={pendingDeletionSince} />
        <div className="card overflow-hidden">
          <div className="border-b border-card-border bg-slate-50/60 px-4 py-2.5">
            <h3 className="text-xs font-semibold text-slate-800">Sous-traitants (traitement de données)</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {SUBPROCESSORS.map((s) => (
              <div key={s.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <span className="min-w-0 flex-1 px-3 text-slate-500">{s.role}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{s.region}</span>
              </div>
            ))}
            <div className="px-4 py-2.5 text-[11px] text-slate-400">
              S&apos;y ajoutent les outils que VOUS connectez (HubSpot, Stripe, Pennylane…) — Revold y accède en
              lecture avec vos propres identifiants, révocables à tout moment depuis Intégrations.
            </div>
          </div>
        </div>
      </div>

      {/* Authentification — câblé au réel (mot de passe, autres sessions) */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Authentification
        </h2>
        <AccountSecurityBlock email={user.email ?? ""} passwordChangedAt={passwordChangedAt} />
      </div>

      {/* API Keys */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Clés d&apos;API Revold
        </h2>
        <p className="text-sm text-slate-500">
          Générez des clés API pour interagir avec Revold depuis vos outils internes (workflows, scripts, BI).
        </p>
        <ApiKeysBlock isAdmin={isAdmin} />
      </div>

      {/* Webhooks sortants */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Webhooks sortants
        </h2>
        <p className="text-sm text-slate-500">
          Recevez en temps réel les événements Revold (nouvelle alerte, rapport activé, score modifié) sur vos endpoints.
        </p>
        <WebhooksBlock isAdmin={isAdmin} />
      </div>

      {/* Journal d'audit — RÉEL (table audit_log alimentée par l'app), admins */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Journal d&apos;audit
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Admin uniquement</span>
        </h2>
        {!isAdmin ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            Le journal d&apos;audit (qui a fait quoi, quand) est visible par les admins de l&apos;organisation.
          </div>
        ) : auditRows.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            Aucun événement tracé pour l&apos;instant — invitations, changements de rôle, clés d&apos;API,
            webhooks et changements de mot de passe s&apos;inscrivent ici.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {auditRows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <code className="font-mono text-[11px] font-semibold text-slate-700">{r.action}</code>
                  <span className="min-w-0 flex-1 px-3 text-slate-500">
                    {r.actor_id ? actorNames.get(r.actor_id) || "Membre" : "Système"}
                  </span>
                  <span className="text-slate-400">
                    {new Date(r.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
