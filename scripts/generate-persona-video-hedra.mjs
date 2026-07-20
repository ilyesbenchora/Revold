/**
 * Génère la vidéo de bio d'un persona avec Hedra Character-3.
 *
 *   node scripts/generate-persona-video-hedra.mjs --list-voices        # voix FR disponibles
 *   node scripts/generate-persona-video-hedra.mjs performance          # génère
 *   node scripts/generate-persona-video-hedra.mjs performance --check  # crédits + modèle
 *
 * Différences avec D-ID (scripts/generate-persona-video.mjs) :
 *  - le portrait est UPLOADÉ (pas une URL publique) → on peut générer avant
 *    même que l'image soit en ligne ;
 *  - la synthèse vocale est faite par Hedra dans le même appel (audio_generation) ;
 *  - pas de filigrane sur les plans payants — À VÉRIFIER sur le premier rendu
 *    avant de lancer la série (cf. --check-watermark dans le README de la tâche).
 *
 * Requiert HEDRA_API_KEY dans .env.local.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.hedra.com/web-app/public";
/** Character-3 — identifiant de modèle documenté par Hedra. */
const MODEL_ID = "26f0fc66-152b-40ab-abed-76c43df99bc8";

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

function loadScript(key) {
  const src = readFileSync(join(ROOT, "lib/ai/agents/persona-scripts.ts"), "utf8");
  const block = new RegExp(`\\b${key}:\\s*\\{([\\s\\S]*?)\\n  \\},`).exec(src);
  if (!block) return null;
  const voice = /hedraVoiceId:\s*"([^"]+)"/.exec(block[1]);
  const segs = /segments:\s*\[([\s\S]*?)\]/.exec(block[1]);
  if (!segs) return null;
  const segments = [...segs[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  return { hedraVoiceId: voice ? voice[1] : null, segments };
}

const ts = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${h}:${m}:${s}`;
};

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
  const args = process.argv.slice(2);
  const key = args.find((a) => !a.startsWith("--"));
  const e = env();
  const apiKey = e.HEDRA_API_KEY;
  if (!apiKey) {
    console.error("HEDRA_API_KEY absent de .env.local.");
    process.exit(1);
  }
  const H = { "X-API-Key": apiKey };
  const JH = { ...H, "Content-Type": "application/json" };

  // Voix disponibles — sert à vérifier la couverture française AVANT de produire.
  if (args.includes("--list-voices")) {
    const r = await fetch(`${API}/voices`, { headers: H });
    if (!r.ok) { console.error(`${r.status} ${await r.text()}`); process.exit(1); }
    const d = await r.json();
    const all = Array.isArray(d) ? d : d.voices ?? d.data ?? [];
    const fr = all.filter((v) => JSON.stringify(v).toLowerCase().match(/fr|french|français/));
    console.log(`${all.length} voix au total, ${fr.length} candidates françaises :`);
    for (const v of fr) console.log(" -", v.id ?? v.voice_id, "|", v.name ?? "", "|", v.gender ?? v.labels?.gender ?? "?");
    if (!fr.length) console.log("(aucune voix FR détectée — il faudra fournir un fichier audio externe)");
    return;
  }

  if (args.includes("--check")) {
    const r = await fetch(`${API}/credits`, { headers: H });
    console.log(`credits → HTTP ${r.status} : ${(await r.text()).slice(0, 300)}`);
    return;
  }

  if (!key) { console.error("Usage : node scripts/generate-persona-video-hedra.mjs <clé-agent>"); process.exit(1); }
  const script = loadScript(key);
  if (!script) { console.error(`Aucun script pour « ${key} ».`); process.exit(1); }
  if (!script.hedraVoiceId) {
    console.error(`Pas de hedraVoiceId pour « ${key} » — lance --list-voices puis renseigne-le dans persona-scripts.ts.`);
    process.exit(1);
  }

  const imgPath = join(ROOT, `public/personas/${key}.png`);
  const text = script.segments.join(" ");
  console.log(`Persona : ${key}\nPortrait: ${imgPath}\nVoix    : ${script.hedraVoiceId}\nTexte   : ${text.length} caractères`);

  // 1. Déclarer l'asset image, 2. téléverser le fichier.
  const created = await fetch(`${API}/assets`, {
    method: "POST", headers: JH,
    body: JSON.stringify({ name: `${key}.png`, type: "image" }),
  });
  if (!created.ok) { console.error(`Création asset : ${created.status} ${await created.text()}`); process.exit(1); }
  const asset = await created.json();
  const assetId = asset.id ?? asset.asset_id;

  const form = new FormData();
  form.append("file", new Blob([readFileSync(imgPath)], { type: "image/png" }), `${key}.png`);
  const up = await fetch(`${API}/assets/${assetId}/upload`, { method: "POST", headers: H, body: form });
  if (!up.ok) { console.error(`Upload : ${up.status} ${await up.text()}`); process.exit(1); }
  console.log(`Portrait téléversé (asset ${assetId})`);

  // 3. Générer la vidéo — TTS incluse dans le même appel.
  const gen = await fetch(`${API}/generations`, {
    method: "POST", headers: JH,
    body: JSON.stringify({
      type: "video",
      ai_model_id: MODEL_ID,
      start_keyframe_id: assetId,
      audio_generation: { type: "text_to_speech", voice_id: script.hedraVoiceId, text },
      generated_video_inputs: {
        // Le portrait est carré : on garde ce cadrage pour rester fidèle à l'avatar.
        aspect_ratio: "1:1",
        resolution: "720p",
        text_prompt: "Le personnage parle face caméra, posture calme, léger sourire",
      },
    }),
  });
  if (!gen.ok) { console.error(`Génération : ${gen.status} ${await gen.text()}`); process.exit(1); }
  const g = await gen.json();
  const genId = g.id ?? g.generation_id;
  console.log(`Tâche ${genId} — rendu en cours…`);

  let done = null;
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const r = await fetch(`${API}/generations/${genId}/status`, { headers: H });
    const d = await r.json();
    if (d.status === "complete") { done = d; break; }
    if (d.status === "error" || d.status === "failed") { console.error(`\nÉchec : ${JSON.stringify(d).slice(0, 400)}`); process.exit(1); }
    process.stdout.write(".");
  }
  if (!done) { console.error("\nTimeout (10 min)."); process.exit(1); }

  const url = done.url ?? done.asset?.url ?? done.download_url;
  if (!url) { console.error(`\nPas d'URL dans la réponse : ${JSON.stringify(done).slice(0, 400)}`); process.exit(1); }

  const outDir = join(ROOT, "public/personas/videos");
  mkdirSync(outDir, { recursive: true });
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(join(outDir, `${key}.mp4`), bin);

  const duration = Number(done.duration) || text.length / 15;
  writeFileSync(join(outDir, `${key}.vtt`), buildVtt(script.segments, duration));
  console.log(`\n\nVidéo → public/personas/videos/${key}.mp4 (${(bin.length / 1024 / 1024).toFixed(2)} Mo)`);
  console.log(`VTT   → ${script.segments.length} lignes sur ${duration.toFixed(1)} s`);
  console.log("\nAVANT DE PRODUIRE LA SÉRIE : extraire une image et vérifier l'absence de filigrane.");
}

main().catch((err) => { console.error(err); process.exit(1); });
