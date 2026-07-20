import { describe, expect, it, vi } from "vitest";
import { computeAggregate } from "@/lib/ai/agents/tool-library";

/**
 * Le filtre `pipeline` doit produire des chiffres FIABLES ou rien du tout.
 * Le piège : quand le rattachement au pipeline n'est résoluble ni par le
 * canonique ni par HubSpot, filtrer renvoie 0 deals — un 0 qui déclencherait
 * à tort une alerte « en dessous du seuil ». On exige une erreur (→ le cron
 * passe l'alerte) plutôt qu'un faux zéro.
 */

type Row = Record<string, unknown>;

/** Supabase minimal : .from().select().eq().limit() → { data } */
function fakeSupabase(rows: Row[]) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.in = () => q;
  q.gte = () => q;
  q.lte = () => q;
  q.limit = () => Promise.resolve({ data: rows, error: null });
  return { from: () => q } as never;
}

const stage = (name: string, pipelineName: string | null, pipelineExtId: string | null) => ({
  amount: 100,
  created_date: "2026-01-15",
  close_date: "2026-02-15",
  stage_external_id: "ext-1",
  pipeline_stages: { name, pipeline_name: pipelineName, pipeline_external_id: pipelineExtId },
});

describe("computeAggregate — portée pipeline", () => {
  it("refuse de répondre quand le pipeline n'est pas résoluble (pas de faux zéro)", async () => {
    // Cas réel observé en prod : pipeline_stages non mappé + pas de token HubSpot.
    const rows = [stage("Qualification", null, null), stage("Gagné", null, null)];
    const res = await computeAggregate(fakeSupabase(rows), "org-1", [], null, {
      entity: "deals",
      groupBy: "stage",
      measure: "count",
      pipeline: "default",
    });

    expect(res.error).toBeTruthy();
    expect(res.rows).toBeUndefined();
  });

  it("isole bien un pipeline quand le canonique est mappé", async () => {
    const rows = [
      stage("Gagné", "Pipeline A", "pa"),
      stage("Gagné", "Pipeline A", "pa"),
      stage("Gagné", "Pipeline B", "pb"), // même libellé, autre pipeline
    ];
    const res = await computeAggregate(fakeSupabase(rows), "org-1", [], null, {
      entity: "deals",
      groupBy: "stage",
      measure: "count",
      pipeline: "pa",
    });

    expect(res.error).toBeFalsy();
    // 2 deals, pas 3 : l'étape homonyme du Pipeline B est exclue.
    expect(res.rows).toEqual([{ group: "Gagné", value: 2 }]);
    expect(res.totalRows).toBe(2);
  });

  it("sans filtre pipeline, les étapes homonymes restent agrégées ensemble", async () => {
    const rows = [stage("Gagné", "Pipeline A", "pa"), stage("Gagné", "Pipeline B", "pb")];
    const res = await computeAggregate(fakeSupabase(rows), "org-1", [], null, {
      entity: "deals",
      groupBy: "stage",
      measure: "count",
    });

    expect(res.rows).toEqual([{ group: "Gagné", value: 2 }]);
  });

  it("groupBy stage_pipeline qualifie chaque étape par son pipeline", async () => {
    const rows = [stage("Gagné", "Pipeline A", "pa"), stage("Gagné", "Pipeline B", "pb")];
    const res = await computeAggregate(fakeSupabase(rows), "org-1", [], null, {
      entity: "deals",
      groupBy: "stage_pipeline",
      measure: "count",
    });

    const groups = (res.rows as { group: string }[]).map((r) => r.group).sort();
    expect(groups).toEqual(["Pipeline A › Gagné", "Pipeline B › Gagné"]);
  });
});

vi.mock("@/lib/integrations/hubspot-snapshot", () => ({
  fetchDealsPipelines: async () => [],
}));
