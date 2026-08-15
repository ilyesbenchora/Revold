"use client";

/**
 * Mobile du compte : un seul numéro active les canaux SMS ET WhatsApp des
 * notifications (Paramètres → Notifications) — rien d'autre à configurer.
 */

import { useState } from "react";
import Link from "next/link";

export function AccountPhoneForm({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/account/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Enregistrement impossible");
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setState("idle");
    }
  }

  const dirty = phone.trim() !== initialPhone.trim();

  return (
    <div>
      <label className="text-xs font-medium text-slate-500" htmlFor="account-phone">
        Téléphone mobile
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="account-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+33612345678"
          className="w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={state === "saving" || !dirty}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
        >
          {state === "saving" ? "…" : state === "saved" ? "✓" : "Enregistrer"}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-[10px] text-rose-600">{error}</p>
      ) : (
        <p className="mt-1 text-[10px] text-slate-400">
          Format international. Active les canaux SMS et WhatsApp dans{" "}
          <Link href="/dashboard/parametres/notifications" className="text-accent hover:underline">
            Paramètres → Notifications
          </Link>
          .
        </p>
      )}
    </div>
  );
}
