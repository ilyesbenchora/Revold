"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeactivateReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    setBusy(true);
    await fetch(`/api/reports/activate?reportId=${encodeURIComponent(reportId)}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleDeactivate}
      className="text-[9px] text-slate-400 hover:text-red-500 disabled:opacity-50"
    >
      {busy ? "Désactivation..." : "Désactiver"}
    </button>
  );
}
