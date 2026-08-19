import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getAnthropicKey } from "@/lib/ai/anthropic-key";
import { CUSTOM_ENTITIES, ENTITY_FIELDS, extraFieldId, type CustomEntity } from "@/lib/integrations/custom-connector";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Wizard connecteur sur mesure → « Correspondance proposée par l'agent » (1d) :
 * à partir des champs détectés et d'un enregistrement RÉEL (test de
 * l'endpoint), l'agent propose le field_map canonique complet + les champs
 * métier supplémentaires utiles. Rien n'est appliqué automatiquement :
 * l'utilisateur voit la proposition dans les sélecteurs et la corrige.
 * Validation stricte : seuls des chemins réellement présents dans `keys`
 * sont acceptés.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { entity?: string; keys?: unknown; sample?: unknown; toolLabel?: string; toolDescription?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }

  const entity = String(body.entity ?? "");
  if (!(CUSTOM_ENTITIES as readonly string[]).includes(entity)) {
    return NextResponse.json({ error: "Entité inconnue" }, { status: 400 });
  }
  const keys = (Array.isArray(body.keys) ? body.keys : [])
    .filter((k): k is string => typeof k === "string" && !!k.trim())
    .slice(0, 200);
  if (keys.length === 0) return NextResponse.json({ error: "Teste d'abord l'endpoint (aucun champ détecté)." }, { status: 400 });
  const sample = body.sample && typeof body.sample === "object" ? (body.sample as Record<string, unknown>) : null;

  const { key: anthropicKey, reason } = getAnthropicKey();
  if (!anthropicKey) return NextResponse.json({ error: reason ?? "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const def = ENTITY_FIELDS[entity as CustomEntity];
  const canonicalDoc = def.fields
    .map((f) => `${f.id}${f.required ? " (OBLIGATOIRE)" : ""} = ${f.label}${f.hint ? ` — ${f.hint.slice(0, 140)}` : ""}`)
    .join(" ; ");

  const MAP_TOOL: Anthropic.Tool = {
    name: "propose_mapping",
    description:
      "Propose la correspondance des champs de l'outil vers le modèle canonique Revold, " +
      "et les champs MÉTIER supplémentaires utiles au reporting (hors modèle canonique). " +
      "N'utilise QUE des chemins présents dans la liste des champs détectés — jamais inventés. " +
      "Un champ canonique sans équivalent évident reste ABSENT du mapping (rien n'est inventé).",
    input_schema: {
      type: "object",
      properties: {
        fieldMap: {
          type: "object",
          description: "Clé = champ canonique, valeur = chemin EXACT du champ dans l'outil (liste détectée).",
          additionalProperties: { type: "string" },
        },
        extraFields: {
          type: "array",
          maxItems: 8,
          description:
            "Champs métier de l'outil ABSENTS du modèle canonique mais utiles au reporting " +
            "(marge, quantité, entrepôt, type de contrat…). kind: number = agrégeable en somme/moyenne, label = répartition.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Nom lisible en français." },
              kind: { type: "string", enum: ["number", "label"] },
              source: { type: "string", description: "Chemin EXACT du champ dans l'outil." },
            },
            required: ["label", "kind", "source"],
          },
        },
        note: { type: "string", description: "1 phrase max : ce qui mérite vérification humaine (ambiguïté, format de date…)." },
      },
      required: ["fieldMap"],
    },
  };

  const system =
    `Tu mappes les champs d'un outil métier (API REST) vers le modèle canonique Revold pour l'entité « ${entity} ». ` +
    `CHAMPS CANONIQUES ATTENDUS : ${canonicalDoc}. ` +
    `Tu reçois la liste des champs détectés et un enregistrement réel d'exemple : appuie-toi sur les NOMS et les VALEURS ` +
    `(formats de dates, montants, codes) pour décider. IMPÉRATIF : chaque chemin proposé doit exister EXACTEMENT dans la liste. ` +
    `Propose aussi en extraFields les champs métier qui n'entrent pas dans le canonique mais enrichiraient le reporting. ` +
    `Réponds uniquement via l'outil propose_mapping.`;

  const userMessage =
    (body.toolLabel ? `Outil : ${String(body.toolLabel).slice(0, 80)}. ` : "") +
    (body.toolDescription ? `Contexte : ${String(body.toolDescription).slice(0, 300)}. ` : "") +
    `Champs détectés (${keys.length}) : ${keys.join(", ")}.` +
    (sample ? ` Enregistrement d'exemple : ${JSON.stringify(sample).slice(0, 3000)}` : "");

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 900,
      system,
      tools: [MAP_TOOL],
      tool_choice: { type: "tool", name: "propose_mapping" },
      messages: [{ role: "user", content: userMessage }],
    });
    const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return NextResponse.json({ error: "L'agent n'a pas pu proposer de correspondance." }, { status: 422 });
    const input = toolUse.input as {
      fieldMap?: Record<string, unknown>;
      extraFields?: Array<{ label?: string; kind?: string; source?: string }>;
      note?: string;
    };

    // ── Validation stricte : chemins existants + champs canoniques connus. ──
    const keySet = new Set(keys);
    const canonicalIds = new Set(def.fields.map((f) => f.id));
    const fieldMap: Record<string, string> = {};
    for (const [canonical, path] of Object.entries(input.fieldMap ?? {})) {
      if (canonicalIds.has(canonical) && typeof path === "string" && keySet.has(path)) fieldMap[canonical] = path;
    }
    const mappedPaths = new Set(Object.values(fieldMap));
    const extraFields: Array<{ label: string; kind: "number" | "label"; source: string }> = [];
    const seen = new Set<string>();
    for (const f of (input.extraFields ?? []).slice(0, 8)) {
      const label = typeof f.label === "string" ? f.label.trim().slice(0, 60) : "";
      const source = typeof f.source === "string" ? f.source.trim() : "";
      if (!label || !keySet.has(source) || mappedPaths.has(source)) continue;
      const id = extraFieldId(label);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      extraFields.push({ label, kind: f.kind === "number" ? "number" : "label", source });
    }

    return NextResponse.json({
      fieldMap,
      extraFields,
      note: typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur agent" }, { status: 500 });
  }
}
