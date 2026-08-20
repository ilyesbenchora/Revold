"use client";

/**
 * Orbe vocale « Revold » — la tour de contrôle de la home (style Jarvis).
 *
 * Sphère de particules dorées animée sur canvas : rotation lente au repos,
 * pulsation réactive au NIVEAU RÉEL du micro pendant l'écoute (AnalyserNode),
 * logo Revold en filigrane très fondu au centre, anneau teinté par le STATUT
 * DE SANTÉ du compte (vert / ambre / rouge, via /api/voice/digest).
 *
 * Rôle 100 % vocal (/api/voice/dispatch, multi-actions) :
 *  - briefer un agent/coach → redirection chat avec la demande exécutée (?ask=…) ;
 *  - plusieurs demandes dans une phrase → file d'attente (sessionStorage) ;
 *  - réponse DIRECTE aux questions KPI simples (+ bouton « creuser ») ;
 *  - création d'alertes/objectifs dictée, validée par boutons avant POST ;
 *  - navigation vocale (pages + rapports sauvegardés) ;
 *  - brief du jour lu à voix haute, avec mode veille (exceptions uniquement) ;
 *  - mémoire des 3 derniers échanges pour les enchaînements.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTowerSettings, readTowerSettings, disabledDispatchTools, normalizePhrase, briefSectionsParam } from "@/lib/voice/tower-settings";

type OrbStatus = "idle" | "listening" | "thinking" | "redirecting" | "error";
type Health = "ok" | "warn" | "critical";

const QUEUE_KEY = "revold:tower-queue";
const QUEUE_EVENT = "revold:tower-queue";
const HISTORY_KEY = "revold:tower-history";

export type QueuedDispatch = { agentKey: string; agentLabel: string; personaName: string; request: string };

export function readTowerQueue(): QueuedDispatch[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((q) => q && typeof q.agentKey === "string" && typeof q.request === "string") : [];
  } catch {
    return [];
  }
}
export function writeTowerQueue(queue: QueuedDispatch[]) {
  try {
    if (queue.length === 0) sessionStorage.removeItem(QUEUE_KEY);
    else sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {}
}

type HistoryEntry = { q: string; outcome: string };
function readHistory(): HistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-3) : [];
  } catch {
    return [];
  }
}
function pushHistory(q: string, outcome: string) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify([...readHistory(), { q, outcome }].slice(-3)));
  } catch {}
}

/* ── Reconnaissance vocale (Web Speech API, fr-FR) ── */
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
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

/**
 * Sélection de la voix de l'orbe : une voix FÉMININE FRANÇAISE, rassurante et
 * dynamique. Sans choix explicite, le navigateur lit le français avec sa voix
 * par défaut (souvent anglophone) → accent absurde. On note chaque voix
 * fr-* disponible : prénoms féminins connus, voix neurales (Edge « Natural »),
 * fr-FR natif et Google français en tête ; prénoms masculins écartés.
 */
const FEMALE_FR = /denise|eloise|vivienne|julie|hortense|audrey|aur[ée]lie|am[ée]lie|marie|c[ée]line|virginie|charlotte|l[ée]a|elise|yelda|female|femme/i;
const MALE_FR = /thomas|nicolas|paul|henri|claude|guillaume|mathieu|antoine|j[ée]r[ôo]me|remy|male(?!.*fe)/i;

let cachedFrVoice: SpeechSynthesisVoice | null = null;
let voicesListenerSet = false;

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedFrVoice) return cachedFrVoice;
  if (!voicesListenerSet) {
    voicesListenerSet = true;
    // La liste arrive souvent en asynchrone : on invalide le cache à sa mise à jour.
    try {
      window.speechSynthesis.addEventListener("voiceschanged", () => { cachedFrVoice = null; });
    } catch { /* ignore */ }
  }
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  if (voices.length === 0) return null;
  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    if (FEMALE_FR.test(v.name)) s += 8;
    if (MALE_FR.test(v.name)) s -= 8;
    if (/natural|neural|online/i.test(v.name)) s += 4; // voix neurales Edge — les plus naturelles
    if (v.lang.toLowerCase().startsWith("fr-fr")) s += 3;
    if (/google/i.test(v.name)) s += 2; // « Google français » (Chrome) : correcte, féminine
    return s;
  };
  cachedFrVoice = [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
  return cachedFrVoice;
}

/** Synthèse NAVIGATEUR — repli uniquement (accent robotique) si ElevenLabs indisponible. */
function speakFallback(text: string, onDone?: () => void) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    // Ton rassurant et dynamique : débit légèrement soutenu, timbre un peu clair.
    u.rate = 1.04;
    u.pitch = 1.05;
    const voice = pickFrenchVoice();
    if (voice) u.voice = voice;
    if (onDone) u.onend = onDone;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    if (onDone) {
      // Filet : si la synthèse est indisponible/silencieuse, on continue quand même.
      setTimeout(onDone, Math.min(12000, 1500 + text.length * 60));
    }
  } catch {
    onDone?.();
  }
}

// Audio ElevenLabs en cours — arrêté avant chaque nouvelle prise de parole.
let towerAudio: HTMLAudioElement | null = null;

