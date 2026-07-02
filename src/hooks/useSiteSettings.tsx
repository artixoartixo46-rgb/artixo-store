import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  support_email: string;
  support_phone: string;
  address: string;
  site_logo: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  announcement_enabled: string;
  announcement_text: string;
  announcement_bg: string;
  announcement_link: string;
  banner_height: string;
  banner_object_fit: string;
  banner_object_position: string;
  banner_overlay_opacity: string;
  banner_show_text: string;
  banner_text_position: string;
  banner_text_color: string;
  seo_title: string;
  seo_description: string;
  seo_og_image: string;
  footer_copyright: string;
  footer_email: string;
  footer_phone: string;
  footer_address: string;
  maintenance_mode: string;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_eta: string;
  currency_symbol: string;
  vat_percentage: string;
  tax_inclusive: string;
  default_commission_rate: string;
  show_flash_sale: string;
  show_newsletter: string;
  show_why_shop: string;
  show_categories: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  whatsapp_number: string;
  free_delivery_min: string;
  delivery_fee: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "ARTIXO",
  site_tagline: "Sri Lanka's #1 Multi-Vendor Marketplace",
  support_email: "support@artixo.lk",
  support_phone: "+94 11 000 0000",
  address: "Colombo, Sri Lanka",
  site_logo: "",
  banner_object_fit: "cover",
  banner_object_position: "center",
  banner_overlay_opacity: "50",
  banner_show_text: "true",
  banner_text_position: "left",
  banner_text_color: "#ffffff",
  seo_title: "ARTIXO — Sri Lanka's Online Marketplace",
  seo_description: "Sri Lanka's premier online marketplace — shop electronics, fashion, home goods and more. Verified sellers, fast delivery island-wide.",
  seo_og_image: "",
  footer_copyright: "© {year} ARTIXO — Made with ❤️ in Sri Lanka",
  footer_email: "support@artixo.lk",
  footer_phone: "+94 11 000 0000",
  footer_address: "Colombo, Sri Lanka 🇱🇰",
  maintenance_mode: "false",
  maintenance_title: "We'll be back soon!",
  maintenance_message: "We're performing scheduled maintenance. Thank you for your patience.",
  maintenance_eta: "",
  currency_symbol: "Rs.",
  vat_percentage: "0",
  tax_inclusive: "true",
  default_commission_rate: "5",
  primary_color: "#FFD100",
  secondary_color: "#8D153A",
  accent_color: "#0D9488",
  announcement_enabled: "false",
  announcement_text: "🎉 Free delivery on orders over Rs. 2,500!",
  announcement_bg: "#8D153A",
  announcement_link: "/products",
  banner_height: "600",
  show_flash_sale: "true",
  show_newsletter: "true",
  show_why_shop: "true",
  show_categories: "true",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  whatsapp_number: "",
  free_delivery_min: "2500",
  delivery_fee: "350",
};

interface SiteSettingsCtx {
  settings: SiteSettings;
  dbReady: boolean;
  refresh: () => Promise<void>;
  save: (updates: Partial<SiteSettings>) => Promise<void>;
  preview: (updates: Partial<SiteSettings>) => void;
}

const Ctx = createContext<SiteSettingsCtx>({
  settings: DEFAULT_SETTINGS,
  dbReady: false,
  refresh: async () => {},
  save: async () => {},
  preview: () => {},
});

/** Convert HSL string like "49 100% 50%" → hex */
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const applyCSSVars = (s: SiteSettings) => {
  const root = document.documentElement;
  // Apply primary colour
  const pc = s.primary_color;
  if (pc.startsWith("#")) {
    const r = parseInt(pc.slice(1, 3), 16);
    const g = parseInt(pc.slice(3, 5), 16);
    const b = parseInt(pc.slice(5, 7), 16);
    // Very rough hex→HSL
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
        case gn: h = ((bn - rn) / d + 2) / 6; break;
        case bn: h = ((rn - gn) / d + 4) / 6; break;
      }
    }
    root.style.setProperty("--primary", `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
  }
  // Apply secondary colour
  const sc = s.secondary_color;
  if (sc.startsWith("#")) {
    const r = parseInt(sc.slice(1, 3), 16);
    const g = parseInt(sc.slice(3, 5), 16);
    const b = parseInt(sc.slice(5, 7), 16);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, sv = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sv = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
        case gn: h = ((bn - rn) / d + 2) / 6; break;
        case bn: h = ((rn - gn) / d + 4) / 6; break;
      }
    }
    root.style.setProperty("--secondary", `${Math.round(h * 360)} ${Math.round(sv * 100)}% ${Math.round(l * 100)}%`);
  }
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [dbReady, setDbReady] = useState(false);

  const load = async () => {
    try {
      const { data, error } = await (supabase as any).from("site_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      if (data && data.length > 0) {
        if ("key" in data[0]) {
          // Key-value store format: [{key, value}, ...]
          data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
          setDbReady(true);
        } else {
          // Single-row named-columns format (legacy schema)
          const r = data[0];
          if (r.store_name)       map["site_name"]              = r.store_name;
          if (r.tagline)          map["site_tagline"]            = r.tagline;
          if (r.primary_color)    map["primary_color"]           = r.primary_color;
          if (r.secondary_color)  map["secondary_color"]         = r.secondary_color;
          if (r.accent_color)     map["accent_color"]            = r.accent_color;
          if (r.logo_url)         map["site_logo"]               = r.logo_url;
          if (r.maintenance_message) map["maintenance_message"]  = r.maintenance_message;
          if (r.maintenance_mode !== undefined) map["maintenance_mode"] = String(r.maintenance_mode);
          if (r.footer_text)      map["footer_copyright"]        = r.footer_text;
          if (r.currency_symbol)  map["currency_symbol"]         = r.currency_symbol;
          if (r.commission_rate !== undefined) map["default_commission_rate"] = String(r.commission_rate);
          // legacy schema: don't mark dbReady (save uses key-value upsert which won't work)
          setDbReady(false);
        }
      }
      const merged = { ...DEFAULT_SETTINGS, ...map } as SiteSettings;
      setSettings(merged);
      applyCSSVars(merged);
    } catch {
      // Table doesn't exist yet — use defaults silently
      setDbReady(false);
    }
  };

  // preview: update context immediately (no DB save) — for live admin preview
  const preview = (updates: Partial<SiteSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      applyCSSVars(next);
      return next;
    });
  };

  const save = async (updates: Partial<SiteSettings>) => {
    // Apply to context immediately so UI updates even before DB confirms
    const next = { ...settings, ...updates };
    setSettings(next);
    applyCSSVars(next);

    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value: String(value ?? ""),
      updated_at: new Date().toISOString(),
    }));

    // Use select() to detect silent RLS failures (0 rows returned = blocked)
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .upsert(rows, { onConflict: "key" })
      .select("key");

    if (error) throw new Error(error.message);

    // If every single row was blocked by RLS, data will be empty
    if (!data || data.length === 0) {
      throw new Error(
        "Settings were not saved — your account may not have admin write permission on the site_settings table. " +
        "Run the setup SQL in your Supabase project's SQL editor to fix this."
      );
    }

    setDbReady(true);
  };

  useEffect(() => { load(); }, []);

  return (
    <Ctx.Provider value={{ settings, dbReady, refresh: load, save, preview }}>
      {children}
    </Ctx.Provider>
  );
};

export const useSiteSettings = () => useContext(Ctx);
