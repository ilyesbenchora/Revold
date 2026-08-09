"use client";

/**
 * Couche vocale du chat agent : dictée (micro → texte) et voix de l'agent
 * (texte → audio).
 *
 * - Dictée : Web Speech API du navigateur (fr-FR, résultats intermédiaires
 *   affichés en direct dans le champ). Chrome/Edge/Safari ; le bouton micro
 *   est masqué si l'API est absente.
 * - Voix : POST /api/tts (ElevenLabs, voix FR du persona). Si la route est
 *   indisponible (clé absente, quota), repli sur speechSynthesis du
 *   navigateur pour ne jamais laisser l'utilisateur sans réponse vocale.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Types minimaux de la Web Speech API (absente des libs TS par défaut).
type SpeechResult = { transcript: string };
type SpeechEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: SpeechResult }> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(agentKey: string) {
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Transcription finale accumulée pendant la session micro.
  const finalRef = useRef("");

  useEffect(() => {
    setMicSupported(getRecognitionCtor() !== null);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  // Coupe l'audio et le micro quand on quitte la page de l'agent.
  useEffect(() => {
    return () => {
      recRef.current?.abort();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  /** Lit `text` avec la voix du persona ; repli navigateur si le TTS échoue. */
  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      stopSpeaking();
      setSpeaking(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, agentKey }),
        });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => stopSpeaking();
        audio.onerror = () => stopSpeaking();
        await audio.play();
      } catch {
        // Repli : synthèse du navigateur (voix système fr-FR).
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utter = new SpeechSynthesisUtterance(clean);
          utter.lang = "fr-FR";
          const fr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
          if (fr) utter.voice = fr;
          utter.onend = () => setSpeaking(false);
          utter.onerror = () => setSpeaking(false);
          window.speechSynthesis.speak(utter);
        } else {
          setSpeaking(false);
        }
      }
    },
    [agentKey, stopSpeaking],
  );

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  /**
   * Démarre la dictée. `onInterim` reçoit le texte au fil de l'eau (pour le
   * champ de saisie) ; `onFinal` reçoit la transcription complète à la fin
   * de la prise de parole (déclenche l'envoi).
   */
  const startListening = useCallback(
    (onInterim: (text: string) => void, onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor || listening) return;
      stopSpeaking();
      const rec = new Ctor();
      rec.lang = "fr-FR";
      rec.continuous = false;
      rec.interimResults = true;
      finalRef.current = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript;
          else interim += r[0].transcript;
        }
        onInterim((finalRef.current + interim).trim());
      };
      rec.onend = () => {
        setListening(false);
        recRef.current = null;
        const text = finalRef.current.trim();
        if (text) onFinal(text);
      };
      rec.onerror = () => {
        // onend suit toujours onerror — l'état y est remis à zéro.
      };
      recRef.current = rec;
      setListening(true);
      rec.start();
    },
    [listening, stopSpeaking],
  );

  return { micSupported, listening, startListening, stopListening, speaking, speak, stopSpeaking };
}
