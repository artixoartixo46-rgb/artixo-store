import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart, ShoppingCart, Share2, Volume2, VolumeX,
  Play, ChevronUp, ChevronDown, Sparkles, Store
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { toast } from "sonner";

interface Reel {
  id: string;
  seller_id: string;
  product_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  caption: string;
  likes: number;
  views: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  } | null;
  seller?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  liked?: boolean;
}

// ── Single reel card ───────────────────────────────────────────────────
const ReelCard = ({
  reel,
  active,
  onLike,
}: {
  reel: Reel;
  active: boolean;
  onLike: (id: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);

  // Auto play/pause based on active
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
      setPlaying(false);
    }
  }, [active]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleAddToCart = () => {
    if (!reel.product) return;
    addItem({
      id: reel.product.id,
      name: reel.product.name,
      price: reel.product.price,
      image: reel.product.image_url ?? "",
    });
    setAddedToCart(true);
    toast.success("Added to cart!");
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleLike = () => {
    if (!user) { navigate("/auth"); return; }
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);
    onLike(reel.id);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/reels#${reel.id}`;
    if (navigator.share) {
      await navigator.share({ title: reel.caption || "ARTIXO Reel", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const sellerInitial = reel.seller?.full_name?.[0]?.toUpperCase() ?? "S";

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Video */}
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        loop
        muted={muted}
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-cover cursor-pointer"
        style={{ maxHeight: "100dvh" }}
      />

      {/* Play/Pause overlay */}
      {!playing && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
        >
          <div className="h-16 w-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Top gradient */}
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Bottom gradient */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Mute button */}
      <button
        onClick={() => setMuted((v) => !v)}
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
      >
        {muted
          ? <VolumeX className="h-4 w-4 text-white" />
          : <Volume2 className="h-4 w-4 text-white" />
        }
      </button>

      {/* ARTIXO badge */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
        <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-white text-xs font-bold">ARTIXO Reels</span>
      </div>

      {/* Right action column */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5">
        {/* Seller avatar */}
        <Link to={`/seller/${reel.seller_id}`}>
          <div className="relative">
            {reel.seller?.avatar_url ? (
              <img
                src={reel.seller.avatar_url}
                className="h-11 w-11 rounded-full border-2 border-white object-cover"
                alt="Seller"
              />
            ) : (
              <div className="h-11 w-11 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg,#8B1A2E,#c0392b)" }}>
                {sellerInitial}
              </div>
            )}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full flex items-center justify-center border-2 border-black"
              style={{ background: "linear-gradient(135deg,#8B1A2E,#c0392b)" }}>
              <Store className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        </Link>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className={`h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform ${likeAnim ? "scale-125" : "scale-100"}`}>
            <Heart
              className={`h-5 w-5 transition-colors ${reel.liked ? "fill-red-500 text-red-500" : "text-white"}`}
            />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">{reel.likes}</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-xs font-semibold drop-shadow">Share</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-14 p-4 pb-6">
        {/* Seller name */}
        <p className="text-white/80 text-xs font-medium mb-1">
          @{reel.seller?.full_name ?? "seller"}
        </p>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white text-sm leading-snug mb-3 line-clamp-2 drop-shadow">
            {reel.caption}
          </p>
        )}

        {/* Product card */}
        {reel.product && (
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md rounded-2xl px-3 py-2.5 border border-white/20">
            {reel.product.image_url && (
              <img
                src={reel.product.image_url}
                className="h-10 w-10 rounded-xl object-cover shrink-0"
                alt={reel.product.name}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{reel.product.name}</p>
              <p className="text-yellow-300 text-sm font-bold">
                LKR {Number(reel.product.price).toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: addedToCart ? "#16a34a" : "linear-gradient(135deg,#8B1A2E,#c0392b)" }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {addedToCart ? "Added!" : "Buy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────
const Reels = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load reels + join product + profile
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("reels")
        .select(`
          id, seller_id, product_id, video_url, thumbnail_url,
          caption, likes, views, created_at,
          products:product_id (id, name, price, image_url),
          profiles:seller_id (id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) { setLoading(false); return; }

      // Check liked status
      let likedIds: string[] = [];
      if (user) {
        const { data: likesData } = await supabase
          .from("reel_likes")
          .select("reel_id")
          .eq("user_id", user.id);
        likedIds = (likesData ?? []).map((l: any) => l.reel_id);
      }

      const mapped: Reel[] = (data ?? []).map((r: any) => ({
        ...r,
        product: Array.isArray(r.products) ? r.products[0] ?? null : r.products ?? null,
        seller: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
        liked: likedIds.includes(r.id),
      }));

      setReels(mapped);
      setLoading(false);

      // Increment view on first reel
      if (mapped[0]) {
        await supabase.from("reels").update({ views: (mapped[0].views ?? 0) + 1 }).eq("id", mapped[0].id);
      }
    };
    load();
  }, [user]);

  // Intersection observer — detect which reel is active
  useEffect(() => {
    if (!reels.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.findIndex((r) => r === entry.target);
            if (idx !== -1) {
              setActiveIdx(idx);
              // Increment views
              supabase.from("reels")
                .update({ views: (reels[idx].views ?? 0) + 1 })
                .eq("id", reels[idx].id)
                .then(() => {});
            }
          }
        });
      },
      { threshold: 0.7 }
    );
    cardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [reels]);

  const handleLike = useCallback(async (reelId: string) => {
    const reel = reels.find((r) => r.id === reelId);
    if (!reel) return;

    if (reel.liked) {
      await supabase.from("reel_likes").delete().match({ reel_id: reelId, user_id: user!.id });
      await supabase.from("reels").update({ likes: Math.max(0, reel.likes - 1) }).eq("id", reelId);
      setReels((prev) => prev.map((r) => r.id === reelId ? { ...r, liked: false, likes: Math.max(0, r.likes - 1) } : r));
    } else {
      await supabase.from("reel_likes").insert({ reel_id: reelId, user_id: user!.id });
      await supabase.from("reels").update({ likes: reel.likes + 1 }).eq("id", reelId);
      setReels((prev) => prev.map((r) => r.id === reelId ? { ...r, liked: true, likes: r.likes + 1 } : r));
    }
  }, [reels, user]);

  const scrollTo = (idx: number) => {
    cardRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading reels…</p>
        </div>
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center text-center p-6">
        <SEO title="Reels — ARTIXO" description="Shop Sri Lanka's trending products through short videos" />
        <div>
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-white font-bold text-xl mb-2">No Reels Yet</h2>
          <p className="text-white/50 text-sm mb-6">
            Sellers — be the first to upload a product reel!
          </p>
          <Link to="/seller">
            <button className="px-6 py-2.5 rounded-full text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg,#8B1A2E,#c0392b)" }}>
              Go to Seller Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden">
      <SEO title="Reels — ARTIXO" description="Discover products through short videos. Shop Sri Lanka's trending items." />

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {reels.map((reel, idx) => (
          <div
            key={reel.id}
            id={reel.id}
            ref={(el) => { cardRefs.current[idx] = el; }}
            style={{ scrollSnapAlign: "start", height: "100dvh", position: "relative" }}
          >
            <ReelCard
              reel={reel}
              active={idx === activeIdx}
              onLike={handleLike}
            />
          </div>
        ))}
      </div>

      {/* Nav arrows (desktop) */}
      <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-2 z-10">
        <button
          onClick={() => scrollTo(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 hover:bg-white/30 transition-colors"
        >
          <ChevronUp className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={() => scrollTo(Math.min(reels.length - 1, activeIdx + 1))}
          disabled={activeIdx === reels.length - 1}
          className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 hover:bg-white/30 transition-colors"
        >
          <ChevronDown className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        {reels.slice(0, 10).map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`rounded-full transition-all duration-200 ${
              i === activeIdx ? "h-5 w-1.5 bg-white" : "h-1.5 w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Reels;
