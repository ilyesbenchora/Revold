"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bouton de DICTÉE d'un champ texte — reconnaissance vocale du navigateur
 * (fr-FR, comme la tour de contrôle). Un clic démarre l'écoute, un second
 * l'arrête ; le texte final est transmis au champ via onText (le parent
 * choisit d'ajouter à la suite de l'existant). Navigateur non supporté →
 * le bouton ne s'affiche pas (le champ reste utilisable au clavier).
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}

export function DictationButton({
  onText,
  className = "",
  label = "Dicter au micro",
}: {
  /** Reçoit le texte FINAL dicté (phrase par phrase) — à ajouter au champ. */
  onText: (text: string) => void;
  className?: string;
  label?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    // Détection après montage (SSR-safe) : l'API navigateur n'existe pas au
    // rendu serveur, l'état ne peut être posé qu'ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(createRecognition() != null);
    return () => {
      try { recRef.current?.stop(); } catch { /* rien */ }
    };
  }, []);

  if (!supported) return null;

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* rien */ }
  };

  const start = () => {
    const rec = createRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) onTextRef.current(t);
        }
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      title={listening ? "Terminer la dictée" : label}
      aria-label={listening ? "Terminer la dictée" : label}
      aria-pressed={listening}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
        listening
          ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-fuchsia-300 hover:text-fuchsia-600"
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={listening ? "animate-pulse" : ""}
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      {listening ? "J'écoute… (clic pour finir)" : "Dicter"}
    </button>
  );
}
