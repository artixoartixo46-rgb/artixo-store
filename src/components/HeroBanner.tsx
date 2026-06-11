import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-shopping.jpg";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  ctaText: string | null;
}

const DEFAULT_BANNER: Banner = {
  id: "default",
  title: "Shop everything island-wide",
  subtitle:
    "From Colombo to Jaffna — discover thousands of products from trusted local sellers. Free delivery & cash on delivery available.",
  imageUrl: heroImg,
  linkUrl: "/products",
  ctaText: "Start Shopping",
};

export const HeroBanner = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const { settings } = useSiteSettings();
  const bannerH = settings.banner_height || "600";
  const bannerStyle = bannerH === "100vh"
    ? { height: "100vh" }
    : { height: `${bannerH}px` };

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
    <section className="relative overflow-hidden">
      <div className="relative w-full" style={bannerStyle}>
        <img
          key={b.id}
          src={b.imageUrl}
          alt={b.title ?? "Banner"}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />

        <div className="relative container h-full flex items-center">
          <div className="max-w-2xl space-y-6 text-white animate-fade-in" key={`c-${b.id}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-sm font-semibold text-white">
              🇱🇰 Sri Lanka's #1 Marketplace
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-lg">
              {b.title ?? "Shop everything island-wide"}
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

        {banners.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-foreground transition-fluid"
              aria-label="Previous banner"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-foreground transition-fluid"
              aria-label="Next banner"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-2 rounded-full tr