/**
 * Garde-fou : un fichier importé par le code doit être SUIVI par git.
 *
 * Le 2026-08-15, tous les déploiements ont échoué pendant des heures parce que
 * `lib/coaching/development.ts` et `lib/coaching/style.ts` étaient importés par
 * du code committé sans avoir jamais été `git add`és. En local tout passe — le
 * fichier est là, tsc et les tests sont verts. Sur Vercel il n'existe pas et le
 * build casse. Rien dans la chaîne ne voyait la différence.
 *
 * Ce script la voit : il résout chaque import interne (`@/…`, `./…`, `../…`) et
 * signale ceux qui pointent vers un fichier présent sur le disque mais absent de
 * l'index git. C'est exactement le cas qui casse le déploiement.
 *
 * Usage : node scripts/check-tracked-imports.mjs
 * Sortie : code 1 s'il reste un import non suivi.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const RESOLVE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css"];

/** Fichiers suivis par git (chemins relatifs à la racine, séparateur /). */
function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return new Set(out.split("\0").filter(Boolean));
}

/** Spécificateurs d'import/require/import() internes d'un fichier. */
function importsOf(src) {
  const specs = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) specs.push(m[1]);
  return specs;
}

/** Chemin relatif à la racine visé par un import, ou null si externe/introuvable. */
function resolveInternal(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // paquet npm ou alias externe

  const candidates = [base, ...RESOLVE_EXT.map((e) => base + e), ...RESOLVE_EXT.map((e) => path.join(base, "index" + e))];
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    if (statSync(c).isDirectory()) continue;
    return path.relative(ROOT, c).split(path.sep).join("/");
  }
  return null; // non résolu : c'est le travail de tsc, pas le nôtre
}

/**
 * @returns {{file: string, spec: string, target: string}[]} imports vers un
 * fichier existant en local mais absent de l'index git.
 */
export function findUntrackedImports() {
  const tracked = trackedFiles();
  const problems = [];
  for (const file of tracked) {
    if (!SOURCE_EXT.test(file)) continue;
    const abs = path.join(ROOT, file);
    if (!existsSync(abs)) continue; // supprimé mais pas encore committé
    for (const spec of importsOf(readFileSync(abs, "utf8"))) {
      const target = resolveInternal(spec, abs);
      if (target && !tracked.has(target)) problems.push({ file, spec, target });
    }
  }
  return problems;
}

/** Vrai si git est utilisable ici (absent de certains conteneurs de build). */
export function gitAvailable() {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (!gitAvailable()) {
    console.log("[check-imports] git indisponible ici — vérification ignorée.");
    process.exit(0);
  }
  const problems = findUntrackedImports();
  if (problems.length === 0) {
    console.log("[check-imports] OK — tous les imports internes pointent vers des fichiers suivis par git.");
    process.exit(0);
  }
  console.error(`\n[check-imports] ${problems.length} import(s) vers un fichier NON SUIVI par git :\n`);
  for (const p of problems) {
    console.error(`  ${p.file}`);
    console.error(`    import "${p.spec}" → ${p.target}  (présent en local, absent de git)`);
  }
  console.error(`\nLe build Vercel échouera : ces fichiers n'existent pas dans le dépôt.`);
  console.error(`Corrige avec :  git add ${[...new Set(problems.map((p) => p.target))].join(" ")}\n`);
  process.exit(1);
}
