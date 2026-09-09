import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { hubFetch } from "@/lib/integrations/hub-fetch";
import { checkHubSpotProperty } from "@/lib/integrations/hubspot-properties";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { poleToWorkspace } from "@/lib/workspaces";
import { isBriefCrmObject, isBriefTeamId, sanitizeBriefTeam, type BriefCustomSuggestion, type BriefTeamConfig } from "@/lib/voice/brief-team";
import { previewSuggestion, previewTeamBrief, propertyCoverage } from "@/lib/voice/brief-team-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vérifications du brief personnalisé par équipe — rien n'est enregistré ici,
 * le client n'ajoute au brief que ce qui est validé :
 *  - kind "property" : la propriété CRM existe (nom API, sinon retrouvée par
 *    libellé), son type est lu, et le RAPPROCHEMENT compte les fiches qui la
 *    renseignent (en direct dans HubSpot) ;
 *  - kind "suggestion" : une suggestion personnalisée est CALCULÉE sur les
 *    vraies données (phrases exactes du brief + nombre de fiches) ;
 *  - kind "preview" : aperçu complet du brief d'équipe tel qu'il sera lu.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const [token, { data: ints }, { data: profile }] = await Promise.all([
    getHubSpotToken(supabase, orgId),
    supabase.from("integrations").select("provider").eq("organization_id", orgId).eq("is_active", true).limit(50),
    supabase.from("profiles").select("role, pole").eq("id", user.id).maybeSingle(),
  ]);
  const crm = (ints ?? []).map((i) => i.provider as string).find((p) => CONNECTABLE_TOOLS[p]?.category === "crm") ?? null;
  const crmLabel = crm ? (CONNECTABLE_TOOLS[crm]?.label ?? crm) : null;
  const isAdmin = profile?.role === "admin";
  const ownTeam = poleToWorkspace(profile?.pole as string | null);

  // ── Propriété CRM : existence + type + rapprochement ──
  if (body.kind === "property") {
    const object = body.object;
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const labelHint = typeof body.label === "string" ? body.label.trim() : "";
    if (!isBriefCrmObject(object) || (!rawName && !labelHint)) {
      return NextResponse.json({ error: "Objet et nom (ou libellé) de la propriété requis" }, { status: 400 });
    }
    if (!token) return NextResponse.json({ ok: false, exists: null, error: "Aucun CRM connecté : la propriété ne peut pas être vérifiée." });
    const check = await checkHubSpotProperty(token, object, rawName, labelHint || undefined);
    const name = check.exists ? rawName : check.suggestedName;
    if (!name) {
      return NextResponse.json({
        ok: false,
        exists: check.exists,
        error: check.exists === null
          ? "Propriété invérifiable pour le moment — réessaie."
          : `Propriété introuvable dans HubSpot sur l'objet ${object}. Vérifie le nom API ou saisis le libellé affiché dans HubSpot.`,
      });
    }
    // Détail de la propriété (type réel : date, datetime, enumeration, number, bool…).
    let type: string | null = null;
    let fieldType: string | null = check.fieldType;
    let label: string | null = check.label;
    try {
      const res = await hubFetch(`https://api.hubapi.com/crm/v3/properties/${object}/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        type = typeof d?.type === "string" ? d.type : null;
        fieldType = typeof d?.fieldType === "string" ? d.fieldType : fieldType;
        label = typeof d?.label === "string" ? d.label : label;
      }
    } catch {}
    const coverage = await propertyCoverage(token, object, name);
    return NextResponse.json({
      ok: true,
      exists: true,
      name,
      label: label ?? name,
      type,
      fieldType,
      renamed: name !== rawName,
      coverage,
      crmLabel,
    });
  }

  // ── Suggestion personnalisée : calcul réel ──
  if (body.kind === "suggestion") {
    const team = body.team;
    if (!isBriefTeamId(team)) return NextResponse.json({ error: "Équipe invalide" }, { status: 400 });
    if (!isAdmin && ownTeam && ownTeam !== team) return NextResponse.json({ error: "Équipe non autorisée" }, { status: 403 });
    const settings = sanitizeBriefTeam({ enabled: true, team, configs: { [team]: body.config ?? {} } });
    const cfg: BriefTeamConfig = settings.configs[team] ?? { pipelines: [], blocks: {}, customProperties: [], customSuggestions: [] };
    const raw = sanitizeBriefTeam({ enabled: true, team, configs: { [team]: { customSuggestions: [body.suggestion] } } });
    const suggestion: BriefCustomSuggestion | undefined = raw.configs[team]?.customSuggestions[0];
    if (!suggestion) return NextResponse.json({ error: "Suggestion invalide" }, { status: 400 });
    const preview = await previewSuggestion(supabase, orgId, token, cfg, suggestion, crmLabel);
    return NextResponse.json({ ok: true, ...preview });
  }

  // ── Aperçu complet du brief d'équipe ──
  if (body.kind === "preview") {
    const settings = sanitizeBriefTeam(body.briefTeam);
    if (!isAdmin && isBriefTeamId(ownTeam)) settings.team = ownTeam;
    const parts = await previewTeamBrief(supabase, orgId, token, settings, crmLabel);
    return NextResponse.json({ ok: true, parts, team: settings.team });
  }

  return NextResponse.json({ error: "kind inconnu" }, { status: 400 });
}
