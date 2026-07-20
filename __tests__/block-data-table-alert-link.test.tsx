import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlockDataTable } from "@/components/data-tables/block-data-table";
import { blockSourceKey } from "@/components/data-tables/surgical-alert-button";

/**
 * Compteur d'alertes posées sur une table de données : nombre affiché + lien
 * direct vers la fiche dans Mes alertes. Vérifie le rendu réel du composant
 * (pas seulement l'API), en simulant la réponse de GET /api/alerts?source_key=.
 */

function mockAlerts(alerts: Array<{ id: string; title: string; status: string }>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => ({ alerts }),
    __url: String(input),
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

const ROWS = [
  { name: "Qualification", value: 12 },
  { name: "RAPPROCHEMENT", value: 7 },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BlockDataTable — compteur et lien d'alertes", () => {
  it("n'affiche aucun compteur quand la table ne porte pas d'alerte", async () => {
    mockAlerts([]);
    render(<BlockDataTable title="Étapes du pipeline" team="sales" rows={ROWS} />);

    await waitFor(() => expect(screen.getByText("Qualification")).toBeDefined());
    expect(screen.queryByText(/alerte/i)?.textContent).not.toMatch(/^\d/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("affiche « 1 alerte » au singulier et pointe vers la fiche", async () => {
    mockAlerts([{ id: "abc-123", title: "Alerte — RAPPROCHEMENT", status: "active" }]);
    render(<BlockDataTable title="Étapes du pipeline" team="sales" rows={ROWS} />);

    const link = await screen.findByRole("link");
    expect(link.textContent).toContain("1 alerte");
    expect(link.getAttribute("href")).toBe("/dashboard/mes-alertes#alerte-abc-123");
    expect(link.getAttribute("title")).toContain("Alerte — RAPPROCHEMENT");
  });

  it("affiche le nombre au pluriel quand plusieurs alertes portent sur la table", async () => {
    mockAlerts([
      { id: "id-1", title: "Alerte A", status: "active" },
      { id: "id-2", title: "Alerte B", status: "active" },
      { id: "id-3", title: "Alerte C", status: "active" },
    ]);
    render(<BlockDataTable title="Étapes du pipeline" team="sales" rows={ROWS} />);

    const link = await screen.findByRole("link");
    expect(link.textContent).toContain("3 alertes");
    expect(link.getAttribute("title")).toContain("3 alertes");
  });

  /**
   * Régression : dans le carrousel Pipeline Management, un ancêtre porte
   * `transform: translateX(...)`, ce qui redéfinit le bloc conteneur de
   * `position: fixed`. La modale s'ouvrait alors hors écran, clippée par le
   * `overflow-x-hidden` du carrousel — le clic sur « Alerte » semblait ne rien
   * faire. La modale doit être montée dans <body>, hors du conteneur transformé.
   */
  it("ouvre la modale dans <body>, même sous un ancêtre transformé", async () => {
    mockAlerts([]);
    const { container } = render(
      <div style={{ transform: "translateX(-50%)", overflowX: "hidden" }}>
        <BlockDataTable title="Étapes du pipeline" team="sales" rows={ROWS} />
      </div>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /alerte/i }));

    const form = await screen.findByText("Alerte technique");
    // Le point clé : la modale ne doit PAS être dans le conteneur transformé.
    expect(container.contains(form)).toBe(false);
    expect(document.body.contains(form)).toBe(true);
  });

  it("interroge l'API avec la clé dérivée du titre ET du sous-titre", async () => {
    const fetchMock = mockAlerts([]);
    render(
      <BlockDataTable
        title="Étapes du pipeline — Pipeline AXMA"
        subtitle="deals · groupé par étape"
        team="sales"
        rows={ROWS}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const key = blockSourceKey("Étapes du pipeline — Pipeline AXMA", "deals · groupé par étape");
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/alerts?source_key=${encodeURIComponent(key)}`);
    // Deux tables de pipelines différents ne doivent pas partager leur compteur.
    expect(key).not.toBe(blockSourceKey("Étapes du pipeline — Pipeline Storee", "deals · groupé par étape"));
  });
});
