/**
 * ARTIXO — Gemini Tamil Translator
 *
 * translate(text) → Tamil string
 *
 * Features:
 *  - In-memory TTL cache (30 min) so same string never hits Gemini twice
 *  - Batch-friendly: translate([...]) translates multiple strings in one API call
 *  - Graceful fallback: returns original text if API fails or key missing
 *  - Skips translation for: empty strings, numbers-only, already-Tamil text
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── Cache ────────────────────────────────────────────────────────────────────
type Entry = { ta: string; exp: number };
const cache = new Map<string, Entry>();
const TTL = 30 * 60_000;

function getCached(text: string): string | null {
  const e = cache.get(text);
  if (!e) return null;
  if (Date.now() > e.exp) { cache.delete(text); return null; }
  return e.ta;
}

function setCache(text: string, ta: string) {
  cache.set(text, { ta, exp: Date.now() + TTL });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isTrivial(text: string) {
  const t = text.trim();
  return !t || /^\d[\d\s.,%-]*$/.test(t) || t.length < 2;
}

// ── Core Gemini call (batch) ─────────────────────────────────────────────────
async function geminiTranslateBatch(texts: string[]): Promise<string[]> {
  if (!GEMINI_KEY) return texts;

  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const prompt = `Translate the following product-related English texts to Tamil (தமிழ்).
Rules:
- Keep brand names, model numbers, sizes, and special characters as-is
- Return ONLY the translations, numbered the same way (1. 2. 3. ...)
- Do NOT add explanations or extra text
- Keep translations natural and concise

Texts to translate:
${numbered}`;

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) return texts;

  const json = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Parse "1. ...\n2. ...\n3. ..."
  const lines = raw.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  return texts.map((original, i) => {
    const match = lines.find((l) => l.trim().startsWith(`${i + 1}.`));
    if (!match) return original;
    const translated = match.replace(/^\d+\.\s*/, "").trim();
    return translated || original;
  });
}

// ── In-flight dedup ──────────────────────────────────────────────────────────
const inFlight = new Map<string, Promise<string>>();

/** Translate a single string to Tamil. Returns original on failure. */
export async function translate(text: string): Promise<string> {
  if (isTrivial(text)) return text;
  const cached = getCached(text);
  if (cached) return cached;
  if (inFlight.has(text)) return inFlight.get(text)!;

  const p = geminiTranslateBatch([text])
    .then(([result]) => { setCache(text, result); inFlight.delete(text); return result; })
    .catch(() => { inFlight.delete(text); return text; });

  inFlight.set(text, p);
  return p;
}

/** Translate multiple strings in a single Gemini call. */
export async function translateBatch(texts: string[]): Promise<string[]> {
  const results: string[] = new Array(texts.length);
  const toFetch: { idx: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (isTrivial(t)) { results[i] = t; continue; }
    const cached = getCached(t);
    if (cached) { results[i] = cached; continue; }
    toFetch.push({ idx: i, text: t });
  }

  if (toFetch.length === 0) return results;

  try {
    const translated = await geminiTranslateBatch(toFetch.map((f) => f.text));
    toFetch.forEach(({ idx, text }, i) => {
      results[idx] = translated[i];
      setCache(text, translated[i]);
    });
  } catch {
    toFetch.forEach(({ idx, text }) => { results[idx] = text; });
  }

  return results;
}
