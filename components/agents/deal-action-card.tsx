"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifyActivatedAlert } from "./activated-alerts";
import { ActionExecutionFunnel, type FunnelResult } from "@/components/actions/action-execution-funnel";
import {
  ACTION_TONES,
  emailTemplate,
  taskTemplate,
  readSavedTemplate,
  saveTemplate,
  type MessageTone,
} from "@/lib/actions/message-templates";
import type { DealActionProposal } from "@/lib/ai/agents/sales-actions";

const KIND_META: Record<DealActionProposal["kind"], { icon: string; label: string; cta: string }> = {
  create_tasks: { icon: "✅", label: "Créer des tâches de relance", cta: "Créer les tâches dans HubSpot" },
  update_closedate: { icon: "📅", label: "Repousser la date de closing", cta: "Mettre à jour dans HubSpot" },
  draft_emails: { icon: "✉️", label: "Déposer des emails de relance", cta: "Créer les relances dans HubSpot" },
};

/**
 * Action pipeline proposée par l'agent, exécutable dans HubSpot APRÈS validation
 * (human-in-the-loop). L'utilisateur ajuste les paramètres puis exécute.
 */
export function DealActionCard({ agentKey, action }: { agentKey: string; action: DealActionProposal }) {
  const meta = KIND_META[action.kind];
  // Template mémorisé (« réutiliser pour les prochaines ») : pré-remplit le
  // message quand l'agent n'en a pas proposé un.
  const saved = typeof window !== "undefined" ? readSavedTemplate(action.kind) : null;
  const [taskBody, setTaskBody] = useState(action.taskBody ?? (action.kind === "create_tasks" ? saved?.body ?? "" : ""));
  const [dueInDays, setDueInDays] = useState(String(action.dueInDays ?? 2));
  const [newCloseDate, setNewCloseDate] = useState(action.newCloseDate ?? "");
  const [emailSubject, setEmailSubject] = useState(action.emailSubject ?? (action.kind === "draft_emails" ? saved?.subject ?? "" : ""));
  const [emailBody, setEmailBody] = useState(action.emailBody ?? (action.kind === "draft_emails" ? saved?.body ?? "" : ""));
  // Ton du contenu + mémorisation pour les prochaines actions du même type.
  const [tone, setTone] = useState<MessageTone | null>(saved?.tone ?? null);
  const [reuseTemplate, setReuseTemplate] = useState(Boolean(saved));
  const [showFunnel, setShowFunnel] = useState(false);
  const [state, setState] = useState<"idle" | "running" | "queuing" | "done" | "queued" | "error">("idle");
  const [result, setResult] = useState<{ done: number; total: number; hint?: string; results?: { name: string; ok: boolean; error?: string }[] } | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [queueError, setQueueError] = useState<string | null>(null);
  const notifyActivated = useNotifyActivatedAlert();

  const fmtEur = (n: number | null) => (n != null ? `${n.toLocaleString("fr-FR")} €` : "—");
  const totalAmount = action.deals.reduce((s, d) => s + (d.amount ?? 0), 0);

  /** Paramètres ajustés dans la carte, appliqués sur la proposition de l'agent. */
  function buildPayload(): DealActionProposal {
    return {
      ...action,
      taskBody: taskBody || null,
      dueInDays: Number(dueInDays) || 2,
      newCloseDate: newCloseDate || null,
      emailSubject: emailSubject || null,
      emailBody: emailBody || null,
    };
  }

  /**
   * « Plus tard » : l'action part dans la file Suivi → Actions au lieu de
   * s'exécuter maintenant. Elle y attend la même validation que les actions
   * des détecteurs — et reste visible ici, dans l'onglet Actions du chat.
   */
  async function queueForLater() {
    setState("queuing");
    setQueueError(null);
    try {
      const res = await fetch("/api/actions/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey, action: buildPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Mise en file impossible");
      setQueuedCount(Number(data.queued) || action.deals.length);
      setState("queued");
      persistTemplateIfWanted();
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Erreur inconnue");
      setState("idle");
    }
  }

  /** Applique un ton : template pré-rempli (email ou tâche), éditable ensuite. */
  function applyTone(t: MessageTone) {
    setTone(t);
    if (action.kind === "draft_emails") {
      const tpl = emailTemplate(t);
      setEmailSubject(tpl.subject);
      setEmailBody(tpl.body);
    } else if (action.kind === "create_tasks") {
      setTaskBody(taskTemplate(t));
    }
  }

  /** Mémorise le message courant pour les prochaines actions du même type. */
  function persistTemplateIfWanted() {
    if (!reuseTemplate || !tone) return;
    if (action.kind === "draft_emails") saveTemplate(action.kind, { tone, subject: emailSubject, body: emailBody });
    else if (action.kind === "create_tasks") saveTemplate(action.kind, { tone, body: taskBody });
  }

  /** L'appel RÉEL — exécuté à l'étape « Écriture HubSpot » du funnel. */
  async function runExecution(): Promise<FunnelResult> {
    const payload: DealActionProposal = buildPayload();
    const res = await fetch(`/api/agents/${agentKey}/execute-deal-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { done: 0, total: action.deals.length, error: data.error || "Échec" };
    return { done: data.done, total: data.total, hint: data.hint, results: data.results };
  }

  /** Ouvre la fenêtre d'exécution en funnel (étapes clés auto-déroulantes). */
  function execute() {
    setState("running");
    setResult(null);
    setShowFunnel(true);
  }

  function onFunnelClose(res: FunnelResult | null) {
    setShowFunnel(false);
    if (!res) {
      setState("idle");
      return;
    }
    setResult({ done: res.done, total: res.total, hint: res.hint, results: res.results });
    setState(res.done > 0 ? "done" : "error");
    if (res.done > 0) {
      notifyActivated?.({ title: `${meta.label} (${res.done})`, at: Date.now() });
      persistTemplateIfWanted();
    }
  }

  const done = state === "done";
  const queued = state === "queued";
  // Une fois planifiée ou exécutée, les champs se figent : la carte devient
  // une trace de ce qui a été décidé.
  const locked = done || queued;
  const field = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100";
  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="ml-9 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        <span>⚡</span> Action à exécuter · HubSpot
      </div>

      <div className="space-y-3 p-3.5">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <span>{meta.icon}</span> {action.title}
          </div>
          {action.rationale && <p className="mt-0.5 text-xs text-slate-600">{action.rationale}</p>}
          {action.estimatedImpact && (
            <p className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              📈 {action.estimatedImpact}
            </p>
          )}
        </div>

        {/* Deals ciblés */}
        <div>
          <div className={lbl}>Deals ciblés ({action.deals.length}) · {fmtEur(totalAmount)}</div>
          <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
            {action.deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs">
                <span className="min-w-0 truncate text-slate-700">{d.name}</span>
                <span className="shrink-0 font-medium text-slate-500">{fmtEur(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ton du contenu (séquences : tâches & emails) — template pré-rempli,
            mémorisable pour les prochaines actions du même type. */}
        {!locked && (action.kind === "create_tasks" || action.kind === "draft_emails") && (
          <div>
            <label className={lbl}>Ton du contenu</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {ACTION_TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTone(t.id)}
                  title={`Pré-remplir le message avec un ton ${t.label.toLowerCase()}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    tone === t.id
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-slate-500">
                <input
                  type="checkbox"
                  checked={reuseTemplate}
                  onChange={(e) => setReuseTemplate(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-300 accent-amber-500"
                />
                Réutiliser pour les prochaines
              </label>
            </div>
          </div>
        )}

        {/* Paramètres selon le type d'action */}
        {!locked && action.kind ==="update_closedate" && (
          <div>
            <label className={lbl}>Nouvelle date de closing</label>
            <input type="date" value={newCloseDate} onChange={(e) => setNewCloseDate(e.target.value)} className={`${field} mt-0.5`} />
          </div>
        )}
        {!locked && action.kind ==="create_tasks" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <label className={lbl}>Contenu de la tâche</label>
              <textarea rows={2} value={taskBody} onChange={(e) => setTaskBody(e.target.value)} className={`${field} mt-0.5`} placeholder="Relancer, proposer un créneau…" />
            </div>
            <div>
              <label className={lbl}>Échéance (j)</label>
              <input type="number" value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} className={`${field} mt-0.5 w-20`} />
            </div>
          </div>
        )}
        {!locked && action.kind ==="draft_emails" && (
          <div className="space-y-2">
            <div>
              <label className={lbl}>Objet</label>
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={`${field} mt-0.5`} />
            </div>
            <div>
              <label className={lbl}>Corps de l&apos;email</label>
              <textarea rows={3} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className={`${field} mt-0.5`} />
            </div>
          </div>
        )}

        {/* Résultat / action */}
        {result && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${result.done > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            <p className="font-medium">
              {result.done > 0 ? `✓ ${result.done}/${result.total} exécuté(s) dans HubSpot` : "Aucune action exécutée"}
            </p>
            {result.hint && <p className="mt-1">{result.hint}</p>}
            {result.results?.some((r) => !r.ok) && (
              <ul className="mt-1 list-disc pl-4">
                {result.results.filter((r) => !r.ok).slice(0, 5).map((r, i) => (
                  <li key={i}>{r.name} — {r.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {queueError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{queueError}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {done ? (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Exécuté —{" "}
              <a href="https://app.hubspot.com" target="_blank" rel="noreferrer" className="underline hover:text-emerald-700">
                voir dans HubSpot
              </a>
            </span>
          ) : queued ? (
            <span className="text-sm font-medium text-indigo-600">
              🗓 Planifiée — {queuedCount} action{queuedCount > 1 ? "s" : ""} en attente de validation dans{" "}
              <Link href="/dashboard/mes-alertes/actions" className="underline hover:text-indigo-700">
                Suivi → Actions
              </Link>
            </span>
          ) : (
            <>
              {/* Deux temps assumés : agir tout de suite, ou déposer l'action
                  dans la file pour la traiter plus tard — même validation. */}
              <button
                onClick={execute}
                disabled={state === "running" || state === "queuing" || (action.kind === "update_closedate" && !newCloseDate)}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {state === "running" ? "Exécution…" : `⚡ Maintenant — ${meta.cta.toLowerCase()}`}
              </button>
              <button
                onClick={queueForLater}
                disabled={state === "running" || state === "queuing" || (action.kind === "update_closedate" && !newCloseDate)}
                title="Dépose l'action dans Suivi → Actions : tu la valides quand tu veux, deal par deal."
                className="rounded-lg border border-indigo-200 bg-white px-3.5 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60"
              >
                {state === "queuing" ? "Planification…" : "🗓 Plus tard"}
              </button>
              <Link href="/dashboard/parametres/integrations" className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline">
                Gérer les accès HubSpot
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Fenêtre d'exécution en funnel : étapes clés auto-déroulantes. */}
      {showFunnel && (
        <ActionExecutionFunnel
          title={action.title}
          count={action.deals.length}
          run={runExecution}
          onClose={onFunnelClose}
        />
      )}
    </div>
  );
}
