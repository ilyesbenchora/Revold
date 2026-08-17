"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Bouton micro de DICTÉE pour un champ texte (descriptif de câblage des
 * funnels, notamment) : clic → écoute, le texte reconnu est AJOUTÉ au champ
 * via onText ; re-clic → stop. Invisible si le navigateur ne supporte pas la
 * reconnaissance vocale.
 */
export function DictationButton({
  onText,
  title = "Dicter à la voix",
  className = "",
}: {
  /** Reçoit chaque segment finalisé (à concaténer au champ). */
  onText: (text: string) => void;
  title?: string;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(recognitionCtor() !== null);
    return () => {
      try {
        recRef.current?.stop();
      } catch {}
    };
  }, []);

  function toggle() {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {}
      setListening(false);
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      // Chaque résultat finalisé est transmis tel quel (concaténé côté champ).
      const last = e.results[e.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim();
      if (transcript) onText(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Arrêter la dictée" : title}
      aria-label={listening ? "Arrêter la dictée" : title}
      className={`rounded-lg border p-1.5 transition ${
        listening
          ? "animate-pulse border-rose-300 bg-rose-50 text-rose-600"
          : "border-slate-200 bg-white text-slate-400 hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600"
      } ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
