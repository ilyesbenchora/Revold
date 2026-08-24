"use client";

import { useEffect, useState } from "react";

/**
 * Bloc ROI « Relances & cash récupéré » (page Trésorerie).
 *
 * La boucle qui prouve la valeur de Revold en euros :
 *  1. les factures en retard sont listées (reste dû, échéance, client) ;
 *  2. « Relancer » ouvre la modale : mail pré-rédigé (infos + lien de la
 *     facture), destinataire = contact de la facture (Pennylane & co),
 *     récurrence optionnelle — l'envoi valide timestampe la relance et les
 *     renvois partent automatiquement (cron) jusqu'au paiement ou au plafond ;
 *  3. dès que la facture est constatée payée, la séquence s'arrête et le
 *     montant est attribué en CASH RÉCUPÉRÉ — le CTA passe au vert.
 */

type Sequence = {
  sendsCount: number;
  maxSends: number;
  recurrenceDays: number | null;
  lastSentAt: string | null;
  nextSendAt: string | null;
  stoppedReason: string | null;
};

type ReminderRow = {
  id: string;
  number: string | null;
  company: string | null;
  amountDue: number;
  dueAt: string | null;
  source: string | null;
  remindedAt: string | null;
  recoveredAt: string | null;
  recoveredAmount: number | null;
  contactEmail: string | null;
  invoiceUrl: string | null;
  sequence: Sequence | null;
  proposal: { subject: string; body: string };
};

type Stats = { recovered: number; recoveredCount: number; remindedPending: number };

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const frShort = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

function daysLate(dueAt: string | null): number {
  if (!dueAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(`${dueAt}T00:00:00`).getTime()) / 86_400_000));
}

