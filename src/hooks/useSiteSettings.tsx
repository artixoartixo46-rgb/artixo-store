import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  support_email: string;
  support_phone: string;
  address: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  announcement_enabled: string;
  announcement_text: string;
  announcement_bg: string;
  announcement_link: string;
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
  primary_color: "#FFD100",
  secondary_color: "#8D153A",
  accent_color: "#0D9488",
  announcement_enabled: "false",
  announcement_text: "🎉 Free delivery on orders over Rs. 2,500!",
  announcement_bg: "#8D153A",
  announcement_link: "/products",
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
}

const Ctx = createContext<SiteSettingsCtx>({
  settings: DEFAULT_SETTINGS,
  dbReady: false,
  refresh: async () => {},
  save: async () => {},
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
      const { data, error } = await (supabase as any).from("site_settings").select("key, value");
      if (error) throw error;
      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        const merged = { ...DEFAULT_SETTINGS, ...map } as SiteSettings;
        setSettings(merged);
        applyCSSVars(merged);
        setDbReady(true);
      }
    } catch {
      // Table doesn't exist yet — use defaults silently
      setDbReady(false);
    }
  };

  const save = async (updates: Partial<SiteSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    applyCSSVars(next);
    if (!dbReady) return;
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    await (supabase as any).from("site_settings").upsert(rows, { onConflict: "key" });
  };

  useEffect(() => { load(); }, []);

  return (
    <Ctx.Provider value={{ settings, dbReady, refresh: load, save }}>
      {children}
    </Ctx.Provider>
  );
};

export const useSiteSettings = () => useContext(Ctx);
