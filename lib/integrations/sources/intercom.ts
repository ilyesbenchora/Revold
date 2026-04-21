/**
 * Minimal Intercom REST API client (v2.11).
 * Auth: Access Token (Bearer).
 */

const INTERCOM_API = "https://api.intercom.io";

export type IntercomContact = {
  id: string;
  type: "contact";
  external_id: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: "user" | "lead";
  companies?: { data: Array<{ id: string }> };
  created_at: number;
};

export type IntercomCompany = {
  id: string;
  company_id: string | null;
  name: string | null;
  website: string | null;
  industry: string | null;
};

export type IntercomConversation = {
  id: string;
  source: { type: string; subject?: string };
  state: "open" | "closed" | "snoozed";
  priority: "priority" | "not_priority";
  assignee?: { type: string; id: string };
  contacts: { contacts: Array<{ id: string }> };
  created_at: number;
  updated_at: number;
  statistics?: { first_admin_reply_at: number | null };
  conversation_rating?: { rating: number | null } | null;
};

async function intercomFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${INTERCOM_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Intercom-Version": "2.11",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Intercom ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

type ScrollResponse<T> = {
  data?: T[];
  scroll_param?: string | null;
};

async function scrollAll<T>(token: string, path: string, max = 1000): Promise<T[]> {
  const all: T[] = [];
  let scrollParam: string | undefined;
  while (all.length < max) {
    const url = scrollParam ? `${path}?scroll_param=${scrollParam}` : path;
    const page = await intercomFetch<ScrollResponse<T>>(token, url);
    const data = page.data ?? [];
    if (data.length === 0) break;
    all.push(...data);
    if (!page.scroll_param) break;
    scrollParam = page.scroll_param;
  }
  return all;
}

/** Validate the Intercom access token via /me (smallest authenticated call). */
export async function pingIntercom(token: string): Promise<boolean> {
  try {
    await intercomFetch(token, "/me");
    return true;
  } catch {
    return false;
  }
}

export const listIntercomContacts = (token: string, max = 1000) =>
  scrollAll<IntercomContact>(token, "/contacts/scroll", max);

export const listIntercomCompanies = (token: string, max = 500) =>
  scrollAll<IntercomCompany>(token, "/companies/scroll", max);

export async function listIntercomConversations(
  token: string,
  max = 500,
): Promise<IntercomConversation[]> {
  const all: IntercomConversation[] = [];
  let startingAfter: string | undefined;
  while (all.length < max) {
    const url = `/conversations?per_page=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
    const page = await intercomFetch<{
      conversations?: IntercomConversation[];
      pages?: { next?: { starting_after?: string } };
    }>(token, url);
    const convos = page.conversations ?? [];
    if (convos.length === 0) break;
    all.push(...convos);
    const next = page.pages?.next?.starting_after;
    if (!next) break;
    startingAfter = next;
  }
  return all;
}
