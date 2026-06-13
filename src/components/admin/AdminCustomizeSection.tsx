import { useState, useRef } from "react";
import { useSiteSettings, DEFAULT_SETTINGS, SiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Palette, Megaphone, LayoutGrid, Share2, Info, Truck,
  Save, AlertTriangle, CheckCircle2, Copy,
  ImageIcon, Upload, X, Monitor,
} from "lucide-react";

const SETUP_SQL = `CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Admin write" ON site_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
INSERT INTO site_settings (key, value) VALUES
  ('site_name','ARTIXO'),('site_tagline','Sri Lanka''s #1 Marketplace'),
  ('support_email','support@artixo.lk'),('support_phone','+94 11 000 0000'),
  ('address','Colombo, Sri Lanka'),('primary_color','#FFD100'),
  ('secondary_color','#8D153A'),('accent_color','#0D9488'),
  ('announcement_enabled','false'),('announcement_text','Free delivery on orders over Rs. 2500!'),
  ('announcement_bg','#8D153A'),('announcement_link','/products'),
  ('show_flash_sale','true'),('show_newsletter','true'),('show_why_shop','true'),
  ('show_categories','true'),('facebook_url',''),('instagram_url',''),
  ('tiktok_url',''),('whatsapp_number',''),('free_delivery_min','2500'),('delivery_fee','350'),
  ('site_logo',''),('banner_height','600')
ON CONFLICT (key) DO NOTHING;`;

const Toggle = ({ label, value, onChange, description }: {
  label: string; value: boolean; onChange: (v: boolean) => void; description?: string;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-white/20"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </button>
  </div>
);

const Field = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1.5 mb-4">
    <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 rounded-2xl bg-white/10 border border-white/15 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 focus:bg-white/15 transition-all"
    />
  </div>
);

