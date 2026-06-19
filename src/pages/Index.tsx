import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, ShieldCheck, CreditCard, Headphones, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { FlashSale } from "@/components/FlashSale";
import { Newsletter } from "@/components/Newsletter";
import { WhyShopWithUs } from "@/components/WhyShopWithUs";
import { HeroBanner } from "@/components/HeroBanner";

interface Category { id: string; name: string; slug: string; icon: string | null; image_url: string | null; }

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<ProductCardData[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductCardData[]>([]);
  const [flashDeals, setFlashDeals] = useState<ProductCardData[]>([]);

  useEffect(() => {
        // Load categories
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });

    // Load products
    supabase
      .from("products")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(24)
      .then(({ data }) => {
        if (!data) return;
        const all = data.map((d) => ({
          id: d.id,
          name: d.name,
          price: d.price,
          image_url: d.image_url ?? null,
          stock: d.stock,
          is_trending: d.is_trending ?? false,
          original_price: d.original_price ?? null,
          seller_id: (d as any).seller_id ?? null,
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
      {/* Hero */}
      <HeroBanner />

      {/* Trust badges */}
      <section className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
          <h3 className="font-display text-2xl md:text-4xl font-bold mb-3">Got products to sell?</h3>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">Reach thousands of Sri Lankan shoppers. Open your shop in minutes — completely free to start.</p>
          <Link to="/become-seller"><Button variant="royal" size="lg">Open Your Shop</Button></Link>
        </Card>
      </