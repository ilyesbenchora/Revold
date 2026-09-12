import { describe, it, expect } from "vitest";
import { num, date } from "@/lib/integrations/sync/connectors/custom-rest";

/** Conversion des valeurs à la synchro — formats ERP réels (surtout FR). */
describe("custom-rest — montants (num)", () => {
  it("formats FR et US", () => {
    expect(num("1 234,56 €")).toBe(1234.56); // FR espace + virgule
    expect(num("1.234,56")).toBe(1234.56); // point milliers, virgule décimale
    expect(num("1,234.56")).toBe(1234.56); // US
    expect(num("980,00")).toBe(980);
    expect(num("2300")).toBe(2300);
    expect(num("12.5")).toBe(12.5);
    expect(num("-1 500,25")).toBe(-1500.25);
    expect(num(3400)).toBe(3400); // déjà numérique
  });
  it("valeurs vides / non numériques → null", () => {
    expect(num("")).toBeNull();
    expect(num(null)).toBeNull();
    expect(num("N/A")).toBeNull();
  });
});

describe("custom-rest — dates (date)", () => {
  it("ISO natif", () => {
    expect(date("2026-12-31")?.slice(0, 10)).toBe("2026-12-31");
    expect(date("2026-12-31T10:30:00Z")).toBe("2026-12-31T10:30:00.000Z");
  });
  it("JJ/MM/AAAA (FR) — auparavant perdu", () => {
    expect(date("31/12/2026")?.slice(0, 10)).toBe("2026-12-31");
    expect(date("05/06/2026")?.slice(0, 10)).toBe("2026-06-05"); // 5 juin, pas 6 mai
    expect(date("31-12-2026")?.slice(0, 10)).toBe("2026-12-31");
    expect(date("31/12/2026 14:30")).toBe("2026-12-31T14:30:00.000Z");
  });
  it("MM/JJ/AAAA US (mois > 12 impossible en FR → repli natif)", () => {
    expect(date("12/31/2026")?.slice(0, 10)).toBe("2026-12-31");
  });
  it("epoch secondes et millisecondes", () => {
    expect(date("1767139200")?.slice(0, 10)).toBe("2025-12-31"); // ~fin 2025
    expect(date(1767139200000)?.slice(0, 10)).toBe("2025-12-31");
  });
  it("vide / illisible → null", () => {
    expect(date("")).toBeNull();
    expect(date(null)).toBeNull();
    expect(date("bientôt")).toBeNull();
  });
});
