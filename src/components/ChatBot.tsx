import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  link?: { label: string; to: string };
  time: string;
}

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

/* ── Smart response engine ── */
const getReply = (
  input: string
): { text: string; link?: { label: string; to: string } } => {
  const q = input.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|vanakkam|ayubowan|hola|yo|sup)\b/.test(q))
    return {
      text: "Hey there! 👋 Welcome to ARTIXO — Sri Lanka's #1 marketplace. How can I help you today?\n\nYou can ask me about:\n• 📦 Your orders\n• 🚚 Delivery\n• 💰 Payments\n• 🔄 Returns\n• 🛍️ Products & sellers",
    };

  // Orders / tracking
  if (/order|track|where.*package|my order|order status/.test(q))
    return {
      text: "To track your order:\n1. Go to **My Orders** page\n2. Click on the order to see real-time status\n\nStatus updates: Pending → Confirmed → Processing → Shipped → Delivered\n\nYou'll also receive email updates at each stage! 📧",
      link: { label: "View My Orders", to: "/orders" },
    };

  // Delivery / shipping
  if (/deliver|shipping|ship|how long|when.*arrive|dispatch/.test(q))
    return {
      text: "🚚 **Delivery Info:**\n• All 25 districts in Sri Lanka covered\n• Standard delivery: 2–5 working days\n• Cash on Delivery available island-wide\n• Free delivery on select orders\n\nFor urgent deliveries, contact the seller directly from your order page.",
    };

  // Payment
  if (/pay|payment|cash|bank|transfer|card|how to pay/.test(q))
    return {
      text: "💳 **Payment Methods on ARTIXO:**\n• 💵 Cash on Delivery — Pay when you receive\n• 🏦 Bank Transfer — Details shared after order\n• 💳 PayHere (coming soon)\n\nAll transactions are secure. No card details stored.",
    };

  // Returns / refunds
  if (/return|refund|cancel|wrong.*item|damaged|broken/.test(q))
    return {
      text: "🔄 **Returns & Refunds:**\n• 7-day easy return policy\n• Eligible for: damaged, wrong, or defective items\n• Process: Go to Orders → Select order → Request Return\n\nRefunds are processed within 3–5 business days to your original payment method.",
      link: { label: "Refund Policy", to: "/refund-policy" },
    };

  // Seller / become seller
  if (/sell|seller|shop|vendor|open.*shop|become.*seller/.test(q))
    return {
      text: "🏪 **Want to sell on ARTIXO?**\n• Completely free to start!\n• Reach thousands of Sri Lankan shoppers\n• Island-wide delivery handled\n• Easy seller dashboard\n\nJoin hundreds of sellers already on the platform!",
      link: { label: "Become a Seller", to: "/become-seller" },
    };

  // Products / categories
  if (/product|item|buy|shop|categor|electronics|fashion|beauty|food|grocery/.test(q))
    return {
      text: "🛍️ **Browse ARTIXO Products:**\n• Electronics & Gadgets\n• Fashion & Clothing\n• Beauty & Personal Care\n• Home & Kitchen\n• Sports & Outdoor\n• Groceries & Food\n\nUse the search bar to find exactly what you need!",
      link: { label: "Browse Products", to: "/products" },
    };

  // Account / login / signup
  if (/account|login|sign in|sign up|register|password|forgot/.test(q))
    return {
      text: "👤 **Account Help:**\n• Sign in with email/password or Google\n• Forgot password? Use the reset link on the login page\n• Create a new account — it's free!\n\nYour account lets you track orders, save addresses, and more.",
      link: { label: "Sign In / Register", to: "/auth" },
    };

  // Cart
  if (/cart|basket|checkout|buy now/.test(q))
    return {
      text: "🛒 **Shopping Cart Tips:**\n• Add items and review before checkout\n• You can update quantities or remove items\n• Choose your delivery address at checkout\n• Select Cash on Delivery or Bank Transfer\n\nNeed help checking out?",
      link: { label: "Go to Cart", to: "/cart" },
    };

  // Price / discount / offer
  if (/price|discount|offer|sale|deal|coupon|cheap|cost/.test(q))
    return {
      text: "💰 **Best Deals on ARTIXO:**\n• Check the **Flash Sale** section for limited-time deals\n• Trending products often have discounts\n• Subscribe to our newsletter for exclusive offers\n• All prices are in LKR (Sri Lankan Rupees) 🇱🇰",
      link: { label: "Shop Deals", to: "/products" },
    };

  // Contact / support
  if (/contact|support|help|complain|issue|problem|human|agent/.test(q))
    return {
      text: "📞 **Need More Help?**\n• Email: support@artixo.lk\n• Help Center has guides for common issues\n• For order disputes, use the Orders page\n\nOur team usually responds within 24 hours.",
      link: { label: "Help Center", to: "/help" },
    };

  // Thanks
  if (/thank|thanks|thank you|nandri|sthuthi/.test(q))
    return {
      text: "You're welcome! 😊 Happy shopping on ARTIXO! 🛍️\n\nFeel free to ask anything else anytime.",
    };

  // Goodbye
  if (/bye|goodbye|see you|ok thanks|that.*all/.test(q))
    return {
      text: "Goodbye! 👋 Happy shopping and enjoy your ARTIXO experience! Come back anytime. 🇱🇰",
    };

  // Fallback
  return {
    text: "Hmm, I'm not sure about that one! 🤔 Try asking me about:\n\n• 📦 Order tracking\n• 🚚 Delivery times\n• 💳 Payment methods\n• 🔄 Returns & refunds\n• 🏪 Becoming a seller\n\nOr visit our Help Center for more support.",
    link: { label: "Help Center", to: "/help" },
  };
};