function stopSpeaking() {
  try {
    towerAudio?.pause();
    towerAudio = null;
  } catch { /* ignore */ }
  try {
    window.speechSynthesis?.cancel();
  } catch { /* ignore */ }
}

/**
 * Voix de la tour de contrôle : ElevenLabs (voix FR dédiée « tower », qualité
 * maximale via /api/tts) — repli sur la synthèse navigateur si la clé est
 * absente ou l'appel échoue. `onDone` est garanti (une seule fois), avec un
 * filet temporel si l'audio ne se termine jamais.
 */
function speak(text: string, onDone?: () => void) {
  stopSpeaking();
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      onDone?.();
    }
  };
  fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, agentKey: "tower" }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (done) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      towerAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        finish();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        speakFallback(text, finish);
      };
      await audio.play();
    })
    .catch(() => speakFallback(text, finish));
  if (onDone) {
    // Filet global (génération + lecture) — proportionnel à la longueur du texte.
    setTimeout(finish, Math.min(60000, 8000 + text.length * 90));
  }
}

/* ── Sphère de particules (répartition de Fibonacci) ── */
const N_PARTICLES = 240;
const PARTICLES = Array.from({ length: N_PARTICLES }, (_, i) => {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / N_PARTICLES);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
    tw: (i % 7) / 7, // phase de scintillement
  };
});

/* ── Actions renvoyées par /api/voice/dispatch (v2 multi-actions) ── */
type DispatchAction = {
  type: "agent" | "answer" | "create_alert" | "create_objective" | "navigate" | "brief" | "clarify";
  say: string;
  // agent
  agentKey?: string;
  agentLabel?: string;
  personaName?: string;
  request?: string;
  // answer
  label?: string;
  formatted?: string | null;
  followupAgentKey?: string;
  followupName?: string;
  followupAsk?: string;
  // create_*
  payload?: Record<string, unknown>;
  summary?: string;
  // navigate
  href?: string;
};

type PendingCreate = { kind: "create_alert" | "create_objective"; payload: Record<string, unknown>; summary: string };
type Followup = { agentKey: string; name: string; ask: string };

const HEALTH_RING: Record<Health, string> = {
  ok: "border-emerald-300/40",
  warn: "border-amber-300/60",
  critical: "border-rose-400/70 animate-pulse",
};

/**
 * Thème actuel de la plateforme : true = clair (aucun data-theme sombre sur
 * <html>). La carte tour de contrôle suit le FOND du thème (même dégradé que
 * le bloc « équipe d'agents IA ») : c'est l'ORBE et les textes qui s'adaptent —
 * violets foncés sur fond clair, dorés/pâles sur fonds sombres. Suivi en direct
 * (MutationObserver) : changer de thème dans Apparence recolore l'orbe aussitôt.
 */
function useIsLightTheme(): boolean {
  const [light, setLight] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    // Lecture du DOM impossible au rendu serveur : l'état ne peut être posé
    // qu'après montage, puis suivi en direct au changement de thème.
     
    const sync = () => setLight(!el.dataset.theme);
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return light;
}
const HEALTH_HINT: Record<Health, string> = {
  ok: "Tout est au vert.",
  warn: "Points de vigilance — demande ton brief.",
  critical: "Situation critique — demande ton brief.",
};

// L'orbe passe en vert émeraude quand le digest signale qu'un contenu du brief
// est finalisé/exécuté/atteint (`achievedKeys`, calculées CÔTÉ SERVEUR et
// gatées par les sections cochées dans Paramètres → Tour de contrôle).
// ÉCOUTER LE BRIEF ACQUITTE ces clés (l'orbe redevient fuchsia) ; elle ne
// repasse au vert que pour une clé NOUVELLE — nouvel objectif atteint,
// nouvelle fournée d'actions exécutées, enrichissement re-terminé.
const BRIEF_ACK_KEY = "revold:tower-brief-ack";

