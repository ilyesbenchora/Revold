"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "revold:theme";
type Theme = "light" | "violet-dark";

/**
 * Paramètres → Apparence : choix du thème de la plateforme. Le mode sombre
 * « violet fuchsia » pose data-theme="violet-dark" sur <html> (repris avant le
 * premier rendu par le script anti-flash du layout racine) ; le remap des
 * couleurs vit dans globals.css, scoping .dashboard-shell.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(THEME_KEY) === "violet-dark") setTheme("violet-dark");
    } catch {
      /* stockage indisponible */
    }
    setHydrated(true);
  }, []);

  // Applique le thème au DOM (attribut sur <html>) — via effet, après choix.
  useEffect(() => {
    if (!hydrated) return;
    if (theme === "violet-dark") document.documentElement.setAttribute("data-theme", "violet-dark");
    else document.documentElement.removeAttribute("data-theme");
  }, [theme, hydrated]);

  function apply(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* stockage indisponible : le thème vaut pour la session courante */
    }
  }

  const options: { key: Theme; label: string; hint: string; preview: React.ReactNode }[] = [
    {
      key: "light",
      label: "Clair",
      hint: "Le thème Revold par défaut, fond clair.",
      preview: (
        <div className="h-20 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="h-2 w-1/3 rounded-full bg-slate-300" />
          <div className="mt-2 flex items-end gap-1.5">
            {[10, 16, 8, 20, 13].map((h, i) => (
              <div key={i} className="w-4 rounded-t bg-gradient-to-t from-indigo-400 to-fuchsia-400" style={{ height: h * 2 }} />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "violet-dark",
      label: "Sombre violet",
      hint: "Fond violet nuit, accents fuchsia néon — lisible et moderne.",
      preview: (
        <div className="h-20 w-full overflow-hidden rounded-lg border border-fuchsia-500/30 bg-[#150a26] p-2">
          <div className="h-2 w-1/3 rounded-full bg-[#4a2f78]" />
          <div className="mt-2 flex items-end gap-1.5">
            {[10, 16, 8, 20, 13].map((h, i) => (
              <div
                key={i}
                className="w-4 rounded-t bg-gradient-to-t from-indigo-500 to-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                style={{ height: h * 2 }}
              />
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
        {options.map((o) => {
          const active = hydrated && theme === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => apply(o.key)}
              aria-pressed={active}
              className={`rounded-xl border-2 p-3 text-left transition ${
                active
                  ? "border-fuchsia-400 bg-fuchsia-50 shadow-[0_0_18px_-6px_rgba(217,70,239,0.5)]"
                  : "border-slate-200 bg-white hover:border-fuchsia-200"
              }`}
            >
              {o.preview}
              <div className="mt-2.5 flex items-center gap-2">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? "border-fuchsia-500 bg-fuchsia-500" : "border-slate-300 bg-white"}`}>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-sm font-semibold text-slate-900">{o.label}</span>
                {o.key === "violet-dark" && (
                  <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    Nouveau
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{o.hint}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Le thème s&apos;applique à toute la plateforme, immédiatement et à chaque visite (préférence enregistrée sur cet
        appareil).
      </p>
    </div>
  );
}
