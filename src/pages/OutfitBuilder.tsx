import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShoppingCart, RefreshCw, X, Plus, ChevronLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { SEO } from "@/components/SEO";

// ── Types ──────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[] | null;
  image_url?: string | null;
  category_id: string;
  description?: string;
}

interface OutfitSlot {
  label: string;
  emoji: string;
  categoryHints: string[]; // category name keywords
  product: Product | null;
}

interface AiResult {
  score: number;       // 0-10
  vibe: string;        // e.g. "Casual Chic"
  occasions: string[]; // e.g. ["Beach", "Brunch"]
  tips: string[];      // styling tips
  missing: string;     // what's missing
}

// ── Groq call (free LLaMA 3.1) ─────────────────────────────────────────
async function analyzeOutfit(slots: OutfitSlot[]): Promise<{ result: AiResult | null; error: string | null }> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return { result: null, error: "AI key not configured. Please contact support." };
  }

  const filled = slots.filter((s) => s.product);
  if (filled.length === 0) return { result: null, error: "Add at least 2 items first!" };

  const items = filled
    .map((s) => `${s.label}: "${s.product!.name}" (LKR ${s.product!.price.toLocaleString()})`)
    .join("\n");

  const prompt = `You are a Sri Lankan fashion stylist AI for ARTIXO online store.
Analyze this outfit combination and return ONLY raw JSON (no markdown, no explanation):

${items}

Return EXACTLY this JSON shape:
{
  "score": 8,
  "vibe": "Casual Chic",
  "occasions": ["Casual Day Out", "Weekend Brunch"],
  "tips": ["Tip 1 about this outfit", "Tip 2 about color coordination"],
  "missing": "A statement accessory like a gold necklace would complete this look"
}

Rules:
- score = outfit harmony out of 10 (integer)
- vibe = 2-3 word style description
- occasions = 2-3 best occasions for this outfit (Sri Lanka context)
- tips = exactly 2 practical styling tips
- missing = one thing that would complete the look (or "This outfit is complete!" if nothing needed)
- Keep it fun, friendly, relevant to Sri Lanka's tropical climate`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Groq error:", res.status, errData);
      return { result: null, error: `AI error (${res.status}). Try again in a moment.` };
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { result: null, error: "AI returned unexpected response. Please try again." };
    const parsed = JSON.parse(match[0]) as AiResult;
    return { result: parsed, error: null };
  } catch (e) {
    console.error("Groq fetch failed:", e);
    return { result: null, error: "Network error. Check your connection and try again." };
  }
}

