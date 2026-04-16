import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ pipelines: [], owners: [], teams: [] });
  }

  try {
    const [pipelinesRes, ownersRes] = await Promise.all([
      fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    let pipelines: Array<{ id: string; label: string }> = [];
    if (pipelinesRes.ok) {
      const data = await pipelinesRes.json();
      pipelines = (data.results ?? []).map((p: { id: string; label: string }) => ({
        id: p.id,
        label: p.label,
      }));
    }

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

    return NextResponse.json(
      { pipelines, owners, teams: Array.from(teamSet).sort() },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ pipelines: [], owners: [], teams: [] });
  }
}