const ColorField = ({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-white/40 font-mono">{value}</p>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl border-2 border-white/20 shadow-lg" style={{ background: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-xl border border-white/20 cursor-pointer bg-transparent p-0.5"
      />
    </div>
  </div>
);

const SectionTitle = ({ title, desc }: { title: string; desc: string }) => (
  <div className="mb-5">
    <h3 className="text-base font-bold text-white">{title}</h3>
    <p className="text-xs text-white/50 mt-0.5">{desc}</p>
  </div>
);

export const AdminCustomizeSection = () => {
  const { settings, dbReady, save } = useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"identity" | "colors" | "announcement" | "banner" | "sections" | "social" | "delivery">("identity");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SiteSettings>(key: K, val: string) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const saveAll = async () => {
    setSaving(true);
    await save(draft);
    setSaving(false);
    toast.success("Settings saved! Changes are live.");
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Logo must be under 500 KB"); return; }
    const reader = new FileReader();
    reader.onload = () => update("site_logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const BANNER_PRESETS = [
    { label: "Small", value: "360" },
    { label: "Medium", value: "480" },
    { label: "Large", value: "600" },
    { label: "XL", value: "720" },
    { label: "Full", value: "100vh" },
  ];

  const navItems = [
    { key: "identity",     label: "Site Info",      icon: Info },
    { key: "colors",       label: "Colors",          icon: Palette },
    { key: "announcement", label: "Announcement",    icon: Megaphone },
    { key: "banner",       label: "Banner",          icon: Monitor },
    { key: "sections",     label: "Sections",        icon: LayoutGrid },
    { key: "social",       label: "Social",          icon: Share2 },
    { key: "delivery",     label: "Delivery",        icon: Truck },
  ] as const;

  return (
    <div className="flex gap-4 h-full min-h-[600px]">

      {/* ── Left sidebar (glass style) ── */}
      <div
        className="w-56 shrink-0 rounded-3xl p-3 flex flex-col gap-1"
        style={{
          background: "rgba(80, 10, 35, 0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1.5px solid rgba(255,255,255,0.13)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-1">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#FFD100,#FF8C00)" }}>
            <Palette className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Customize</p>
            <p className="text-[10px] text-white/50">Site Settings</p>
          </div>
        </div>

        {/* Nav items */}
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-2xl text-sm font-medium transition-all text-left"
            style={
              tab === key
                ? {
                    background: "rgba(141,21,58,0.8)",
                    color: "#fff",
                    boxShadow: "0 2px 12px rgba(141,21,58,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }
                : { color: "rgba(255,255,255,0.65)" }
            }
            onMouseEnter={(e) => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { if (tab !== key) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}

        {/* Save button */}
        <div className="mt-auto pt-3 border-t border-white/10">
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{
              background: saving ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#FFD100,#FF8C00)",
              boxShadow: saving ? "none" : "0 4px 16px rgba(255,209,0,0.35)",
            }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Right content panel ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* DB warning */}
        {!dbReady && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(180,120,0,0.15)",
              border: "1px solid rgba(255,200,0,0.25)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-yellow-200 text-sm">One-time database setup needed</p>
                <p className="text-xs text-yellow-300/70 mt-1 mb-3">
                  Run this SQL in your{" "}
                  <a href="https://supabase.com/dashboard/project/djmrevzcetdpjzbggavj/sql/new"
                    target="_blank" rel="noopener noreferrer"
                    className="underline font-semibold text-yellow-200">Supabase SQL Editor</a>
                  {" "}to save settings permanently.
                </p>
                <pre className="text-[10px] bg-black/30 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-yellow-100/80 max-h-28">
                  {SETUP_SQL}
                </pre>
                <button
                  onClick={copySQL}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-yellow-200 hover:text-white transition-colors"
                >
                  {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy SQL</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {dbReady && (
          <div className="flex items-center gap-2 text-sm text-green-300 rounded-2xl px-4 py-2.5"
            style={{ background: "rgba(0,180,80,0.12)", border: "1px solid rgba(0,220,100,0.2)" }}>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Database connected — settings sync live.
          </div>
        )}

        {/* Content card */}
        <div
          className="flex-1 rounded-3xl p-5"
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >

          {/* ── Site Info ── */}
          {tab === "identity" && (
            <>
              <SectionTitle title="Site Identity" desc="Name, tagline, contact details, and logo" />
              <Field label="Site Name" value={draft.site_name} onChange={(v) => update("site_name", v)} placeholder="ARTIXO" />
              <Field label="Tagline" value={draft.site_tagline} onChange={(v) => update("site_tagline", v)} placeholder="Sri Lanka's #1 Marketplace" />
              <Field label="Support Email" value={draft.support_email} onChange={(v) => update("support_email", v)} placeholder="support@artixo.lk" type="email" />
              <Field label="Support Phone" value={draft.support_phone} onChange={(v) => update("support_phone", v)} placeholder="+94 11 000 0000" />
              <Field label="Address" value={draft.address} onChange={(v) => update("address", v)} placeholder="Colombo, Sri Lanka" />

              <div className="mt-2 pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Site Logo</p>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5 shrink-0 overflow-hidden">
                    {draft.site_logo
                      ? <img src={draft.site_logo} alt="Logo" className="h-full w-full object-contain p-1" />
                      : <ImageIcon className="h-6 w-6 text-white/30" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 w-full h-9 rounded-2xl text-sm font-medium text-white transition-all"
                      style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Image (max 500 KB)
                    </button>
                    <input
                      value={draft.site_logo.startsWith("data:") ? "" : draft.site_logo}
                      onChange={(e) => update("site_logo", e.target.value)}
                      placeholder="Or paste image URL…"
                      className="w-full h-9 rounded-2xl bg-white/10 border border-white/15 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-all"
                    />
                    {draft.site_logo && (
                      <button onClick={() => update("site_logo", "")}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                        <X className="h-3 w-3" /> Remove logo
                      </button>
                    )}
                    <p className="text-xs text-white/30">PNG or SVG recommended.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Colors ── */}
          {tab === "colors" && (
            <>
              <SectionTitle title="Brand Colors" desc="Changes apply instantly across the entire site" />
              <ColorField label="Primary Color (Gold)" value={draft.primary_color} onChange={(v) => update("primary_color", v)} />
              <ColorField label="Secondary Color (Maroon)" value={draft.secondary_color} onChange={(v) => update("secondary_color", v)} />
              <ColorField label="Accent Color (Teal)" value={draft.accent_color} onChange={(v) => update("accent_color", v)} />
            </>
          )}

          {/* ── Announcement ── */}
          {tab === "announcement" && (
            <>
              <SectionTitle title="Announcement Bar" desc="A banner shown at the very top of the site" />
              <Toggle
                label="Show Announcement Bar"
                value={draft.announcement_enabled === "true"}
                onChange={(v) => update("announcement_enabled", v ? "true" : "false")}
                description="Displays a thin bar above the navbar"
              />
              <div className="mt-4 space-y-3">
                <Field label="Message" value={draft.announcement_text} onChange={(v) => update("announcement_text", v)} placeholder="🎉 Free delivery on orders over Rs. 2,500!" />
                <Field label="Link (optional)" value={draft.announcement_link} onChange={(v) => update("announcement_link", v)} placeholder="/products" />
                <div className="flex items-center gap-3">
                  <p className="text-sm text-white/70 flex-1">Bar Background Color</p>
                  <input
                    type="color"
                    value={draft.announcement_bg}
                    onChange={(e) => update("announcement_bg", e.target.value)}
                    className="h-10 w-14 rounded-xl border border-white/20 cursor-pointer p-0.5 bg-transparent"
                  />
                </div>
              </div>
              {draft.announcement_enabled === "true" && (
                <div className="mt-4 rounded-2xl px-4 py-2.5 text-white text-sm text-center font-medium" style={{ background: draft.announcement_bg }}>
                  {draft.announcement_text || "Preview"}
                </div>
              )}
            </>
          )}

          {/* ── Banner ── */}
          {tab === "banner" && (
            <>
              <SectionTitle title="Hero Banner Height" desc="Controls the height of the main banner on the homepage" />
              <div className="grid grid-cols-5 gap-2 mb-4">
                {BANNER_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => update("banner_height", p.value)}
                    className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={
                      draft.banner_height === p.value
                        ? { background: "rgba(141,21,58,0.8)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Field label="Custom Height (px or 100vh)" value={draft.banner_height} onChange={(v) => update("banner_height", v)} placeholder="600" />
            </>
          )}

          {/* ── Sections ── */}
          {tab === "sections" && (
            <>
              <SectionTitle title="Homepage Sections" desc="Show or hide sections on the homepage" />
              <Toggle label="Flash Sale Section" value={draft.show_flash_sale === "true"} onChange={(v) => update("show_flash_sale", v ? "true" : "false")} description="Highlighted deals with countdown timer" />
              <Toggle label="Category Grid" value={draft.show_categories === "true"} onChange={(v) => update("show_categories", v ? "true" : "false")} description="Browse by product category" />
              <Toggle label="Why Shop Section" value={draft.show_why_shop === "true"} onChange={(v) => update("show_why_shop", v ? "true" : "false")} description="Trust badges and benefits" />
              <Toggle label="Newsletter Section" value={draft.show_newsletter === "true"} onChange={(v) => update("show_newsletter", v ? "true" : "false")} description="Email subscription form" />
            </>
          )}

          {/* ── Social ── */}
          {tab === "social" && (
            <>
              <SectionTitle title="Social Media Links" desc="Shown in the site footer" />
              <Field label="Facebook URL" value={draft.facebook_url} onChange={(v) => update("facebook_url", v)} placeholder="https://facebook.com/artixo" />
              <Field label="Instagram URL" value={draft.instagram_url} onChange={(v) => update("instagram_url", v)} placeholder="https://instagram.com/artixo" />
              <Field label="TikTok URL" value={draft.tiktok_url} onChange={(v) => update("tiktok_url", v)} placeholder="https://tiktok.com/@artixo" />
              <Field label="WhatsApp Number" value={draft.whatsapp_number} onChange={(v) => update("whatsapp_number", v)} placeholder="+94771234567" />
            </>
          )}

          {/* ── Delivery ── */}
          {tab === "delivery" && (
            <>
              <SectionTitle title="Delivery Settings" desc="Shipping fees shown at checkout" />
              <Field label="Free Delivery Minimum (Rs.)" value={draft.free_delivery_min} onChange={(v) => update("free_delivery_min", v)} placeholder="2500" type="number" />
              <Field label="Standard Delivery Fee (Rs.)" value={draft.delivery_fee} onChange={(v) => update("delivery_fee", v)} placeholder="350" type="number" />
              <div className="mt-4 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs text-white/50">Orders above <span className="text-white font-semibold">Rs. {draft.free_delivery_min}</span> get free delivery. Others pay <span className="text-white font-semibold">Rs. {draft.delivery_fee}</span>.</p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
