import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import type { ConnectedSummary } from "@/lib/integrations/connected-tools";

const CATEGORY_LABEL: Record<string, string> = {
  crm: "CRM",
  billing: "Facturation",
  phone: "Téléphonie",
  support: "Service client",
  communication: "Communication",
  conv_intel: "Conversation Intelligence",
};

type Unlock = {
  key: string;
  label: string;
  description: string;
  badge: string;
};

function buildUnlocks(s: ConnectedSummary): Unlock[] {
  const u: Unlock[] = [];
  if (s.hasCrmAndBilling) {
    u.push({
      key: "crm_billing",
      label: "Forecast vs CA encaissé",
      description: "Réconcilie les deals gagnés CRM avec les factures payées pour mesurer l'écart prévision / réalité.",
      badge: "CRM × Facturation",
    });
    u.push({
      key: "won_without_invoice",
      label: "Fuite revenue : deals gagnés sans facture",
      description: "Détecte les deals « Closed Won » sans facture associée — du CA déjà signé qui ne rentre pas.",
      badge: "CRM × Facturation",
    });
  }
  if (s.hasCrmAndSupport) {
    u.push({
      key: "crm_support",
      label: "Score santé client (tickets × deals)",
      description: "Croise volume de tickets, priorités et stade des deals pour détecter les comptes en risque churn.",
      badge: "CRM × Support",
    });
  }
  if (s.hasCrmAndPhone) {
    u.push({
      key: "crm_phone",
      label: "Impact appels sur closing",
      description: "Mesure le delta de closing rate entre deals avec ≥ 3 appels et deals sans appel logué.",
      badge: "CRM × Téléphonie",
    });
  }
  if (s.hasCrmAndConvIntel) {
    u.push({
      key: "crm_conv",
      label: "Talk ratio × win rate",
      description: "Identifie le talk ratio commercial optimal en croisant transcriptions Praiz et issue des deals.",
      badge: "CRM × Conv. Intelligence",
    });
  }
  if (s.hasCommunication) {
    u.push({
      key: "comm_alerts",
      label: "Alertes & digests poussés",
      description: "Vos alertes critiques + digest quotidien sont envoyés sur les canaux configurés (Slack/Teams/email).",
      badge: "Communication",
    });
  }
  return u;
}

export function MultiToolBanner({ summary }: { summary: ConnectedSummary }) {
  const tools = summary.tools;
  const unlocks = buildUnlocks(summary);

  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <p className="text-sm font-semibold text-amber-900">🔌 Aucun outil connecté</p>
        <p className="mt-1 text-xs text-amber-800">
          Connectez vos outils dans la page <Link href="/dashboard/integration" className="font-semibold underline">Intégrations</Link> pour débloquer les simulations cross-source (CRM × Facturation × Téléphonie × Support).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-fuchsia-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-indigo-900">
            🔌 {tools.length} outil{tools.length > 1 ? "s" : ""} connecté{tools.length > 1 ? "s" : ""} à Revold
          </p>
          <p className="mt-1 text-xs text-indigo-800">
            Les simulations et coachings ci-dessous s&apos;adaptent aux outils branchés. Plus vous connectez, plus les recommandations cross-source se débloquent.
          </p>
        </div>
        <Link
          href="/dashboard/integration"
          className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-white"
        >
          Gérer les intégrations →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tools.map((t) => (
          <span
            key={t.key}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
            title={`${t.label} (${CATEGORY_LABEL[t.category] ?? t.category})`}
          >
            <BrandLogo domain={t.domain} alt={t.label} fallback={t.icon} size={14} />
            {t.label}
          </span>
        ))}
      </div>

      {unlocks.length > 0 && (
        <div className="mt-4 border-t border-indigo-100 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            ✨ {unlocks.length} simulation{unlocks.length > 1 ? "s" : ""} cross-source débloquée{unlocks.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {unlocks.map((u) => (
              <li key={u.key} className="rounded-lg bg-white/70 p-2.5 ring-1 ring-indigo-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900">{u.label}</p>
                  <span className="shrink-0 rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-fuchsia-800">
                    {u.badge}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">{u.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
