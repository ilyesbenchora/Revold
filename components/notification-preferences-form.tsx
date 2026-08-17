"use client";

/**
 * Contenu des notifications (Paramètres → Notifications) — pensé comme le
 * « contenu du brief » de la tour de contrôle : chaque événement s'active,
 * et choisit SES canaux. Le brief te LIT ces informations quand tu le
 * demandes ; ici, Revold te les ENVOIE quand elles se produisent.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notifications/events";

type Pref = { enabled: boolean; channels: string[] };

export function NotificationPreferencesForm({
  /** Canaux réellement configurés (email/slack…) — les autres sont grisés. */
  configuredChannels,
  /** Mobile renseigné dans Mon compte : conditionne SMS et WhatsApp. */
  hasPhone,
  /** Restreint l'affichage à ces événements (Mon compte → Notifications). */
  only,
}: {
  configuredChannels: string[];
  hasPhone: boolean;
  only?: string[];
}) {
  const [prefs, setPrefs] = useState<Record<string, Pref> | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/notifications/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setPrefs(d.prefs ?? {});
        setNeedsMigration(Boolean(d.needsMigration));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save(eventKey: string, patch: Partial<Pref>) {
    const current = prefs?.[eventKey];
    if (!current) return;
    const next = { ...current, ...patch };
    setPrefs((p) => ({ ...(p ?? {}), [eventKey]: next })); // optimiste
    setBusy(eventKey);
    setError(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_key: eventKey, enabled: next.enabled, channels: next.channels }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.needsMigration) setNeedsMigration(true);
        throw new Error(d.error || "Enregistrement impossible");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(null);
    }
  }

  /** Un canal est-il utilisable ? (configuré, ou mobile renseigné) */
  function channelReady(key: string): { ok: boolean; reason?: string } {
    if (key === "in_app") return { ok: true };
    if (key === "sms" || key === "whatsapp") {
      return hasPhone ? { ok: true } : { ok: false, reason: "Ajoute ton mobile dans Mon compte" };
    }
    return configuredChannels.includes(key)
      ? { ok: true }
      : { ok: false, reason: "Configure ce canal ci-dessous" };
  }

  if (prefs === null) {
    return <p className="text-xs text-slate-400">Chargement des préférences…</p>;
  }

  return (
    <div className="space-y-3">
      {needsMigration && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          La table <code>notification_event_prefs</code> n&apos;existe pas encore — applique la migration pour
          enregistrer ces préférences. En attendant, les valeurs par défaut s&apos;appliquent.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      <div className="grid gap-2 md:grid-cols-2">
        {NOTIFICATION_EVENTS.filter((evt) => !only || only.includes(evt.key)).map((evt) => {
          const pref = prefs[evt.key] ?? { enabled: true, channels: ["in_app"] };
          return (
            <article
              key={evt.key}
              className={`rounded-xl border p-3.5 transition ${
                pref.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{evt.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{evt.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pref.enabled}
                  aria-label={evt.label}
                  disabled={busy === evt.key}
                  onClick={() => void save(evt.key, { enabled: !pref.enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                    pref.enabled ? "bg-accent" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                      pref.enabled ? "translate-x-[1.15rem]" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {pref.enabled && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
                  {NOTIFICATION_CHANNELS.map((ch) => {
                    const on = pref.channels.includes(ch.key);
                    const ready = channelReady(ch.key);
                    return (
                      <button
                        key={ch.key}
                        type="button"
                        disabled={busy === evt.key || (!ready.ok && !on)}
                        title={ready.ok ? ch.hint : ready.reason}
                        onClick={() =>
                          void save(evt.key, {
                            channels: on ? pref.channels.filter((c) => c !== ch.key) : [...pref.channels, ch.key],
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          on
                            ? "bg-accent text-white"
                            : ready.ok
                              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              : "bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {on && <span className="mr-0.5">✓</span>}
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!hasPhone && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Les canaux <b>Mobile (SMS)</b> et <b>WhatsApp</b> s&apos;activent dès que ton numéro est renseigné dans{" "}
          <Link href="/dashboard/mon-compte" className="font-medium text-accent hover:underline">
            Mon compte
          </Link>
          {" "}— un seul numéro suffit pour les deux.
        </p>
      )}
    </div>
  );
}
