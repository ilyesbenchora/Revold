/**
 * Minimal Zendesk REST API client.
 * Auth: email/token Basic auth → "{email}/token:{api_token}".
 */

const ZD_BASE = (subdomain: string) => `https://${subdomain}.zendesk.com/api/v2`;

export type ZendeskUser = {
  id: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  organization_id: number | null;
  role: "end-user" | "agent" | "admin";
  created_at: string;
};

export type ZendeskOrganization = {
  id: number;
  name: string;
  domain_names: string[];
};

export type ZendeskTicket = {
  id: number;
  subject: string | null;
  description: string | null;
  status: "new" | "open" | "pending" | "hold" | "solved" | "closed";
  priority: "low" | "normal" | "high" | "urgent" | null;
  via: { channel: string };
  requester_id: number | null;
  organization_id: number | null;
  assignee_id: number | null;
  created_at: string;
  updated_at: string;
};

function basicAuth(email: string, token: string): string {
  return Buffer.from(`${email}/token:${token}`).toString("base64");
}

async function zdFetch<T>(
  subdomain: string,
  email: string,
  token: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${ZD_BASE(subdomain)}${path}`, {
    headers: {
      Authorization: `Basic ${basicAuth(email, token)}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zendesk ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(
  subdomain: string,
  email: string,
  token: string,
  endpoint: string,
  resultKey: string,
  max = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let nextPage: string | null = `${endpoint}?per_page=100`;
  while (nextPage && all.length < max) {
    const requestPath: string = nextPage.startsWith("http")
      ? nextPage.replace(`${ZD_BASE(subdomain)}`, "")
      : nextPage;
    const response = await zdFetch<Record<string, unknown>>(subdomain, email, token, requestPath);
    const data = (response[resultKey] as T[]) ?? [];
    if (data.length === 0) break;
    all.push(...data);
    nextPage = (response.next_page as string | null) ?? null;
  }
  return all;
}

export const listZendeskUsers = (sub: string, email: string, token: string, max = 1000) =>
  listAll<ZendeskUser>(sub, email, token, "/users.json", "users", max);

export const listZendeskOrganizations = (sub: string, email: string, token: string, max = 500) =>
  listAll<ZendeskOrganization>(sub, email, token, "/organizations.json", "organizations", max);

export const listZendeskTickets = (sub: string, email: string, token: string, max = 1000) =>
  listAll<ZendeskTicket>(sub, email, token, "/tickets.json", "tickets", max);
