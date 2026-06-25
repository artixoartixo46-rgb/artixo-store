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
  // Start with DEFAULT_BANNER so the section renders immediately (no blank flash on load)
  const [banners, setBanners] = useState<Banner[]>([DEFAULT_BANNER]);
  const [idx, setIdx] = useState(0);
  const { settings } = useSiteSettings();
  const bannerH = settings.banner_height || "520";
  // Desktop: fixed height from settings. Mobile: min 220px, scales with vw up to bannerH
  const bannerStyle = bannerH === "100vh"
    ? { height: "100svh" }
    : { height: `clamp(220px, 38vw, ${bannerH}px)` };
  const objectFit = (settings.banner_object_fit || "cover") as React.CSSProperties["objectFit"];
  const objectPosition = settings.banner_object_position || "center";
  const overlayOpacity = Number(settings.banner_overlay_opacity ?? 50) / 100;
  const showText = settings.banner_show_text !== "false";
  const textPosition = settings.banner_text_position || "left";
  const textColor = settings.banner_text_color || "#ffffff";
  const textAlign: React.CSSProperties = textPosition === "center"
    ? { alignItems: "center", textAlign: "center" }
    : textPosition === "right"
    ? { alignItems: "flex-end", textAlign: "right" }
    : { alignItems: "flex-start", textAlign: "left" };

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

  const b = banners[idx];

  return (
    <section className="relative overflow-hidden">
      <div className="relative w-full" style={bannerStyle}>
        <img
          key={b.id}
          src={b.imageUrl}
          alt={b.title ?? "Banner"}
          className="absolute inset-0 w-full h-full animate-fade-in"
          style={{ objectFit, objectPosition }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
        />

        {showText && (
          <div className="relative container h-full flex items-center px-14 sm:px-8">
            <div
              className="w-full max-w-2xl space-y-3 sm:space-y-6 animate-fade-in"
              key={`c-${b.id}`}
              style={{ color: textColor, ...textAlign }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-xs sm:text-sm font-semibold" style={{ color: textColor }}>
                🇱🇰 Sri Lanka's #1 Marketplace
              </div>
              <h1 className="font-display text-xl sm:text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-lg break-words">
                {b.title ?? "Shop everything island-wide"}
              </h1>
              {b.subtitle && (
                <p className="text-sm sm:text-lg opacity-90 max-w-md drop-shadow hidden sm:block">{b.subtitle}</p>
              )}
              <div className="flex flex-wrap gap-2 sm:gap-3" style={{ justifyContent: textPosition === "center" ? "center" : textPosition === "right" ? "flex-end" : "flex-start" }}>
                <Link to={b.linkUrl ?? "/products"}>
                  <Button variant="hero" size="sm" className="sm:text-base sm:h-11 sm:px-6">{b.ctaText ?? "Shop Now"}</Button>
                </Link>
                <Link to="/become-seller">
                  <Button variant="outline" size="sm" className="sm:text-base sm:h-11 sm:px-6 bg-white/10 border-white/50 text-white hover:bg-white/20">
                    Sell with Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {banners.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-white transition-fluid"
              aria-label="Previous banner"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass hover:glass-strong flex items-center justify-center text-white transition-fluid"
              aria-label="Next banner"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-2 bg-white/60"}`}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
  