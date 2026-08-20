import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveCohortAccessor } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

/**
 * Ids HubSpot des DEALS dont l'entreprise appartient à une cohorte — pour les
 * blocs alimentés en direct par HubSpot (Deals à risque, Forecast management) :
 * ils filtrent leurs listes côté client sur ce Set, avec exactement les mêmes
 * règles de lecture de cohorte que le moteur d'agrégats.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") ?? "").trim();
  const value = (url.searchParams.get("value") ?? "").trim();
  if (!key || !value) return NextResponse.json({ error: "key et value requis" }, { status: 400 });

  const acc = await resolveCohortAccessor(supabase, orgId, key);
  if (!acc.prop && !acc.col) {
    return NextResponse.json({ error: `Cohorte inconnue ou non mappée : ${key}.` }, { status: 400 });
  }
  const matchVal = (v: unknown) => (value === "inconnu" ? v == null || v === "" : String(v) === value);

  // ── Cohorte portée par les DEALS eux-mêmes : matching direct sur raw_data. ──
  if (acc.prop && acc.object === "deals") {
    const { data: deals, error: dealsErr } = await supabase
      .from("deals")
      .select("hubspot_id, raw_data")
      .eq("organization_id", orgId)
      .limit(10000);
    if (dealsErr) return NextResponse.json({ error: dealsErr.message }, { status: 500 });
    const dealIds = ((deals ?? []) as { hubspot_id: string | null; raw_data: unknown }[])
      .filter((d) => {
        if (!d.hubspot_id) return false;
        const props = (d.raw_data as { properties?: Record<string, unknown> } | null)?.properties;
        return matchVal(props?.[acc.prop!]);
      })
      .map((d) => d.hubspot_id as string);
    return NextResponse.json({ dealIds });
  }

  // ── Entreprises de la cohorte → Set d'ids → deals rattachés (jointure JS).
  // Cohorte CONTACTS : entreprises des contacts qui matchent + lien DIRECT
  // deal → contact (deals.contact_id, associations HubSpot). ──
  let companyIds: Set<string>;
  let contactIds: Set<string> | null = null;
  if (acc.prop && acc.object === "contacts") {
    const target = `raw_data->properties->>${acc.prop}`;
    let oq = supabase.from("contacts").select("id, company_id").eq("organization_id", orgId).limit(10000);
    oq = value === "inconnu" ? oq.is(target, null) : oq.eq(target, value);
    const { data: cts, error: ctsErr } = await oq;
    if (ctsErr) return NextResponse.json({ error: ctsErr.message }, { status: 500 });
    const rows = (cts ?? []) as { id: string; company_id: string | null }[];
    contactIds = new Set(rows.map((c) => c.id));
    companyIds = new Set(
      rows.map((c) => c.company_id).filter((v): v is string => typeof v === "string" && !!v),
    );
  } else {
    const target = acc.prop ? `raw_data->properties->>${acc.prop}` : acc.col!;
    let cq = supabase.from("companies").select("id").eq("organization_id", orgId).limit(10000);
    cq = value === "inconnu" ? cq.is(target, null) : cq.eq(target, value);
    const { data: comp, error: compErr } = await cq;
    if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });
    companyIds = new Set(((comp ?? []) as { id: string }[]).map((c) => c.id));
  }

  // deals.contact_id d'une migration récente : repli sans la colonne.
  const full = await supabase
    .from("deals")
    .select("hubspot_id, company_id, contact_id")
    .eq("organization_id", orgId)
    .limit(10000);
  let deals: unknown = full.data;
  let dealsErr = full.error;
  if (dealsErr && /contact_id/.test(dealsErr.message)) {
    const basic = await supabase
      .from("deals")
      .select("hubspot_id, company_id")
      .eq("organization_id", orgId)
      .limit(10000);
    deals = basic.data;
    dealsErr = basic.error;
  }
  if (dealsErr) return NextResponse.json({ error: dealsErr.message }, { status: 500 });
  const dealIds = ((deals ?? []) as unknown as { hubspot_id: string | null; company_id: string | null; contact_id?: string | null }[])
    .filter((d) => {
      if (!d.hubspot_id) return false;
      const byCompany = !!d.company_id && companyIds.has(d.company_id);
      const byContact = !!contactIds && !!d.contact_id && contactIds.has(d.contact_id);
      return byCompany || byContact;
    })
    .map((d) => d.hubspot_id as string);

  return NextResponse.json({ dealIds });
}
