"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

type AlertButtonProps = {
  title: string;
  description: string;
  impact: string;
  category: string;
  forecastType?: string;
  threshold?: number;
  direction?: "above" | "below";
};

type ConfiguredChannel = { type: "email" | "slack" | "teams" | "webhook"; enabled: boolean };

const CHANNEL_META: Record<
  string,
  { label: string; icon: string; description: string; brandDomain?: string }
> = {
  in_app: { label: "Cloche in-app", icon: "🔔", description: "Header + page Alertes" },
  email: { label: "Email", icon: "✉️", description: "Aux destinataires configurés" },
  slack: { label: "Slack", icon: "💬", description: "Canal Slack configuré", brandDomain: "slack.com" },
  teams: { label: "Microsoft Teams", icon: "👥", description: "Canal Teams configuré", brandDomain: "microsoft.com" },
  hubspot: { label: "HubSpot CRM", icon: "🔶", description: "Notification (note) dans le CRM", brandDomain: "hubspot.com" },
  webhook: { label: "Webhook custom", icon: "🔌", description: "POST JSON vers votre URL" },
};

export function AlertButton({ title, description, impact, category, forecastType, threshold, direction }: AlertButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["in_app"]);
  const [configuredChannels, setConfiguredChannels] = useState<ConfiguredChannel[]>([]);
  const [loadedChannels, setLoadedChannels] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal mount detection (évite hydration mismatch SSR)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pickerOpen && !loadedChannels) {
      fetch("/api/notifications/channels")
        .then((r) => (r.ok ? r.json() : { channels: [] }))
        .then((data) => {
          setConfiguredChannels(data.channels ?? []);
          setLoadedChannels(true);
        })
        .catch(() => setLoadedChannels(true));
    }
  }, [pickerOpen, loadedChannels]);

  // Lock body scroll quand le modal est ouvert
  useEffect(() => {
    if (pickerOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [pickerOpen]);

  // Fermer avec Escape
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state !== "loading") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, state]);

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  async function submit() {
    if (selectedChannels.length === 0) return;
    setState("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          impact,
          category,
          forecast_type: forecastType || null,
          threshold: threshold ?? null,
          direction: direction || "above",
          notification_channels: selectedChannels,
        }),
      });
      if (res.ok) {
        setState("done");
        setPickerOpen(false);
        router.refresh();
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
        Alerte activée — suivi en cours
      </span>
    );
  }

  // ── Modal contenu (porté via createPortal pour échapper aux overflow-hidden parents) ──
  const modal = pickerOpen && mounted ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => state !== "loading" && setPickerOpen(false)}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Bouton close en haut à droite */}
        <button
          type="button"
          onClick={() => state !== "loading" && setPickerOpen(false)}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="pr-8 text-base font-semibold text-slate-900">
          Choisir les canaux de notification
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Quand l&apos;objectif sera atteint, vous serez notifié via les canaux sélectionnés.
        </p>

        <div className="mt-4 space-y-1.5">
          {(["in_app", "email", "slack", "teams", "hubspot", "webhook"] as const).map((ch) => {
            const isInApp = ch === "in_app";
            const isHubspot = ch === "hubspot";
            const isConfigured = isInApp || isHubspot || configuredChannels.some((c) => c.type === ch && c.enabled);
            const meta = CHANNEL_META[ch];
            const isSelected = selectedChannels.includes(ch);

            return (
              <button
                key={ch}
                type="button"
                onClick={() => isConfigured && toggleChannel(ch)}
                disabled={!isConfigured}
                className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                  isSelected
                    ? "border-accent bg-accent/5"
                    : isConfigured
                    ? "border-slate-200 hover:border-slate-300"
                    : "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
                }`}
              >
                <span className="shrink-0">
                  {meta.brandDomain ? (
                    <BrandLogo
                      domain={meta.brandDomain}
                      alt={meta.label}
                      fallback={meta.icon}
                      size={20}
                    />
                  ) : (
                    <span className="text-lg">{meta.icon}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                    {isInApp && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        ✓ Toujours
                      </span>
                    )}
                    {!isConfigured && !isInApp && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                        Non configuré
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{meta.description}</p>
                </div>
                <div
                  className={`h-4 w-4 shrink-0 rounded border-2 transition ${
                    isSelected ? "border-accent bg-accent" : "border-slate-300"
                  } ${!isConfigured ? "opacity-50" : ""}`}
                >
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-full w-full">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[10px] text-slate-400">
          Pas configuré ?{" "}
          <a href="/dashboard/parametres/notifications" target="_blank" className="text-accent underline">
            Configurer mes canaux →
          </a>
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            disabled={state === "loading"}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={state === "loading" || selectedChannels.length === 0}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {state === "loading" ? "Activation..." : "Activer le suivi"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Modifier cette alerte
      </button>

      {/* Portal vers document.body pour échapper aux containers parents
          (les SimulationCard ont overflow-hidden + transform/halo qui peuvent
          créer un stacking context et casser le rendu fixed) */}
      {modal && createPortal(modal, document.body)}
    </>
  );
}
