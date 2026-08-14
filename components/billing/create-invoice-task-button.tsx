"use client";

/**
 * « Créer la tâche au owner » — pour un deal GAGNÉ toujours pas facturé :
 * crée une tâche HubSpot (haute priorité, échéance 48 h) assignée au owner du
 * deal, via le circuit d'exécution human-in-the-loop existant
 * (/api/agents/paiement-facturation/execute-deal-action). Rien n'est écrit
 * sans le clic de l'utilisateur.
 */

import { useState } from "react";

export function CreateInvoiceTaskButton({
  dealHubspotId,
  dealName,
  companyName,
  ownerId,
  amount,
  daysSince,
}: {
  dealHubspotId: string;
  dealName: string;
  companyName: string;
  ownerId: string | null;
  amount: number | null;
  daysSince: number;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    if (state === "busy" || state === "done") return;
    setState("busy");
    setMessage(null);
    try {
      const eur = amount
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount)
        : null;
      const res = await fetch("/api/agents/paiement-facturation/execute-deal-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "create_tasks",
          title: "Facturer",
          rationale: "Deal gagné sans facture — radar de facturation Trésorerie.",
          deals: [{ id: dealHubspotId, name: `${companyName} — ${dealName}`, amount, ownerId }],
          dueInDays: 2,
          taskBody:
            `Deal gagné il y a ${daysSince} jours${eur ? ` (${eur})` : ""} et toujours AUCUNE facture émise. ` +
            `Émettre la facture dans l'outil de facturation (Pennylane/Stripe) ou vérifier pourquoi elle n'est pas partie. ` +
            `Détecté par le bloc « Du closing à la 1re facture » (Trésorerie, Revold).`,
          newCloseDate: null,
          emailSubject: null,
          emailBody: null,
          estimatedImpact: eur ? `${eur} de trésorerie en attente` : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setState("done");
      } else {
        setState("error");
        setMessage(d.hint || d.error || "Création impossible.");
      }
    } catch {
      setState("error");
      setMessage("Création impossible (réseau).");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        ✓ Tâche créée dans HubSpot{ownerId ? " (assignée au owner)" : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={create}
        disabled={state === "busy"}
        className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-50"
      >
        {state === "busy" ? "Création…" : "⚡ Créer la tâche « Facturer » au owner"}
      </button>
      {state === "error" && message && <span className="text-[10px] text-rose-600">{message}</span>}
    </span>
  );
}
