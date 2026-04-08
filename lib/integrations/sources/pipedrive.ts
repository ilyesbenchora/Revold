/**
 * Minimal Pipedrive REST API client.
 * Uses the company-domain URL form: https://{company}.pipedrive.com/api/v1
 * Auth: API token passed as ?api_token= query string.
 */

const PD_BASE = (domain: string) => `https://${domain}.pipedrive.com/api/v1`;

export type PipedriveOrgRef = { value: number; name: string } | number | null;

export type PipedrivePerson = {
  id: number;
  name: string;
  primary_email: Array<{ value: string; primary: boolean }> | string | null;
  email: Array<{ value: string; primary: boolean }> | null;
  phone: Array<{ value: string; primary: boolean }> | null;
  org_id: PipedriveOrgRef;
  add_time: string;
  update_time: string;
};

export type PipedriveOrganization = {
  id: number;
  name: string;
  address: string | null;
  web_url?: string | null;
  add_time: string;
  update_time: string;
};

export type PipedriveDeal = {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: "open" | "won" | "lost" | "deleted";
  add_time: string;
  update_time: string;
  close_time: string | null;
  won_time: string | null;
  lost_time: string | null;
  person_id: { value: number; name: string } | number | null;
  org_id: PipedriveOrgRef;
  user_id: { id: number; name: string; email: string } | number | null;
  stage_id: number | null;
  pipeline_id: number | null;
};

type ListResponse<T> = {
  success: boolean;
  data: T[] | null;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
};

async function pdFetch<T>(domain: string, token: string, path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${PD_BASE(domain)}${path}${sep}api_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pipedrive ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(
  domain: string,
  token: string,
  endpoint: string,
  max = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  while (all.length < max) {
    const limit = Math.min(100, max - all.length);
    const page = await pdFetch<ListResponse<T>>(
      domain,
      token,
      `${endpoint}?start=${start}&limit=${limit}`,
    );
    if (!page.data || page.data.length === 0) break;
    all.push(...page.data);
    const pagination = page.additional_data?.pagination;
    if (!pagination?.more_items_in_collection || pagination.next_start == null) break;
    start = pagination.next_start;
  }
  return all;
}

export function listPersons(domain: string, token: string, max = 2000) {
  return listAll<PipedrivePerson>(domain, token, "/persons", max);
}

export function listOrganizations(domain: string, token: string, max = 1000) {
  return listAll<PipedriveOrganization>(domain, token, "/organizations", max);
}

export function listDeals(domain: string, token: string, max = 2000) {
  return listAll<PipedriveDeal>(domain, token, "/deals", max);
}

/** Validate domain + token combo (smallest authenticated call). */
export async function pingPipedrive(domain: string, token: string): Promise<boolean> {
  try {
    await pdFetch(domain, token, "/users/me");
    return true;
  } catch {
    return false;
  }
}

/** Pipedrive sometimes returns email as a string, sometimes as an array of {value, primary}. */
export function extractPrimaryEmail(p: PipedrivePerson): string | null {
  const e = p.primary_email ?? p.email;
  if (!e) return null;
  if (typeof e === "string") return e;
  if (Array.isArray(e) && e.length > 0) {
    const primary = e.find((x) => x.primary) ?? e[0];
    return primary?.value ?? null;
  }
  return null;
}

export function extractPrimaryPhone(p: PipedrivePerson): string | null {
  if (!p.phone || p.phone.length === 0) return null;
  const primary = p.phone.find((x) => x.primary) ?? p.phone[0];
  return primary?.value ?? null;
}

export function extractOrgId(ref: PipedriveOrgRef): number | null {
  if (ref == null) return null;
  if (typeof ref === "number") return ref;
  return ref.value ?? null;
}

/** Best-effort domain extraction from Pipedrive web_url. */
export function extractDomainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
