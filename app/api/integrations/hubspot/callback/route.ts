/**
 * GET /api/integrations/hubspot/callback?code=...&state=...
 *
 * Reçoit le code d'autorisation HubSpot, vérifie le state CSRF, échange le
 * code contre access_token + refresh_token, récupère les infos du portail
 * (portal_id, hub_domain, scopes), upsert dans `integrations` puis redirige
 * vers la page paramètres avec un message de succès.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  exchangeHubSpotCode,
  fetchHubSpotAccountInfo,
  fetchHubSpotCustomObjects,
  fetchHubSpotLists,
} from "@/lib/integrations/hubspot";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function redirectTo(path: string, params: Record<string, string> = {}) {
  const url = new URL(path, APP_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errParam = searchParams.get("error");

  if (errParam) {
    const description = searchParams.get("error_description") || "";
    const isScopeMismatch = /scope|domain|domaine|incohérence/i.test(`${errParam} ${description}`);
    const message = isScopeMismatch
      ? "Configuration de scopes désynchronisée — voir /api/integrations/hubspot/debug/scopes pour la liste exacte envoyée. Cocher chaque scope dans le dev portal HubSpot ou utiliser HUBSPOT_OAUTH_OPTIONAL_SCOPES env var."
      : `HubSpot a refusé l'autorisation : ${errParam}${description ? ` — ${description}` : ""}`;
    console.error("[hubspot oauth callback] error param", { errParam, description });
    return redirectTo("/dashboard/parametres/integrations", { hs_error: message });
  }
  if (!code || !state) {
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: "Réponse OAuth invalide (code ou state manquant)",
    });
  }

  // Double-check CSRF : state du cookie doit matcher le state retourné
  const cookieState = req.cookies.get("hs_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: "Vérification CSRF échouée — relancez la connexion",
    });
  }

  // Vérifie la signature HMAC du state
  const verified = verifyOAuthState(state);
  if (!verified) {
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: "State OAuth invalide (signature)",
    });
  }
  const { orgId } = verified;

  // Échange le code contre les tokens
  let tokens;
  try {
    tokens = await exchangeHubSpotCode(code);
  } catch (err) {
    console.error("[hubspot oauth callback] exchange failed", { orgId, err });
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: "Échec de l'échange du code OAuth",
    });
  }

  // Récupère les infos du portail (portal_id, hub_domain)
  let info;
  try {
    info = await fetchHubSpotAccountInfo(tokens.access_token);
  } catch (err) {
    console.error("[hubspot oauth callback] account info failed", { orgId, err });
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: "Impossible de récupérer les infos du portail HubSpot",
    });
  }

  // Détecte les custom objects + listes (non bloquant si fail)
  const [customObjects, lists] = await Promise.all([
    fetchHubSpotCustomObjects(tokens.access_token).catch((err) => {
      console.warn("[hubspot oauth callback] custom objects fetch failed", { orgId, err });
      return [] as Awaited<ReturnType<typeof fetchHubSpotCustomObjects>>;
    }),
    fetchHubSpotLists(tokens.access_token).catch((err) => {
      console.warn("[hubspot oauth callback] lists fetch failed", { orgId, err });
      return [] as Awaited<ReturnType<typeof fetchHubSpotLists>>;
    }),
  ]);

  // Upsert dans integrations
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("integrations")
    .upsert(
      {
        organization_id: orgId,
        provider: "hubspot",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        portal_id: String(info.portal_id ?? info.hub_id),
        is_active: true,
        metadata: {
          hub_domain: info.hub_domain,
          scopes: info.scopes,
          user: info.user,
          user_id: info.user_id,
          connected_at: new Date().toISOString(),
          custom_objects: customObjects,
          custom_objects_count: customObjects.length,
          lists,
          lists_count: lists.length,
          initial_sync_status: "pending",
          initial_sync_started_at: null,
          initial_sync_completed_at: null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );

  if (error) {
    console.error("[hubspot oauth callback] upsert failed", {
      orgId,
      code: error.code,
      message: error.message,
    });
    return redirectTo("/dashboard/parametres/integrations", {
      hs_error: `Erreur enregistrement : ${error.message}`,
    });
  }

  // ── Trigger sync initial automatique (fire-and-forget) ──
  // Le user n'a RIEN à faire : ses données HubSpot s'importent en arrière-plan
  // dès la fin de l'OAuth. Visible via initial_sync_status sur la page.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret) {
    // Chaîne séquentielle (companies → contacts → deals) en background.
    // Timeout 1s sur le 1er fetch pour ne pas bloquer le redirect.
    fetch(`${appUrl}/api/integrations/hubspot/sync?orgId=${orgId}&type=companies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(1000),
    }).catch(() => {
      // Timeout attendu — Vercel continue l'exécution côté serveur
    });
  } else {
    console.warn("[hubspot oauth callback] CRON_SECRET not set, skipping auto-sync");
  }

  // Cleanup cookie
  const res = redirectTo("/dashboard/parametres/integrations", {
    hs_connected: info.hub_domain,
  });
  res.cookies.delete("hs_oauth_state");
  return res;
}
