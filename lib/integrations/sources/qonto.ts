/**
 * Minimal Qonto API client (banque pro FR).
 * Auth: header `Authorization: {organization_slug}:{secret_key}` — clé créée
 * depuis l'app Qonto → Paramètres → API & intégrations.
 * Docs : https://api-doc.qonto.com/
 */

const QONTO_API = "https://thirdparty.qonto.com/v2";

function headers(slug: string, secretKey: string): Record<string, string> {
  return { Authorization: `${slug}:${secretKey}`, Accept: "application/json" };
}

export type QontoBankAccount = {
  slug: string;
  iban: string;
  currency: string;
  balance: number;
  name?: string | null;
};

export type QontoOrganization = {
  slug: string;
  legal_name?: string | null;
  bank_accounts: QontoBankAccount[];
};

export type QontoTransaction = {
  transaction_id: string;
  /** Montant positif ; le sens est porté par `side`. */
  amount: number;
  currency: string;
  side: "credit" | "debit";
  operation_type?: string | null;
  /** pending | completed | declined */
  status: string;
  settled_at?: string | null;
  emitted_at?: string | null;
  /** Nom de la contrepartie. */
  label?: string | null;
  reference?: string | null;
  note?: string | null;
};

export async function getQontoOrganization(
  slug: string,
  secretKey: string,
): Promise<QontoOrganization | null> {
  const res = await fetch(`${QONTO_API}/organization`, { headers: headers(slug, secretKey) });
  if (!res.ok) return null;
  const json = (await res.json()) as { organization?: QontoOrganization };
  return json.organization ?? null;
}

/** Vérifie les identifiants (GET /v2/organization → 200). */
export async function pingQonto(slug: string, secretKey: string): Promise<boolean> {
  if (!slug || !secretKey) return false;
  return (await getQontoOrganization(slug, secretKey)) !== null;
}

/**
 * Transactions d'un compte (IBAN) sur les `sinceDays` derniers jours
 * (défaut 365). Pagination Qonto : meta.next_page (numéro de page).
 */
export async function listQontoTransactions(
  slug: string,
  secretKey: string,
  iban: string,
  sinceDays = 365,
  maxPages = 40,
): Promise<QontoTransaction[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const out: QontoTransaction[] = [];
  let page: number | null = 1;
  for (let i = 0; i < maxPages && page; i++) {
    const params = new URLSearchParams({
      iban,
      per_page: "100",
      current_page: String(page),
      "emitted_at_from": since,
    });
    const res = await fetch(`${QONTO_API}/transactions?${params}`, { headers: headers(slug, secretKey) });
    if (!res.ok) throw new Error(`Qonto transactions ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as {
      transactions?: QontoTransaction[];
      meta?: { next_page?: number | null };
    };
    out.push(...(json.transactions ?? []));
    page = json.meta?.next_page ?? null;
  }
  return out;
}
