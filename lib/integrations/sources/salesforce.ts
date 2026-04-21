/**
 * Minimal Salesforce REST API client.
 *
 * Note on auth: real Salesforce production uses OAuth2 (web server flow).
 * For V1 we accept the user-provided instance_url + security_token (treated
 * as the access token) and call the REST API directly. The user can replace
 * with a real OAuth refresh flow later by extending this file.
 */

const SF_API_VERSION = "v60.0";

export type SfAccount = {
  Id: string;
  Name: string;
  Website: string | null;
  Industry: string | null;
};

export type SfContact = {
  Id: string;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  Phone: string | null;
  AccountId: string | null;
};

export type SfOpportunity = {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;
  CloseDate: string | null;
  IsClosed: boolean;
  IsWon: boolean;
  AccountId: string | null;
};

async function sfQuery<T>(
  instanceUrl: string,
  accessToken: string,
  soql: string,
): Promise<T[]> {
  const url = `${instanceUrl.replace(/\/$/, "")}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { records?: T[] };
  return data.records ?? [];
}

export const listSfAccounts = (instanceUrl: string, token: string, max = 1000) =>
  sfQuery<SfAccount>(
    instanceUrl,
    token,
    `SELECT Id, Name, Website, Industry FROM Account LIMIT ${max}`,
  );

export const listSfContacts = (instanceUrl: string, token: string, max = 2000) =>
  sfQuery<SfContact>(
    instanceUrl,
    token,
    `SELECT Id, FirstName, LastName, Email, Phone, AccountId FROM Contact LIMIT ${max}`,
  );

export const listSfOpportunities = (instanceUrl: string, token: string, max = 2000) =>
  sfQuery<SfOpportunity>(
    instanceUrl,
    token,
    `SELECT Id, Name, Amount, StageName, CloseDate, IsClosed, IsWon, AccountId FROM Opportunity LIMIT ${max}`,
  );

/** Validate Salesforce instance + token (smallest authenticated call). */
export async function pingSalesforce(instanceUrl: string, accessToken: string): Promise<boolean> {
  try {
    const url = `${instanceUrl.replace(/\/$/, "")}/services/data/${SF_API_VERSION}/limits`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Extract domain from a Salesforce Account.Website. */
export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
