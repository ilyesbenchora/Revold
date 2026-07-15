/**
 * Génère les 17 portraits 3D des personnages d'agents (style Pixar pro, façon
 * référence) et les enregistre dans public/personas/<clé-agent>.png.
 *
 * Usage :
 *   OPENAI_API_KEY=sk-...  node scripts/generate-personas.mjs
 *   (optionnel)  IMAGE_MODEL=dall-e-3   FORCE=1
 *
 * - Modèle par défaut : gpt-image-1 (meilleur rendu 3D). Alternative : dall-e-3.
 * - FORCE=1 régénère même si le fichier existe déjà.
 * - Génération séquentielle (respect des rate limits).
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const FORCE = process.env.FORCE === "1";
const OUT_DIR = path.join(process.cwd(), "public", "personas");

if (!API_KEY) {
  console.error("❌ OPENAI_API_KEY manquante. Exemple : OPENAI_API_KEY=sk-... node scripts/generate-personas.mjs");
  process.exit(1);
}

// Style commun — reproduit l'esprit de la référence (3D Pixar, buste, bras
// croisés, fond dégradé bleu, éclairage studio doux).
const STYLE =
  "3D animated character portrait, Pixar / Disney style render, upper body, arms crossed confidently, warm friendly subtle smile, looking directly at the camera, soft studio lighting, smooth vibrant blue gradient background, high quality octane 3D render, centered composition, clean, no text, no logo, no watermark";

/** Personnages : clé d'agent → prompt spécifique (prénom, genre, look métier). */
const PERSONAS = [
  { key: "coaching-ventes", desc: "Marc, a confident male sales coach, short brown hair, light stubble, wearing a navy blazer over a white shirt" },
  { key: "coaching-marketing", desc: "Léa, a creative female marketing coach, wavy auburn hair, wearing a stylish mustard blouse" },
  { key: "coaching-data", desc: "Sofia, a female data coach, dark hair in a ponytail, modern glasses, wearing a green tech shirt" },
  { key: "coaching-integration", desc: "Yanis, a male integration engineer coach, short black hair, wearing a dark developer hoodie over a t-shirt" },
  { key: "coaching-cross-source", desc: "Nina, a female cross-source analyst coach, curly hair, smart casual, wearing a purple top" },
  { key: "coaching-data-model", desc: "Adam, a male data-model architect coach, glasses, neat beard, wearing a light grey shirt" },
  { key: "performance", desc: "Chloé, a female performance analyst, blonde bob haircut, wearing a modern office blazer" },
  { key: "automatisations", desc: "Théo, a male workflow automation engineer, short hair, wearing a technical work shirt" },
  { key: "paiement-facturation", desc: "Inès, an elegant female billing expert, dark hair, wearing a refined business blazer" },
  { key: "service-client", desc: "Hugo, a friendly male customer support agent wearing a headset and a company polo shirt" },
  { key: "equipes", desc: "Sarah, a warm female team coach, shoulder-length brown hair, wearing a casual smart blazer" },
  { key: "proprietes", desc: "Karim, a male CRM data auditor, short hair, wearing a smart shirt, subtle detective vibe" },
  { key: "prev-ventes", desc: "Emma, a female sales forecaster, futuristic smart-casual outfit, confident look" },
  { key: "prev-marketing", desc: "Lucas, a male marketing forecaster, energetic, wearing a modern casual shirt" },
  { key: "prev-revenue", desc: "Maya, a female revenue forecaster, elegant, wearing a teal blouse" },
  { key: "prev-donnees", desc: "Noah, a male data forecaster, glasses, wearing a light blue shirt" },
  { key: "reporting", desc: "Alix, a female reporting analyst, modern glasses, wearing a slate professional top" },
];

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function generate(persona) {
  const prompt = `${persona.desc}. ${STYLE}`;
  const body = { model: MODEL, prompt, size: "1024x1024", n: 1 };
  // dall-e-3 accepte response_format ; gpt-image-1 renvoie du b64 par défaut.
  if (MODEL === "dall-e-3") {
    body.response_format = "b64_json";
    body.quality = "hd";
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status} : ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Réponse sans image (b64_json absent).");
  return Buffer.from(b64, "base64");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`🎨 Génération des portraits (${MODEL}) → public/personas/\n`);

  for (const persona of PERSONAS) {
    const out = path.join(OUT_DIR, `${persona.key}.png`);
    if (!FORCE && (await fileExists(out))) {
      console.log(`⏭️  ${persona.key} (déjà présent — FORCE=1 pour régénérer)`);
      continue;
    }
    try {
      process.stdout.write(`⏳ ${persona.key} … `);
      const buf = await generate(persona);
      await writeFile(out, buf);
      console.log("✅");
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }
  console.log("\n✨ Terminé. Committe public/personas/*.png puis pousse.");
}

main();
