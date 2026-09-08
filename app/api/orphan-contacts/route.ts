import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { hubFetch } from "@/lib/integrations/hub-fetch";

export const dynamic = "force-dynamic";

/**
 * Contacts sans entreprise (orphelins) — la feature que HubSpot n'a pas :
 * l'association EN MASSE de contacts à une entreprise.
 *
 * GET  : liste les contacts orphelins (company_id null, hubspot_id présent)
 *        + suggestions automatiques par domaine email (jean@acme.fr → ACME
 *        dont le domaine est en base), domaines grand public exclus.
 * POST : associe une sélection de contacts à UNE entreprise — écrit d'abord
 *        les associations dans HubSpot (API v4 batch, types 279 + 1 primary),
 *        puis répercute contacts.company_id en canonique. Aucune écriture
 *        sans validation explicite de l'utilisateur (bouton de la page).
 */

/** Domaines email grand public : jamais de suggestion d'entreprise dessus. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
  "live.com", "live.fr", "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "aol.com",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr", "laposte.net", "bbox.fr",
  "protonmail.com", "proton.me", "gmx.com", "gmx.fr", "msn.com",
]);

function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  return d || null;
}

type OrphanRow = {
  id: string;
  hubspot_id: string;
  email: string | null;
  full_name: string | null;
  title: string | null;
  lifecycle_stage: string | null;
};

type CompanyRow = { id: string; hubspot_id: string | null; name: string | null; domain: string | null };

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  // Orphelins ACTIONNABLES : sans entreprise ET présents dans HubSpot (un
  // contact sans hubspot_id ne peut pas recevoir d'association côté CRM).
  const { data: orphanRows, error } = await supabase
    .from("contacts")
    .select("id, hubspot_id, email, full_name, title, lifecycle_stage")
    .eq("organization_id", orgId)
    .is("company_id", null)
    .not("hubspot_id", "is", null)
    .order("email", { ascending: true })
    .limit(3000);
  if (error) return NextResponse.json({ error: "Lecture des contacts impossible." }, { status: 500 });
  const orphans = (orphanRows ?? []) as OrphanRow[];

  // Suggestions par domaine email ↔ domaine d'entreprise (déterministe).
  const byDomain = new Map<string, OrphanRow[]>();
  for (const c of orphans) {
    const d = emailDomain(c.email);
    if (!d || FREE_EMAIL_DOMAINS.has(d)) continue;
    const list = byDomain.get(d) ?? [];
    list.push(c);
    byDomain.set(d, list);
  }
  let suggestions: Array<{ company: CompanyRow; contactIds: string[]; domain: string }> = [];
  if (byDomain.size > 0) {
    const { data: compRows } = await supabase
      .from("companies")
      .select("id, hubspot_id, name, domain")
      .eq("organization_id", orgId)
      .not("domain", "is", null)
      .not("hubspot_id", "is", null)
      .in("domain", [...byDomain.keys()].slice(0, 500));
    for (const comp of (compRows ?? []) as CompanyRow[]) {
      const d = (comp.domain ?? "").toLowerCase();
      const matched = byDomain.get(d);
      if (matched?.length) {
        suggestions.push({ company: comp, contactIds: matched.map((c) => c.id), domain: d });
      }
    }
    // Un même domaine porté par plusieurs fiches entreprise → ambigu, on ne
    // suggère qu'une fois (la première) et l'utilisateur tranche en manuel.
    const seen = new Set<string>();
    suggestions = suggestions
      .filter((s) => (seen.has(s.domain) ? false : (seen.add(s.domain), true)))
      .sort((a, b) => b.contactIds.length - a.contactIds.length);
  }

  return NextResponse.json({ orphans, suggestions, total: orphans.length });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { companyId?: string; contactIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const contactIds = Array.isArray(body.contactIds) ? body.contactIds.filter((v) => typeof v === "string") : [];
  if (!body.companyId || contactIds.length === 0) {
    return NextResponse.json({ error: "companyId et contactIds sont requis" }, { status: 400 });
  }
  if (contactIds.length > 1000) {
    return NextResponse.json({ error: "Maximum 1000 contacts par lot." }, { status: 400 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, hubspot_id, name")
    .eq("organization_id", orgId)
    .eq("id", body.companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  if (!company.hubspot_id) {
    return NextResponse.json({ error: "Cette entreprise n'existe pas dans HubSpot (pas d'ID CRM) — choisis une entreprise synchronisée." }, { status: 400 });
  }

  // Sécurité : uniquement des contacts de l'org, ENCORE orphelins, avec ID CRM.
  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, hubspot_id")
    .eq("organization_id", orgId)
    .in("id", contactIds)
    .is("company_id", null)
    .not("hubspot_id", "is", null);
  const contacts = (contactRows ?? []) as Array<{ id: string; hubspot_id: string }>;
  if (contacts.length === 0) {
    return NextResponse.json({ error: "Aucun contact actionnable dans la sélection (déjà associés ?)." }, { status: 400 });
  }

  const token = await getHubSpotToken(supabase, orgId);
  if (!token) return NextResponse.json({ error: "HubSpot n'est pas connecté." }, { status: 400 });

  // ── 1. Écriture HubSpot d'abord (batch v4, chunks de 100) ──
  // 279 = contact→company (défaut) · 1 = primary. Un orphelin n'a pas de
  // primary : on pose les deux ; si HubSpot refuse le lot (primary déjà pris
  // suite à une modif concurrente), on retente avec 279 seul.
  const HS = "https://api.hubapi.com";
  const associate = async (batch: typeof contacts, typeIds: number[]) => {
    const res = await hubFetch(`${HS}/crm/v4/associations/contacts/companies/batch/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: batch.map((c) => ({
          from: { id: c.hubspot_id },
          to: { id: company.hubspot_id },
          types: typeIds.map((t) => ({ associationCategory: "HUBSPOT_DEFINED", associationTypeId: t })),
        })),
      }),
    });
    return res;
  };

  const associated: string[] = [];
  const failures: string[] = [];
  for (let i = 0; i < contacts.length; i += 100) {
    const batch = contacts.slice(i, i + 100);
    let res = await associate(batch, [279, 1]);
    if (!res.ok) res = await associate(batch, [279]);
    if (res.ok) {
      associated.push(...batch.map((c) => c.id));
    } else {
      const txt = (await res.text()).slice(0, 180);
      failures.push(`${batch.length} contacts refusés (${res.status}) : ${txt}`);
      if (res.status === 403) break; // scope manquant : inutile d'insister
    }
  }

  // ── 2. Répercussion canonique + journal ──
  if (associated.length > 0) {
    await supabase
      .from("contacts")
      .update({ company_id: company.id })
      .eq("organization_id", orgId)
      .in("id", associated);
    await supabase.from("sync_logs").insert({
      organization_id: orgId,
      source: "hubspot",
      direction: "outbound",
      entity_type: "contact_company_association",
      status: "completed",
      entity_count: associated.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  if (associated.length === 0) {
    return NextResponse.json(
      { error: failures[0] ?? "HubSpot a refusé les associations." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    associated: associated.length,
    company: company.name,
    warning: failures.length > 0 ? failures.join(" · ") : undefined,
  });
}
