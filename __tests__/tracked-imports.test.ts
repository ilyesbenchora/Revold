import { describe, it, expect } from "vitest";
// @ts-expect-error — script utilitaire en JS pur, sans types.
import { findUntrackedImports, gitAvailable } from "../scripts/check-tracked-imports.mjs";

/**
 * Filet de sécurité contre la panne du 2026-08-15 : un fichier importé mais
 * jamais `git add`é passe tsc et les tests en local (il est là), puis casse
 * TOUS les déploiements (il n'est pas dans le dépôt). Ce test s'exécute avant
 * chaque commit, là où la faute se commet.
 */
describe("imports internes", () => {
  it.skipIf(!gitAvailable())("pointent tous vers des fichiers suivis par git", () => {
    const problems = findUntrackedImports() as Array<{ file: string; spec: string; target: string }>;
    const detail = problems.map((p) => `${p.file} → ${p.spec} (${p.target})`).join("\n");
    expect(problems, `Fichiers importés mais absents de git :\n${detail}`).toEqual([]);
  });
});
