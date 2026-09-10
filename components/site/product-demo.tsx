"use client";

import { useEffect, useRef, useState } from "react";

/**
 * DÉMO PRODUIT animée (home marketing) — auto-play ~45 s, 6 scènes en boucle,
 * chaque scène met en scène une VRAIE feature à impact. Pas une vidéo MP4 :
 * une animation 100 % code (comme Linear/Vercel) — nette, légère, sans lecteur.
 * Respecte prefers-reduced-motion (pas d'auto-play, navigation par points).
 */

type Scene = { tag: string; title: string; impact: string; render: () => React.ReactNode };

const fmtEur = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

/** Compteur animé (rAF) — remonté à chaque scène active via `key`. */
function CountUp({ to, dur = 1100, prefix = "", suffix = "" }: { to: number; dur?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return <>{prefix}{fmtEur(v)}{suffix}</>;
}

/** Petit graphe en barres qui « pousse ». */
function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex-1 origin-bottom rounded-t bg-gradient-to-t from-fuchsia-500/70 to-indigo-400/70 demo-grow-y" style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

const SCENES: Scene[] = [
  {
    tag: "Réconciliation CRM × facturation",
    title: "L'écart signé vs encaissé, révélé",
    impact: "Le CA vendu jamais facturé, retrouvé — au centime, par SIREN.",
    render: () => (
      <div className="grid w-full gap-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "Signé (CRM)", v: 128000, c: "text-slate-200" },
            { k: "Encaissé", v: 96000, c: "text-emerald-300" },
            { k: "Écart révélé", v: 32000, c: "text-rose-300" },
          ].map((s, i) => (
            <div key={s.k} className="demo-fade rounded-xl border border-white/10 bg-white/[0.04] p-3" style={{ animationDelay: `${i * 140}ms` }}>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.k}</p>
              <p className={`mt-1 text-lg font-bold tabular-nums ${s.c}`}><CountUp to={s.v} prefix="" suffix=" €" /></p>
            </div>
          ))}
        </div>
        <div className="demo-fade rounded-xl border border-white/10 bg-white/[0.03] p-3" style={{ animationDelay: "420ms" }}>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-200">Deal #4472</span>
            <span className="text-slate-500">→</span>
            <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-fuchsia-200">3 factures</span>
            <span className="text-slate-500">→</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-200">encaissé</span>
            <span className="ml-auto rounded bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-200">1 facture manquante</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 demo-grow-x" style={{ width: "75%" }} />
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "Tour de contrôle vocal",
    title: "Votre brief business, à la voix",
    impact: "Chaque matin, l'essentiel dit en 30 s — sans ouvrir un dashboard.",
    render: () => (
      <div className="flex w-full flex-col items-center gap-4 py-2">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-fuchsia-500/20 demo-ping" />
          <span className="absolute inset-2 rounded-full bg-indigo-500/20 demo-ping" style={{ animationDelay: "600ms" }} />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 shadow-lg shadow-fuchsia-500/40">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10a7 7 0 0 1-14 0M12 17v4" /></svg>
          </span>
        </div>
        <div className="demo-type w-full max-w-md overflow-hidden whitespace-nowrap border-r-2 border-fuchsia-400/70 text-center text-sm text-slate-200">
          « Bonjour. 3 alertes : Dupont SAS +18 % de MRR, 2 impayés &gt; 45 j… »
        </div>
      </div>
    ),
  },
  {
    tag: "Alertes intelligentes",
    title: "Le problème détecté avant qu'il coûte",
    impact: "Un seuil franchi côté cash ou pipe → vous êtes prévenu, pas surpris.",
    render: () => (
      <div className="grid w-full gap-3">
        <div className="demo-fade rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>DSO (délai de paiement)</span>
            <span className="font-semibold text-rose-300">47 j · seuil 45 j</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-amber-400 to-rose-500 demo-grow-x" style={{ width: "88%" }} />
          </div>
        </div>
        <div className="demo-slide flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3" style={{ animationDelay: "500ms" }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-200">⚠</span>
          <p className="text-sm text-rose-100">Impayés &gt; 45 j sur <span className="font-semibold">3 comptes</span> · 41 200 € — relance recommandée.</p>
        </div>
      </div>
    ),
  },
  {
    tag: "Boîte d'actions",
    title: "Valider, c'est fait — dans vos outils",
    impact: "L'IA propose, vous validez, Revold exécute dans HubSpot / Stripe.",
    render: () => (
      <div className="grid w-full gap-3">
        <div className="demo-fade rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Relancer la facture #4472</p>
              <p className="text-[11px] text-slate-400">Dupont SAS · 12 400 € · échue depuis 12 j</p>
            </div>
            <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-400">HubSpot</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="demo-btn rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Valider</span>
            <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">Rejeter</span>
            <span className="demo-check ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-300">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Exécuté
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "Groupes multi-entités",
    title: "Vos groupes consolidés, automatiquement",
    impact: "Société mère ↔ filiales rapprochées par le registre — plus de silos.",
    render: () => (
      <div className="flex w-full flex-col items-center gap-2 py-1">
        <div className="demo-fade rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-100">Groupe Dupont (SIREN 552…)</div>
        <div className="h-4 w-px bg-white/15" />
        <div className="grid grid-cols-3 gap-2">
          {["Dupont Lyon", "Dupont Paris", "Dupont Sud"].map((c, i) => (
            <div key={c} className="demo-pop rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-[11px] text-slate-300" style={{ animationDelay: `${300 + i * 160}ms` }}>{c}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "Cockpit cross-source",
    title: "CRM × facturation × trésorerie",
    impact: "Une seule vérité, réconciliée — le pilotage, pas le reporting.",
    render: () => (
      <div className="grid w-full gap-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { k: "MRR", v: 84000, s: " €" },
            { k: "ARR", v: 1008000, s: " €" },
            { k: "Marge", v: 38, s: " %" },
            { k: "Runway", v: 14, s: " mois" },
          ].map((t, i) => (
            <div key={t.k} className="demo-fade rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center" style={{ animationDelay: `${i * 120}ms` }}>
              <p className="text-[9px] uppercase tracking-wide text-slate-500">{t.k}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-white"><CountUp to={t.v} suffix={t.s} /></p>
            </div>
          ))}
        </div>
        <div className="demo-fade rounded-xl border border-white/10 bg-white/[0.03] p-3" style={{ animationDelay: "520ms" }}>
          <MiniBars values={[42, 55, 48, 63, 71, 68, 84]} />
        </div>
      </div>
    ),
  },
];

const SCENE_MS = 7500; // 6 × 7,5 s = 45 s

export function ProductDemo() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Lecture de la préférence système au montage (SSR-safe : initial = false,
    // synchronisé ici) + abonnement aux changements.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    timer.current = setTimeout(() => setActive((a) => (a + 1) % SCENES.length), SCENE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active, paused, reduced]);

  const scene = SCENES[active];

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Fenêtre app façon navigateur */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-indigo-950/40 backdrop-blur"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />

        {/* Barre navigateur */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-center text-[11px] text-slate-500">app.revold.ai — {scene.tag}</span>
          <span className="hidden items-center gap-1 text-[10px] font-medium text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Démo · 45 s
          </span>
        </div>

        {/* Scène */}
        <div className="relative min-h-[248px] px-5 py-6 sm:px-8">
          <div key={active} className="demo-scene flex h-full flex-col">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200">{scene.tag}</span>
            </div>
            <div className="flex flex-1 items-center">{scene.render()}</div>
            <div className="mt-4">
              <p className="text-base font-semibold text-white">{scene.title}</p>
              <p className="mt-0.5 text-sm text-slate-400">{scene.impact}</p>
            </div>
          </div>
        </div>

        {/* Frise / timeline (segments = scènes) */}
        <div className="flex gap-1.5 px-5 pb-4 sm:px-8">
          {SCENES.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              aria-label={`Voir : ${s.tag}`}
              onClick={() => setActive(i)}
              className="group relative h-1 flex-1 overflow-hidden rounded-full bg-white/10"
            >
              <span
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-400 ${i < active ? "w-full" : "w-0"} ${i === active && !paused && !reduced ? "demo-progress" : ""}`}
                style={i === active && (paused || reduced) ? { width: "100%" } : undefined}
              />
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-500">
        Démo interactive — survolez pour mettre en pause, cliquez un segment pour naviguer.
      </p>

      {/* Animations (scopées par les classes demo-*). */}
      <style>{`
        @keyframes demoScene { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes demoFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes demoGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes demoGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes demoPop { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes demoPing { 0% { transform: scale(0.9); opacity: 0.6; } 70%,100% { transform: scale(1.6); opacity: 0; } }
        @keyframes demoType { from { width: 0; } to { width: 100%; } }
        @keyframes demoBtn { 0%,55% { box-shadow: 0 0 0 0 rgba(232,121,249,0); } 60% { box-shadow: 0 0 0 4px rgba(232,121,249,0.35); } 75%,100% { box-shadow: 0 0 0 0 rgba(232,121,249,0); } }
        @keyframes demoCheck { 0%,60% { opacity: 0; transform: translateX(6px); } 78%,100% { opacity: 1; transform: none; } }
        @keyframes demoProgress { from { width: 0; } to { width: 100%; } }
        .demo-scene { animation: demoScene 0.5s ease-out both; }
        .demo-fade { animation: demoFade 0.5s ease-out both; }
        .demo-grow-x { animation: demoGrowX 1s ease-out both; }
        .demo-grow-y { animation: demoGrowY 0.7s ease-out both; }
        .demo-pop { animation: demoPop 0.45s ease-out both; }
        .demo-ping { animation: demoPing 2s ease-out infinite; }
        .demo-type { animation: demoType 2.6s steps(48) both; }
        .demo-btn { animation: demoBtn 3.2s ease-out both; }
        .demo-check { animation: demoCheck 3.2s ease-out both; }
        .demo-progress { animation: demoProgress ${SCENE_MS}ms linear both; }
        @media (prefers-reduced-motion: reduce) {
          .demo-scene, .demo-fade, .demo-grow-x, .demo-grow-y, .demo-pop, .demo-ping, .demo-type, .demo-btn, .demo-check, .demo-progress { animation: none !important; }
          .demo-type { width: 100%; border-right: 0; }
        }
      `}</style>
    </div>
  );
}
