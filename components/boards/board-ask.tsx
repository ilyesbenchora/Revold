"use client";

import { useRef, useState } from "react";
import { DictationButton } from "@/components/dictation-button";

/**
 * Tableau de bord CONVERSATIONNEL — un champ de question posé sur le tableau :
 * « Pourquoi le CA baisse en mars ? », « Combien de deals gagnés ce mois ? ».
 * La réponse vient de /api/boards/ask : l'agent recalcule les chiffres via le
 * moteur déterministe (jamais un chiffre inventé), contextualisé par la
 * composition réelle du tableau. Les suivis fonctionnent (« et en avril ? ») :
 * les 3 derniers échanges repartent avec la question.
 */

type Exchange = { q: string; a: string };

export function BoardAsk({ pageKey }: { pageKey: string }) {
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const history = exchanges.slice(-3).flatMap((e) => [
        { role: "user", content: e.q },
        { role: "assistant", content: e.a },
      ]);
      const res = await fetch("/api/boards/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, question: q, history }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.text !== "string") {
        setError(d.error ?? "Réponse impossible — réessaie.");
        return;
      }
      setExchanges((prev) => [...prev.slice(-4), { q, a: d.text }]);
      setQuestion("");
    } catch {
      setError("Réponse impossible — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-fuchsia-200/60 bg-gradient-to-r from-fuchsia-50/40 via-white to-white p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base leading-none">✨</span>
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Pose une question sur ce tableau — « pourquoi le CA baisse ce mois ? », « combien de deals gagnés ? »…"
          disabled={busy}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
        <DictationButton onText={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} title="Dicter la question" />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || !question.trim()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
        >
          {busy ? "Je calcule…" : "Demander"}
        </button>
      </div>

      {error && <p className="mt-2 px-6 text-xs text-rose-600">{error}</p>}

      {exchanges.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-fuchsia-100 px-1 pt-3">
          {exchanges.map((e, i) => (
            <div key={i}>
              <p className="text-[11px] font-medium text-slate-400">« {e.q} »</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{e.a}</p>
            </div>
          ))}
          <p className="text-[10px] text-slate-400">
            Chiffres recalculés en direct sur tes données synchronisées — jamais inventés.{" "}
            <button
              type="button"
              onClick={() => setExchanges([])}
              className="font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              Effacer
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
