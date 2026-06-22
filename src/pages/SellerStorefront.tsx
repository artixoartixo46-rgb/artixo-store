import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  Store, Package, Star, Users, UserPlus, UserMinus, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

interface SellerProfile {
  id: string;
  full_name: string | null;
  shop_name: string | null;
  bio: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  email: string | null;
}

const SellerStorefront = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [joinedDate, setJoinedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Seller profile — read banner_url and is_verified from DB directly
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, shop_name, shop_description, avatar_url, email, created_at, banner_url, is_verified")
        .eq("id", id)
        .maybeSingle();

      if (!prof) return;

      setSeller({
        ...prof,
        bio: prof.shop_description ?? null,
        banner_url: prof.banner_url ?? null,
        avatar_url: prof.avatar_url ?? null,
        is_verified: prof.is_verified ?? false,
      });
      setJoinedDate(prof.created_at ? new Date(prof.created_at).toLocaleDateString("en-LK", { year: "numeric", month: "long" }) : null);

      // Products
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, image_url, stock, is_trending, original_price, seller_id")
        .eq("seller_id", id).eq("status", "approved")
        .order("created_at", { ascending: false });

      setProducts((prods ?? []).map((p: any) => ({
        id: p.id, name: p.name, price: p.price, image_url: p.image_url ?? null,
        stock: p.stock, is_trending: p.is_trending ?? false,
        original_price: p.original_price ?? null, seller_id: p.seller_id ?? null,
      })));

      // Ratings (skip if no products to avoid empty .in() error)
      if (prods && prods.length > 0) {
        const { data: reviews } = await (supabase as any)
          .from("reviews").select("rating")
          .in("product_id", prods.map((p: any) => p.id));
        if (reviews && reviews.length > 0) {
          const ratings = reviews.map((r: any) => Number(r.rating));
          setAvgRating(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length);
          setReviewCount(ratings.length);
        }
      }

      // Followers (table may not exist — fail silently)
      const folRes = await (supabase as any)
        .from("seller_follows").select("id", { count: "exact", head: true }).eq("seller_id", id);
      if (!folRes.error) setFollowerCount(folRes.count ?? 0);

      if (user && !folRes.error) {
        const { data: fol } = await (supabase as any)
          .from("seller_follows").select("id")
          .eq("seller_id", id).eq("follower_id", user.id).maybeSingle();
        setIsFollowing(!!fol);
      }
    } catch (e) {
      console.error("Storefront load error:", e);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!user) { toast.error("Sign in to follow sellers"); return; }
    if (!id) return;
    setFollowLoading(true);
    if (isFollowing) {
      const { error } = await (supabase as any)
        .from("seller_follows")
        .delete()
        .eq("seller_id", id)
        .eq("follower_id", user.id);
      if (!error) { setIsFollowing(false); setFollowerCount((c) => Math.max(0, c - 1)); }
      toast.success(error ? "Follow feature coming soon!" : "Unfollowed");
    } else {
      const { error } = await (supabase as any)
        .from("seller_follows")
        .insert({ seller_id: id, follower_id: user.id });
      if (!error) { setIsFollowing(true); setFollowerCount((c) => c + 1); }
      toast.success(error ? "Follow feature coming soon!" : "Following!");
    }
    setFollowLoading(false);
  };

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground animate-pulse" />
        <p className="text-muted-foreground">Loading shop…</p>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="container py-16 text-center">
        <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <h2 className="font-display text-xl mb-2">Shop not found</h2>
        <Link to="/products" className="text-primary hover:underline text-sm">Browse all products</Link>
      </div>
    );
  }

  const displayName = seller.shop_name || seller.full_name || "ARTIXO Seller";
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const isSelf = user?.id === seller.id;

  return (
    <div className="min-h-screen">
      <SEO
        title={`${displayName} — ARTIXO Seller`}
        description={seller.bio ? seller.bio.slice(0, 155) : `Shop from ${displayName} on ARTIXO — Sri Lanka's online marketplace. Verified seller with island-wide delivery.`}
        canonical={`/seller/${seller.id}`}
        image={seller.banner_url ?? undefined}
      />
      {/* Banner */}
      <div
        className="w-full h-40 md:h-56 relative overflow-hidden bg-gradient-to-r from-primary/20 to-secondary/20"
        style={seller.banner_url ? { backgroundImage: `url(${seller.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {!seller.banner_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Store className="h-32 w-32 text-primary" />
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="container">
        <div className="relative -mt-12 mb-4 flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Avatar */}
          <div className="h-24 w-24 rounded-2xl border-4 border-background shrink-0 shadow-sm overflow-hidden bg-primary/10 flex items-center justify-center">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-primary font-display text-2xl font-bold">{initials}</span>
            )}
          </div>

          {/* Name + actions */}
          <div className="flex flex-1 flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl leading-tight">{displayName}</h1>
                {seller.is_verified && <VerifiedBadge size="lg" />}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {avgRating !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    <span className="font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({reviewCount} reviews)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{followerCount} followers</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>{products.length} products</span>
                </div>
                {joinedDate && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Joined {joinedDate}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {isSelf ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/seller?tab=profile">Edit shop</Link>
                </Button>
              ) : (
                <Button
                  variant={isFollowing ? "outline" : "hero"}
                  size="sm"
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className="gap-1.5"
                >
                  {isFollowing ? (
                    <><UserMinus className="h-4 w-4" /> Unfollow</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> Follow</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {seller.bio && (
          <Card className="p-4 mb-6 bg-background">
            <p className="text-sm text-muted-foreground leading-relaxed">{seller.bio}</p>
          </Card>
        )}

        <Separator className="mb-6" />

        {/* Products */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Products</h2>
          {products.length > 0 && (
            <span className="text-sm text-muted-foreground">{products.length} item{products.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {products.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No products listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-12">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerStorefront;
