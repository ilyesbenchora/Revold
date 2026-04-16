export function resolvePresetDates(preset: string): { from: string | null; to: string | null } {
  if (!preset || preset === "all_time") return { from: null, to: null };
  const now = new Date();
  const to = now.toISOString();
  let from: string;

  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      return { from, to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString() };
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1).toISOString();
      break;
    }
    case "last_quarter": {
      const cq = Math.floor(now.getMonth() / 3) * 3;
      return { from: new Date(now.getFullYear(), cq - 3, 1).toISOString(), to: new Date(now.getFullYear(), cq, 0).toISOString() };
    }
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
    case "last_6m":
      from = new Date(Date.now() - 180 * 86400000).toISOString();
      break;
    default:
      return { from: null, to: null };
  }
  return { from, to };
}
