/**
 * GET /api/integrations/hubspot/debug/ecosystem
 *
 * Endpoint debug : retourne live les counts ecosystem pour l'org connectée.
 * Permet de vérifier en 1 requête que chaque endpoint HubSpot renvoie bien
 * la bonne donnée (workflows, sequences, forms, tickets, etc.).
 *
 * Usage : ouvrir l'URL dans le browser après login → comparer aux counts
 * réels visibles dans HubSpot.
 */
import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { fetchHubSpotEcosystemCounts } from "@/lib/integrations/hubspot";

export const dynamic = "force-dynamic";

export async function GET() {
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Pas d'org" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return NextResponse.json({ error: "HubSpot non connecté pour cette org" }, { status: 400 });
  }

  // ── Audit endpoint par endpoint ──
  const audit: Record<string, { ok: boolean; status: number; sample?: unknown; count?: number; error?: string }> = {};

  async function probe(label: string, url: string, init?: RequestInit) {
    try {
      const res = await fetch(`https://api.hubapi.com${url}`, {
        headers: { Authorization: `Bearer ${token}`, ...init?.headers },
        ...init,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {}
      const sample = (() => {
        if (!parsed || typeof parsed !== "object") return text.slice(0, 200);
        const obj = parsed as Record<string, unknown>;
        const keys = Object.keys(obj).slice(0, 5);
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          const v = obj[k];
          if (Array.isArray(v)) out[k] = `Array(${v.length})${v[0] ? ` first=${JSON.stringify(v[0]).slice(0, 100)}` : ""}`;
          else if (typeof v === "object") out[k] = JSON.stringify(v).slice(0, 100);
          else out[k] = v;
        }
        return out;
      })();
      audit[label] = { ok: res.ok, status: res.status, sample };
    } catch (err) {
      audit[label] = { ok: false, status: 0, error: String(err) };
    }
  }

  await Promise.all([
    probe("workflows_v3", "/automation/v3/workflows"),
    probe("workflows_v4_flows", "/automation/v4/flows?limit=200"),
    probe("sequences_enrollments_v4", "/automation/v4/sequences/enrollments?limit=10"),
    probe("forms_v3", "/marketing/v3/forms?limit=10"),
    probe("campaigns_v3", "/marketing/v3/campaigns?limit=10"),
    probe("users_v3", "/settings/v3/users?limit=10"),
    probe("teams_v3", "/settings/v3/users/teams"),
    probe("schemas", "/crm/v3/schemas"),
    probe("pipelines_deals", "/crm/v3/pipelines/deals"),
    probe("conversations_threads", "/conversations/v3/conversations/threads?limit=10"),
    probe("tickets_search", "/crm/v3/objects/tickets/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
    probe("invoices_search", "/crm/v3/objects/invoices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
    probe("subscriptions_search", "/crm/v3/objects/subscriptions/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
    probe("leads_search", "/crm/v3/objects/leads/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
    probe("goals_search", "/crm/v3/objects/goals/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    }),
  ]);

  // Le snapshot final qu'on utilise dans ctx
  const ecosystem = await fetchHubSpotEcosystemCounts(token);

  // Distribution lifecycle stages (count exact par stage HubSpot)
  let lifecycleDistribution: Record<string, unknown> = {};
  try {
    const propRes = await fetch(
      "https://api.hubapi.com/crm/v3/properties/contacts/lifecyclestage",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (propRes.ok) {
      const propData = await propRes.json();
      const stages = ((propData.options ?? []) as Array<{ value: string; label: string; hidden?: boolean }>)
        .filter((o) => !o.hidden);
      const counts = await Promise.all(
        stages.map(async (s) => {
          const r = await fetch(
            "https://api.hubapi.com/crm/v3/objects/contacts/search",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                limit: 1,
                filterGroups: [{ filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: s.value }] }],
              }),
            },
          );
          if (!r.ok) return { stage: s.value, label: s.label, count: 0, error: r.status };
          const d = await r.json();
          return { stage: s.value, label: s.label, count: d.total ?? 0 };
        }),
      );
      lifecycleDistribution = {
        stages_in_hubspot: stages.length,
        per_stage: counts,
      };
    }
  } catch (err) {
    lifecycleDistribution = { error: String(err) };
  }

  return NextResponse.json(
    {
      ecosystem_used_in_app: ecosystem,
      lifecycle_distribution: lifecycleDistribution,
      raw_endpoint_audit: audit,
      hint: "Compare ecosystem_used_in_app + lifecycle_distribution aux chiffres réels HubSpot. raw_endpoint_audit montre la réponse brute de chaque endpoint pour diagnostiquer.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
