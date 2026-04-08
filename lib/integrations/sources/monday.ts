/**
 * Minimal monday.com GraphQL API client.
 *
 * monday CRM is built on top of monday boards. We pull boards tagged as
 * "CRM" or "Deals" (heuristic via name pattern), then their items.
 */

const MONDAY_API = "https://api.monday.com/v2";

export type MondayBoard = {
  id: string;
  name: string;
  state: string;
};

export type MondayItem = {
  id: string;
  name: string;
  column_values: Array<{
    id: string;
    title: string;
    text: string | null;
    value: string | null;
  }>;
};

async function gql<T>(token: string, query: string): Promise<T> {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": "2024-04",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`monday ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (data.errors?.length) throw new Error(`monday: ${data.errors[0].message}`);
  if (!data.data) throw new Error("monday: empty response");
  return data.data;
}

export async function listMondayBoards(token: string): Promise<MondayBoard[]> {
  const res = await gql<{ boards: MondayBoard[] }>(
    token,
    `query { boards(limit:100, state:active) { id name state } }`,
  );
  return res.boards ?? [];
}

export async function listMondayItems(token: string, boardId: string, max = 500): Promise<MondayItem[]> {
  const res = await gql<{ boards: Array<{ items_page: { items: MondayItem[] } }> }>(
    token,
    `query { boards(ids:${boardId}) { items_page(limit:${max}) { items { id name column_values { id title text value } } } } }`,
  );
  return res.boards?.[0]?.items_page?.items ?? [];
}

/** Heuristic: pick boards that look like CRM/Deals/Pipeline. */
export function pickCrmBoards(boards: MondayBoard[]): MondayBoard[] {
  const re = /(crm|deal|pipeline|sales|opportunit|client)/i;
  return boards.filter((b) => re.test(b.name));
}

/** Extract column value by title heuristic. */
export function getCol(item: MondayItem, ...titles: string[]): string | null {
  const lower = titles.map((t) => t.toLowerCase());
  const col = item.column_values.find((c) => lower.includes((c.title || "").toLowerCase()));
  return col?.text || null;
}
