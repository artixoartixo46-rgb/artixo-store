import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clampNumber = (v: unknown, max = 500): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < 0 || v > max) return null;
  return v;
};

const clampString = (v: unknown, max = 120): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) return json(401, { error: "Unauthorized" });

    const { measurements = {}, product_name, size_chart } = await req.json();

    // Sanitize all inputs to prevent prompt injection and oversized requests
    const m = {
      height_cm: clampNumber(measurements.height_cm, 300) ?? "unknown",
      weight_kg: clampNumber(measurements.weight_kg, 500) ?? "unknown",
      chest_cm: clampNumber(measurements.chest_cm, 300) ?? "unknown",
      waist_cm: clampNumber(measurements.waist_cm, 300) ?? "unknown",
      shoulder_cm: clampNumber(measurements.shoulder_cm, 200) ?? "unknown",
    };
    const safeProductName = clampString(product_name, 120) ?? "Clothing Item";
    const sizeChartText = size_chart
      ? `\nSize Chart:\n${JSON.stringify(size_chart).slice(0, 2000)}`
      : "\nNo size chart provided — use standard Sri Lankan sizing.";

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY not configured" });

    const prompt = `You are a clothing fit expert. Analyze these body measurements and recommend the best size.

Body Measurements:
- Height: ${m.height_cm} cm
- Weight: ${m.weight_kg} kg
- Chest: ${m.chest_cm} cm
- Waist: ${m.waist_cm} cm
- Shoulders: ${m.shoulder_cm} cm

Product: ${safeProductName}${sizeChartText}

Respond with ONLY a valid JSON object in this exact format (no markdown, no extra text):
{
  "recommended_size": "M",
  "confidence": "high",
  "fit_notes": "Brief 1-2 sentence fit explanation",
  "size_ratings": {
    "XS": "too small",
    "S": "slightly small",
    "M": "perfect fit",
    "L": "slightly large",
    "XL": "too large"
  }
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return json(500, { error: data.error?.message || "Claude API error" });

    let analysis;
    try {
      const text = data.content[0].text.trim();
      const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = {
        recommended_size: "M",
        confidence: "medium",
        fit_notes: data.content[0]?.text ?? "Unable to parse fit analysis.",
        size_ratings: {},
      };
    }

    return json(200, analysis);
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});
