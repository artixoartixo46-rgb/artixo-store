import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, RotateCcw, ShoppingBag, Package, RefreshCw, HelpCircle, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────
interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  links?: { label: string; to: string }[];
  time: string;
}

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// ── Quick actions ───────────────────────────────────────────────────────
const QUICK = [
  { icon: Package,     label: "Track my order",     msg: "How do I track my order?" },
  { icon: RefreshCw,   label: "Return / Refund",     msg: "What is the return and refund policy?" },
  { icon: ShoppingBag, label: "Browse products",     msg: "Show me popular products" },
  { icon: Tag,         label: "Delivery info",       msg: "How long does delivery take?" },
];

// ── Fetch helpers ───────────────────────────────────────────────────────
async function fetchUserOrders(userId: string) {
  const { data } = await supabase
    .from("orders")
    .select("id, status, total, created_at, tracking_number")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

async function fetchProducts(keyword: string) {
  const { data } = await supabase
    .from("products")
    .select("id, name, price, image_url")
    .ilike("name", `%${keyword}%`)
    .limit(5);
  return data ?? [];
}

// ── Pollinations AI ─────────────────────────────────────────────────────
async function askAI(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: "openai",
        seed: Math.floor(Math.random() * 9999),
      }),
    });
    if (!res.ok) return "Sorry, I couldn't reach the AI right now. Please try again!";
    return await res.text();
  } catch {
    return "Network error. Please check your connection and try again.";
  }
}

// ── System prompt builder ───────────────────────────────────────────────
function buildSystem(orders: any[], isLoggedIn: boolean): string {
  const orderBlock = orders.length
    ? orders
        .map(
          (o) =>
            `Order #${String(o.id).slice(0, 8).toUpperCase()} — Status: ${o.status} — Total: LKR ${Number(o.total).toLocaleString()}${o.tracking_number ? ` — Tracking: ${o.tracking_number}` : ""} — Placed: ${new Date(o.created_at).toLocaleDateString()}`
        )
        .join("\n")
    : isLoggedIn
    ? "No recent orders found."
    : "User is not logged in — cannot show order details. Ask them to sign in at /auth.";

  return `You are ARTIXO Support Bot — a friendly, helpful customer support AI for ARTIXO, Sri Lanka's #1 online marketplace.

STORE INFO:
- Name: ARTIXO
- Location: Sri Lanka — island-wide delivery to all 25 districts
- Delivery: 1-3 business days (Colombo), 2-5 days (other districts)
- Payment: Cash on Delivery (COD) + online payment
- Return policy: 7-day return window for unused/defective items. Contact support within 7 days of delivery.
- Refund policy: Refunds processed in 3-5 business days after return is received.
- Support email: support@artixo.lk
- Sellers: Admin-verified sellers only
- Currency: LKR (Sri Lankan Rupee)

CUSTOMER ORDERS:
${orderBlock}

RULES:
- Be warm, concise, helpful. Use short paragraphs.
- Answer in the same language the user writes (English or Tamil/Sinhala mix is fine).
- For order tracking: use the order data above. If no orders, explain they need to sign in.
- For product questions: recommend they use the search bar or browse /products.
- Never make up order data. Only use what's provided above.
- Keep responses under 120 words. Use emojis sparingly.
- End with a follow-up offer like "Anything else I can help with? 😊"`;
}

// ── Main Component ─────────────────────────────────────────────────────
export const ChatBot = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      from: "bot",
      text: "Hi there! 👋 I'm ARTIXO's support bot. I can help you track orders, answer questions about delivery, returns, and more!\n\nWhat can I help you with today?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load user orders once
  useEffect(() => {
    if (user) fetchUserOrders(user.id).then(setOrders);
  }, [user]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const addBotMessage = useCallback((text: string, links?: { label: string; to: string }[]) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "bot", text, links, time: now() },
    ]);
    if (!open) setUnread((n) => n + 1);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: trimmed, time: now() },
    ]);
    setInput("");
    setTyping(true);

    // Build conversation history
    const newHistory = [
      ...history,
      { role: "user", content: trimmed },
    ];

    // Check for product search intent
    const productKeywords = trimmed.match(/show me|find|search|looking for|i want|buy (.+)/i);
    let extraContext = "";
    if (productKeywords) {
      const keyword = productKeywords[1] ?? trimmed.replace(/show me|find|search|looking for|i want/gi, "").trim();
      if (keyword.length > 2) {
        const found = await fetchProducts(keyword);
        if (found.length) {
          extraContext = `\n\n[PRODUCT SEARCH RESULTS for "${keyword}"]: ${found.map((p: any) => `${p.name} — LKR ${Number(p.price).toLocaleString()}`).join(", ")}. Tell the user about these results and suggest they visit /products to browse.`;
        }
      }
    }

    const systemPrompt = buildSystem(orders, !!user);
    const aiMessages = [
      { role: "system", content: systemPrompt + extraContext },
      ...newHistory,
    ];

    const reply = await askAI(aiMessages);
    setTyping(false);

    // Detect links to include
    const links: { label: string; to: string }[] = [];
    if (/order|track/.test(trimmed.toLowerCase()) && !user) {
      links.push({ label: "Sign in to see orders", to: "/auth" });
    }
    if (/product|shop|buy|browse/.test(trimmed.toLowerCase())) {
      links.push({ label: "Browse products", to: "/products" });
    }

    addBotMessage(reply, links.length ? links : undefined);
    setHistory([...newHistory, { role: "assistant", content: reply }]);
  }, [typing, history, orders, user, addBotMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleReset = () => {
    setMessages([{
      id: 1,
      from: "bot",
      text: "Chat cleared! How can I help you? 😊",
      time: now(),
    }]);
    setHistory([]);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
        aria-label="Customer Support"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6 text-white" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-400 text-yellow-900 text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-24 right-5 z-50 w-[340px] sm:w-[380px] rounded-2xl overflow-hidden shadow-2xl border border-white/20 transition-all duration-300 origin-bottom-right ${
          open ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none"
        }`}
        style={{ maxHeight: "520px", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-3 shrink-0"
          style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
        >
          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">ARTIXO Support</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-white/70 text-xs">AI-powered • Always online</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            title="Clear chat"
          >
            <RotateCcw className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-3 space-y-3"
          style={{ background: "#f8f9fa", minHeight: 0 }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.from === "bot" && (
                <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.from === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.from === "user"
                      ? "text-white rounded-tr-sm"
                      : "bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100"
                  }`}
                  style={msg.from === "user" ? { background: "linear-gradient(135deg, #8B1A2E, #c0392b)" } : {}}
                >
                  {msg.text}
                </div>
                {msg.links?.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="text-xs px-3 py-1 rounded-full font-medium text-white inline-block mt-1"
                    style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
                  >
                    {l.label} →
                  </Link>
                ))}
                <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex gap-2 items-end">
              <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}>
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 flex gap-1 items-center">
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick actions (shown when chat is short) */}
        {messages.length <= 2 && !typing && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0" style={{ background: "#f8f9fa" }}>
            {QUICK.map((q) => (
              <button
                key={q.msg}
                onClick={() => send(q.msg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-800 transition-colors"
              >
                <q.icon className="h-3 w-3" />
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 shrink-0 bg-white"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400 text-gray-800"
            disabled={typing}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
            style={{ background: "linear-gradient(135deg, #8B1A2E, #c0392b)" }}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </form>
      </div>
    </>
  );
};
