import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-shopping.jpg";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  ctaText: string | null;
  isDefault?: boolean;
}

const DEFAULT_BANNER: Banner = {
  id: "default",
  title: "Shop everything island-wide",
  subtitle:
    "From Colombo to Jaffna — discover thousands of products from trusted local sellers. Free delivery & cash on delivery available.",
  imageUrl: heroImg,
  linkUrl: "/products",
  ctaText: "Start Shopping",
  isDefault: true,
};

export const HeroBanner = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    supabase
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setBanners([DEFAULT_BANNER]);
          return;
        }
        setBanners(
          data.map((d: any) => ({
            id: d.id,
            title: d.title ?? null,
            subtitle: d.subtitle ?? null,
            imageUrl: d.image_url,
            linkUrl: d.link_url ?? null,
            ctaText: d.cta_text ?? null,
            isDefault: false,
          }))
        );
      });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[idx];

  return (
    <section style={{ position: "relative", width: "100%", display: "block" }}>
      {/* Full-width banner image — no height constraint */}
      <img
        key={b.id}
        src={b.imageUrl}
        alt={b.title ?? "Banner"}
        style={{ display: "block", width: "100%", height: "auto" }}
        className="animate-fade-in"
      />

      {/* Text overlay — only for the default fallback banner */}
      {b.isDefault && (
        <>
          <div
            style={{ position: "absolute", inset: 0 }}
            className="bg-gradient-to-r from-black/60 via-black/20 to-transparent"
          />
          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}
          >
            <div className="container">
              <div className="max-w-2xl space-y-6 text-white animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-sm font-semibold text-white">
                  🇱🇰 Sri Lanka's #1 Marketplace
                </div>
                <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-lg">
                  {b.title}
                </h1>
                {b.subtitle && (
                  <p className="text-lg opacity-90 max-w-md drop-shadow">{b.subtitle}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Link to={b.linkUrl ?? "/products"}>
                    <Button variant="hero" size="lg">{b.ctaText ?? "Shop Now"}</Button>
                  </Link>
                  <Link to="/become-seller">
                    <Button variant="outline" size="lg" className="bg-background/10 border-background/30 text-secondary-foreground hover:bg-background/20">
                      Sell with Us
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CTA buttons for uploaded banners */}
      {!b.isDefault && (
        <div style={{ position: "absolute", bottom: "24px", left: "0", right: "0", display: "flex", justifyContent: "center", gap: "12px" }}>
          <Link to={b.linkUrl ?? "/products"}>
            <Button variant="hero" size="lg">{b.ctaText ?? "Shop Now"}</Button>
          </Link>
          <Link to="/become-seller">
            <Button size="lg" style={{ background: "rgba(255,255,255,0.15)", border: "2px solid white", color: "white", backdropFilter: "blur(8px)" }}>
              Sell with Us
            </Button>
          </Link>
        </div>
      )}

      {/* Carousel arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
            className="h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-foreground transition-fluid"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % banners.length)}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}
            className="h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-foreground transition-fluid"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-2 bg-white/60"}`}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
