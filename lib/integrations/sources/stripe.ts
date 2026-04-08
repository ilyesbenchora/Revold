/**
 * Minimal Stripe API client used by the ingestion worker.
 * Uses fetch + Basic auth (secret key) — no Stripe SDK dependency.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export type StripeCustomer = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: number;
  metadata?: Record<string, string>;
};

export type StripeInvoice = {
  id: string;
  customer: string | null;
  number: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: string;
  total: number;          // in cents
  amount_paid: number;
  amount_due: number;
  created: number;
  due_date: number | null;
  status_transitions: { paid_at: number | null };
};

export type StripeSubscription = {
  id: string;
  customer: string | null;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused";
  currency: string;
  current_period_start: number;
  current_period_end: number;
  start_date: number;
  canceled_at: number | null;
  items: {
    data: Array<{
      price: {
        unit_amount: number | null;        // in cents
        currency: string;
        recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null;
      };
      quantity: number;
    }>;
  };
};

type ListResponse<T> = {
  object: "list";
  data: T[];
  has_more: boolean;
  url: string;
};

async function stripeFetch<T>(secretKey: string, path: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Iterate through every page of a Stripe list endpoint, capped at maxItems. */
async function listAll<T extends { id: string }>(
  secretKey: string,
  endpoint: string,
  maxItems = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let startingAfter: string | undefined;
  while (all.length < maxItems) {
    const params = new URLSearchParams({ limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const page = await stripeFetch<ListResponse<T>>(
      secretKey,
      `${endpoint}?${params.toString()}`,
    );
    all.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return all;
}

export function listCustomers(secretKey: string, max = 1000) {
  return listAll<StripeCustomer>(secretKey, "/customers", max);
}

export function listInvoices(secretKey: string, max = 2000) {
  return listAll<StripeInvoice>(secretKey, "/invoices", max);
}

export function listSubscriptions(secretKey: string, max = 1000) {
  return listAll<StripeSubscription>(
    secretKey,
    "/subscriptions?status=all",
    max,
  );
}

/** Validate the Stripe key by hitting /balance (smallest authenticated call). */
export async function pingStripe(secretKey: string): Promise<boolean> {
  try {
    await stripeFetch(secretKey, "/balance");
    return true;
  } catch {
    return false;
  }
}

/** Compute MRR for a Stripe subscription (in major currency units, e.g. EUR). */
export function computeMrr(sub: StripeSubscription): number {
  let mrr = 0;
  for (const item of sub.items.data) {
    const unit = item.price.unit_amount ?? 0;
    const qty = item.quantity ?? 1;
    const recur = item.price.recurring;
    if (!recur) continue;
    const monthly =
      recur.interval === "month" ? 1 / recur.interval_count :
      recur.interval === "year" ? 1 / (12 * recur.interval_count) :
      recur.interval === "week" ? 4.345 / recur.interval_count :
      recur.interval === "day" ? 30 / recur.interval_count :
      0;
    mrr += (unit * qty * monthly) / 100;
  }
  return Math.round(mrr * 100) / 100;
}
