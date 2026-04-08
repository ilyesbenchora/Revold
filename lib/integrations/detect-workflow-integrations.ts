/**
 * Detect integrations that hook into HubSpot via workflow webhooks.
 *
 * Some apps (Zapier, Make/Integromat, n8n, Pabbly, Workato…) don't install
 * custom property groups and don't always show up in /account-info/v3/api-usage.
 * They DO however receive their data via HubSpot workflow webhook actions
 * pointing at their respective hook URLs.
 *
 * We list active workflows and inspect their actions for outbound webhook
 * destinations matching known automation tool domains.
 */

const HS_API = "https://api.hubapi.com";

const WEBHOOK_SIGNATURES: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "zapier", label: "Zapier", pattern: /hooks\.zapier\.com/i },
  { key: "make", label: "Make", pattern: /(hook\.(eu1|us1|us2)\.make\.com|hook\.integromat\.com)/i },
  { key: "n8n", label: "n8n", pattern: /n8n\.io/i },
  { key: "pabbly", label: "Pabbly Connect", pattern: /pabbly\.com/i },
  { key: "workato", label: "Workato", pattern: /workato\.com/i },
  { key: "tray", label: "Tray.io", pattern: /tray\.io/i },
];

export type WorkflowIntegrationHit = {
  key: string;
  label: string;
  workflowsCount: number;
};

export async function detectWorkflowIntegrations(token: string): Promise<WorkflowIntegrationHit[]> {
  try {
    const res = await fetch(`${HS_API}/automation/v4/flows?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const flows: Array<Record<string, unknown>> = data.results ?? [];

    // Stringify each flow once and pattern-match against the JSON.
    // This catches webhook URLs anywhere in actions/branches without having
    // to walk the workflow tree explicitly.
    const counts = new Map<string, { label: string; count: number }>();
    for (const flow of flows) {
      const json = JSON.stringify(flow);
      for (const sig of WEBHOOK_SIGNATURES) {
        if (sig.pattern.test(json)) {
          const existing = counts.get(sig.key) ?? { label: sig.label, count: 0 };
          existing.count += 1;
          counts.set(sig.key, existing);
        }
      }
    }

    return Array.from(counts.entries()).map(([key, { label, count }]) => ({
      key,
      label,
      workflowsCount: count,
    }));
  } catch {
    return [];
  }
}
