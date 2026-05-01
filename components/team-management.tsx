"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  fullName: string;
  role: string;
  roleLabel: string;
  createdAt: string | null;
};

type Pending = {
  id: string;
  email: string;
  role: string;
  roleLabel: string;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  myUserId: string | null;
  myRole: string | null;
  members: Member[];
  pending: Pending[];
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin — gestion complète" },
  { value: "manager", label: "Manager — équipe + données" },
  { value: "rep", label: "Commercial — lecture + alertes" },
];

export function TeamManagement({ myUserId, myRole, members, pending }: Props) {
  const router = useRouter();
  const canInvite = myRole === "admin" || myRole === "manager";
  const isAdmin = myRole === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("rep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastInviteUrl(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'invitation.");
        setBusy(false);
        return;
      }
      setLastInviteUrl(data.acceptUrl);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(memberId: string, newRole: string) {
    if (!confirm(`Changer le rôle pour "${newRole}" ?`)) return;
    setError(null);
    const res = await fetch(`/api/team/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur changement de rôle.");
      return;
    }
    router.refresh();
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`Supprimer ${name} de l'organisation ?`)) return;
    setError(null);
    const res = await fetch(`/api/team/members/${memberId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {/* Invitation */}
      {canInvite && (
        <div className="card overflow-hidden">
          <div className="border-b border-card-border bg-slate-50 px-6 py-3">
            <p className="text-sm font-semibold text-slate-900">Inviter un membre</p>
          </div>
          <form onSubmit={invite} className="space-y-3 p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.fr"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {ROLE_OPTIONS.filter((o) => isAdmin || o.value === "rep").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || !email.includes("@")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
              >
                {busy ? "Envoi…" : "Inviter"}
              </button>
            </div>
            {!isAdmin && (
              <p className="text-[11px] text-slate-500">En tant que manager, vous ne pouvez inviter que des commerciaux (rep).</p>
            )}
            {lastInviteUrl && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
                <p className="font-semibold text-emerald-800">Invitation créée</p>
                <p className="mt-1 break-all text-emerald-700">
                  Lien à transmettre :
                  <br />
                  <code className="text-[11px]">{lastInviteUrl}</code>
                </p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lastInviteUrl)}
                  className="mt-2 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Copier le lien
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Membres actifs */}
      <div className="card overflow-hidden">
        <div className="border-b border-card-border bg-slate-50 px-6 py-3">
          <p className="text-sm font-semibold text-slate-900">Membres ({members.length})</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
              <th className="px-5 py-2">Nom</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Ajouté</th>
              {isAdmin && <th className="px-5 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isMe = m.id === myUserId;
              return (
                <tr key={m.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {m.fullName}
                    {isMe && <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">Vous</span>}
                  </td>
                  <td className="px-3 py-3">
                    {isAdmin && !isMe ? (
                      <select
                        defaultValue={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{m.roleLabel}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => removeMember(m.id, m.fullName)}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invitations en attente */}
      {pending.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-card-border bg-slate-50 px-6 py-3">
            <p className="text-sm font-semibold text-slate-900">Invitations en attente ({pending.length})</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60">
              <tr className="border-b border-slate-100 text-left text-[10px] font-medium uppercase text-slate-400">
                <th className="px-5 py-2">Email</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Expire</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{p.email}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{p.roleLabel}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {new Date(p.expiresAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
