/**
 * Minimal QuickBooks Online REST API client.
 * Auth: OAuth2 refresh-token flow → exchange refresh_token for access_token.
 */

const QB_AUTH = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API = (companyId: string) =>
  `https://quickbooks.api.intuit.com/v3/company/${companyId}`;

export type QbCustomer = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
};

export type QbInvoice = {
  Id: string;
  DocNumber: string | null;
  TotalAmt: number;
  Balance: number;
  CurrencyRef: { value: string };
  TxnDate: string | null;
  DueDate: string | null;
  CustomerRef: { value: string };
};

export async function refreshQbAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(QB_AUTH, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`QuickBooks token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("QuickBooks: no access_token returned");
  return data.access_token;
}

async function qbQuery<T>(companyId: string, accessToken: string, sql: string): Promise<T[]> {
  const url = `${QB_API(companyId)}/query?query=${encodeURIComponent(sql)}&minorversion=70`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`QuickBooks ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { QueryResponse?: Record<string, unknown> };
  // QueryResponse contains either Customer[], Invoice[], etc.
  const qr = data.QueryResponse ?? {};
  const key = Object.keys(qr).find((k) => Array.isArray((qr as Record<string, unknown>)[k]));
  return key ? ((qr as Record<string, unknown>)[key] as T[]) : [];
}

export const listQbCustomers = (companyId: string, token: string, max = 1000) =>
  qbQuery<QbCustomer>(companyId, token, `SELECT * FROM Customer MAXRESULTS ${max}`);

export const listQbInvoices = (companyId: string, token: string, max = 1000) =>
  qbQuery<QbInvoice>(companyId, token, `SELECT * FROM Invoice MAXRESULTS ${max}`);
