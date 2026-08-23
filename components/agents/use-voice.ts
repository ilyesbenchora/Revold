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

/**
 * Prépare une réponse d'agent pour la LECTURE : on lit des phrases, pas du
 * markdown. Blocs de code et images retirés, liens réduits à leur libellé,
 * lignes de tableau aplaties en énumération, puces effacées, émojis retirés
 * (la synthèse les épelle ou bafouille). Les légendes à l'écran, elles,
 * gardent le texte d'origine.
 */
function toSpokenText(t: string): string {
  return t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*\|[\s:|-]+\|\s*$/gm, " ") // séparateurs de tableau |---|---|
    .replace(/^\s*\|(.+)\|\s*$/gm, (_, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join(", ") + ".")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[•▪◦→]/g, ", ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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
  // L'utilisateur a cliqué "stop" : le prochain onend envoie la transcription.
  const manualStopRef = useRef(false);
  // Session annulée (démontage) : ni relance ni envoi.
  const cancelledRef = useRef(false);
  // Erreur bloquante (micro refusé…) : on n'essaie pas de relancer.
  const fatalErrorRef = useRef(false);

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
      cancelledRef.current = true;
      recRef.current?.abort();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  /** Lit `text` avec la voix du persona ; repli navigateur si le TTS échoue. */
  const speak = useCallback(
    async (text: string) => {
      const clean = toSpokenText(text);
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
        // Repli : synthèse du navigateur — français de FRANCE d'abord (une
        // voix fr-BE/fr-CA ne sert que s'il n'existe aucune fr-FR).
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utter = new SpeechSynthesisUtterance(clean);
          utter.lang = "fr-FR";
          const all = window.speechSynthesis.getVoices();
          const fr = all.find((v) => v.lang.toLowerCase().startsWith("fr-fr")) ?? all.find((v) => v.lang.toLowerCase().startsWith("fr"));
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
    manualStopRef.current = true;
    recRef.current?.stop();
  }, []);

  /**
   * Démarre la dictée. `onInterim` reçoit le texte au fil de l'eau (pour le
   * champ de saisie) ; `onFinal` reçoit la transcription complète quand
   * l'utilisateur arrête lui-même le micro (déclenche l'envoi). Les pauses
   * ne coupent pas la dictée : si le navigateur s'arrête sur un silence, la
   * reconnaissance est relancée en conservant le texte déjà transcrit.
   */
  const startListening = useCallback(
    (onInterim: (text: string) => void, onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor || listening) return;
      stopSpeaking();
      const rec = new Ctor();
      rec.lang = "fr-FR";
      rec.continuous = true;
      rec.interimResults = true;
      finalRef.current = "";
      manualStopRef.current = false;
      cancelledRef.current = false;
      fatalErrorRef.current = false;
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
        if (cancelledRef.current) {
          setListening(false);
          recRef.current = null;
          return;
        }
        // Silence : le navigateur coupe tout seul, on relance sans envoyer
        // pour laisser l'utilisateur finir sa phrase.
        if (!manualStopRef.current && !fatalErrorRef.current) {
          try {
            rec.start();
            return;
          } catch {
            // Relance impossible : on finalise avec ce qu'on a.
          }
        }
        setListening(false);
        recRef.current = null;
        const text = finalRef.current.trim();
        if (text) onFinal(text);
      };
      rec.onerror = (e) => {
        // Micro refusé ou indisponible : inutile de relancer en boucle.
        if (e.error === "not-allowed" || e.error === "audio-capture" || e.error === "service-not-allowed") {
          fatalErrorRef.current = true;
        }
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
