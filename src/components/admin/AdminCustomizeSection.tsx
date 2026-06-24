import { useState, useRef, useEffect } from "react";
import { useSiteSettings, DEFAULT_SETTINGS, SiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Palette, Megaphone, LayoutGrid, Share2, Info, Truck,
  Save, AlertTriangle, CheckCircle2, Copy,
  ImageIcon, Upload, X, Monitor, Search, FootprintsIcon, Wrench, DollarSign,
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
  <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
    <div>
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-gray-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </button>
  </div>
);

const Field = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="space-y-1.5 mb-4">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
    />
  </div>
);

const ColorField = ({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
    <div>
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <p className="text-xs text-gray-400 font-mono">{value}</p>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl border-2 border-gray-200 shadow-sm" style={{ background: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-xl border border-gray-200 cursor-pointer bg-transparent p-0.5"
      />
    </div>
  </div>
);

const SectionTitle = ({ title, desc }: { title: string; desc: string }) => (
  <div className="mb-5">
    <h3 className="text-base font-bold text-gray-900">{title}</h3>
    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
  </div>
);

export const AdminCustomizeSection = () => {
  const { settings, dbReady, save, preview } = useSiteSettings();
  const [draft, setDraft] = useState<SiteSettings>({ ...settings });
  const [draftInitialized, setDraftInitialized] = useState(dbReady);
  const [saving, setSaving] = useState(false);

  // Sync draft when DB loads for the first time (avoids overwriting defaults with stale form)
  useEffect(() => {
    if (dbReady && !draftInitialized) {
      setDraft({ ...settings });
      setDraftInitialized(true);
    }
  }, [dbReady, settings, draftInitialized]);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"identity" | "colors" | "announcement" | "banner" | "sections" | "social" | "delivery" | "seo" | "footer" | "maintenance" | "currency">("identity");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SiteSettings>(key: K, val: string) => {
    setDraft((d) => ({ ...d, [key]: val }));
    // Live preview — update global context so homepage banner changes instantly
    preview({ [key]: val } as Partial<SiteSettings>);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast.success("Settings saved! Changes are live.");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setSaving(false);
    }
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
    { key: "seo",          label: "SEO",             icon: Search },
    { key: "footer",       label: "Footer",          icon: FootprintsIcon },
    { key: "maintenance",  label: "Maintenance",     icon: Wrench },
    { key: "currency",     label: "Currency & Tax",  icon: DollarSign },
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
          <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 text-sm">One-time database setup needed</p>
                <p className="text-xs text-amber-700 mt-1 mb-3">
                  Run this SQL in your{" "}
                  <a href="https://supabase.com/dashboard/project/djmrevzcetdpjzbggavj/sql/new"
                    target="_blank" rel="noopener noreferrer"
                    className="underline font-semibold text-amber-900">Supabase SQL Editor</a>
                  {" "}to save settings permanently.
                </p>
                <pre className="text-[10px] bg-amber-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap text-amber-900 max-h-28">
                  {SETUP_SQL}
                </pre>
                <button
                  onClick={copySQL}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors"
                >
                  {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy SQL</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {dbReady && (
          <div className="flex items-center gap-2 text-sm text-green-700 rounded-2xl px-4 py-2.5 bg-green-50 border border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Database connected — settings sync live.
          </div>
        )}

        {/* Content card */}
        <div className="flex-1 rounded-3xl p-5 bg-white border border-gray-200 shadow-sm">

          {/* ── Site Info ── */}
          {tab === "identity" && (
            <>
              <SectionTitle title="Site Identity" desc="Name, tagline, contact details, and logo" />
              <Field label="Site Name" value={draft.site_name} onChange={(v) => update("site_name", v)} placeholder="ARTIXO" />
              <Field label="Tagline" value={draft.site_tagline} onChange={(v) => update("site_tagline", v)} placeholder="Sri Lanka's #1 Marketplace" />
              <Field label="Support Email" value={draft.support_email} onChange={(v) => update("support_email", v)} placeholder="support@artixo.lk" type="email" />
              <Field label="Support Phone" value={draft.support_phone} onChange={(v) => update("support_phone", v)} placeholder="+94 11 000 0000" />
              <Field label="Address" value={draft.address} onChange={(v) => update("address", v)} placeholder="Colombo, Sri Lanka" />

              <div className="mt-2 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Site Logo</p>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
                    {draft.site_logo
                      ? <img src={draft.site_logo} alt="Logo" className="h-full w-full object-contain p-1" />
                      : <ImageIcon className="h-6 w-6 text-gray-300" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Image (max 500 KB)
                    </button>
                    <input
                      value={draft.site_logo.startsWith("data:") ? "" : draft.site_logo}
                      onChange={(e) => update("site_logo", e.target.value)}
                      placeholder="Or paste image URL…"
                      className="w-full h-9 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                    {draft.site_logo && (
                      <button onClick={() => update("site_logo", "")}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600">
                        <X className="h-3 w-3" /> Remove logo
                      </button>
                    )}
                    <p className="text-xs text-gray-400">PNG or SVG recommended.</p>
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
                  <p className="text-sm text-gray-700 flex-1">Bar Background Color</p>
                  <input
                    type="color"
                    value={draft.announcement_bg}
                    onChange={(e) => update("announcement_bg", e.target.value)}
                    className="h-10 w-14 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-transparent"
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
              <SectionTitle title="Hero Banner" desc="Full control over the homepage banner size, style & text" />

              {/* Height */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Height</p>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {BANNER_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => update("banner_height", p.value)}
                    className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={draft.banner_height === p.value
                      ? { background: "rgba(141,21,58,0.85)", color: "#fff", border: "1px solid rgba(141,21,58,0.3)" }
                      : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <Field label="Custom Height (px or 100vh)" value={draft.banner_height} onChange={(v) => update("banner_height", v)} placeholder="600" />

              {/* Image Fit */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Image Fit</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Cover (Fill)", value: "cover", desc: "Fills container, may crop" },
                  { label: "Contain (Full)", value: "contain", desc: "Full image, may have gaps" },
                  { label: "Fill (Stretch)", value: "fill", desc: "Stretches to fit exactly" },
                ].map((o) => (
                  <button key={o.value} onClick={() => update("banner_object_fit", o.value)}
                    className="py-2.5 px-3 rounded-2xl text-left transition-all"
                    style={draft.banner_object_fit === o.value
                      ? { background: "rgba(141,21,58,0.85)", color: "#fff", border: "1px solid rgba(141,21,58,0.3)" }
                      : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-semibold">{o.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>

              {/* Image Position */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Image Position</p>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {["top", "center", "bottom", "left", "right"].map((pos) => (
                  <button key={pos} onClick={() => update("banner_object_position", pos)}
                    className="py-2 rounded-2xl text-xs font-medium capitalize transition-all"
                    style={draft.banner_object_position === pos
                      ? { background: "rgba(141,21,58,0.85)", color: "#fff", border: "1px solid rgba(141,21,58,0.3)" }
                      : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                    {pos}
                  </button>
                ))}
              </div>

              {/* Overlay Opacity */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dark Overlay Opacity</p>
                  <span className="text-sm font-bold text-gray-800">{draft.banner_overlay_opacity}%</span>
                </div>
                <input type="range" min="0" max="90" step="5"
                  value={draft.banner_overlay_opacity}
                  onChange={(e) => update("banner_overlay_opacity", e.target.value)}
                  className="w-full accent-[#8D153A]" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0% (No overlay)</span><span>90% (Very dark)</span>
                </div>
              </div>

              {/* Show/Hide Text */}
              <div className="border-t border-gray-100 pt-4">
                <Toggle label="Show Text Overlay" value={draft.banner_show_text === "true"}
                  onChange={(v) => update("banner_show_text", v ? "true" : "false")}
                  description="Show title, subtitle and buttons on the banner" />
              </div>

              {draft.banner_show_text === "true" && (
                <>
                  {/* Text Position */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Text Position</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "← Left", value: "left" },
                      { label: "Center", value: "center" },
                      { label: "Right →", value: "right" },
                    ].map((p) => (
                      <button key={p.value} onClick={() => update("banner_text_position", p.value)}
                        className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                        style={draft.banner_text_position === p.value
                          ? { background: "rgba(141,21,58,0.85)", color: "#fff", border: "1px solid rgba(141,21,58,0.3)" }
                          : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Text Color */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Text Color</p>
                      <p className="text-xs text-gray-400 font-mono">{draft.banner_text_color}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl border-2 border-gray-200 shadow-sm" style={{ background: draft.banner_text_color }} />
                      <input type="color" value={draft.banner_text_color}
                        onChange={(e) => update("banner_text_color", e.target.value)}
                        className="h-9 w-9 rounded-xl border border-gray-200 cursor-pointer bg-transparent p-0.5" />
                    </div>
                  </div>
                </>
              )}

              {/* Live Preview */}
              <div className="mt-5 rounded-2xl overflow-hidden border border-gray-200" style={{ height: "120px", position: "relative", background: "#1a1a2e" }}>
                <div className="absolute inset-0 flex items-center" style={{
                  background: `rgba(0,0,0,${Number(draft.banner_overlay_opacity)/100})`,
                  justifyContent: draft.banner_text_position === "center" ? "center" : draft.banner_text_position === "right" ? "flex-end" : "flex-start",
                }}>
                  {draft.banner_show_text === "true" && (
                    <div className="px-5" style={{ color: draft.banner_text_color, textAlign: draft.banner_text_position as any }}>
                      <p className="text-xs font-bold">🛍 Shop everything island-wide</p>
                      <p className="text-[10px] opacity-70 mt-1">Preview of your banner text</p>
                    </div>
                  )}
                </div>
                <p className="absolute bottom-2 right-3 text-[10px] text-white/40">Preview</p>
              </div>

              {/* View on Homepage button */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                <Monitor className="h-4 w-4" />
                View Live Banner on Homepage ↗
              </a>

              <p className="text-xs text-gray-400 text-center mt-2">
                Changes preview instantly — click <strong>Save All Changes</strong> to persist.
              </p>
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
              <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-600">Orders above <span className="text-gray-900 font-semibold">Rs. {draft.free_delivery_min}</span> get free delivery. Others pay <span className="text-gray-900 font-semibold">Rs. {draft.delivery_fee}</span>.</p>
              </div>
            </>
          )}

          {/* ── SEO ── */}
          {tab === "seo" && (
            <>
              <SectionTitle title="SEO Settings" desc="Controls how your site appears in Google and social media previews" />
              <Field label="Default Page Title" value={draft.seo_title} onChange={(v) => update("seo_title", v)} placeholder="ARTIXO — Sri Lanka's Online Marketplace" />
              <div className="space-y-1.5 mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Meta Description</label>
                <textarea
                  value={draft.seo_description}
                  onChange={(e) => update("seo_description", e.target.value)}
                  placeholder="Sri Lanka's premier online marketplace..."
                  rows={3}
                  maxLength={160}
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                />
                <p className="text-[10px] text-gray-400 text-right">{draft.seo_description.length}/160 characters</p>
              </div>
              <Field label="OG Image URL (social media preview)" value={draft.seo_og_image} onChange={(v) => update("seo_og_image", v)} placeholder="https://artixo.lk/og-image.jpg" />
              {draft.seo_og_image && (
                <div className="rounded-xl overflow-hidden border border-gray-200 mt-2">
                  <img src={draft.seo_og_image} alt="OG Preview" className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              )}
              <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 mb-1">Google Preview</p>
                <p className="text-sm font-medium text-blue-900">{draft.seo_title || "ARTIXO — Sri Lanka's Online Marketplace"}</p>
                <p className="text-xs text-green-700">https://artixo.lk</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{draft.seo_description || "Sri Lanka's premier online marketplace..."}</p>
              </div>
            </>
          )}

          {/* ── Footer ── */}
          {tab === "footer" && (
            <>
              <SectionTitle title="Footer Settings" desc="Contact info and copyright text shown in the site footer" />
              <Field label="Copyright Text" value={draft.footer_copyright} onChange={(v) => update("footer_copyright", v)} placeholder="© {year} ARTIXO — Made with ❤️ in Sri Lanka" />
              <p className="text-[10px] text-gray-400 -mt-3 mb-4">Use <code className="bg-gray-100 px-1 rounded">{"{year}"}</code> to auto-insert the current year.</p>
              <Field label="Support Email" value={draft.footer_email} onChange={(v) => update("footer_email", v)} placeholder="support@artixo.lk" type="email" />
              <Field label="Support Phone" value={draft.footer_phone} onChange={(v) => update("footer_phone", v)} placeholder="+94 11 000 0000" />
              <Field label="Address" value={draft.footer_address} onChange={(v) => update("footer_address", v)} placeholder="Colombo, Sri Lanka 🇱🇰" />
              <div className="mt-4 p-4 rounded-xl bg-gray-900 border border-gray-700 text-white">
                <p className="text-[10px] text-gray-400 mb-2">Footer Preview</p>
                <p className="text-xs text-gray-300">📍 {draft.footer_address || "Colombo, Sri Lanka 🇱🇰"}</p>
                <p className="text-xs text-gray-300 mt-1">✉️ {draft.footer_email || "support@artixo.lk"}</p>
                <p className="text-xs text-gray-300 mt-1">📞 {draft.footer_phone || "+94 11 000 0000"}</p>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-[10px] text-gray-500">{(draft.footer_copyright || "© {year} ARTIXO").replace("{year}", new Date().getFullYear().toString())}</p>
                </div>
              </div>
            </>
          )}

          {/* ── Maintenance ── */}
          {tab === "maintenance" && (
            <>
              <SectionTitle title="Maintenance Mode" desc="When enabled, visitors see a maintenance page. Admins can still access the site." />
              <div className={`rounded-2xl p-4 mb-4 border ${draft.maintenance_mode === "true" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${draft.maintenance_mode === "true" ? "text-red-700" : "text-green-700"}`}>
                      {draft.maintenance_mode === "true" ? "🔴 Site is OFFLINE (maintenance mode ON)" : "🟢 Site is ONLINE (maintenance mode OFF)"}
                    </p>
                    <p className={`text-xs mt-0.5 ${draft.maintenance_mode === "true" ? "text-red-600" : "text-green-600"}`}>
                      {draft.maintenance_mode === "true" ? "Visitors see maintenance page. Admins can still browse." : "Site is live and accessible to everyone."}
                    </p>
                  </div>
                  <button
                    onClick={() => update("maintenance_mode", draft.maintenance_mode === "true" ? "false" : "true")}
                    className={`relative w-14 h-7 rounded-full transition-colors ${draft.maintenance_mode === "true" ? "bg-red-500" : "bg-green-500"}`}
                  >
                    <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.maintenance_mode === "true" ? "translate-x-7" : ""}`} />
                  </button>
                </div>
              </div>
              <Field label="Maintenance Page Title" value={draft.maintenance_title} onChange={(v) => update("maintenance_title", v)} placeholder="We'll be back soon!" />
              <div className="space-y-1.5 mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maintenance Message</label>
                <textarea
                  value={draft.maintenance_message}
                  onChange={(e) => update("maintenance_message", e.target.value)}
                  placeholder="We're performing scheduled maintenance. Thank you for your patience."
                  rows={3}
                  className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                />
              </div>
              <Field label="Expected Back Time (optional)" value={draft.maintenance_eta} onChange={(v) => update("maintenance_eta", v)} placeholder="e.g. 2:00 PM today" />
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700">⚠️ Save changes first, then toggle maintenance mode. Admins bypass the maintenance page automatically.</p>
              </div>
            </>
          )}

          {/* ── Currency & Tax ── */}
          {tab === "currency" && (
            <>
              <SectionTitle title="Currency & Tax" desc="Controls how prices are displayed across the site" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Currency Symbol</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {["Rs.", "LKR", "$", "€"].map((sym) => (
                  <button key={sym} onClick={() => update("currency_symbol", sym)}
                    className="py-2.5 rounded-2xl text-sm font-bold transition-all"
                    style={draft.currency_symbol === sym
                      ? { background: "rgba(141,21,58,0.85)", color: "#fff", border: "1px solid rgba(141,21,58,0.3)" }
                      : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                    {sym}
                  </button>
                ))}
              </div>
              <Field label="Custom Currency Symbol" value={draft.currency_symbol} onChange={(v) => update("currency_symbol", v)} placeholder="Rs." />

              <div className="border-t border-gray-100 pt-4 mt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">VAT / Tax Percentage</p>
                  <span className="text-sm font-bold text-gray-800">{draft.vat_percentage}%</span>
                </div>
                <input type="range" min="0" max="30" step="1"
                  value={draft.vat_percentage}
                  onChange={(e) => update("vat_percentage", e.target.value)}
                  className="w-full accent-[#8D153A]" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 mb-4">
                  <span>0% (No tax)</span><span>30%</span>
                </div>
                <Field label="Custom VAT %" value={draft.vat_percentage} onChange={(v) => update("vat_percentage", v)} placeholder="0" type="number" />
                <Toggle label="Tax Inclusive Pricing" value={draft.tax_inclusive === "true"}
                  onChange={(v) => update("tax_inclusive", v ? "true" : "false")}
                  description="If ON, displayed prices already include tax. If OFF, tax is added at checkout." />
              </div>

              <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500 mb-2 font-semibold">Price Display Preview</p>
                <p className="text-lg font-bold text-gray-900">{draft.currency_symbol} 2,500</p>
                {Number(draft.vat_percentage) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {draft.tax_inclusive === "true"
                      ? `Includes ${draft.vat_percentage}% VAT`
                      : `+ ${draft.vat_percentage}% VAT = ${draft.currency_symbol} ${Math.round(2500 * (1 + Number(draft.vat_percentage) / 100)).toLocaleString()}`}
                  </p>
                )}
              </div>

              {/* Commission Rate */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Default Seller Commission Rate</p>
                  <span className="text-lg font-bold text-rose-700">{draft.default_commission_rate}%</span>
                </div>
                <input type="range" min="1" max="20" step="0.5"
                  value={draft.default_commission_rate}
                  onChange={(e) => update("default_commission_rate", e.target.value)}
                  className="w-full accent-[#8D153A]" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 mb-3">
                  <span>1% (Very low)</span><span>20% (High)</span>
                </div>
                <Field label="Custom Rate %" value={draft.default_commission_rate} onChange={(v) => update("default_commission_rate", v)} placeholder="5" type="number" />

                {/* Competitor comparison */}
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 text-xs">
                  <div className="bg-gray-50 px-3 py-2 font-semibold text-gray-600">Competitor Comparison</div>
                  {[
                    { name: "Daraz Sri Lanka", rate: "10–15%", color: "text-red-600" },
                    { name: "Kapruka", rate: "12–18%", color: "text-red-500" },
                    { name: "ikman.lk", rate: "8–12%", color: "text-orange-500" },
                    { name: "ARTIXO (yours)", rate: `${draft.default_commission_rate}%`, color: "text-green-600 font-bold" },
                  ].map((c) => (
                    <div key={c.name} className="flex justify-between items-center px-3 py-2 border-t border-gray-100">
                      <span className="text-gray-700">{c.name}</span>
                      <span className={c.color}>{c.rate}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">This rate applies to all new sellers. Existing sellers keep their individual rate from the database.</p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
