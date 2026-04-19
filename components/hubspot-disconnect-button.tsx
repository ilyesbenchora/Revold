"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HubspotDisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/hubspot/disconnect", { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        Déconnecter
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] text-slate-600">Confirmer ?</span>
      <button
        type="button"
        disabled={busy}
        onClick={disconnect}
        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? "..." : "Déconnecter"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirm(false)}
        className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
      >
        Annuler
      </button>
    </div>
  );
}
