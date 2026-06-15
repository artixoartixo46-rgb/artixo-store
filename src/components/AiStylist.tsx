import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot, User, ImagePlus, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface StylistMsg {
  id: number;
  from: "bot" | "user";
  text: string;
  image?: string;
  products?: { label: string; search: string }[];
  time: string;
}

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const GEMINI_MODEL = "gemini-2.0-flash-lite";

const SYSTEM_PROMPT = `You are ARTIXO Stylist ✨ — a warm, trendy AI fashion assistant for ARTIXO, Sri Lanka's multi-vendor marketplace.

Your role:
- Give personalized style advice, outfit ideas, and fashion tips
- Analyze outfit or product photos when shared
- Recommend items suited for Sri Lanka's tropical climate and culture
- Keep responses concise (3–5 sentences), friendly, and actionable

When suggesting products to shop, always end your reply with this exact line (no extra text after):
PRODUCTS: [{"label":"item name","search":"search keyword"},{"label":"item name","search":"search keyword"}]

If no product suggestions, omit the PRODUCTS line entirely.`;

const QUICK = ["Outfit for a party 🎉", "Casual everyday look", "Office wear tips", "Rainy season style 🌧️"];

export const AiStylist = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<StylistMsg[]>([
    {
      id: 0,
      from: "bot",
      text: "Hi! ✨ I'm your AI Stylist. Ask me anything about fashion, or upload a photo of an outfit for personalized advice! 👗",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const parseProducts = (text: string) => {
    const match = text.match(/PRODUCTS:\s*(\[[\s\S]*?\])/);
    if (!match) return { cleanText: text.trim(), products: [] };
    try {
      const products = JSON.parse(match[1]) as { label: string; search: string }[];
      const cleanText = text.replace(/PRODUCTS:\s*\[[\s\S]*?\]/, "").trim();
      return { cleanText, products };
    } catch {
      return { cleanText: text.trim(), products: [] };
    }
  };

  const callGemini = async (userText: string, imageBase64?: string, mimeType?: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API key not configured");

    const parts: object[] = [];
    if (imageBase64) {
      parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } });
    }
    parts.push({
      text: SYSTEM_PROMPT + "\n\nUser: " + (userText.trim() || "Please analyze this photo and give me style advice."),
    });

    const doFetch = () =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      );

    let res = await doFetch();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000));
      res = await doFetch();
    }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`${res.status}: ${(e as any)?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "Sorry, I couldn't generate a response.";
  };

  const send = async (text: string, imageFile?: File) => {
    if (!text.trim() && !imageFile) return;

    let imageBase64: string | undefined;
    let imagePreview: string | undefined;
    let mimeType: string | undefined;

    if (imageFile) {
      imageBase64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(imageFile);
      });
      imagePreview = URL.createObjectURL(imageFile);
      mimeType = imageFile.type;
    }

    const userMsg: StylistMsg = {
      id: Date.now(),
      from: "user",
      text: text || "📸 Shared a photo",
      image: imagePreview,
      time: now(),
    };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const raw = await callGemini(text, imageBase64, mimeType);
      const { cleanText, products } = parseProducts(raw);
      setMsgs((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: "bot",
          text: cleanText,
          products: products.length ? products : undefined,
          time: now(),
        },
      ]);
      if (!open) setUnread((n) => n + 1);
    } catch (e: unknown) {
      setMsgs((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: "bot",
          text: `Oops! Something went wrong: ${(e as Error).message}`,
          time: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) send(input, file);
    e.target.value = "";
  };

  return (
    <>
      {/* Floating button — sits to the LEFT of the ChatBot button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 z-50 h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          right: "88px",
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        }}
        aria-label="Open AI Stylist"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Sparkles className="h-6 w-6 text-white" />
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 z-50 w-[340px] sm:w-[380px] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          style={{ right: "88px", maxHeight: "560px", background: "#fff" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, #5b21b6, #7c3aed)" }}
          >
            <div className="h-9 w-9 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">ARTIXO Stylist ✨</p>
              <p className="text-white/65 text-xs flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                AI-powered · Upload photos
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50"
            style={{ minHeight: 0 }}
          >
            {msgs.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.from === "bot" ? "bg-purple-200" : "bg-purple-100"
                  }`}
                >
                  {msg.from === "bot" ? (
                    <Sparkles className="h-4 w-4 text-purple-700" />
                  ) : (
                    <User className="h-4 w-4 text-purple-500" />
                  )}
                </div>

                <div
                  className={`max-w-[78%] space-y-1.5 flex flex-col ${
                    msg.from === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Image preview */}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="uploaded"
                      className="w-40 h-40 object-cover rounded-2xl border border-purple-100"
                    />
                  )}

                  {/* Text bubble */}
                  {msg.text && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                        msg.from === "bot"
                          ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                          : "text-white rounded-tr-sm"
                      }`}
                      style={
                        msg.from === "user"
                          ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)" }
                          : undefined
                      }
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Product chips */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {msg.products.map((p) => (
                        <Link
                          key={p.search}
                          to={`/products?search=${encodeURIComponent(p.search)}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:bg-purple-50"
                          style={{ color: "#7c3aed", borderColor: "#c4b5fd" }}
                        >
                          <ShoppingBag className="h-3 w-3" />
                          {p.label}
                        </Link>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-gray-400">{msg.time}</span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="h-7 w-7 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-purple-700" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors hover:bg-purple-50 disabled:opacity-40"
                style={{ borderColor: "#c4b5fd", color: "#7c3aed" }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            {/* Photo upload */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 disabled:opacity-40 border border-purple-200 bg-purple-50"
              title="Upload outfit photo"
            >
              <ImagePlus className="h-4 w-4 text-purple-600" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && send(input)}
              placeholder="Ask about style or upload a photo…"
              disabled={loading}
              className="flex-1 text-sm px-4 py-2 rounded-full bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-purple-200 placeholder:text-gray-400 disabled:opacity-60"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
