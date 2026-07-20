/**
 * Génère la vidéo de bio d'un persona à partir de SON portrait existant.
 *
 *   node scripts/generate-persona-video.mjs performance
 *   node scripts/generate-persona-video.mjs performance --dry-run
 *
 * Principe : D-ID anime `https://<APP_URL>/personas/<clé>.png` en tête parlante
 * avec une voix TTS française, à partir du script de lib/ai/agents/persona-scripts.ts.
 * On récupère le mp4 dans public/personas/videos/<clé>.mp4 et on écrit la piste
 * de sous-titres <clé>.vtt à côté.
 *
 * Le portrait DOIT être accessible publiquement (D-ID le télécharge) : on pointe
 * donc sur la prod, pas sur localhost.
 *
 * Requiert D_ID_API_KEY dans .env.local (clé « Basic » du dashboard D-ID).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.d-id.com";

function env() {
  const out = {};
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    out[t.slice(0, t.indexOf("=")).trim()] = t.slice(t.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Charge les segments sans dépendre d'un runtime TS : on lit le littéral. */
function loadScript(key) {
  const src = readFileSync(join(ROOT, "lib/ai/agents/persona-scripts.ts"), "utf8");
  const block = new RegExp(`\\b${key}:\\s*\\{([\\s\\S]*?)\\n  \\},`).exec(src);
  if (!block) return null;
  const voice = /voiceId:\s*"([^"]+)"/.exec(block[1]);
  const segs = /segments:\s*\[([\s\S]*?)\]/.exec(block[1]);
  if (!voice || !segs) return null;
  const segments = [...segs[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  return { voiceId: voice[1], segments };
}

const ts = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${h}:${m}:${s}`;
};

/**
 * Minutage au prorata du nombre de caractères : sans alignement forcé, c'est
 * l'approximation la plus fidèle — la durée de lecture d'un segment est
 * proportionnelle à sa longueur. Écart typique < 0,3 s sur 35 s.
 */
function buildVtt(segments, durationSec) {
  const total = segments.reduce((n, s) => n + s.length, 0);
  let t = 0;
  const cues = segments.map((seg, i) => {
    const start = t;
    t += (seg.length / total) * durationSec;
    const end = i === segments.length - 1 ? durationSec : t;
    return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${seg}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const key = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!key) {
    console.error("Usage : node scripts/generate-persona-video.mjs <clé-agent> [--dry-run]");
    process.exit(1);
  }

  const script = loadScript(key);
  if (!script) {
    console.error(`Aucun script pour « ${key} » dans lib/ai/agents/persona-scripts.ts.`);
    process.exit(1);
  }

  const e = env();
  const appUrl = (e.NEXT_PUBLIC_APP_URL || "https://revold.io").replace(/\/$/, "");
  const sourceUrl = `${appUrl}/personas/${key}.png`;
  const text = script.segments.join(" ");
  const outDir = join(ROOT, "public/personas/videos");
  const mp4Path = join(outDir, `${key}.mp4`);
  const vttPath = join(outDir, `${key}.vtt`);

  console.log(`Persona   : ${key}`);
  console.log(`Portrait  : ${sourceUrl}`);
  console.log(`Voix      : ${script.voiceId}`);
  console.log(`Segments  : ${script.segments.length} (${text.length} caractères)`);

  if (dryRun) {
    mkdirSync(outDir, { recursive: true });
    // Durée estimée : ~15 caractères/seconde en français à débit posé.
    writeFileSync(vttPath, buildVtt(script.segments, text.length / 15));
    console.log(`\n--dry-run : aucun appel API. Sous-titres estimés → ${vttPath}`);
    return;
  }

  const apiKey = e.D_ID_API_KEY;
  if (!apiKey) {
    console.error("\nD_ID_API_KEY absent de .env.local — impossible de générer la vidéo.");
    process.exit(1);
  }
  const auth = { Authorization: `Basic ${apiKey}`, "Content-Type": "application/json" };

  const created = await fetch(`${API}/talks`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      source_url: sourceUrl,
      script: {
        type: "text",
        input: text,
        provider: { type: "microsoft", voice_id: script.voiceId },
      },
      // Le portrait est un rendu 3D cadré buste : on garde le cadrage d'origine
      // pour que le personnage reste EXACTEMENT celui de l'avatar.
      config: { stitch: true, result_format: "mp4" },
    }),
  });
  if (!created.ok) {
    console.error(`Création refusée (${created.status}) : ${await created.text()}`);
    process.exit(1);
  }
  const { id } = await created.json();
  console.log(`\nTâche D-ID : ${id}\nRendu en cours…`);

  let result = null;
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const r = await fetch(`${API}/talks/${id}`, { headers: auth });
    const d = await r.json();
    if (d.status === "done") { result = d; break; }
    if (d.status === "error" || d.status === "rejected") {
      console.error(`Rendu échoué : ${JSON.stringify(d.error ?? d)}`);
      process.exit(1);
    }
    process.stdout.write(".");
  }
  if (!result) {
    console.error("\nTimeout : le rendu n'a pas abouti en 3 minutes.");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const video = await fetch(result.result_url);
  writeFileSync(mp4Path, Buffer.from(await video.arrayBuffer()));

  const duration = Number(result.duration) || text.length / 15;
  writeFileSync(vttPath, buildVtt(script.segments, duration));

  const mb = (readFileSync(mp4Path).length / 1024 / 1024).toFixed(2);
  console.log(`\n\nVidéo      → public/personas/videos/${key}.mp4 (${mb} Mo, ${duration.toFixed(1)} s)`);
  console.log(`Sous-titres → public/personas/videos/${key}.vtt (${script.segments.length} lignes)`);
  console.log("\nRelis les sous-titres : le minutage est calculé au prorata, ajuste si un segment décale.");
}

main().catch((err) => { console.error(err); process.exit(1); });
