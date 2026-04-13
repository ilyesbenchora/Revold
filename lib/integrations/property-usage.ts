/**
 * Counts property dependencies across HubSpot assets:
 * - Workflows (GET /automation/v4/flows + detail per flow)
 * - Lists/Segments (GET /crm/v3/lists/search + GET /crm/v3/lists/{id}?includeFilters=true)
 * - Forms (GET /forms/v2/forms)
 */

const HS = "https://api.hubapi.com";

type AssetDeps = {
  workflows: number;
  forms: number;
  lists: number;
};

export type PropertyUsage = {
  name: string;
  label: string;
  isCustom: boolean;
  deps: AssetDeps;
  totalDeps: number;
};

/** Extract property names from a workflow detail JSON (actions + enrollment criteria) */
function extractWorkflowProps(wf: unknown): Set<string> {
  const props = new Set<string>();
  const json = JSON.stringify(wf);
  for (const re of [
    /"property_name"\s*:\s*"([^"]+)"/g,
    /"propertyName"\s*:\s*"([^"]+)"/g,
    /"property"\s*:\s*"([^"]+)"/g,
    /"filterProperty"\s*:\s*"([^"]+)"/g,
  ]) {
    let m;
    while ((m = re.exec(json)) !== null) props.add(m[1]);
  }
  return props;
}

/** Recursively extract property names from a list filterBranch */
function extractFilterBranchProps(branch: unknown): Set<string> {
  const props = new Set<string>();
  if (!branch || typeof branch !== "object") return props;
  const b = branch as Record<string, unknown>;

  // Direct filters with filterType: "PROPERTY"
  if (Array.isArray(b.filters)) {
    for (const f of b.filters) {
      if (f && typeof f === "object" && (f as Record<string, unknown>).filterType === "PROPERTY") {
        const prop = (f as Record<string, unknown>).property;
        if (typeof prop === "string") props.add(prop);
      }
    }
  }

  // Nested filterBranches
  if (Array.isArray(b.filterBranches)) {
    for (const child of b.filterBranches) {
      for (const p of extractFilterBranchProps(child)) props.add(p);
    }
  }

  return props;
}

/** Extract property names from a form (v2 format) */
function extractFormProps(form: unknown): Set<string> {
  const props = new Set<string>();
  const json = JSON.stringify(form);
  // v2 forms have formFieldGroups[].fields[].name
  const re = /"name"\s*:\s*"([a-z_][a-z0-9_]*)"/gi;
  let m;
  while ((m = re.exec(json)) !== null) {
    const name = m[1];
    if (name.length > 2 && !["submit", "button", "form", "field", "true", "false", "type", "name", "label"].includes(name)) {
      props.add(name);
    }
  }
  return props;
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchPropertyUsage(token: string): Promise<PropertyUsage[]> {
  // 1. Get all contact properties
  const propsData = await fetchJson(`${HS}/crm/v3/properties/contacts`, token) as { results?: Array<{ name: string; label: string; hubspotDefined: boolean }> } | null;
  if (!propsData?.results) return [];
  const allProps = propsData.results;

  const usage = new Map<string, AssetDeps>();
  for (const p of allProps) usage.set(p.name, { workflows: 0, forms: 0, lists: 0 });

  // 2. Scan workflows
  try {
    let after: string | undefined;
    let pages = 0;
    while (pages < 5) {
      const url = after
        ? `${HS}/automation/v4/flows?limit=10&after=${after}`
        : `${HS}/automation/v4/flows?limit=10`;
      const data = await fetchJson(url, token) as { results?: Array<{ id: string }>; paging?: { next?: { after: string } } } | null;
      if (!data?.results) break;

      // Fetch each workflow detail in parallel (batch of 10)
      const details = await Promise.all(
        data.results.map((wf) => fetchJson(`${HS}/automation/v4/flows/${wf.id}`, token).catch(() => null)),
      );
      for (const detail of details) {
        if (!detail) continue;
        for (const prop of extractWorkflowProps(detail)) {
          const u = usage.get(prop);
          if (u) u.workflows++;
        }
      }

      after = data.paging?.next?.after;
      pages++;
      if (!after) break;
    }
  } catch {}

  // 3. Scan lists/segments (v3 with filters)
  try {
    // First get all list IDs
    let offset = 0;
    const listIds: Array<{ id: string; processingType: string }> = [];
    let hasMore = true;
    while (hasMore && listIds.length < 100) {
      const data = await fetchJson(
        `${HS}/crm/v3/lists/search`,
        token,
      ).catch(() => null);

      // Use POST search
      const res = await fetch(`${HS}/crm/v3/lists/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "", count: 50, offset, processingTypes: ["DYNAMIC"] }),
      });
      if (!res.ok) break;
      const body = await res.json() as { lists?: Array<{ listId: string; processingType: string }>; hasMore?: boolean; offset?: number };
      for (const l of body.lists ?? []) listIds.push({ id: l.listId, processingType: l.processingType });
      hasMore = body.hasMore ?? false;
      offset = body.offset ?? 0;
    }

    // Fetch each list with filters (parallel, batches of 10)
    for (let i = 0; i < listIds.length; i += 10) {
      const batch = listIds.slice(i, i + 10);
      const details = await Promise.all(
        batch.map((l) => fetchJson(`${HS}/crm/v3/lists/${l.id}?includeFilters=true`, token).catch(() => null)),
      );
      for (const detail of details) {
        if (!detail || typeof detail !== "object") continue;
        const list = (detail as Record<string, unknown>).list ?? detail;
        const filterBranch = (list as Record<string, unknown>).filterBranch;
        if (filterBranch) {
          for (const prop of extractFilterBranchProps(filterBranch)) {
            const u = usage.get(prop);
            if (u) u.lists++;
          }
        }
      }
    }
  } catch {}

  // 4. Scan forms (v2)
  try {
    const data = await fetchJson(`${HS}/forms/v2/forms?limit=100`, token);
    if (Array.isArray(data)) {
      for (const form of data) {
        for (const prop of extractFormProps(form)) {
          const u = usage.get(prop);
          if (u) u.forms++;
        }
      }
    }
  } catch {}

  // Build result
  return allProps
    .map((p) => {
      const deps = usage.get(p.name) ?? { workflows: 0, forms: 0, lists: 0 };
      return {
        name: p.name,
        label: p.label || p.name,
        isCustom: !p.hubspotDefined,
        deps,
        totalDeps: deps.workflows + deps.forms + deps.lists,
      };
    })
    .filter((p) => p.totalDeps > 0 || p.isCustom)
    .sort((a, b) => b.totalDeps - a.totalDeps);
}
