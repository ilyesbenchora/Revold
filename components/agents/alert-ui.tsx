"use client";

/** Canaux de notification proposés à la création d'une alerte. */
export const ALERT_CHANNELS: { key: string; icon: string; label: string }[] = [
  { key: "app", icon: "🔔", label: "App Revold" },
  { key: "email", icon: "📧", label: "Email" },
  { key: "slack", icon: "💬", label: "Slack / Teams" },
];

export function channelLabel(key: string): { icon: string; label: string } {
  return ALERT_CHANNELS.find((c) => c.key === key) ?? { icon: "🔔", label: key };
}

/** Petit intitulé de section (titre au-dessus d'un contenu d'alerte). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</div>;
}

/** Badges des canaux choisis (lecture seule). */
export function ChannelBadges({ channels }: { channels?: string[] }) {
  const list = channels && channels.length ? channels : ["app"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((k) => {
        const c = channelLabel(k);
        return (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
          >
            <span>{c.icon}</span>
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

/** Corps d'alerte moderne, en lecture seule, avec titres de sections. */
export function AlertBody({
  title,
  description,
  impact,
  category,
  channels,
}: {
  title: string;
  description: string;
  impact?: string | null;
  category?: string | null;
  channels?: string[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Objectif</SectionLabel>
        <div className="mt-0.5 flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {category && (
            <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-fuchsia-700">
              {category}
            </span>
          )}
        </div>
      </div>
      <div>
        <SectionLabel>Description</SectionLabel>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
      {impact && (
        <div>
          <SectionLabel>Impact attendu</SectionLabel>
          <p className="mt-0.5 text-sm text-slate-600">{impact}</p>
        </div>
      )}
      <div>
        <SectionLabel>Canaux de notification</SectionLabel>
        <div className="mt-1">
          <ChannelBadges channels={channels} />
        </div>
      </div>
    </div>
  );
}
