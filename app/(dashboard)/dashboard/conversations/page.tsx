export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { InsightLockedBlock } from "@/components/insight-locked-block";

const fmtDuration = (s: number | null) => {
  if (!s || s < 0) return "—";
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return min > 0 ? `${min}min ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type Conversation = {
  id: string;
  provider: string;
  provider_id: string;
  title: string | null;
  source: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  user_email: string | null;
  participants: Array<{ first_name?: string; last_name?: string; email?: string; phone_number?: string }>;
  insights: Record<string, unknown>;
  scores: Record<string, number>;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
};

export default async function ConversationsPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("organization_id", orgId)
    .order("recorded_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const conversations = (data ?? []) as Conversation[];

  // Stats globales
  const totalDuration = conversations.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
  const distinctSales = new Set(conversations.map((c) => c.user_email).filter(Boolean)).size;
  const last7d = conversations.filter(
    (c) => c.recorded_at && new Date(c.recorded_at).getTime() > Date.now() - 7 * 86400000,
  ).length;

  // Avg insights
  const talkRatios = conversations
    .map((c) => Number(c.insights.talk_ratio))
    .filter((n) => !isNaN(n));
  const avgTalkRatio = talkRatios.length > 0
    ? Math.round(talkRatios.reduce((a, b) => a + b, 0) / talkRatios.length)
    : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Conversations IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Transcription + analyse des appels commerciaux via Praiz.
          {conversations.length > 0 && ` ${conversations.length} conversation${conversations.length > 1 ? "s" : ""} synchronisée${conversations.length > 1 ? "s" : ""}.`}
        </p>
      </header>

      <InsightLockedBlock
        previewTitle="Analyse IA de vos conversations commerciales"
        previewBody="Revold croise les transcriptions Praiz avec vos deals HubSpot pour identifier les patterns gagnants : objections récurrentes, talk ratio idéal, mots-clés des deals fermés."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Conversations totales</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{conversations.length}</p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">7 derniers jours</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{last7d}</p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Sales actifs</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">{distinctSales}</p>
        </article>
        <article className="card p-4">
          <p className="text-[10px] font-medium uppercase text-slate-500">Talk ratio moyen</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              avgTalkRatio == null
                ? "text-slate-400"
                : avgTalkRatio > 60
                ? "text-rose-600"
                : avgTalkRatio < 40
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {avgTalkRatio != null ? `${avgTalkRatio}%` : "—"}
          </p>
        </article>
      </div>

      {/* Empty state */}
      {conversations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-base font-medium text-slate-900">Aucune conversation synchronisée</p>
          <p className="mt-2 text-sm text-slate-600">
            Connectez Praiz dans la page Intégration pour commencer à recevoir les transcriptions
            et analyses IA de vos appels commerciaux.
          </p>
          <Link
            href="/dashboard/integration/connect/praiz"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            🎙️ Connecter Praiz
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            Durée setup : ~10 min (contact hello@praiz.io pour l&apos;accès API)
          </p>
        </div>
      )}

      {/* Liste */}
      {conversations.length > 0 && (
        <div className="space-y-3">
          {conversations.map((c) => {
            const externalParticipants = c.participants.filter(
              (p) => p.email && p.email !== c.user_email,
            );
            const objections = (c.insights.objections as string[] | undefined) ?? [];
            const sentiment = c.insights.sentiment as string | undefined;
            const nextSteps = (c.insights.next_steps as string[] | undefined) ?? [];
            const talkRatio = c.insights.talk_ratio as number | undefined;

            return (
              <article key={c.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{c.title || "Sans titre"}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.source && <span className="capitalize">{c.source} · </span>}
                      {fmtDuration(c.duration_seconds)} · {fmtDate(c.recorded_at)}
                      {c.user_email && <span> · par {c.user_email}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sentiment && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          sentiment === "positive" || sentiment === "très positif"
                            ? "bg-emerald-100 text-emerald-700"
                            : sentiment === "negative" || sentiment === "négatif"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {sentiment}
                      </span>
                    )}
                    {talkRatio != null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          talkRatio > 60
                            ? "bg-rose-100 text-rose-700"
                            : talkRatio < 40
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        Talk {talkRatio}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 p-5 md:grid-cols-2">
                  {/* Participants */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Participants externes
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs">
                      {externalParticipants.length === 0 && (
                        <li className="text-slate-400">Aucun participant externe</li>
                      )}
                      {externalParticipants.map((p, i) => (
                        <li key={i} className="text-slate-700">
                          {[p.first_name, p.last_name].filter(Boolean).join(" ")}
                          {p.email && <span className="text-slate-400"> · {p.email}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Insights */}
                  <div>
                    {objections.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                          Objections détectées
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-xs">
                          {objections.slice(0, 3).map((o, i) => (
                            <li key={i} className="text-slate-700">
                              <span className="text-rose-400">•</span> {o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {nextSteps.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                          Prochaines étapes
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-xs">
                          {nextSteps.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-slate-700">
                              <span className="text-emerald-400">→</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-2.5">
                  {c.recording_url && (
                    <a
                      href={c.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      ▶ Écouter l&apos;enregistrement
                    </a>
                  )}
                  {c.transcript_url && (
                    <a
                      href={c.transcript_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      📄 Lire la transcription
                    </a>
                  )}
                  {c.hubspot_deal_id && (
                    <span className="text-[11px] text-slate-500">
                      Deal HubSpot lié : <code className="rounded bg-slate-100 px-1">{c.hubspot_deal_id}</code>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
