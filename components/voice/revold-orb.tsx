"use client";

/**
 * Orbe vocale « Revold » — la tour de contrôle de la home (style Jarvis).
 *
 * Sphère de particules dorées animée sur canvas : rotation lente au repos,
 * pulsation réactive au NIVEAU RÉEL du micro pendant l'écoute (AnalyserNode),
 * logo Revold en filigrane très fondu au centre.
 *
 * Rôle 100 % vocal : un clic → dictée (Web Speech API), la demande est routée
 * vers l'agent/coach pertinent (/api/voice/dispatch), confirmée à l'oral
 * (SpeechSynthesis), puis redirection vers sa page de chat avec la demande
 * EXÉCUTÉE automatiquement (?ask=…).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type OrbStatus = "idle" | "listening" | "thinking" | "redirecting" | "error";

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

function speak(text: string, onDone?: () => void) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1.05;
    if (onDone) u.onend = onDone;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    if (onDone) {
      // Filet : si la synthèse est indisponible/silencieuse, on continue quand même.
      setTimeout(onDone, Math.min(6000, 1500 + text.length * 60));
    }
  } catch {
    onDone?.();
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

export function RevoldOrb({ size = 210 }: { size?: number }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<OrbStatus>("idle");
  const [caption, setCaption] = useState<string>("");
  const [supported, setSupported] = useState(true);

  const statusRef = useRef<OrbStatus>("idle");
  statusRef.current = status;
  const levelRef = useRef(0); // niveau micro 0..1 (lissé)
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  useEffect(() => {
    setSupported(!!createRecognition());
  }, []);

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

      // Halo / cœur lumineux doré
      const glow = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.55);
      const coreAlpha = s === "listening" ? 0.5 + level * 0.4 : s === "idle" ? 0.32 + 0.05 * Math.sin(t * 1.8) : 0.5;
      glow.addColorStop(0, `rgba(253, 224, 150, ${coreAlpha})`);
      glow.addColorStop(0.45, `rgba(245, 190, 90, ${coreAlpha * 0.35})`);
      glow.addColorStop(1, "rgba(245, 190, 90, 0)");
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
        g.fillStyle = `rgba(250, 210, 120, ${alpha})`;
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

  /* ── Dictée → dispatch → redirection ── */
  const dispatch = useCallback(async (transcript: string) => {
    setStatus("thinking");
    setCaption(`« ${transcript} »`);
    try {
      const res = await fetch("/api/voice/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Routage impossible");
      if (d.clarify) {
        setStatus("idle");
        setCaption(d.clarify);
        speak(d.clarify);
        return;
      }
      setStatus("redirecting");
      setCaption(d.say ?? `Je t'ouvre ${d.personaName}…`);
      speak(d.say ?? `Je t'ouvre ${d.personaName}.`, () => {
        router.push(`/dashboard/agents/${d.agentKey}?ask=${encodeURIComponent(d.request)}`);
      });
    } catch (e) {
      setStatus("error");
      setCaption(e instanceof Error ? e.message : "Une erreur est survenue — réessaie.");
    }
  }, [router]);

  const startListening = useCallback(() => {
    if (statusRef.current === "listening" || statusRef.current === "thinking" || statusRef.current === "redirecting") return;
    const rec = createRecognition();
    if (!rec) { setSupported(false); return; }
    recRef.current = rec;
    let finalText = "";
    setStatus("listening");
    setCaption("Je t'écoute…");
    void startAudioLevel();
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setCaption(`« ${(finalText + interim).trim()} »`);
    };
    rec.onerror = (e) => {
      stopAudioLevel();
      setStatus(e.error === "no-speech" ? "idle" : "error");
      setCaption(e.error === "not-allowed" ? "Micro refusé — autorise-le dans le navigateur." : e.error === "no-speech" ? "" : "Je n'ai pas pu t'entendre — réessaie.");
    };
    rec.onend = () => {
      stopAudioLevel();
      const text = finalText.trim();
      if (text) void dispatch(text);
      else if (statusRef.current === "listening") { setStatus("idle"); setCaption(""); }
    };
    try { rec.start(); } catch { setStatus("idle"); }
  }, [dispatch, startAudioLevel, stopAudioLevel]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const busy = status === "thinking" || status === "redirecting";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => (status === "listening" ? stopListening() : startListening())}
        disabled={busy || !supported}
        title={!supported ? "Dictée vocale non supportée par ce navigateur" : status === "listening" ? "Terminer la dictée" : "Parler à Revold"}
        className="group relative rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300"
        style={{ width: size, height: size }}
        aria-label="Parler à Revold"
      >
        <canvas ref={canvasRef} style={{ width: size, height: size }} className="pointer-events-none" />
        {/* Logo Revold en filigrane — très fondu, au cœur de l'orbe */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" width={size * 0.26} height={size * 0.26} fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="1.1" strokeLinecap="round" className="drop-shadow-[0_0_6px_rgba(253,224,150,0.35)]">
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
            <line x1="19.8" y1="7.5" x2="4.2" y2="16.5" />
            <path d="M12 3l-1.6 1.9M12 3l1.6 1.9M12 21l-1.6-1.9M12 21l1.6-1.9" />
            <path d="M4.2 7.5l2.4.3M4.2 16.5l2.4-.3M19.8 7.5l-2.4.3M19.8 16.5l-2.4-.3" />
          </svg>
        </span>
        {/* Anneau discret au survol / écoute */}
        <span
          className={`pointer-events-none absolute inset-3 rounded-full border transition ${
            status === "listening" ? "border-amber-300/50" : "border-amber-200/0 group-hover:border-amber-200/30"
          }`}
        />
      </button>

      <p className="mt-1 min-h-8 max-w-[16rem] text-center text-[11px] leading-snug text-slate-500">
        {!supported
          ? "Dictée vocale non supportée par ce navigateur."
          : caption || (status === "idle" ? "Clique et dicte ta demande — je briefe le bon agent et je t'y emmène." : "")}
      </p>
    </div>
  );
}

/** Carte « tour de contrôle » de la home — à droite du bloc équipe IA. */
export function RevoldControlTower() {
  return (
    <div className="card relative flex h-full flex-col items-center justify-center overflow-hidden bg-slate-950 p-5">
      {/* fond nocturne discret */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(245,190,90,0.12),transparent_60%)]" />
      <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/70">
        Revold · Tour de contrôle
      </p>
      <div className="relative z-10 -my-1">
        <RevoldOrb />
      </div>
      <p className="relative z-10 text-center text-xs leading-relaxed text-slate-400">
        Appelle un agent ou un coach à la voix : je le briefe avec ta demande
        et je t&apos;emmène directement sur son chat, réponse en cours.
      </p>
    </div>
  );
}
