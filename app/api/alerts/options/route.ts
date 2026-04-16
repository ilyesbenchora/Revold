import { NextResponse } from "next/server";

type HsProperty = {
  name: string;
  label: string;
  hubspotDefined: boolean;
  type: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
};

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ pipelines: [], owners: [], teams: [], lifecycleStages: [], sources: [], customContactProps: [] });
  }

  try {
    const [pipelinesRes, ownersRes, contactPropsRes] = await Promise.all([
      fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    // ── Pipelines ──
    let pipelines: Array<{ id: string; label: string }> = [];
    if (pipelinesRes.ok) {
      const data = await pipelinesRes.json();
      pipelines = (data.results ?? []).map((p: { id: string; label: string }) => ({
        id: p.id,
        label: p.label,
      }));
    }

    // ── Owners + Teams ──
    let owners: Array<{ id: string; name: string; email: string; team: string | null }> = [];
    const teamSet = new Set<string>();
    if (ownersRes.ok) {
      const data = await ownersRes.json();
      owners = (data.results ?? []).map((o: { id: string; firstName?: string; lastName?: string; email?: string; teams?: Array<{ id: string; name: string }> }) => {
        const teamName = o.teams?.[0]?.name ?? null;
        if (teamName) teamSet.add(teamName);
        return {
          id: o.id,
          name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || "Sans nom",
          email: o.email ?? "",
          team: teamName,
        };
      });
    }

    // ── Contact properties → lifecycle stages, sources, custom props ──
    let lifecycleStages: Array<{ value: string; label: string }> = [];
    let sources: Array<{ value: string; label: string }> = [];
    let customContactProps: Array<{ name: string; label: string; type: string }> = [];

    if (contactPropsRes.ok) {
      const data = await contactPropsRes.json();
      const props = (data.results ?? []) as HsProperty[];

      // Lifecycle stages from the lifecyclestage property options
      const lcProp = props.find((p) => p.name === "lifecyclestage");
      if (lcProp?.options) {
        lifecycleStages = lcProp.options.map((o) => ({ value: o.value, label: o.label }));
      }

      // Source origins from hs_analytics_source
      const srcProp = props.find((p) => p.name === "hs_analytics_source");
      if (srcProp?.options) {
        sources = srcProp.options.map((o) => ({ value: o.value, label: o.label }));
      } else {
        // Fallback: HubSpot standard source values
        sources = [
          { value: "ORGANIC_SEARCH", label: "Recherche organique" },
          { value: "PAID_SEARCH", label: "Recherche payante" },
          { value: "PAID_SOCIAL", label: "Social payant" },
          { value: "SOCIAL_MEDIA", label: "Réseaux sociaux" },
          { value: "EMAIL_MARKETING", label: "Email marketing" },
          { value: "REFERRALS", label: "Referral" },
          { value: "DIRECT_TRAFFIC", label: "Trafic direct" },
          { value: "OFFLINE", label: "Offline" },
          { value: "OTHER_CAMPAIGNS", label: "Autres campagnes" },
        ];
      }

      // Custom contact properties (user-created, not HubSpot-defined)
      customContactProps = props
        .filter((p) => !p.hubspotDefined)
        .map((p) => ({ name: p.name, label: p.label, type: p.type }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return NextResponse.json(
      { pipelines, owners, teams: Array.from(teamSet).sort(), lifecycleStages, sources, customContactProps },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ pipelines: [], owners: [], teams: [], lifecycleStages: [], sources: [], customContactProps: [] });
  }
}
