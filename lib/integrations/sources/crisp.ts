/**
 * Minimal Crisp REST API client.
 * Auth: Basic auth using plugin identifier:key.
 * Crisp uses a plugin model: each "user" of the API is a plugin.
 */

const CRISP_API = "https://api.crisp.chat/v1";

export type CrispProfile = {
  people_id: string;
  email: string;
  person: { nickname?: string; phone?: string };
  company?: { name?: string; url?: string };
  segments?: string[];
};

export type CrispConversation = {
  session_id: string;
  state: "pending" | "unresolved" | "resolved";
  meta?: { email?: string; nickname?: string; subject?: string };
  created_at: number;
  updated_at: number;
};

function basicAuth(identifier: string, key: string): string {
  return Buffer.from(`${identifier}:${key}`).toString("base64");
}

async function crispFetch<T>(
  identifier: string,
  key: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${CRISP_API}${path}`, {
    headers: {
      Authorization: `Basic ${basicAuth(identifier, key)}`,
      "X-Crisp-Tier": "plugin",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Crisp ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function listAll<T>(
  identifier: string,
  key: string,
  endpoint: string,
  max = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < max) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await crispFetch<{ error: boolean; data?: T[] }>(
      identifier,
      key,
      `${endpoint}${sep}page_number=${page}`,
    );
    const data = res.data ?? [];
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < 50) break;
    page++;
  }
  return all;
}

export const listCrispProfiles = (websiteId: string, identifier: string, key: string, max = 1000) =>
  listAll<CrispProfile>(identifier, key, `/website/${websiteId}/people/profiles`, max);

export const listCrispConversations = (websiteId: string, identifier: string, key: string, max = 500) =>
  listAll<CrispConversation>(identifier, key, `/website/${websiteId}/conversations/1`, max);
