/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Faux client Supabase DÉTERMINISTE pour tester les moteurs de calcul
 * (computeAggregate, moteur de réconciliation, valueFromAggSpec) sur des jeux
 * de données connus — sans réseau, sans base.
 *
 * Implémente le sous-ensemble du query-builder utilisé par les moteurs :
 * from().select().eq().in().gte().lte().is().not().order().limit().range()
 * + thenable ({ data, error }) et maybeSingle()/single().
 * Le filtrage est appliqué réellement (naïvement, champs de premier niveau) :
 * les maths des moteurs sont donc exercées sur les lignes exactes attendues.
 */

export type FakeRow = Record<string, unknown>;
export type Fixtures = Record<string, FakeRow[]>;

class FakeQuery {
  private rows: FakeRow[];

  constructor(rows: FakeRow[]) {
    this.rows = [...rows];
  }

  select(): this {
    return this;
  }

  eq(col: string, val: unknown): this {
    this.rows = this.rows.filter((r) => r[col] === val);
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.rows = this.rows.filter((r) => vals.includes(r[col]));
    return this;
  }

  // Comparaisons de dates ISO : l'ordre lexicographique suffit. Comme en SQL,
  // une valeur NULL ne matche jamais une comparaison.
  gte(col: string, val: unknown): this {
    this.rows = this.rows.filter((r) => r[col] != null && String(r[col]) >= String(val));
    return this;
  }

  lte(col: string, val: unknown): this {
    this.rows = this.rows.filter((r) => r[col] != null && String(r[col]) <= String(val));
    return this;
  }

  is(col: string, val: unknown): this {
    this.rows = this.rows.filter((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }

  not(col: string, op: string, val: unknown): this {
    if (op === "is" && val === null) this.rows = this.rows.filter((r) => r[col] != null);
    return this;
  }

  order(): this {
    return this;
  }

  limit(n: number): this {
    this.rows = this.rows.slice(0, n);
    return this;
  }

  range(from: number, to: number): this {
    this.rows = this.rows.slice(from, to + 1);
    return this;
  }

  maybeSingle(): Promise<{ data: FakeRow | null; error: null }> {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }

  single(): Promise<{ data: FakeRow | null; error: { message: string } | null }> {
    return Promise.resolve(
      this.rows[0] ? { data: this.rows[0], error: null } : { data: null, error: { message: "0 rows" } },
    );
  }

  then<T>(
    onFulfilled: (value: { data: FakeRow[]; error: null }) => T,
    onRejected?: (reason: unknown) => T,
  ): Promise<T> {
    return Promise.resolve({ data: this.rows, error: null as null }).then(onFulfilled, onRejected);
  }
}

/** Client factice : `fixtures` = lignes par table (table absente = vide). */
export function fakeSupabase(fixtures: Fixtures): any {
  return { from: (table: string) => new FakeQuery(fixtures[table] ?? []) };
}