const QUICK_REPLIES = [
  "Track my order",
  "Delivery info",
  "Return policy",
  "Become a seller",
];

export const ChatBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      from: "bot",
      text: "Hi! 👋 I'm ARTIXO Assistant. How can I help you today?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), from: "user", text, time: now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(
      () => {
        const reply = getReply(text);
        setTyping(false);
        setMessages((m) => [
          ...m,
          {
            id: Date.now() + 1,
            from: "bot",
            text: reply.text,
            link: reply.link,
            time: now(),
          },
        ]);
        if (!open) setUnread((n) => n + 1);
      },
      800 + Math.random() * 600,
    );
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(135deg, hsl(343 73% 32%), hsl(343 73% 42%))" }}
        aria-label="Open chat"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
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
          className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[380px] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          style={{ maxHeight: "520px", background: "#fff" }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, hsl(343 73% 28%), hsl(343 73% 38%))" }}
          >
            <div className="h-9 w-9 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5 text-yellow-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">ARTIXO Assistant</p>
              <p className="text-white/65 text-xs flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                Online · Replies instantly
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50" style={{ minHeight: 0 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.from === "bot"
                      ? "bg-yellow-400"
                      : "bg-secondary/20"
                  }`}
                >
                  {msg.from === "bot" ? (
                    <Bot className="h-4 w-4 text-yellow-900" />
                  ) : (
                    <User className="h-4 w-4 text-secondary" />
                  )}
                </div>

                <div className={`max-w-[75%] space-y-1 ${msg.from === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                      msg.from === "bot"
                        ? "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
                        : "text-white rounded-tr-sm"
                    }`}
                    style={
                      msg.from === "user"
                        ? { background: "hsl(343 73% 32%)" }
                        : undefined
                    }
                  >
                    {msg.text}
                  </div>
                  {msg.link && (
                    <Link
                      to={msg.link.to}
                      onClick={() => setOpen(false)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                      style={{ color: "hsl(343 73% 32%)", borderColor: "hsl(343 73% 32% / 0.3)" }}
                    >
                      {msg.link.label} →
                    </Link>
                  )}
                  <span className="text-[10px] text-gray-400">{msg.time}</span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2 items-center">
                <div className="h-7 w-7 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-yellow-900" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors hover:bg-secondary/5"
                style={{ borderColor: "hsl(343 73% 32% / 0.25)", color: "hsl(343 73% 32%)" }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Type a message..."
              className="flex-1 text-sm px-4 py-2 rounded-full bg-gray-100 border-0 outline-none focus:ring-2 focus:ring-secondary/20 placeholder:text-gray-400"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, hsl(343 73% 32%), hsl(343 73% 42%))" }}
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
