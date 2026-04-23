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
  // Détecte si l'endpoint contient déjà une query string (?status=all par ex.)
  // — sans ça, on concatène un 2e "?" qui produit /subscriptions?status=all?limit=100
  // que Stripe parse comme status="all?limit=100" → HTTP 400 (Invalid status).
  const sep = endpoint.includes("?") ? "&" : "?";
  while (all.length < maxItems) {
    const params = new URLSearchParams({ limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const page = await stripeFetch<ListResponse<T>>(
      secretKey,
      `${endpoint}${sep}${params.toString()}`,
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

/**
 * Compteurs LIVE Stripe pour l'UI (page Données).
 *
 * On ne stocke pas localement — on lit directement Stripe. Cap à 5000 par
 * objet pour rester rapide tout en couvrant la plupart des comptes pilote.
 * Si l'utilisateur a > 5000 customers/invoices, on retourne `truncated: true`
 * et le compte est un minorant.
 */
export type StripeLiveCounts = {
  customers: number;
  invoices: number;
  subscriptions: number;
  truncated: boolean;
  error?: string;
};

export async function fetchStripeLiveCounts(
  secretKey: string,
): Promise<StripeLiveCounts> {
  // Cap volontairement bas pour rester sous 30s sur l'UI : on veut une
  // métrique d'ordre de grandeur, pas un export complet (la sync officielle
  // remplit les tables locales).
  const CAP = 1000;
  if (!secretKey || typeof secretKey !== "string") {
    return {
      customers: 0,
      invoices: 0,
      subscriptions: 0,
      truncated: false,
      error: "Clé Stripe absente.",
    };
  }
  try {
    const [customers, invoices, subscriptions] = await Promise.all([
      listCustomers(secretKey, CAP).catch(() => [] as StripeCustomer[]),
      listInvoices(secretKey, CAP).catch(() => [] as StripeInvoice[]),
      listSubscriptions(secretKey, CAP).catch(() => [] as StripeSubscription[]),
    ]);
    return {
      customers: customers.length,
      invoices: invoices.length,
      subscriptions: subscriptions.length,
      truncated:
        customers.length === CAP || invoices.length === CAP || subscriptions.length === CAP,
    };
  } catch (err) {
    return {
      customers: 0,
      invoices: 0,
      subscriptions: 0,
      truncated: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "Erreur Stripe",
    };
  }
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

/**
 * Validation Stripe enrichie : détecte le type de clé (pk/sk/rk), le mode
 * (test/live) et la cause d'échec (401, 403, format invalide). Conçue pour
 * que le wizard puisse afficher un message UX précis au lieu d'un échec
 * générique.
 */
export type StripePingResult =
  | { ok: true; mode: "live" | "test"; keyType: "secret" | "restricted" }
  | { ok: false; reason: string; hint?: string };

export async function pingStripeDetailed(secretKey: string): Promise<StripePingResult> {
  const key = (secretKey ?? "").trim();
  if (!key) {
    return { ok: false, reason: "Clé Stripe manquante." };
  }
  if (key.startsWith("pk_")) {
    return {
      ok: false,
      reason: "Vous avez collé une Publishable Key (pk_…). Stripe utilise deux clés différentes : la publishable est publique et inutile ici.",
      hint: "Il vous faut une Secret Key (sk_live_… / sk_test_…) ou une Restricted Key en lecture seule (rk_live_… / rk_test_…).",
    };
  }
  if (key.startsWith("whsec_")) {
    return {
      ok: false,
      reason: "C'est un secret de webhook (whsec_…), pas une clé API.",
      hint: "Allez dans Developers → API keys (pas Webhooks) pour récupérer la bonne clé.",
    };
  }
  if (!key.startsWith("sk_") && !key.startsWith("rk_")) {
    return {
      ok: false,
      reason: "Format de clé inattendu.",
      hint: "Une clé Stripe valide commence par sk_live_, sk_test_, rk_live_ ou rk_test_.",
    };
  }

  const mode: "live" | "test" =
    key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "test" : "live";
  const keyType: "secret" | "restricted" = key.startsWith("rk_") ? "restricted" : "secret";

  try {
    await stripeFetch(key, "/balance");
    return { ok: true, mode, keyType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes(" 401")) {
      return {
        ok: false,
        reason: "Stripe a rejeté la clé (401 Unauthorized).",
        hint: "Vérifiez qu'elle est active dans Developers → API keys et qu'elle n'a pas été révoquée.",
      };
    }
    if (msg.includes(" 403")) {
      return {
        ok: false,
        reason: "Permissions insuffisantes sur cette Restricted Key.",
        hint: "Cochez les accès READ pour Customers, Charges, Invoices, Subscriptions et Balance, puis recréez la clé.",
      };
    }
    return {
      ok: false,
      reason: `Stripe a refusé la clé : ${msg.slice(0, 140)}`,
    };
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
