"use client";

import { useState } from "react";

type Channel = {
  id?: string;
  type: "email" | "slack" | "teams" | "webhook";
  enabled: boolean;
  config: {
    recipients?: string[];
    webhook_url?: string;
    url?: string;
    headers?: Record<string, string>;
  };
  digest_daily_enabled?: boolean;
  digest_daily_time?: string;
  digest_weekly_enabled?: boolean;
  digest_weekly_day?: string;
};

type Props = {
  initialChannels: Channel[];
};

export function NotificationChannelsForm({ initialChannels }: Props) {
  const [channels, setChannels] = useState<Record<string, Channel>>(() => {
    const map: Record<string, Channel> = {};
    for (const c of initialChannels) map[c.type] = c;
    return map;
  });
  const [emailRecipientInput, setEmailRecipientInput] = useState(
    (channels.email?.config.recipients ?? []).join(", "),
  );
  const [slackUrl, setSlackUrl] = useState(channels.slack?.config.webhook_url ?? "");
  const [teamsUrl, setTeamsUrl] = useState(channels.teams?.config.webhook_url ?? "");
  const [webhookUrl, setWebhookUrl] = useState(channels.webhook?.config.url ?? "");
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [errorFlash, setErrorFlash] = useState<string | null>(null);

  const flash = (type: "saved" | "error", msg: string) => {
    if (type === "saved") {
      setSavedFlash(msg);
      setTimeout(() => setSavedFlash(null), 3000);
    } else {
      setErrorFlash(msg);
      setTimeout(() => setErrorFlash(null), 5000);
    }
  };

  async function saveChannel(type: Channel["type"], config: Channel["config"], enabled = true) {
    setSavingType(type);
    setErrorFlash(null);
    try {
      const res = await fetch("/api/notifications/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config, enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        flash("error", data.error ?? `Erreur lors de la sauvegarde du ${type}`);
        return;
      }
      const data = await res.json();
      setChannels((prev) => ({ ...prev, [type]: data.channel }));
      flash("saved", `${labelFor(type)} sauvegardé`);
    } catch {
      flash("error", "Erreur réseau");
    } finally {
      setSavingType(null);
    }
  }

  async function disableChannel(type: Channel["type"]) {
    setSavingType(type);
    try {
      const res = await fetch(`/api/notifications/channels?type=${type}`, { method: "DELETE" });
      if (!res.ok) {
        flash("error", "Suppression échouée");
        return;
      }
      setChannels((prev) => {
        const copy = { ...prev };
        delete copy[type];
        return copy;
      });
      flash("saved", `${labelFor(type)} désactivé`);
    } catch {
      flash("error", "Erreur réseau");
    } finally {
      setSavingType(null);
    }
  }

  function saveEmail() {
    const recipients = emailRecipientInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      flash("error", "Au moins un email destinataire requis");
      return;
    }
    saveChannel("email", { recipients });
  }

  function saveSlack() {
    if (!slackUrl.startsWith("https://hooks.slack.com/")) {
      flash("error", "URL Slack invalide (doit commencer par https://hooks.slack.com/)");
      return;
    }
    saveChannel("slack", { webhook_url: slackUrl });
  }

  function saveTeams() {
    if (!teamsUrl.startsWith("https://")) {
      flash("error", "URL Teams invalide (HTTPS requis)");
      return;
    }
    saveChannel("teams", { webhook_url: teamsUrl });
  }

  function saveWebhook() {
    if (!webhookUrl.startsWith("https://")) {
      flash("error", "URL webhook invalide (HTTPS requis)");
      return;
    }
    saveChannel("webhook", { url: webhookUrl });
  }

  function labelFor(type: string) {
    return ({ email: "Email", slack: "Slack", teams: "Teams", webhook: "Webhook" } as Record<string, string>)[type] ?? type;
  }

  return (
    <div className="space-y-3">
      {(savedFlash || errorFlash) && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            savedFlash ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {savedFlash || errorFlash}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Email */}
        <article className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Email</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Notifications email via Resend (alertes atteintes + digest quotidien)
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                channels.email?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {channels.email?.enabled ? "✓ Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Destinataires</label>
            <input
              type="text"
              value={emailRecipientInput}
              onChange={(e) => setEmailRecipientInput(e.target.value)}
              placeholder="alice@org.com, bob@org.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-[10px] text-slate-400">Séparés par virgule, point-virgule ou espace</p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {channels.email && (
              <button
                onClick={() => disableChannel("email")}
                disabled={savingType === "email"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Désactiver
              </button>
            )}
            <button
              onClick={saveEmail}
              disabled={savingType === "email"}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingType === "email" ? "..." : "Sauvegarder"}
            </button>
          </div>
        </article>

        {/* Slack */}
        <article className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Slack</h3>
              <p className="mt-0.5 text-xs text-slate-500">Webhook entrant vers un canal Slack dédié</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                channels.slack?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {channels.slack?.enabled ? "✓ Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">URL du webhook Slack</label>
            <input
              type="text"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T0/B0/..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Crée un Incoming Webhook depuis Slack → Apps → Incoming Webhooks
            </p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {channels.slack && (
              <button
                onClick={() => disableChannel("slack")}
                disabled={savingType === "slack"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Désactiver
              </button>
            )}
            <button
              onClick={saveSlack}
              disabled={savingType === "slack"}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingType === "slack" ? "..." : "Sauvegarder"}
            </button>
          </div>
        </article>

        {/* Teams */}
        <article className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Microsoft Teams</h3>
              <p className="mt-0.5 text-xs text-slate-500">Webhook entrant vers un canal Teams</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                channels.teams?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {channels.teams?.enabled ? "✓ Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">URL du webhook Teams</label>
            <input
              type="text"
              value={teamsUrl}
              onChange={(e) => setTeamsUrl(e.target.value)}
              placeholder="https://outlook.office.com/webhook/..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Canal Teams → Connecteurs → Incoming Webhook
            </p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {channels.teams && (
              <button
                onClick={() => disableChannel("teams")}
                disabled={savingType === "teams"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Désactiver
              </button>
            )}
            <button
              onClick={saveTeams}
              disabled={savingType === "teams"}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingType === "teams" ? "..." : "Sauvegarder"}
            </button>
          </div>
        </article>

        {/* Webhook custom */}
        <article className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Webhook custom</h3>
              <p className="mt-0.5 text-xs text-slate-500">POST JSON vers une URL HTTPS de votre choix</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                channels.webhook?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {channels.webhook?.enabled ? "✓ Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">URL endpoint</label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/revold"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Format payload : {"{ sourceType, sourceId, subject, bodyText, link, timestamp }"}
            </p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {channels.webhook && (
              <button
                onClick={() => disableChannel("webhook")}
                disabled={savingType === "webhook"}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Désactiver
              </button>
            )}
            <button
              onClick={saveWebhook}
              disabled={savingType === "webhook"}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingType === "webhook" ? "..." : "Sauvegarder"}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
