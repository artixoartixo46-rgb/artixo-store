import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, X, Loader2, Mic, MicOff } from "lucide-react";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { cn } from "@/lib/utils";

const GEMINI_MODEL = "gemini-2.0-flash-lite";

interface ParsedQuery {
  keyword: string | null;
  category: string | null;
  maxPrice: number | null;
  minPrice: number | null;
  brand: string | null;
  onSale: boolean;
  sort: "newest" | "price_asc" | "price_desc" | "name_asc";
}

function isNaturalLanguage(q: string): boolean {
  return (
    /under|below|less than|above|over|more than|cheap|affordable|budget|expensive|premium|best|sale|discount|offer/i.test(q) ||
    /lkr|rs\.?\s*\d|\d{3,}/i.test(q) ||
    q.trim().split(/\s+/).length >= 3
  );
}

async function parseWithGemini(q: string): Promise<ParsedQuery | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a product search parser for ARTIXO, a Sri Lankan e-commerce marketplace.
Available category slugs: electronics, fashion, home, beauty, sports, grocery, furniture, toys, health

Parse this search query and return ONLY raw JSON (no markdown fences, no explanation):
"${q}"

Required JSON shape:
{
  "keyword": "core product name or null",
  "category": "exact slug from the list above or null",
  "maxPrice": number_in_LKR_or_null,
  "minPrice": number_in_LKR_or_null,
  "brand": "brand name or null",
  "onSale": false,
  "sort": "newest"
}

Rules:
- keyword = the main product (no price/quality adjectives)
- "cheap","affordable","budget","low price" → sort:"price_asc"
- "expensive","premium","luxury","best" → sort:"price_desc"
- "under X","below X","less than X","within X" → maxPrice: X
- "above X","over X","more than X" → minPrice: X
- "on sale","discount","offer","sale" → onSale: true
- Numbers without LKR context → treat as LKR (e.g. "under 5000" → maxPrice:5000)
- If no category matches, use null`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 300 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as ParsedQuery;
  } catch {
    return null;
  }
}

export const AiSearchBar = ({ onSearch }: { onSearch?: () => void } = {}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setInterimText("");
    onSearch?.();

    if (!isNaturalLanguage(trimmed)) {
      navigate(`/products?q=${encodeURIComponent(trimmed)}`);
      return;
    }

    setLoading(true);
    try {
      const parsed = await parseWithGemini(trimmed);
      if (!parsed) { navigate(`/products?q=${encodeURIComponent(trimmed)}`); return; }

      const sp = new URLSearchParams();
      if (parsed.keyword) sp.set("q", parsed.keyword);
      if (parsed.category) sp.set("category", parsed.category);
      if (parsed.maxPrice != null) sp.set("maxPrice", String(parsed.maxPrice));
      if (parsed.minPrice != null) sp.set("minPrice", String(parsed.minPrice));
      if (parsed.brand) sp.set("brand", parsed.brand);
      if (parsed.onSale) sp.set("onSale", "true");
      if (parsed.sort && parsed.sort !== "newest") sp.set("sort", parsed.sort);
      sp.set("aiQuery", encodeURIComponent(trimmed));

      navigate(`/products?${sp.toString()}`);
    } catch {
      navigate(`/products?q=${encodeURIComponent(trimmed)}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const { state: voiceState, supported: voiceSupported, start: startVoice } = useVoiceSearch({
    lang: "en-LK",
    onInterim: (t) => {
      setQuery(t);
      setInterimText(t);
    },
    onResult: (t) => {
      setQuery(t);
      setInterimText("");
      doSearch(t);
    },
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const isListening = voiceState === "listening";

  return (
    <form onSubmit={handleSearch} className="w-full max-w-xl mx-auto">
      <div
        className={cn(
          "relative flex items-center rounded-full transition-all duration-300",
          "bg-white/80 backdrop-blur-md",
          "border-2",
          focused || isListening
            ? "border-primary shadow-[0_0_0_3px_hsl(49_100%_50%/0.18)]"
            : "border-white/60 shadow-[0_2px_12px_rgba(0,0,0,0.08)]",
          isListening && "border-primary/70"
        )}
      >
        {/* Left: search / spinner icon */}
        <div className="flex items-center pl-3.5 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <Search className={cn(
              "h-4 w-4 transition-colors",
              focused ? "text-primary" : "text-muted-foreground/60"
            )} />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={isListening && interimText ? interimText : query}
          onChange={(e) => { setQuery(e.target.value); setInterimText(""); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isListening ? "Listening…" : "Search products, brands…"}
          className={cn(
            "flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none",
            "placeholder:text-muted-foreground/50 text-foreground",
            "[appearance:textfield] [&::-webkit-search-cancel-button]:hidden"
          )}
          disabled={loading}
        />

        {/* Right: controls */}
        <div className="flex items-center gap-1.5 pr-3">
          {/* Clear */}
          {query && !loading && !isListening && (
            <button
              type="button"
              onClick={() => { setQuery(""); setInterimText(""); inputRef.current?.focus(); }}
              className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-4 bg-border/60" />

          {/* Mic */}
          {voiceSupported && (
            <button
              type="button"
              onClick={startVoice}
              aria-label={isListening ? "Stop listening" : "Voice search"}
              className={cn(
                "relative flex items-center justify-center h-7 w-7 rounded-full transition-all",
                isListening
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              )}
              {isListening ? (
                <MicOff className="h-3.5 w-3.5 relative z-10" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* AI Search button */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold",
              "text-white select-none transition-all duration-200",
              "hover:opacity-90 active:scale-95 disabled:opacity-60"
            )}
            style={{ background: "linear-gradient(135deg, #8B1A2E 0%, #c0392b 60%, #e74c3c 100%)" }}
          >
            <Sparkles className="h-3 w-3" />
            AI
          </button>
        </div>
      </div>

      {/* Listening hint */}
      {isListening && (
        <p className="text-[11px] text-primary mt-1.5 ml-4 animate-pulse font-medium">
          🎙 Speak now — say what you're looking for…
        </p>
      )}
    </form>
  );
};
