import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  fetchPage,
  flattenKeys,
  suggestFieldMap,
  CUSTOM_ENTITIES,
  type CustomEntity,
} from "@/lib/integrations/custom-connector";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TEST EN DIRECT d'un endpoint d'outil sur mesure — la réponse à « comment je
 * récupère les bons endpoints ? ». Revold appelle l'URL fournie, montre la
 * réponse RÉELLE, détecte automatiquement où se trouve la liste
 * d'enregistrements, liste les champs disponibles et pré-remplit la
 * correspondance vers son modèle canonique. L'utilisateur corrige, valide.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: {
    baseUrl?: string;
    authType?: string;
    authParam?: string | null;
    authValue?: string | null;
    path?: string;
    recordsPath?: string | null;
    entity?: string;
    /** Connecteur déjà enregistré : réutilise son secret sans le renvoyer au client. */
    connectorId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  let baseUrl = (body.baseUrl ?? "").trim();
  let authType = (body.authType ?? "none") as "none" | "bearer" | "header" | "query";
  let authParam = body.authParam ?? null;
  let authValue = body.authValue ?? null;

  // Secret jamais renvoyé au navigateur : on le relit en base si besoin.
  if (body.connectorId) {
    const { data } = await supabase
      .from("custom_connectors")
      .select("base_url, auth_type, auth_param, auth_value")
      .eq("id", body.connectorId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (data) {
      baseUrl = baseUrl || (data.base_url as string);
      authType = (data.auth_type as typeof authType) ?? authType;
      authParam = authParam ?? (data.auth_param as string | null);
      authValue = authValue || (data.auth_value as string | null);
    }
  }

  const path = (body.path ?? "").trim();
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json({ error: "URL de base invalide (https://…)" }, { status: 400 });
  }
  if (!path) return NextResponse.json({ error: "Chemin de l'endpoint requis" }, { status: 400 });

  const outcome = await fetchPage(
    { base_url: baseUrl, auth_type: authType, auth_param: authParam, auth_value: authValue },
    path,
    body.recordsPath?.trim() || null,
  );
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error, status: outcome.status, sample: outcome.raw ?? null });
  }

  const first = outcome.records[0] ?? null;
  const keys = first ? flattenKeys(first) : [];
  const entity = (CUSTOM_ENTITIES as readonly string[]).includes(String(body.entity))
    ? (body.entity as CustomEntity)
    : null;

  return NextResponse.json({
    ok: true,
    count: outcome.records.length,
    detectedPath: outcome.detectedPath,
    keys,
    sample: first,
    suggestion: entity ? suggestFieldMap(entity, keys) : {},
  });
}
