import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, ShieldCheck, CreditCard, Headphones, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cachedQuery, TTL } from "@/lib/trafficManager";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { FlashSale } from "@/components/FlashSale";
import { Newsletter } from "@/components/Newsletter";
import { WhyShopWithUs } from "@/components/WhyShopWithUs";
import { HeroBanner } from "@/components/HeroBanner";
import { SEO, websiteSchema, orgSchema } from "@/components/SEO";

interface Category { id: string; name: string; slug: string; icon: string | null; image_url: string | null; }

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<ProductCardData[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductCardData[]>([]);
  const [flashDeals, setFlashDeals] = useState<ProductCardData[]>([]);

  useEffect(() => {
    // Load categories (cached 30 min — shared with Products page)
    cachedQuery(
      "categories:all",
      () => supabase.from("categories").select("*").order("name").then(r => r.data ?? []),
      TTL.CATEGORIES
    ).then((data) => setCategories(data as Category[]));

    // Load products (cached 3 min — shared with Products page)
    cachedQuery(
      "products:approved",
      () => supabase.from("products").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(24).then(r => r.data ?? []),
      TTL.PRODUCTS
    ).then((data) => {
      if (!data?.length) return;
      const all = (data as any[]).map((d) => ({
        id: d.id,
        name: d.name,
        price: d.price,
        image_url: d.image_url ?? null,
        stock: d.stock,
        is_trending: d.is_trending ?? false,
        original_price: d.original_price ?? null,
        seller_id: d.seller_id ?? null,
      }));
      setTrending(all.filter((p) => p.is_trending).slice(0, 12));
      setNewArrivals(all.slice(0, 12));
      setFlashDeals(
        all.filter((p) => p.original_price && Number(p.original_price) > Number(p.price)).slice(0, 6)
      );
    });
  }, []);

  return (
    <div>
      <SEO
        canonical="/"
        schema={[websiteSchema, orgSchema]}
      />
      {/* Hero */}
      <HeroBanner />

      {/* Trust badges */}
      <section className="container py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { icon: Truck, title: "Island-wide Delivery", desc: "All 25 districts" },
          { icon: CreditCard, title: "Cash on Delivery", desc: "Pay when you receive" },
          { icon: ShieldCheck, title: "Verified Sellers", desc: "Admin-approved shops" },
          { icon: Headphones, title: "24/7 Support", desc: "We're here to help" },
        ].map((b) => (
          <Card key={b.title} className="p-4 flex items-center gap-3 border-border/60">
            <div className="h-10 w-10 rounded-lg gradient-saffron flex items-center justify-center text-primary-foreground shrink-0">
              <b.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.desc}</div>
            </div>
          </Card>
        ))}
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container py-8">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl md:text-3xl">Shop by Category</h2>
            <Link to="/products" className="text-sm text-primary hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 md:gap-3">
            {categories.map((c) => (
              <Link key={c.id} to={`/products?category=${c.slug}`}>
                <Card className="p-4 text-center hover:shadow-glow hover:-translate-y-1 transition-bounce border-border/60 h-full flex flex-col items-center justify-center gap-2">
                  {c.image_url ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0">
                      <img
                        src={c.image_url}
                        alt={`Shop ${c.name} products online in Sri Lanka`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-3xl">{c.icon}</div>
                  )}
                  <div className="text-xs font-medium line-clamp-2">{c.name}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Flash Sale */}
      <FlashSale products={flashDeals} />

      {/* Trending */}
      {trending.length > 0 && (
        <section className="container py-8">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl md:text-3xl">🔥 Trending Now</h2>
            <Link to="/products" className="text-sm text-primary hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {trending.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      <section className="container py-8">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl md:text-3xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> New Arrivals
          </h2>
          <Link to="/products" className="text-sm text-primary hover:underline">See all →</Link>
        </div>
        {newArrivals.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            No products yet. Sellers — start uploading! 🛍️
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {newArrivals.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* Why shop */}
      <WhyShopWithUs />

      {/* Newsletter */}
      <Newsletter />

      {/* CTA banner */}
      <section className="container py-12">
        <Card className="gradient-saffron text-primary-foreground p-8 md:p-12 text-center border-0 shadow-glow">
          {/* Promo banners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">

          {/* Rental Marketplace promo */}
          <Link to="/rentals">
            <div className="rounded-2xl p-4 flex items-center gap-3 text-white relative overflow-hidden h-full"
              style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
              <span className="text-4xl">🔄</span>
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-0.5">New ✨</p>
                <h3 className="font-display text-base font-extrabold leading-tight">Rent Anything</h3>
                <p className="text-white/70 text-xs mt-0.5">Cameras, dresses & more by the day</p>
              </div>
              <div className="shrink-0 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-bold">
                Browse →
              </div>
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10" />
            </div>
          </Link>

          {/* AI Outfit Builder promo */}
          <Link to="/outfit-builder" className="block">
            <div className="rounded-2xl p-5 flex items-center gap-4 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #8B1A2E 0%, #c0392b 55%, #FFD100 100%)" }}>
              <span className="text-5xl">👗</span>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-0.5">New Feature ✨</p>
                <h3 className="font-display text-lg font-extrabold leading-tight">AI Outfit Builder</h3>
                <p className="text-white/80 text-xs mt-0.5">Mix & match products — AI styles you instantly!</p>
              </div>
              <div className="shrink-0 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap">
                Try Now →
              </div>
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            </div>
          </Link>

          </div>{/* end promo grid */}

          <h3 className="font-display text-2xl md:text-4xl font-bold mb-3">Got products to sell?</h3>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">Reach thousands of Sri Lankan shoppers. Open your shop in minutes — completely free to start.</p>
          <Link to="/become-seller"><Button variant="royal" size="lg">Open Your Shop</Button></Link>
        </Card>
      </section>
    </div>
  );
};

export default Index;
