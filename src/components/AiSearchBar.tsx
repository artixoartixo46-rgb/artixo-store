import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, X, Loader2, Mic, MicOff } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export const AiSearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [interimText, setInterimText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setInterimText("");

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
    <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
      <div className="relative">
        {/* Left icon — spinner while loading or AI processing voice */}
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}

        <Input
          ref={inputRef}
          value={isListening && interimText ? interimText : query}
          onChange={(e) => { setQuery(e.target.value); setInterimText(""); }}
          placeholder={isListening ? "Listening…" : 'Try "cheap phones under 15000 LKR" or "Nike shoes"…'}
          className={cn(
            "pl-10 pr-24 h-10 rounded-full input-glass border-transparent focus-visible:bg-white/80 focus-visible:border-white/60 transition-fluid",
            isListening && "border-primary/60 ring-2 ring-primary/20"
          )}
          disabled={loading}
        />

        {/* Right side controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Clear button */}
          {query && !loading && !isListening && (
            <button
              type="button"
              onClick={() => { setQuery(""); setInterimText(""); inputRef.current?.focus(); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Mic button — only shown if browser supports speech API */}
          {voiceSupported && (
            <button
              type="button"
              onClick={startVoice}
              aria-label={isListening ? "Stop listening" : "Search by voice"}
              className={cn(
                "relative flex items-center justify-center h-6 w-6 rounded-full transition-colors",
                isListening
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Pulse ring while listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-primary/10" />
                </>
              )}
              {isListening ? (
                <MicOff className="h-3.5 w-3.5 relative z-10" />
              ) : (
                <Mic className="h-3.5 w-3.5 relative z-10" />
              )}
            </button>
          )}

          {/* AI badge */}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex items-center gap-0.5 select-none"
            style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
          >
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        </div>
      </div>

      {/* Listening status hint */}
      {isListening && (
        <p className="text-[11px] text-primary mt-1 ml-3 animate-pulse">
          Speak now — say what you're looking for…
        </p>
      )}
    </form>
  );
};
