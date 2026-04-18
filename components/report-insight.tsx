"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  headline: string;
  detail: string | null;
  caveat: string | null;
  reportId?: string;
  reportTitle?: string;
  team?: string | null;
  kpiLabel?: string;
};

const COACHING_LABEL = "Coaching IA à faire";

type ParsedSection = {
  label: string;
  content: string;
  isCoaching: boolean;
};

/** Split a detail blob into sections (paragraphs). Returns parsed structure. */
function splitSections(text: string): ParsedSection[] {
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  return paragraphs.map((para) => {
    const trimmed = para.trim();
    const sectionMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*:\s*([\s\S]*)/);
    if (sectionMatch) {
      const label = sectionMatch[1].trim();
      const content = sectionMatch[2].trim();
      const ll = label.toLowerCase();
      const isCoaching =
        ll.includes("décision") ||
        ll.includes("plan d'action") ||
        ll.includes("action immédiate") ||
        ll.startsWith("action") ||
        ll.includes("coaching");
      return { label, content, isCoaching };
    }
    return { label: "", content: trimmed, isCoaching: false };
  });
}

/** Synthesise a coaching action from the headline when none is provided. */
function synthesiseCoaching(headline: string, kpiLabel?: string): string {
  const cleaned = headline.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
  const kpi = kpiLabel ? ` sur « ${kpiLabel} »` : "";
  return `Identifier le levier principal d'amélioration${kpi}, définir une action mesurable sous 7 jours, puis valider l'impact en relisant ce rapport au prochain cycle. Données observées : ${cleaned}`;
}

function renderBold(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<span key={`b${idx++}`} className="font-semibold text-slate-800">{match[1]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`e${idx}`}>{text.slice(lastIndex)}</span>);
  }
  return parts;
}

function styleForLabel(label: string): { labelColor: string; borderColor: string } {
  const ll = label.toLowerCase();
  if (ll.includes(COACHING_LABEL.toLowerCase()) || ll.includes("décision") || ll.includes("plan d'action") || ll.startsWith("action")) {
    return { labelColor: "text-fuchsia-700 bg-fuchsia-50", borderColor: "border-l-fuchsia-400" };
  }
  if (ll.includes("objectif")) return { labelColor: "text-emerald-700 bg-emerald-50", borderColor: "border-l-emerald-400" };
  if (ll.includes("tendance")) return { labelColor: "text-blue-700 bg-blue-50", borderColor: "border-l-blue-400" };
  if (ll.includes("seuil")) return { labelColor: "text-amber-700 bg-amber-50", borderColor: "border-l-amber-400" };
  return { labelColor: "text-slate-700 bg-slate-100", borderColor: "border-l-slate-300" };
}

export function ReportInsight({
  headline,
  detail,
  caveat,
  reportId,
  reportTitle,
  team,
  kpiLabel,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [activationState, setActivationState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Parse the detail and detect whether a coaching/decision section already exists
  const sections = detail ? splitSections(detail) : [];
  const hasCoachingSection = sections.some((s) => s.isCoaching);

  // If none, synthesise one so every report has its "Coaching IA à faire" block
  const coachingContent = hasCoachingSection
    ? sections.find((s) => s.isCoaching)!.content
    : synthesiseCoaching(headline, kpiLabel);

  // Other sections (everything not the coaching one) for display
  const otherSections = sections.filter((s) => !s.isCoaching);

  const canActivate = !!reportId && !!team;

  async function handleActivate() {
    if (!reportId || activationState === "loading") return;
    setActivationState("loading");
    setActivationError(null);
    try {
      const res = await fetch("/api/reports/activate-coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          kpiLabel,
          title: reportTitle ?? kpiLabel ?? "Coaching IA",
          body: coachingContent,
          recommendation: coachingContent,
          severity: "info",
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirectTo?: string }
        | null;
      if (!res.ok || !payload?.ok) {
        setActivationState("error");
        setActivationError(payload?.error ?? `Échec (${res.status}).`);
        return;
      }
      setActivationState("done");
      setRedirectTo(payload.redirectTo ?? null);
    } catch (err) {
      setActivationState("error");
      setActivationError(err instanceof Error ? err.message : "Erreur réseau.");
    }
  }

  const hasMore = (detail && detail.length > 0) || caveat;

  return (
    <div className="mt-2">
      {/* Headline */}
      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-medium text-slate-800 leading-relaxed">{renderBold(headline)}</p>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2.5 px-1">
          {/* Other sections (Tendance, Objectif, Seuil, etc.) */}
          {otherSections.map((s, i) => {
            if (!s.label) {
              return (
                <p key={i} className="text-[11px] text-slate-600 leading-relaxed">
                  {renderBold(s.content)}
                </p>
              );
            }
            const { labelColor, borderColor } = styleForLabel(s.label);
            return (
              <div key={i} className={`border-l-2 ${borderColor} pl-3 py-1.5`}>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${labelColor} mb-1`}>
                  {s.label}
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">{renderBold(s.content)}</p>
              </div>
            );
          })}

          {/* Coaching IA à faire — TOUJOURS présent (synthétisé si absent) */}
          <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fuchsia-700 bg-fuchsia-100 mb-1.5">
                  ✨ {COACHING_LABEL}
                </span>
                <p className="text-[11px] text-slate-700 leading-relaxed">{renderBold(coachingContent)}</p>
              </div>
            </div>

            {/* Activation button + state */}
            {canActivate && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activationState === "idle" && (
                  <button
                    type="button"
                    onClick={handleActivate}
                    className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-fuchsia-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Activer ce coaching
                  </button>
                )}
                {activationState === "loading" && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-fuchsia-700">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-fuchsia-300 border-t-fuchsia-600" />
                    Activation...
                  </span>
                )}
                {activationState === "done" && (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
                      ✓ Coaching activé
                    </span>
                    {redirectTo && (
                      <button
                        type="button"
                        onClick={() => router.push(redirectTo)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-fuchsia-700 underline hover:text-fuchsia-800"
                      >
                        Voir dans la page coaching →
                      </button>
                    )}
                  </>
                )}
                {activationState === "error" && (
                  <div className="text-[10px] text-red-700">
                    Erreur : {activationError ?? "inconnue"}{" "}
                    <button
                      type="button"
                      onClick={handleActivate}
                      className="underline hover:no-underline"
                    >
                      Réessayer
                    </button>
                  </div>
                )}
              </div>
            )}
            {!canActivate && (
              <p className="mt-2 text-[10px] italic text-slate-400">
                Activation indisponible pour ce rapport.
              </p>
            )}
          </div>

          {caveat && (
            <div className="border-l-2 border-l-amber-400 pl-3 py-1.5">
              <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 mb-1">
                Attention
              </span>
              <p className="text-[11px] text-amber-700 leading-relaxed">{caveat}</p>
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-3 py-1 text-[10px] font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
        >
          {expanded ? "Réduire l'analyse ▲" : "Lire l'analyse ▼"}
        </button>
      )}
    </div>
  );
}