// ── Main Component ─────────────────────────────────────────────────────
const OutfitBuilder = () => {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const [addedToCart, setAddedToCart] = useState<string[]>([]);

  const [slots, setSlots] = useState<OutfitSlot[]>([
    { label: "Top",       emoji: "👕", categoryHints: ["fashion", "top", "shirt", "clothing", "women", "men", "tshirt"], product: null },
    { label: "Bottom",    emoji: "👖", categoryHints: ["fashion", "bottom", "pant", "skirt", "clothing"], product: null },
    { label: "Shoes",     emoji: "👟", categoryHints: ["shoes", "footwear", "fashion", "sandal"], product: null },
    { label: "Accessory", emoji: "💍", categoryHints: ["accessory", "jewel", "bag", "fashion", "beauty"], product: null },
  ]);

  // Load products — try status filter, fall back to all active
  useEffect(() => {
    const load = async () => {
      // Try with status column (new schema)
      let { data, error } = await supabase
        .from("products")
        .select("id, name, price, images, image_url, category_id, description")
        .eq("status", "approved")
        .limit(60);

      // If status column doesn't exist, fetch without filter
      if (error || !data?.length) {
        const fallback = await supabase
          .from("products")
          .select("id, name, price, images, image_url, category_id, description")
          .limit(60);
        data = fallback.data;
      }

      setProducts((data ?? []) as Product[]);
      setLoading(false);
    };
    load();
  }, []);

  const pickProduct = (product: Product) => {
    if (activeSlotIdx === null) return;
    setSlots((prev) =>
      prev.map((s, i) => (i === activeSlotIdx ? { ...s, product } : s))
    );
    setActiveSlotIdx(null);
    setAiResult(null);
  };

  const clearSlot = (idx: number) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, product: null } : s)));
    setAiResult(null);
    setAiError(null);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAiResult(null);
    setAiError(null);
    // Minimum 1.2s so the spinner is always visible
    const [{ result, error }] = await Promise.all([
      analyzeOutfit(slots),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
    setAiResult(result);
    setAiError(error);
    setAnalyzing(false);
  };

  const handleAddAllToCart = () => {
    slots.forEach((s) => {
      if (s.product) {
        addItem({
          id: s.product.id,
          name: s.product.name,
          price: s.product.price,
          image: s.product.images?.[0] ?? "",
        });
        setAddedToCart((prev) => [...prev, s.product!.id]);
      }
    });
  };

  const filledCount = slots.filter((s) => s.product).length;

  // ── Picker panel ────────────────────────────────────────────────────
  if (activeSlotIdx !== null) {
    const slot = slots[activeSlotIdx];
    const filtered = products.length > 0 ? products : [];

    return (
      <div className="min-h-screen bg-background">
        <SEO title={`Pick ${slot.label} — AI Outfit Builder`} />
        {/* Picker header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setActiveSlotIdx(null)} className="p-1.5 rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold">Pick {slot.emoji} {slot.label}</span>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No products found. Add products to your store first!
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => pickProduct(p)}
                className="group rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary transition-all text-left bg-white shadow-sm hover:shadow-md"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  <img
                    src={p.images?.[0] ?? p.image_url ?? "/placeholder.svg"}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2 leading-snug">{p.name}</p>
                  <p className="text-xs text-primary font-bold mt-0.5">LKR {p.price.toLocaleString()}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Main builder UI ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title="AI Outfit Builder — ARTIXO" description="Mix and match fashion products and let AI style you!" />

      {/* Header */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #8B1A2E 0%, #c0392b 60%, #FFD100 100%)" }}>
        <div className="container py-8 text-white text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" /> AI Powered
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2">
            AI Outfit Builder 👗
          </h1>
          <p className="text-white/80 text-sm max-w-sm mx-auto">
            Pick your pieces — our AI styles you instantly!
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/10" />
      </div>

      <div className="container py-6 max-w-lg mx-auto">

        {/* Outfit slots grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {slots.map((slot, idx) => (
            <div key={idx} className="relative">
              {slot.product ? (
                // Filled slot
                <div
                  className="rounded-2xl overflow-hidden border-2 border-primary/30 bg-white shadow-md cursor-pointer"
                  onClick={() => setActiveSlotIdx(idx)}
                >
                  <div className="aspect-square bg-muted overflow-hidden relative">
                    <img
                      src={slot.product.images?.[0] ?? slot.product.image_url ?? "/placeholder.svg"}
                      alt={slot.product.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Clear button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {/* Slot label */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <span className="text-white text-xs font-semibold">{slot.emoji} {slot.label}</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-medium line-clamp-1">{slot.product.name}</p>
                    <p className="text-xs font-bold text-primary">LKR {slot.product.price.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                // Empty slot
                <button
                  onClick={() => setActiveSlotIdx(idx)}
                  className="w-full aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-white/50 hover:bg-white transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <span className="text-3xl">{slot.emoji}</span>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    + Add {slot.label}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Total price */}
        {filledCount > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total outfit cost</p>
              <p className="text-xl font-bold text-foreground">
                LKR {slots.reduce((sum, s) => sum + (s.product?.price ?? 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{filledCount} / {slots.length} items</p>
              <div className="flex gap-1 mt-1">
                {slots.map((s, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full ${s.product ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={filledCount < 2 || analyzing}
          className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: filledCount >= 2 ? "linear-gradient(135deg, #8B1A2E, #c0392b)" : undefined, color: filledCount >= 2 ? "white" : undefined, backgroundColor: filledCount < 2 ? "hsl(var(--muted))" : undefined }}
        >
          {analyzing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyzing your outfit…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {filledCount < 2 ? "Add at least 2 items to analyze" : "✨ Analyze My Outfit"}
            </>
          )}
        </button>

        {/* AI Error */}
        {aiError && !analyzing && (
          <div className="mt-3 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-sm"
            style={{ background: "hsl(0 84% 60% / 0.1)", border: "1px solid hsl(0 84% 60% / 0.25)" }}>
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-red-700 text-xs mb-0.5">AI Analysis Failed</p>
              <p className="text-red-600/80 text-xs">{aiError}</p>
            </div>
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="mt-4 rounded-2xl overflow-hidden shadow-md border border-primary/20">
            {/* Score header */}
            <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wide font-medium">Outfit Vibe</p>
                  <h3 className="font-display text-xl font-bold">{aiResult.vibe}</h3>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-extrabold">{aiResult.score}</div>
                  <div className="text-white/70 text-xs">/10</div>
                </div>
              </div>
              {/* Star bar */}
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i < aiResult.score ? "bg-yellow-400" : "bg-white/20"}`} />
                ))}
              </div>
            </div>

            <div className="bg-white p-4 space-y-4">
              {/* Occasions */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Best For</p>
                <div className="flex flex-wrap gap-2">
                  {aiResult.occasions.map((o, i) => (
                    <span key={i} className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: "hsl(49 100% 50% / 0.15)", color: "hsl(343 73% 32%)" }}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Styling Tips</p>
                <div className="space-y-2">
                  {aiResult.tips.map((tip, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-0.5 shrink-0">✦</span>
                      <span className="text-foreground/80">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing piece */}
              {aiResult.missing && aiResult.missing !== "This outfit is complete!" && (
                <div className="rounded-xl p-3 text-sm" style={{ background: "hsl(49 100% 50% / 0.1)" }}>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Complete the look</p>
                  <p className="text-foreground/80">{aiResult.missing}</p>
                </div>
              )}

              {/* Add all to cart */}
              <button
                onClick={handleAddAllToCart}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
              >
                <ShoppingCart className="h-4 w-4" />
                Add Full Outfit to Cart
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filledCount === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-6">
            Tap any slot above to pick a product 👆
          </p>
        )}
      </div>
    </div>
  );
};

export default OutfitBuilder;
