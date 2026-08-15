import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  customProvider,
  CUSTOM_ENTITIES,
  targetsForEntities,
  targetsForPages,
  type CustomEntity,
} from "@/lib/integrations/custom-connector";
import { getToolKeys, setToolKeys } from "@/lib/integrations/tool-mappings";

export const dynamic = "force-dynamic";

const AUTH_TYPES = new Set(["none", "bearer", "header", "query"]);
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/** Liste les connecteurs sur mesure de l'org (SANS les secrets). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("custom_connectors")
    .select("id, key, label, base_url, auth_type, auth_param, is_active, last_sync_at, last_error, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ connectors: [], unavailable: true });

  const ids = (data ?? []).map((c) => c.id as string);
  let endpoints: unknown[] = [];
  if (ids.length > 0) {
    const { data: eps } = await supabase
      .from("custom_connector_endpoints")
      .select("id, connector_id, entity, path, records_path, pagination, field_map, is_active, last_count")
      .in("connector_id", ids);
    endpoints = eps ?? [];
  }
  return NextResponse.json({ connectors: data ?? [], endpoints });
}

/** Crée (ou met à jour) un connecteur sur mesure et ses endpoints. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    id?: string;
    label?: string;
    description?: string;
    category?: string;
    /** Rattacher automatiquement l'outil aux pages/agents. */
    attachTargets?: boolean;
    /** Pages CHOISIES par l'utilisateur — prioritaires sur toute déduction. */
    pages?: string[];
    baseUrl?: string;
    authType?: string;
    authParam?: string | null;
    authValue?: string | null;
    endpoints?: Array<{
      entity?: string;
      path?: string;
      recordsPath?: string | null;
      pagination?: Record<string, unknown>;
      fieldMap?: Record<string, string>;
      isActive?: boolean;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const label = (body.label ?? "").trim();
  const baseUrl = (body.baseUrl ?? "").trim();
  const description = (body.description ?? "").trim();
  const category = (body.category ?? "billing").trim();
  if (!label) return NextResponse.json({ error: "Nom de l'outil requis" }, { status: 400 });
  if (description.length < 15) {
    return NextResponse.json(
      { error: "Décris en une phrase à quoi sert l'outil — c'est ce contexte qui permet aux agents de l'analyser correctement." },
      { status: 400 },
    );
  }
  if (!/^https?:\/\//i.test(baseUrl)) return NextResponse.json({ error: "URL de base invalide (https://…)" }, { status: 400 });

  const row: Record<string, unknown> = {
    organization_id: orgId,
    label,
    description: description.slice(0, 1000),
    category,
    base_url: baseUrl.replace(/\/+$/, ""),
    auth_type: AUTH_TYPES.has(String(body.authType)) ? body.authType : "none",
    auth_param: body.authParam?.trim() || null,
    is_active: true,
  };
  // Secret : uniquement s'il est fourni (sinon on garde l'existant).
  if (body.authValue) row.auth_value = body.authValue;

  let connectorId = body.id ?? null;
  let connectorKey: string | null = null;
  if (connectorId) {
    const { data: updated, error } = await supabase
      .from("custom_connectors")
      .update(row)
      .eq("id", connectorId)
      .eq("organization_id", orgId)
      .select("key")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    connectorKey = (updated?.key as string | undefined) ?? null;
    if (connectorKey) {
      await supabase.from("integrations").upsert(
        {
          organization_id: orgId,
          provider: customProvider(connectorKey),
          access_token: "custom-connector",
          metadata: { label, description, category, custom: true, base_url: row.base_url },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" },
      );
    }
  } else {
    const { data, error } = await supabase
      .from("custom_connectors")
      .insert({ ...row, key: slugify(label) || `outil_${Date.now()}`, created_by: user.id })
      .select("id, key")
      .single();
    if (error) {
      const msg = /duplicate/i.test(error.message) ? "Un connecteur porte déjà ce nom." : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    connectorId = data.id as string;
    connectorKey = data.key as string;

    // Ligne `integrations` : l'outil apparaît comme source connectée partout
    // (mapping par page/agent, sélecteurs de sources, taux de rapprochement).
    await supabase.from("integrations").upsert(
      {
        organization_id: orgId,
        provider: customProvider(connectorKey),
        access_token: "custom-connector",
        metadata: { label, description, category, custom: true, base_url: row.base_url },
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );
  }

  // Endpoints (remplacement complet de la configuration envoyée).
  for (const ep of body.endpoints ?? []) {
    if (!ep.entity || !(CUSTOM_ENTITIES as readonly string[]).includes(ep.entity)) continue;
    if (!ep.path?.trim()) continue;
    const { error } = await supabase.from("custom_connector_endpoints").upsert(
      {
        connector_id: connectorId,
        organization_id: orgId,
        entity: ep.entity,
        path: ep.path.trim(),
        records_path: ep.recordsPath?.trim() || null,
        pagination: ep.pagination ?? { type: "none" },
        field_map: ep.fieldMap ?? {},
        is_active: ep.isActive !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connector_id,entity" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Rattachement automatique aux pages et agents (le « data model ») ──
  // Les entités configurées déterminent ce que l'outil peut alimenter : on
  // l'AJOUTE aux mappings existants (jamais de remplacement) pour que ses
  // données apparaissent immédiatement dans les bonnes pages et pour les bons
  // agents, sans configuration manuelle page par page.
  const attached: string[] = [];
  if (body.attachTargets !== false && connectorKey) {
    const provider = customProvider(connectorKey);
    // Les PAGES choisies par l'utilisateur font foi. Sans choix explicite
    // (édition d'un ancien connecteur), on retombe sur la déduction par les
    // objets configurés.
    const chosen = Array.isArray(body.pages) ? body.pages.filter((p) => typeof p === "string") : [];
    const targets =
      chosen.length > 0
        ? targetsForPages(chosen)
        : targetsForEntities(
            (body.endpoints ?? [])
              .map((e) => e.entity)
              .filter((e): e is CustomEntity => !!e && (CUSTOM_ENTITIES as readonly string[]).includes(e)),
          );
    for (const t of [...targets.pages, ...targets.agents]) {
      try {
        const current = await getToolKeys(supabase, orgId, t.key);
        if (!current.includes(provider)) {
          await setToolKeys(supabase, orgId, t.key, [...current, provider], user.id);
          attached.push(t.label);
        }
      } catch {
        /* mapping indisponible → non bloquant */
      }
    }
  }

  return NextResponse.json({ ok: true, id: connectorId, attached });
}
