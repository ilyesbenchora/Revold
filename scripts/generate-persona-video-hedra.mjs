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

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.hedra.com/web-app/public";
/**
 * Modèles talking-head disponibles sur l'API Hedra (relevés via /models).
 * Character 3 par défaut ; les autres servent au comparatif de qualité.
 */
const MODELS = {
  "character-3": "d1dd37a3-e39a-4854-a298-6510289f9cf2", // Hedra Character 3
  "hedra-avatar": "26f0fc66-152b-40ab-abed-76c43df99bc8", // ancien modèle Hedra
  omnihuman: "5efced1a-0ca0-4255-87d2-070146842ad9", // Omnihuman 1.5 I2V (bon sur illustré)
  "kling-avatar": "0451ceea-a7b5-4275-a970-82bf4ef38055", // Kling AI Avatar v2 Pro
};
const MODEL_ID = MODELS["character-3"];

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
  // Les clés à tiret sont entre guillemets ("service-client":), les autres non.
  const esc = key.replace(/[-]/g, "\\-");
  const block = new RegExp(`(?:"${esc}"|\\b${esc}):\\s*\\{([\\s\\S]*?)\\n  \\},`).exec(src);
  if (!block) return null;
  const voice = /hedraVoiceId:\s*"([^"]+)"/.exec(block[1]);
  const eleven = /elevenVoiceId:\s*"([^"]+)"/.exec(block[1]);
  // Tonalité par persona (stability/similarity_boost/style) — optionnelle.
  const settingsBlock = /voiceSettings:\s*\{([^}]*)\}/.exec(block[1]);
  const voiceSettings = {};
  if (settingsBlock) {
    for (const [, k, v] of settingsBlock[1].matchAll(/(stability|similarity_boost|style):\s*([\d.]+)/g)) {
      voiceSettings[k] = Number(v);
    }
  }
  const segs = /segments:\s*\[([\s\S]*?)\]/.exec(block[1]);
  if (!segs) return null;
  const segments = [...segs[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  return { hedraVoiceId: voice ? voice[1] : null, elevenVoiceId: eleven ? eleven[1] : null, voiceSettings, segments };
}

const ts = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${h}:${m}:${s}`;
};

/** Repli : minutage au prorata des caractères (imprécis). */
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

/**
 * Minutage EXACT à partir des timestamps caractère par caractère renvoyés par
 * ElevenLabs (alignment). On resitue chaque segment dans le texte complet, et
 * on prend le temps de son premier et de son dernier caractère prononcé —
 * les sous-titres suivent alors la voix à la milliseconde.
 */
function buildVttFromAlignment(segments, fullText, alignment) {
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  // Reconstruit l'index de chaque caractère du texte joint dans l'alignement.
  const joined = chars.join("");
  let cursor = 0;
  const cues = segments.map((seg, i) => {
    const at = joined.indexOf(seg, cursor);
    const startIdx = at >= 0 ? at : cursor;
    const endIdx = Math.min(startIdx + seg.length - 1, ends.length - 1);
    cursor = startIdx + seg.length;
    const start = starts[startIdx] ?? 0;
    const end = ends[endIdx] ?? start;
    return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${seg}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ffmpeg si disponible (PATH ou installation winget), sinon null. */
function findFfmpeg() {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe",
  );
  for (const candidate of ["ffmpeg", winget]) {
    try {
      execFileSync(candidate, ["-version"], { stdio: "ignore" });
      return candidate;
    } catch {
      /* essai suivant */
    }
  }
  return null;
}

/** Durée (secondes) d'un mp4 via ffprobe — null si ffprobe indisponible. */
function probeDuration(path) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return null;
  const ffprobe = ffmpeg === "ffmpeg" ? "ffprobe" : ffmpeg.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
  try {
    const out = execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
    const d = Number(out.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Prolonge la POSE FINALE (dernière image gelée + silence) de `seconds` s.
 * Hedra trime le silence ajouté en fin d'audio : sans ça, la vidéo coupe dès
 * le dernier mot. La dernière image rendue est la pose « à la Sarah » (lèvres
 * fermées, sourire doux) — on la tient à l'écran.
 */
function freezeExtend(path, seconds) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return;
  const dur = seconds.toFixed(2);
  const tmp = path.replace(/\.mp4$/, ".hold.mp4");
  execFileSync(ffmpeg, [
    "-y", "-i", path,
    "-vf", `tpad=stop_mode=clone:stop_duration=${dur}`,
    "-af", `apad=pad_dur=${dur}`,
    "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k",
    "-movflags", "+faststart",
    tmp,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  renameSync(tmp, path);
}

/**
 * Compresse le mp4 Hedra (~35 Mo brut) en H.264 web (~2 Mo, qualité intacte à
 * l'œil). Sans ffmpeg, on garde le fichier brut — un avertissement est loggé.
 */
function compressVideo(path) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.warn("ffmpeg introuvable — vidéo laissée brute (lourde). Installe ffmpeg pour compresser.");
    return;
  }
  const tmp = path.replace(/\.mp4$/, ".tmp.mp4");
  const before = statSync(path).size;
  execFileSync(ffmpeg, [
    "-y", "-i", path,
    "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k",
    "-movflags", "+faststart",
    tmp,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  renameSync(tmp, path);
  console.log(`Compression : ${(before / 1024 / 1024).toFixed(1)} Mo → ${(statSync(path).size / 1024 / 1024).toFixed(1)} Mo`);
}

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

  // Voix ElevenLabs à accent/personnalité française — pour choisir par persona.
  if (args.includes("--eleven-voices")) {
    if (!e.ELEVENLABS_API_KEY) { console.error("ELEVENLABS_API_KEY absent de .env.local."); process.exit(1); }
    const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": e.ELEVENLABS_API_KEY } });
    if (!r.ok) { console.error(`${r.status} ${await r.text()}`); process.exit(1); }
    const d = await r.json();
    const voices = d.voices ?? [];
    const fr = voices.filter((v) => JSON.stringify(v.labels ?? {}).toLowerCase().match(/french|français|france/));
    console.log(`${voices.length} voix dans ta bibliothèque, ${fr.length} étiquetées françaises :`);
    for (const v of (fr.length ? fr : voices)) {
      console.log(" -", v.voice_id, "|", v.name, "|", JSON.stringify(v.labels ?? {}));
    }
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
  // Voix ElevenLabs (production) ; à défaut, repli Hedra.
  if (!script.elevenVoiceId && !script.hedraVoiceId) {
    console.error(`Aucune voix (elevenVoiceId/hedraVoiceId) pour « ${key} » dans persona-scripts.ts.`);
    process.exit(1);
  }

  // Choix du modèle vidéo : --model=omnihuman|kling-avatar|hedra-avatar pour le
  // comparatif, Character 3 par défaut.
  const modelArg = (args.find((a) => a.startsWith("--model=")) || "").split("=")[1];
  const modelId = MODELS[modelArg] || MODEL_ID;
  const outSuffix = modelArg && MODELS[modelArg] ? `-${modelArg}` : "";

  const imgPath = join(ROOT, `public/personas/${key}.png`);
  const text = script.segments.join(" ");
  // Silence de fin (~1,4 s) : la vidéo Hedra dure exactement le temps de
  // l'audio — sans ce silence, elle coupe brutalement dès le dernier mot.
  // Avec lui, le personnage termine naturellement : bouche fermée, sourire.
  const ttsText = `${text} <break time="1.4s" />`;
  console.log(`Persona : ${key}\nPortrait: ${imgPath}\nModèle  : ${modelArg || "character-3"}\nVoix    : ${script.elevenVoiceId || script.hedraVoiceId}\nTexte   : ${text.length} caractères`);

  const poll = async (genId, label) => {
    for (let i = 0; i < 200; i++) {
      await sleep(3000);
      const r = await fetch(`${API}/generations/${genId}/status`, { headers: H });
      const d = await r.json();
      if (d.status === "complete") return d;
      if (d.status === "error" || d.status === "failed") {
        console.error(`\n${label} échoué : ${JSON.stringify(d).slice(0, 400)}`);
        process.exit(1);
      }
      process.stdout.write(".");
    }
    console.error(`\n${label} : timeout (10 min).`);
    process.exit(1);
  };

  // 1. Voix française. ElevenLabs (français NATIF) si dispo, sinon TTS Hedra
  //    (repli — accent anglophone assumé, à éviter en prod).
  let audioId;
  let alignment = null;
  if (e.ELEVENLABS_API_KEY && script.elevenVoiceId) {
    console.log(`Voix ElevenLabs (${script.elevenVoiceId}) — français natif…`);
    // Endpoint « with-timestamps » : renvoie l'audio ET le minutage caractère
    // par caractère, pour des sous-titres alignés sur la voix réelle.
    const el = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${script.elevenVoiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": e.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ttsText,
          model_id: "eleven_multilingual_v2",
          // Tonalité : défauts + réglages propres au persona (persona-scripts.ts).
          voice_settings: { stability: 0.5, similarity_boost: 0.75, ...script.voiceSettings },
        }),
      },
    );
    if (!el.ok) { console.error(`ElevenLabs : ${el.status} ${await el.text()}`); process.exit(1); }
    const payload = await el.json();
    const mp3 = Buffer.from(payload.audio_base64, "base64");
    alignment = payload.normalized_alignment ?? payload.alignment ?? null;

    // Déposer l'audio comme asset Hedra, puis le téléverser.
    const aCreate = await fetch(`${API}/assets`, {
      method: "POST", headers: JH, body: JSON.stringify({ name: `${key}-voice.mp3`, type: "audio" }),
    });
    if (!aCreate.ok) { console.error(`Asset audio : ${aCreate.status} ${await aCreate.text()}`); process.exit(1); }
    audioId = (await aCreate.json()).id;
    const af = new FormData();
    af.append("file", new Blob([mp3], { type: "audio/mpeg" }), `${key}-voice.mp3`);
    const aUp = await fetch(`${API}/assets/${audioId}/upload`, { method: "POST", headers: H, body: af });
    if (!aUp.ok) { console.error(`Upload audio : ${aUp.status} ${await aUp.text()}`); process.exit(1); }
    console.log(`Voix prête (${(mp3.length / 1024).toFixed(0)} Ko, asset ${audioId})`);
  } else {
    const tts = await fetch(`${API}/generations`, {
      method: "POST", headers: JH,
      body: JSON.stringify({ type: "text_to_speech", voice_id: script.hedraVoiceId, text: ttsText, language: "French" }),
    });
    if (!tts.ok) { console.error(`TTS : ${tts.status} ${await tts.text()}`); process.exit(1); }
    const ttsJob = await tts.json();
    console.log(`Voix Hedra en cours (repli, accent anglophone)…`);
    const ttsDone = await poll(ttsJob.id, "TTS");
    audioId = ttsJob.asset_id ?? ttsDone.asset_id;
    console.log(`\nVoix prête (asset ${audioId})`);
  }

  // 2. Déclarer + téléverser le portrait.
  const created = await fetch(`${API}/assets`, {
    method: "POST", headers: JH,
    body: JSON.stringify({ name: `${key}.png`, type: "image" }),
  });
  if (!created.ok) { console.error(`Création asset : ${created.status} ${await created.text()}`); process.exit(1); }
  const assetId = (await created.json()).id;
  const form = new FormData();
  form.append("file", new Blob([readFileSync(imgPath)], { type: "image/png" }), `${key}.png`);
  const up = await fetch(`${API}/assets/${assetId}/upload`, { method: "POST", headers: H, body: form });
  if (!up.ok) { console.error(`Upload : ${up.status} ${await up.text()}`); process.exit(1); }
  console.log(`Portrait téléversé (asset ${assetId})`);

  // Durée audio attendue : dernier caractère prononcé + le silence de fin.
  // Sert à DÉTECTER LES RENDUS TRONQUÉS (Hedra coupe parfois avant la fin de
  // l'audio → personnage figé en pleine phrase, bouche ouverte).
  const alignEnds = alignment?.character_end_times_seconds;
  const expectedDur = alignEnds?.length ? alignEnds[alignEnds.length - 1] + 1.4 : null;

  // 3. Générer la vidéo à partir du portrait + de l'audio. L'audio et le
  //    portrait sont déjà téléversés : un rendu tronqué ne relance QUE la
  //    génération vidéo (jusqu'à 3 tentatives).
  const outDir = join(ROOT, "public/personas/videos");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${key}${outSuffix}.mp4`);
  let bin = null;
  let done = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const gen = await fetch(`${API}/generations`, {
      method: "POST", headers: JH,
      body: JSON.stringify({
        type: "video",
        ai_model_id: modelId,
        start_keyframe_id: assetId,
        audio_id: audioId,
        // Le portrait est carré : on garde ce cadrage pour rester fidèle à l'avatar.
        generated_video_inputs: {
          aspect_ratio: "1:1",
          resolution: "720p",
          // Fin de référence (validée sur Sarah/equipes) : lèvres fermées, sourire
          // doux SANS montrer les dents, regard caméra détendu jusqu'à la fin.
          text_prompt:
            "Le personnage parle face caméra, posture calme, léger sourire. " +
            "Quand il a fini de parler, il ferme complètement la bouche, lèvres jointes sans montrer les dents, " +
            "et garde un sourire doux et détendu face caméra, immobile et serein, jusqu'à la toute fin de la vidéo.",
        },
      }),
    });
    if (!gen.ok) { console.error(`Génération vidéo : ${gen.status} ${await gen.text()}`); process.exit(1); }
    const genId = (await gen.json()).id;
    console.log(`Vidéo en cours (tâche ${genId}, tentative ${attempt}/3)…`);
    done = await poll(genId, "Vidéo");

    const url = done.url ?? done.asset?.url ?? done.download_url;
    if (!url) { console.error(`\nPas d'URL dans la réponse : ${JSON.stringify(done).slice(0, 400)}`); process.exit(1); }
    // Téléchargement résilient : un ECONNRESET ne doit pas jeter le rendu.
    bin = null;
    for (let dl = 1; dl <= 3 && !bin; dl++) {
      try {
        bin = Buffer.from(await (await fetch(url)).arrayBuffer());
      } catch (err) {
        console.warn(`\nTéléchargement échoué (${err?.cause?.code ?? err?.message ?? err}) — retry ${dl}/3 dans 5 s…`);
        await sleep(5000);
      }
    }
    if (!bin) { console.error("Téléchargement impossible après 3 tentatives."); process.exit(1); }
    writeFileSync(outPath, bin);

    // Contrôle de durée : mp4 vs durée audio attendue.
    //  - Petit déficit (≤ 2,5 s) : Hedra TRIME le silence de fin — comportement
    //    systématique, inutile de re-rendre. On prolonge la pose finale en
    //    post-prod (gel de la dernière image, validée « à la Sarah »).
    //  - Gros déficit : vraie troncature en pleine phrase → nouveau rendu.
    const actualDur = probeDuration(outPath);
    if (expectedDur && actualDur && actualDur < expectedDur - 0.4) {
      const deficit = expectedDur - actualDur;
      if (deficit > 2.5) {
        console.warn(`\nRendu tronqué (${actualDur.toFixed(1)} s < ${expectedDur.toFixed(1)} s attendues) — nouvelle tentative…`);
        continue;
      }
      console.log(`\nSilence final trimé par Hedra (${deficit.toFixed(1)} s) — gel de la pose finale en post-prod.`);
      freezeExtend(outPath, deficit);
    } else if (actualDur) {
      console.log(`\nDurée vérifiée : ${actualDur.toFixed(1)} s (attendu ≥ ${expectedDur ? expectedDur.toFixed(1) : "?"} s)`);
    }
    break;
  }
  compressVideo(outPath);

  const duration = Number(done.duration) || text.length / 15;
  const vtt = alignment && alignment.characters
    ? buildVttFromAlignment(script.segments, text, alignment)
    : buildVtt(script.segments, duration);
  writeFileSync(join(outDir, `${key}${outSuffix}.vtt`), vtt);
  console.log(`Sous-titres : ${alignment ? "alignés sur la voix (timestamps ElevenLabs)" : "prorata (repli)"}`);
  console.log(`\n\nVidéo → public/personas/videos/${key}${outSuffix}.mp4 (${(statSync(outPath).size / 1024 / 1024).toFixed(2)} Mo)`);
  console.log(`VTT   → ${script.segments.length} lignes sur ${duration.toFixed(1)} s`);
  console.log("\nAVANT DE PRODUIRE LA SÉRIE : extraire une image et vérifier l'absence de filigrane.");
}

main().catch((err) => { console.error(err); process.exit(1); });