export function CashRecoveryBlock() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<ReminderRow[] | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Modale de relance ──
  const [modalRow, setModalRow] = useState<ReminderRow | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recurrenceDays, setRecurrenceDays] = useState(7);
  const [maxSends, setMaxSends] = useState(3);
  const [sending, setSending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/roi/reminders");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setNeedsMigration(Boolean(d.needsMigration));
      setStats(d.stats ?? { recovered: 0, recoveredCount: 0, remindedPending: 0 });
      const overdue: ReminderRow[] = Array.isArray(d.overdue) ? d.overdue : [];
      const recovered: ReminderRow[] = Array.isArray(d.recovered) ? d.recovered : [];
      setRows([...overdue, ...recovered]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openModal(row: ReminderRow) {
    setModalRow(row);
    setRecipient(row.contactEmail ?? "");
    setSubject(row.proposal.subject);
    setBody(row.proposal.body);
    setRecurrenceDays(7);
    setMaxSends(3);
    setModalError(null);
  }

  async function sendReminder() {
    if (!modalRow || sending) return;
    setSending(true);
    setModalError(null);
    try {
      const res = await fetch("/api/roi/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: modalRow.id,
          recipientEmail: recipient,
          subject,
          body,
          recurrenceDays,
          maxSends,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Envoi impossible");
      if (d.warning) setWarning(d.warning);
      setModalRow(null);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  }

  /** Ancien flux : marquer relancée sans envoyer d'email (relance téléphone…). */
  async function markOnly() {
    if (!modalRow || sending) return;
    setSending(true);
    setModalError(null);
    try {
      const res = await fetch("/api/roi/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: modalRow.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Relance impossible");
      setModalRow(null);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  }

  async function stopSequenceFor(invoiceId: string) {
    if (busyId) return;
    setBusyId(invoiceId);
    try {
      await fetch("/api/roi/reminders/send", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function renderCta(row: ReminderRow) {
    // 3. Vert : cash récupéré (paiement détecté après relance).
    if (row.recoveredAt) {
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Cash récupéré le {frShort(row.recoveredAt)}
          {row.recoveredAmount ? ` · ${eur(row.recoveredAmount)}` : ""}
        </span>
      );
    }
    // 2. Séquence email en cours / terminée.
    if (row.sequence) {
      const seq = row.sequence;
      if (seq.stoppedReason === "max_reached") {
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            Séquence terminée ({seq.sendsCount} envois) — paiement en attente
          </span>
        );
      }
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
            Relancée le {seq.lastSentAt ? frShort(seq.lastSentAt) : "—"} · {seq.sendsCount}/{seq.maxSends}
          </span>
          {seq.nextSendAt && (
            <span className="text-[10px] text-slate-400">prochaine le {frShort(seq.nextSendAt)}</span>
          )}
          {(seq.nextSendAt || !seq.stoppedReason) && seq.nextSendAt && (
            <button
              onClick={() => stopSequenceFor(row.id)}
              disabled={busyId === row.id}
              className="text-[10px] font-medium text-slate-400 underline-offset-2 transition hover:text-rose-600 hover:underline disabled:opacity-50"
            >
              stopper
            </button>
          )}
        </span>
      );
    }
    // Relance marquée à la main (ancien flux, sans email).
    if (row.remindedAt) {
      return (
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
          Relancée le {frShort(row.remindedAt)}
        </span>
      );
    }
    // 1. Pas encore relancée → modale d'envoi.
    return (
      <button
        onClick={() => openModal(row)}
        disabled={needsMigration}
        className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
      >
        Relancer
      </button>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-slate-50/60 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Relances & cash récupéré</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Relance tes impayés depuis Revold : mail pré-rédigé avec la facture, renvois automatiques jusqu&apos;au
            paiement — chaque facture relancée puis encaissée alimente le compteur, prouvable ligne à ligne.
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Cash récupéré</p>
              <p className={`text-xl font-bold tabular-nums ${stats.recovered > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {eur(stats.recovered)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Factures récupérées</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{stats.recoveredCount}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Relances en cours</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{stats.remindedPending}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {needsMigration && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            La table des relances n&apos;existe pas encore — applique la migration <code>invoice_reminders</code> pour
            activer le suivi du cash récupéré.
          </p>
        )}
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        {warning && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{warning}</p>}

        {rows === null ? (
          <p className="text-xs text-slate-400">Chargement des impayés…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune facture en retard — rien à relancer.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2.5 py-2 font-semibold">Facture</th>
                  <th className="px-2.5 py-2 font-semibold">Client</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Reste dû</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Retard</th>
                  <th className="px-2.5 py-2 font-semibold">Relance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 transition last:border-0 hover:bg-indigo-50/40">
                    <td className="px-2.5 py-2 font-medium text-slate-800">
                      {inv.number ?? "—"}
                      {inv.source && <span className="ml-1.5 text-[10px] text-slate-400">({inv.source})</span>}
                    </td>
                    <td className="px-2.5 py-2 text-slate-700">{inv.company ?? "—"}</td>
                    <td className={`px-2.5 py-2 text-right font-semibold tabular-nums ${inv.recoveredAt ? "text-emerald-600" : "text-rose-600"}`}>
                      {inv.recoveredAt && inv.recoveredAmount ? eur(inv.recoveredAmount) : eur(inv.amountDue)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-slate-700">
                      {inv.recoveredAt ? "—" : `${daysLate(inv.dueAt)} j`}
                    </td>
                    <td className="px-2.5 py-2">{renderCta(inv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modale d'envoi de relance ── */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !sending && setModalRow(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-slate-900">
              Relancer la facture {modalRow.number ?? ""}
              {modalRow.company ? ` — ${modalRow.company}` : ""}
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {eur(modalRow.amountDue)} en retard de {daysLate(modalRow.dueAt)} j.
              {modalRow.invoiceUrl
                ? " Le lien de la facture est inclus dans le mail."
                : " Aucun lien public de facture disponible (il sera capturé à la prochaine sync)."}
              {" "}Les réponses du client arriveront sur ton adresse email.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600">Destinataire</label>
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={modalRow.contactEmail ? undefined : "email du client (introuvable dans la source)"}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Objet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={9}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs leading-relaxed text-slate-800 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Récurrence si non payée</label>
                  <select
                    value={recurrenceDays}
                    onChange={(e) => setRecurrenceDays(Number(e.target.value))}
                    className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                  >
                    <option value={0}>Aucune (envoi unique)</option>
                    <option value={7}>Tous les 7 jours</option>
                    <option value={14}>Tous les 14 jours</option>
                  </select>
                </div>
                {recurrenceDays > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Maximum d&apos;envois</label>
                    <select
                      value={maxSends}
                      onChange={(e) => setMaxSends(Number(e.target.value))}
                      className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                    >
                      <option value={2}>2 relances</option>
                      <option value={3}>3 relances</option>
                      <option value={5}>5 relances</option>
                    </select>
                  </div>
                )}
              </div>
              {recurrenceDays > 0 && (
                <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-500">
                  Les renvois s&apos;arrêtent automatiquement dès qu&apos;un paiement est détecté dans ta source
                  (Pennylane, Stripe…), et jamais plus de {maxSends} envois au total.
                </p>
              )}
            </div>

            {modalError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{modalError}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={markOnly}
                disabled={sending}
                className="text-[10px] font-medium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:opacity-50"
              >
                Marquer relancée sans envoyer d&apos;email
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalRow(null)}
                  disabled={sending}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={sendReminder}
                  disabled={sending || !recipient || !subject.trim() || !body.trim()}
                  className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                >
                  {sending ? "Envoi…" : "Valider l'envoi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
