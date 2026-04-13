/**
 * Counts property dependencies across HubSpot assets:
 * workflows, forms, active lists (segments).
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

/** Extract property names referenced in a workflow's actions and enrollment criteria */
function extractWorkflowProps(wf: Record<string, unknown>): Set<string> {
  const props = new Set<string>();
  const json = JSON.stringify(wf);
  // Match "property_name":"xxx" or "propertyName":"xxx" or "property":"xxx"
  const patterns = [
    /"property_name"\s*:\s*"([^"]+)"/g,
    /"propertyName"\s*:\s*"([^"]+)"/g,
    /"property"\s*:\s*"([^"]+)"/g,
    /"filterProperty"\s*:\s*"([^"]+)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(json)) !== null) props.add(m[1]);
  }
  return props;
}

/** Extract property names from form field groups */
function extractFormProps(form: Record<string, unknown>): Set<string> {
  const props = new Set<string>();
  const json = JSON.stringify(form);
  const re = /"name"\s*:\s*"([a-z_][a-z0-9_]*)"/gi;
  let m;
  while ((m = re.exec(json)) !== null) {
    const name = m[1];
    if (name.length > 2 && !["submit", "button", "form", "field", "true", "false"].includes(name)) {
      props.add(name);
    }
  }
  return props;
}

/** Extract property names from list filters */
function extractListProps(list: Record<string, unknown>): Set<string> {
  const props = new Set<string>();
  const json = JSON.stringify(list);
  const re = /"property"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(json)) !== null) props.add(m[1]);
  return props;
}

export async function fetchPropertyUsage(token: string): Promise<PropertyUsage[]> {
  // 1. Get all contact properties with metadata
  const propsRes = await fetch(`${HS}/crm/v3/properties/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!propsRes.ok) return [];
  const propsData = await propsRes.json();
  const allProps: Array<{ name: string; label: string; hubspotDefined: boolean }> = propsData.results ?? [];

  // Build map: property name → usage counts
  const usage = new Map<string, AssetDeps>();
  for (const p of allProps) usage.set(p.name, { workflows: 0, forms: 0, lists: 0 });

  // 2. Scan workflows (max 50)
  try {
    let after: string | undefined;
    let pages = 0;
    while (pages < 5) {
      const url = new URL(`${HS}/automation/v4/flows`);
      url.searchParams.set("limit", "10");
      if (after) url.searchParams.set("after", after);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) break;
      const data = await res.json();
      for (const wf of data.results ?? []) {
        // Fetch full workflow to get actions
        try {
          const detailRes = await fetch(`${HS}/automation/v4/flows/${wf.id}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            for (const prop of extractWorkflowProps(detail)) {
              const u = usage.get(prop);
              if (u) u.workflows++;
            }
          }
        } catch {}
      }
      after = data.paging?.next?.after;
      pages++;
      if (!after) break;
    }
  } catch {}

  // 3. Scan forms
  try {
    const res = await fetch(`${HS}/marketing/v3/forms?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      for (const form of data.results ?? []) {
        for (const prop of extractFormProps(form)) {
          const u = usage.get(prop);
          if (u) u.forms++;
        }
      }
    }
  } catch {}

  // 4. Scan active lists (segments)
  try {
    const res = await fetch(`${HS}/contacts/v1/lists?count=100&listType=DYNAMIC`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      for (const list of data.lists ?? []) {
        for (const prop of extractListProps(list)) {
          const u = usage.get(prop);
          if (u) u.lists++;
        }
      }
    }
  } catch {}

  // Build final result
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
