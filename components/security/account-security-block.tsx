"use client";

import { useState } from "react";

/**
 * Authentification du compte — câblé au réel : changement de mot de passe
 * (auth.updateUser) et déconnexion des autres appareils (signOut others).
 */
export function AccountSecurityBlock({
  email,
  passwordChangedAt,
}: {
  email: string;
  passwordChangedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [othersMsg, setOthersMsg] = useState<string | null>(null);

  async function changePassword() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", password: pwd }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok) {
      setMsg({ ok: true, text: "Mot de passe mis à jour." });
      setPwd("");
      setOpen(false);
    } else setMsg({ ok: false, text: d?.error ?? "Modification impossible." });
  }

  async function signOutOthers() {
    setBusy(true);
    setOthersMsg(null);
    const res = await fetch("/api/account/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout_others" }),
    }).catch(() => null);
    setBusy(false);
    setOthersMsg(res?.ok ? "✓ Toutes les autres sessions ont été déconnectées." : "Échec — réessaie.");
  }

  const lastChange = passwordChangedAt
    ? new Date(passwordChangedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="card p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Email du compte</p>
            <p className="mt-0.5 text-xs text-slate-500">{email}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ Vérifié</span>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Mot de passe</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {lastChange ? `Dernière modification : ${lastChange}` : "Jamais modifié depuis la création"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
            >
              {open ? "Annuler" : "Modifier"}
            </button>
          </div>
          {open && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="Nouveau mot de passe (8 caractères min.)"
                className="w-72 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void changePassword()}
                disabled={busy || pwd.length < 8}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          )}
          {msg && (
            <p className={`mt-2 text-xs font-medium ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Autres appareils</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {othersMsg ?? "Déconnecte toutes les sessions ouvertes ailleurs (autres navigateurs, autres postes)."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOutOthers()}
            disabled={busy}
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Déconnecter les autres sessions
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Authentification à 2 facteurs</p>
            <p className="mt-0.5 text-xs text-slate-500">Sécurise votre compte avec un code généré sur votre téléphone</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Bientôt disponible</span>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">SSO (Single Sign-On)</p>
            <p className="mt-0.5 text-xs text-slate-500">Authentification SAML/Google Workspace pour les équipes Enterprise</p>
          </div>
          <span className="rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700">Plan Enterprise</span>
        </div>
      </div>
    </div>
  );
}