function readBriefAck(): Set<string> {
  try {
    const raw = localStorage.getItem(BRIEF_ACK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}
function writeBriefAck(keys: string[]) {
  try {
    // FUSION avec les acquittements existants (jamais d'écrasement) : sinon un
    // accomplissement déjà entendu redevient « nouveau » dès qu'un brief
    // intermédiaire porte d'autres clés — l'orbe reverdissait et répétait.
    const merged = [...new Set([...readBriefAck(), ...keys])];
    localStorage.setItem(BRIEF_ACK_KEY, JSON.stringify(merged.slice(-200)));
  } catch {}
}
/** Clés déjà acquittées, à transmettre au digest (il ne les répète pas). */
function briefAckParam(): string {
  return encodeURIComponent([...readBriefAck()].join(","));
}
/** Clés d'accomplissement du digest, nettoyées. */
function achievedKeysOf(d: unknown): string[] {
  const raw = (d as { achievedKeys?: unknown } | null)?.achievedKeys;
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
}
/** Vrai s'il reste au moins un accomplissement PAS ENCORE écouté dans un brief. */
function hasUnackedAchievement(keys: string[]): boolean {
  if (keys.length === 0) return false;
  const ack = readBriefAck();
  return keys.some((k) => !ack.has(k));
}

export function RevoldOrb({ size = 210 }: { size?: number }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Thème clair → orbe FONCÉE (violet soutenu) pour rester visible sur le fond
  // clair de la carte ; thèmes sombres → palette pâle historique. Ref lue par
  // la boucle canvas (pas de redémarrage de l'animation au changement).
  const isLight = useIsLightTheme();
  const isLightRef = useRef(isLight);
  isLightRef.current = isLight;
  const [status, setStatus] = useState<OrbStatus>("idle");
  const [caption, setCaption] = useState<string>("");
  const [supported, setSupported] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  // Vert émeraude : un contenu du brief est finalisé/exécuté/atteint.
  const [achieved, setAchieved] = useState(false);
  // Personnalisation (Paramètres → Tour de contrôle) : fonctionnalités
  // activables/désactivables + phrase de brief, synchronisées en direct.
  const settings = useTowerSettings();
  const veille = settings.veille;
  const [pending, setPending] = useState<PendingCreate | null>(null);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [creating, setCreating] = useState(false);

  const statusRef = useRef<OrbStatus>("idle");
  statusRef.current = status;
  const achievedRef = useRef(false);
  achievedRef.current = achieved;
  const levelRef = useRef(0); // niveau micro 0..1 (lissé)
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  useEffect(() => {
    setSupported(!!createRecognition());
  }, []);

  // Statut de santé + signal « contenu du brief accompli » au chargement.
  // Les SECTIONS COCHÉES (contenu du brief) sont envoyées au digest : le vert
  // ne peut venir que d'un contenu réellement activé dans les réglages.
  const sectionsParam = briefSectionsParam(settings);
  useEffect(() => {
    if (!settings.healthRing) setHealth(null);
    let alive = true;
    void fetch(`/api/voice/digest?sections=${encodeURIComponent(sectionsParam)}&ack=${briefAckParam()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (settings.healthRing && (d.status === "ok" || d.status === "warn" || d.status === "critical")) setHealth(d.status);
        setAchieved(hasUnackedAchievement(achievedKeysOf(d)));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [settings.healthRing, sectionsParam]);

  /* ── Animation canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const g = canvas.getContext("2d");
    if (!g) return;
    let raf = 0;
    let t = 0;

    const draw = () => {
      t += 0.008;
      const s = statusRef.current;
      const level = levelRef.current;
      const cx = (size * dpr) / 2;
      const cy = (size * dpr) / 2;
      // Rayon : respiration lente au repos, gonflé par la voix en écoute.
      const breathe = 1 + 0.02 * Math.sin(t * 1.8);
      const voiceBoost = s === "listening" ? 1 + level * 0.16 : s === "thinking" || s === "redirecting" ? 1.04 + 0.03 * Math.sin(t * 6) : 1;
      const R = size * dpr * 0.32 * breathe * voiceBoost;

      g.clearRect(0, 0, size * dpr, size * dpr);

      // Halo / cœur lumineux FUCHSIA (identité Revold). VERT ÉMERAUDE (même
      // gamme que l'anneau de santé) quand un contenu du brief est
      // finalisé/exécuté/atteint — le signe d'une bonne nouvelle à écouter.
      const done = achievedRef.current;
      const lightTheme = isLightRef.current;
      const glow = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.55);
      const coreAlpha = s === "listening" ? 0.5 + level * 0.4 : s === "idle" ? 0.32 + 0.05 * Math.sin(t * 1.8) : 0.5;
      if (done) {
        if (lightTheme) {
          glow.addColorStop(0, `rgba(16, 185, 129, ${coreAlpha * 0.8})`);
          glow.addColorStop(0.45, `rgba(4, 120, 87, ${coreAlpha * 0.3})`);
          glow.addColorStop(1, "rgba(4, 120, 87, 0)");
        } else {
          glow.addColorStop(0, `rgba(167, 243, 208, ${coreAlpha})`);
          glow.addColorStop(0.45, `rgba(52, 211, 153, ${coreAlpha * 0.35})`);
          glow.addColorStop(1, "rgba(52, 211, 153, 0)");
        }
      } else if (lightTheme) {
        // Fond clair : halo violet soutenu (l'orbe pâle disparaissait sur blanc).
        glow.addColorStop(0, `rgba(192, 132, 252, ${coreAlpha * 0.8})`);
        glow.addColorStop(0.45, `rgba(147, 51, 234, ${coreAlpha * 0.3})`);
        glow.addColorStop(1, "rgba(147, 51, 234, 0)");
      } else {
        glow.addColorStop(0, `rgba(245, 180, 250, ${coreAlpha})`);
        glow.addColorStop(0.45, `rgba(217, 70, 239, ${coreAlpha * 0.35})`);
        glow.addColorStop(1, "rgba(217, 70, 239, 0)");
      }
      g.fillStyle = glow;
      g.fillRect(0, 0, size * dpr, size * dpr);

      // Particules de la sphère (rotation lente, jitter vocal)
      const rotY = t * (s === "thinking" || s === "redirecting" ? 3.2 : 0.9);
      const rotX = Math.sin(t * 0.35) * 0.35;
      for (const p of PARTICLES) {
        // rotation Y puis X
        const x1 = p.x * Math.cos(rotY) + p.z * Math.sin(rotY);
        const z1 = -p.x * Math.sin(rotY) + p.z * Math.cos(rotY);
        const y1 = p.y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = p.y * Math.sin(rotX) + z1 * Math.cos(rotX);
        const jitter = s === "listening" ? 1 + level * 0.25 * Math.sin(t * 22 + p.tw * 12) : 1;
        const px = cx + x1 * R * jitter;
        const py = cy + y1 * R * jitter;
        const depth = (z2 + 1) / 2; // 0 (arrière) → 1 (avant)
        const twinkle = 0.55 + 0.45 * Math.sin(t * 3 + p.tw * Math.PI * 2);
        const alpha = (0.12 + depth * 0.75) * twinkle;
        const r = (0.9 + depth * 1.5) * dpr * (s === "listening" ? 1 + level * 0.5 : 1);
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        // Mode accompli : particules vert émeraude (même charte que la santé).
        // Thème clair : teintes FONCÉES (violet/émeraude soutenus) — les pâles
        // historiques disparaissaient sur le fond clair de la carte.
        g.fillStyle = done
          ? lightTheme
            ? `rgba(5, 150, 105, ${alpha})`
            : `rgba(110, 231, 183, ${alpha})`
          : lightTheme
            ? `rgba(126, 34, 206, ${alpha})`
            : `rgba(240, 171, 252, ${alpha})`;
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  /* ── Niveau micro réel (AnalyserNode) pendant l'écoute ── */
  const startAudioLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const raw = Math.min(1, (sum / buf.length / 140) * 1.6);
        levelRef.current = levelRef.current * 0.7 + raw * 0.3; // lissage
        const raf = requestAnimationFrame(tick);
        if (audioRef.current) audioRef.current.raf = raf;
      };
      audioRef.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch {
      /* micro refusé : l'orbe pulse sans réactivité audio */
    }
  }, []);
  const stopAudioLevel = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((tr) => tr.stop());
    void a.ctx.close().catch(() => {});
    audioRef.current = null;
    levelRef.current = 0;
  }, []);
  useEffect(() => () => { stopAudioLevel(); recRef.current?.stop(); }, [stopAudioLevel]);

  /* ── Brief du jour (déterministe, lu à voix haute) ── */
  const runBrief = useCallback(async () => {
    setStatus("thinking");
    setCaption(veille ? "Brief (mode veille)…" : "Je prépare ton brief…");
    try {
      // Contenu du brief personnalisé (Paramètres → Tour de contrôle).
      const params = new URLSearchParams();
      if (veille) params.set("mode", "veille");
      params.set("sections", briefSectionsParam(readTowerSettings()));
      // Accomplissements déjà entendus : le digest ne les répète pas, il
      // n'annonce que les NOUVELLES atteintes/exécutions.
      params.set("ack", [...readBriefAck()].join(","));
      const res = await fetch(`/api/voice/digest?${params.toString()}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Brief indisponible");
      if (settings.healthRing && (d.status === "ok" || d.status === "warn" || d.status === "critical")) setHealth(d.status);
      // Brief ÉCOUTÉ (hors veille : les bonnes nouvelles y sont réellement
      // lues) → les accomplissements annoncés sont acquittés, l'orbe redevient
      // fuchsia. Elle ne reverdit que pour une clé nouvelle (nouvelle atteinte
      // ou exécution sur les contenus cochés).
      if (!veille) {
        writeBriefAck(achievedKeysOf(d));
        setAchieved(false);
      } else {
        setAchieved(hasUnackedAchievement(achievedKeysOf(d)));
      }
      setStatus("idle");
      setCaption(d.text ?? "");
      speak(d.text ?? "");
    } catch (e) {
      setStatus("error");
      setCaption(e instanceof Error ? e.message : "Brief indisponible — réessaie.");
    }
  }, [veille, settings.healthRing]);

  /* ── Exécution des actions renvoyées par le routeur vocal ── */
  const runActions = useCallback((transcript: string, actions: DispatchAction[]) => {
    const agents = actions.filter((a) => a.type === "agent" && a.agentKey && a.request);
    const answer = actions.find((a) => a.type === "answer");
    const create = actions.find((a) => a.type === "create_alert" || a.type === "create_objective");
    const nav = actions.find((a) => a.type === "navigate" && a.href);
    const brief = actions.find((a) => a.type === "brief");
    const clarify = actions.find((a) => a.type === "clarify");

    // Mémoire de contexte : trace compacte de ce qui a été fait (désactivable).
    if (readTowerSettings().memory) {
      const outcome = [
        answer ? `réponse : ${answer.label} = ${answer.formatted ?? "n/a"}` : null,
        create ? `préparé ${create.type === "create_alert" ? "alerte" : "objectif"} « ${create.summary} »` : null,
        ...agents.map((a) => `briefé ${a.personaName} : ${(a.request ?? "").slice(0, 80)}`),
        nav ? `ouvert ${nav.href}` : null,
        brief ? "brief lu" : null,
        clarify && actions.length === 1 ? "incompris" : null,
      ].filter(Boolean).join(" ; ");
      pushHistory(transcript, outcome || "aucune action");
    }

    // File multi-agents désactivée : on ne garde que la première demande.
    const queueOn = readTowerSettings().queue;
    if (!queueOn && agents.length > 1) agents.splice(1);

    // 1) Réponse directe : parlée + affichée, avec option « creuser ».
    if (answer) {
      setFollowup(
        answer.followupAgentKey && answer.followupAsk
          ? { agentKey: answer.followupAgentKey, name: answer.followupName ?? "l'agent", ask: answer.followupAsk }
          : null,
      );
    }

    // 2) Création à valider : on parle, on affiche les boutons, on NE navigue pas.
    if (create?.payload) {
      setPending({ kind: create.type as PendingCreate["kind"], payload: create.payload, summary: create.summary ?? "" });
      // Les agents supplémentaires attendent dans la file (chip en bas de page).
      if (agents.length > 0) writeTowerQueue([...readTowerQueue(), ...agents.map((a) => ({ agentKey: a.agentKey!, agentLabel: a.agentLabel ?? "", personaName: a.personaName ?? "", request: a.request! }))]);
      setStatus("idle");
      setCaption(create.summary ?? "");
      speak([answer?.say, create.say].filter(Boolean).join(" "));
      return;
    }

    // 3) Brief demandé à la voix.
    if (brief) {
      speak(brief.say ?? "Voilà ton brief.", () => void runBrief());
      if (agents.length > 0) writeTowerQueue([...readTowerQueue(), ...agents.map((a) => ({ agentKey: a.agentKey!, agentLabel: a.agentLabel ?? "", personaName: a.personaName ?? "", request: a.request! }))]);
      return;
    }

    // 4) Redirection agent : le premier tout de suite, le reste en file.
    if (agents.length > 0) {
      const [first, ...rest] = agents;
      if (rest.length > 0) writeTowerQueue([...readTowerQueue(), ...rest.map((a) => ({ agentKey: a.agentKey!, agentLabel: a.agentLabel ?? "", personaName: a.personaName ?? "", request: a.request! }))]);
      const sayText = [answer?.say, first.say, rest.length > 0 ? `${rest.length === 1 ? "Une autre demande attend" : `${rest.length} autres demandes attendent`} en file.` : null]
        .filter(Boolean)
        .join(" ");
      setStatus("redirecting");
      setCaption(first.say ?? `Je t'ouvre ${first.personaName}…`);
      speak(sayText, () => {
        router.push(`/dashboard/agents/${first.agentKey}?ask=${encodeURIComponent(first.request!)}`);
      });
      return;
    }

    // 5) Navigation seule.
    if (nav?.href) {
      setStatus("redirecting");
      setCaption(nav.say ?? "");
      speak([answer?.say, nav.say].filter(Boolean).join(" "), () => router.push(nav.href!));
      return;
    }

    // 6) Réponse directe seule / clarification.
    setStatus("idle");
    if (answer) {
      setCaption(answer.say ?? "");
      speak(answer.say ?? "");
    } else if (clarify) {
      setCaption(clarify.say ?? "");
      speak(clarify.say ?? "");
    }
  }, [router, runBrief]);

  /* ── Dictée → dispatch multi-actions ── */
  const dispatch = useCallback(async (transcript: string) => {
    setStatus("thinking");
    setCaption(`« ${transcript} »`);
    setPending(null);
    setFollowup(null);
    const cur = readTowerSettings();
    // Phrase de brief personnalisée (« quoi de neuf » par défaut) : détectée
    // localement, le brief part sans passer par le routeur.
    const phrase = normalizePhrase(cur.briefPhrase || "quoi de neuf");
    if (cur.brief && phrase && normalizePhrase(transcript).includes(phrase)) {
      void runBrief();
      return;
    }
    try {
      const res = await fetch("/api/voice/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          history: cur.memory ? readHistory() : [],
          disabled: disabledDispatchTools(cur),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Routage impossible");
      const actions: DispatchAction[] = Array.isArray(d.actions) ? d.actions : [];
      if (actions.length === 0) throw new Error("Routage impossible");
      runActions(transcript, actions);
    } catch (e) {
      setStatus("error");
      setCaption(e instanceof Error ? e.message : "Une erreur est survenue — réessaie.");
    }
  }, [runActions, runBrief]);

  /* ── Validation / annulation d'une création dictée ── */
  const confirmPending = useCallback(async () => {
    if (!pending || creating) return;
    setCreating(true);
    try {
      const isAlert = pending.kind === "create_alert";
      const body = isAlert
        ? {
            ...pending.payload,
            description: "Alerte créée à la voix depuis la tour de contrôle.",
            impact: "Suivi automatique du seuil dicté à la voix.",
            severity: "warning",
          }
        : { ...pending.payload, description: "Objectif créé à la voix depuis la tour de contrôle." };
      const res = await fetch(isAlert ? "/api/alerts" : "/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Création impossible");
      const doneSay = isAlert ? "C'est fait — alerte créée et suivie." : "C'est fait — objectif créé et suivi.";
      setPending(null);
      setCaption(doneSay);
      speak(doneSay);
      pushHistory(pending.summary, isAlert ? "alerte créée" : "objectif créé");
      router.push(isAlert ? "/dashboard/mes-alertes" : "/dashboard/mes-alertes/objectifs");
    } catch (e) {
      setCaption(e instanceof Error ? e.message : "Création impossible — réessaie.");
      speak("La création a échoué — réessaie.");
    } finally {
      setCreating(false);
    }
  }, [pending, creating, router]);

  const cancelPending = useCallback(() => {
    setPending(null);
    setCaption("Annulé.");
    speak("Annulé.");
  }, []);

  const startListening = useCallback(() => {
    if (statusRef.current === "listening" || statusRef.current === "thinking" || statusRef.current === "redirecting") return;
    const rec = createRecognition();
    if (!rec) { setSupported(false); return; }
    // ÉCOUTE CONTINUE : en mode non-continu, le navigateur coupe au premier
    // silence court — impossible de finir sa phrase. Ici, c'est NOTRE détecteur
    // de fin qui décide : 2,5 s sans nouveau mot une fois qu'on a parlé
    // (respirations et hésitations tolérées), 9 s sans rien dire au départ,
    // 60 s de plafond absolu. Cliquer l'orbe arrête aussi manuellement.
    rec.continuous = true;
    recRef.current = rec;
    let finalText = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let capTimer: ReturnType<typeof setTimeout> | null = null;
    const clearTimers = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (capTimer) clearTimeout(capTimer);
      silenceTimer = null;
      capTimer = null;
    };
    const armSilence = (ms: number) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { try { rec.stop(); } catch { /* déjà stoppé */ } }, ms);
    };
    setStatus("listening");
    setCaption("Je t'écoute…");
    void startAudioLevel();
    armSilence(9000); // rien dit du tout → on rend la main
    capTimer = setTimeout(() => { try { rec.stop(); } catch { /* déjà stoppé */ } }, 60000);
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setCaption(`« ${(finalText + interim).trim()} »`);
      // Chaque nouveau mot repousse la fin : la phrase se termine sur un VRAI silence.
      if ((finalText + interim).trim()) armSilence(2500);
    };
    rec.onerror = (e) => {
      clearTimers();
      stopAudioLevel();
      setStatus(e.error === "no-speech" ? "idle" : "error");
      setCaption(e.error === "not-allowed" ? "Micro refusé — autorise-le dans le navigateur." : e.error === "no-speech" ? "" : "Je n'ai pas pu t'entendre — réessaie.");
    };
    rec.onend = () => {
      clearTimers();
      stopAudioLevel();
      const text = finalText.trim();
      if (text) void dispatch(text);
      else if (statusRef.current === "listening") { setStatus("idle"); setCaption(""); }
    };
    try { rec.start(); } catch { clearTimers(); setStatus("idle"); }
  }, [dispatch, startAudioLevel, stopAudioLevel]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  // ── Récap d'équipe (Paramètres → Tour de contrôle) : lu à voix haute. ──
  // Une fois ÉCOUTÉ jusqu'au bout : le texte du récap s'efface (retour au
  // texte par défaut) et le CTA du jour disparaît (mémorisé par jour —
  // le prochain récap programmé réaffichera le sien).
  const [recapDone, setRecapDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`revold:recap-done:${new Date().toDateString()}`);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      if (arr.length > 0) setRecapDone(new Set(arr));
    } catch { /* préférence indisponible → CTA affiché */ }
  }, []);
  const markRecapDone = useCallback((period: string, scope: string) => {
    setRecapDone((prev) => {
      const next = new Set(prev).add(`${period}:${scope}`);
      try {
        localStorage.setItem(`revold:recap-done:${new Date().toDateString()}`, JSON.stringify([...next]));
      } catch { /* rien */ }
      return next;
    });
  }, []);

  const runRecap = useCallback(async (period: string, scope: string) => {
    setStatus("thinking");
    setCaption("Je prépare ton récap…");
    try {
      const params = new URLSearchParams({ period, scope, team: readTowerSettings().recapTeam || "all" });
      const res = await fetch(`/api/voice/recap?${params}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.text) throw new Error(d.error || "Récap indisponible.");
      setStatus("idle");
      setCaption(String(d.text));
      speak(String(d.text), () => {
        // Écoute terminée : texte par défaut + CTA du jour retiré.
        setCaption("");
        markRecapDone(period, scope);
      });
    } catch (err) {
      setStatus("idle");
      setCaption(err instanceof Error ? err.message : "Récap indisponible — réessaie.");
    }
  }, [markRecapDone]);

  // ── Appel vocal mains libres (« Hey Revold ») : écoute discrète de la
  // phrase d'appel quand l'onglet est visible, le micro DÉJÀ autorisé et
  // l'orbe au repos — l'entendre déclenche l'écoute active. ──
  useEffect(() => {
    if (!settings.wakeWord || !supported) return;
    let stopped = false;
    let rec: SpeechRecognitionLike | null = null;
    const phrase = normalizePhrase(settings.wakePhrase || "Hey Revold");
    if (!phrase) return;

    const start = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      if (statusRef.current !== "idle") { setTimeout(() => void start(), 2000); return; }
      // Jamais de prompt micro surprise : l'écoute mains libres ne démarre que
      // si la permission a déjà été accordée (une dictée cliquée l'accorde).
      try {
        const perm = await navigator.permissions?.query?.({ name: "microphone" as PermissionName });
        if (perm && perm.state !== "granted") return;
      } catch { /* API permissions absente → on tente, le navigateur arbitre */ }
      rec = createRecognition();
      if (!rec) return;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let heard = "";
        for (let i = e.resultIndex; i < e.results.length; i++) heard += `${e.results[i][0].transcript} `;
        if (normalizePhrase(heard).includes(phrase)) {
          try { rec?.stop(); } catch { /* déjà stoppé */ }
          rec = null;
          startListening();
        }
      };
      rec.onerror = () => { /* onend relance */ };
      rec.onend = () => {
        rec = null;
        if (!stopped) setTimeout(() => void start(), 1500);
      };
      try { rec.start(); } catch { /* une autre reconnaissance tourne — onend relancera */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void start();
      else { try { rec?.stop(); } catch { /* rien */ } }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void start();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try { rec?.stop(); } catch { /* rien */ }
    };
  }, [settings.wakeWord, settings.wakePhrase, supported, startListening]);

  // ── CTA récap du moment : lundi = semaine passée, vendredi = semaine en
  // cours ; premiers jours du mois/trimestre = période écoulée. ──
  // (Horloge du client — recalculée à chaque rendu, pas de dérive serveur.)
  const recapCta = (() => {
    const now = new Date();
    const day = now.getDay();
    const dom = now.getDate();
    const cta =
      settings.recapWeekly && day === 1
        ? { label: "Récap de la semaine passée", period: "week", scope: "last" }
        : settings.recapWeekly && day === 5
          ? { label: "Récap de la semaine en cours", period: "week", scope: "current" }
          : settings.recapQuarterly && now.getMonth() % 3 === 0 && dom <= 7
            ? { label: "Récap du trimestre passé", period: "quarter", scope: "last" }
            : settings.recapMonthly && dom <= 3
              ? { label: "Récap du mois passé", period: "month", scope: "last" }
              : null;
    // Déjà écouté aujourd'hui → le CTA disparaît jusqu'au prochain récap programmé.
    if (cta && recapDone.has(`${cta.period}:${cta.scope}`)) return null;
    return cta;
  })();

  const busy = status === "thinking" || status === "redirecting";
  // Anneau : écoute > santé critique > contenu du brief accompli (vert) > santé.
  const ringClass =
    status === "listening"
      ? "border-amber-300/50"
      : health === "critical"
        ? HEALTH_RING.critical
        : achieved
          ? "border-emerald-300/70 shadow-[0_0_14px_rgba(52,211,153,0.4)]"
          : health
            ? HEALTH_RING[health]
            : "border-amber-200/0 group-hover:border-amber-200/30";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => (status === "listening" ? stopListening() : startListening())}
        disabled={busy || !supported}
        title={
          !supported
            ? "Dictée vocale non supportée par ce navigateur"
            : status === "listening"
              ? "Terminer la dictée"
              : achieved && health !== "critical"
                ? "Parler à Revold — Bonne nouvelle : un contenu de ton brief est atteint ou exécuté, demande ton brief."
                : health
                  ? `Parler à Revold — ${HEALTH_HINT[health]}`
                  : "Parler à Revold"
        }
        className="group relative rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300"
        style={{ width: size, height: size }}
        aria-label="Parler à Revold"
      >
        <canvas ref={canvasRef} style={{ width: size, height: size }} className="pointer-events-none" />
        {/* Logo Revold en filigrane — très fondu, au cœur de l'orbe */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" width={size * 0.26} height={size * 0.26} fill="none" stroke={isLight ? "rgba(88,28,135,0.35)" : "rgba(255,255,255,0.34)"} strokeWidth="1.1" strokeLinecap="round" className={isLight ? "drop-shadow-[0_0_6px_rgba(147,51,234,0.3)]" : "drop-shadow-[0_0_6px_rgba(240,171,252,0.35)]"}>
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
            <line x1="19.8" y1="7.5" x2="4.2" y2="16.5" />
            <path d="M12 3l-1.6 1.9M12 3l1.6 1.9M12 21l-1.6-1.9M12 21l1.6-1.9" />
            <path d="M4.2 7.5l2.4.3M4.2 16.5l2.4-.3M19.8 7.5l-2.4.3M19.8 16.5l-2.4-.3" />
          </svg>
        </span>
        {/* Anneau de santé : vert / ambre / rouge selon l'état du compte */}
        <span className={`pointer-events-none absolute inset-3 rounded-full border transition ${ringClass}`} />
      </button>

      {/* Zone de texte contenue : les briefs longs défilent au lieu de déborder
          sur le bouton veille et le pied de la carte. Au repos, l'orbe VERTE
          (contenu du brief accompli) explique sa couleur ici — même style que
          le texte par défaut, seule la couleur de l'orbe change. */}
      <p className="mt-1 max-h-20 min-h-8 w-full max-w-[17rem] overflow-y-auto px-1 text-center text-[11px] leading-snug text-slate-400">
        {!supported
          ? "Dictée vocale non supportée par ce navigateur."
          : caption ||
            (status === "idle"
              ? achieved
                ? "Bonne nouvelle : un contenu de ton brief est atteint ou exécuté."
                : "Clique et dicte ta demande — je réponds, je briefe le bon agent ou je crée ton alerte."
              : "")}
      </p>

      {/* Validation d'une création dictée (alerte / objectif) */}
      {pending && (
        <div className="mt-2 w-full max-w-[16rem] rounded-lg border border-amber-300/30 bg-amber-400/10 p-2 text-center">
          <p className={`text-[11px] leading-snug ${isLight ? "text-amber-900" : "text-amber-100"}`}>{pending.summary}</p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void confirmPending()}
              disabled={creating}
              className="rounded-md bg-amber-300 px-3 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-amber-200 disabled:opacity-50"
            >
              {creating ? "Création…" : "Valider"}
            </button>
            <button
              type="button"
              onClick={cancelPending}
              disabled={creating}
              className={`rounded-md border px-3 py-1 text-[11px] font-medium transition ${isLight ? "border-slate-300 text-slate-600 hover:bg-slate-100" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Après une réponse directe : creuser avec l'agent pertinent */}
      {!pending && followup && (
        <button
          type="button"
          onClick={() => router.push(`/dashboard/agents/${followup.agentKey}?ask=${encodeURIComponent(followup.ask)}`)}
          className={`mt-2 rounded-md border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-medium transition hover:bg-amber-400/20 ${isLight ? "text-amber-700" : "text-amber-200"}`}
        >
          Creuser avec {followup.name} →
        </button>
      )}

      {/* Brief du jour — le mode veille se règle dans Paramètres → Tour de
          contrôle (pas de toggle en doublon sur la home). Le CTA récap suit
          les périodes cochées : lundi/vendredi (semaine), début de mois ou de
          trimestre (période écoulée). */}
      {(settings.brief || recapCta) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {settings.brief && (
            <button
              type="button"
              onClick={() => void runBrief()}
              disabled={busy || status === "listening"}
              className={`rounded-md border px-3 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                isLight
                  ? "border-slate-300 bg-white text-slate-700 hover:border-fuchsia-300 hover:text-fuchsia-700"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-300/40 hover:text-amber-200"
              }`}
            >
              Brief du jour
            </button>
          )}
          {recapCta && (
            <button
              type="button"
              onClick={() => void runRecap(recapCta.period, recapCta.scope)}
              disabled={busy || status === "listening"}
              className={`rounded-md border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                isLight
                  ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                  : "border-amber-300/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
              }`}
            >
              {recapCta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Variante VERROUILLÉE de la tour de contrôle (plan Starter) : même
 * emplacement, orbe éteinte, invitation à passer au plan Business.
 */
export function RevoldControlTowerLocked() {
  const isLight = useIsLightTheme();
  return (
    // MÊME FOND que le bloc « équipe d'agents IA » (card + dégradé) : la carte
    // se fond dans le thème — c'est l'orbe et les textes qui s'adaptent.
    <div className="card relative flex h-full overflow-hidden">
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-5">
        <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Revold · Tour de contrôle
        </p>
        <div className={`relative z-10 my-3 flex h-16 w-16 items-center justify-center rounded-full border text-2xl grayscale ${isLight ? "border-slate-300 bg-slate-100" : "border-slate-700 bg-slate-900"}`}>
          🔒
        </div>
        <p className="relative z-10 text-center text-xs leading-relaxed text-slate-400">
          Commande tes agents à la voix, façon Jarvis : brief santé, navigation et
          agents briefés à la dictée.
        </p>
        <a
          href="/dashboard/mon-compte/facturation"
          className={`relative z-10 mt-3 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-400/20 ${isLight ? "text-amber-700" : "text-amber-200"}`}
        >
          Disponible dès le plan Business →
        </a>
      </div>
    </div>
  );
}

/** Carte « tour de contrôle » de la home — à droite du bloc équipe IA. */
export function RevoldControlTower() {
  const isLight = useIsLightTheme();
  return (
    // MÊME FOND que le bloc « équipe d'agents IA » (card + dégradé fuchsia →
    // blanc → indigo, remappé par les thèmes sombres) : la carte se fond dans
    // le thème — l'orbe passe en violet FONCÉ sur fond clair pour rester
    // visible, en doré/pâle sur les fonds sombres.
    <div className="card relative flex h-full overflow-hidden">
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-5">
      {/* halo discret au cœur de la carte */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(217,70,239,0.12),transparent_60%)]" />
      <p className={`relative z-10 text-[10px] font-semibold uppercase tracking-[0.25em] ${isLight ? "text-amber-600/90" : "text-amber-200/70"}`}>
        Revold · Tour de contrôle
      </p>
      {/* Réglages : fonctionnement détaillé + activation par fonctionnalité */}
      <a
        href="/dashboard/parametres/tour-de-controle"
        title="Personnaliser la tour de contrôle"
        aria-label="Personnaliser la tour de contrôle"
        className="absolute right-3 top-3 z-10 text-slate-600 transition hover:text-amber-200"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </a>
      <div className="relative z-10 -my-1">
        <RevoldOrb />
      </div>
      </div>
    </div>
  );
}
