import { NextResponse } from "next/server";

/**
 * Formulaires du site marketing (contact, démo, essai gratuit) → email via
 * Resend (no-reply@revold.io) vers la boîte de l'équipe. Remplace Formspree :
 * les IDs codés en dur n'existaient pas, toutes les soumissions se perdaient.
 */

const TO = "ilyes.benchora@gmail.com";
const FORM_LABELS: Record<string, string> = {
  contact: "Contact",
  demo: "Demande de démo",
  "essai-gratuit": "Essai gratuit",
};

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY manquante" }, { status: 500 });
  }

  let fields: Record<string, string> = {};
  let formKind = "contact";
  try {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.length <= 5000) fields[k] = v;
    }
    formKind = FORM_LABELS[fields._form] ? fields._form : "contact";
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Honeypot anti-bots : champ caché « _gotcha » rempli → on ignore poliment.
  if (fields._gotcha) return NextResponse.json({ ok: true });

  const email = (fields.email ?? "").trim();
  const shown = Object.entries(fields).filter(([k, v]) => !k.startsWith("_") && v.trim());
  if (shown.length === 0) {
    return NextResponse.json({ error: "Formulaire vide" }, { status: 400 });
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rowsHtml = shown
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Revold Site <no-reply@revold.io>",
      to: [TO],
      reply_to: email || undefined,
      subject: `[Site] ${FORM_LABELS[formKind]}${email ? ` — ${email}` : ""}`,
      html: `<img src="https://revold.ai/email-logo.png" width="40" height="40" alt="Revold" style="border-radius:50%" /><h2>${FORM_LABELS[formKind]} — nouvelle soumission</h2><table style="font-size:14px">${rowsHtml}</table>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[site-forms] Resend error", res.status, detail.slice(0, 300));
    return NextResponse.json({ error: "Envoi impossible" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
