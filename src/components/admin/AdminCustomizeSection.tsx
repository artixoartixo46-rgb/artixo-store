import { useState, useRef } from "react";
import { useSiteSettings, DEFAULT_SETTINGS, SiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Palette, Megaphone, LayoutGrid, Share2, Info, Truck,
  Save, AlertTriangle, CheckCircle2, Eye, EyeOff, Copy,
  ImageIcon, Upload, X, Monitor,
} from "lucide-react";

const SETUP_SQL = `-- Run this once in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS site_settings (
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

const Toggle = ({
  label, value, onChange, description,
}: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
    <div>
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </button>
  </div>
);

const SettingRow = ({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div className="grid grid-cols-[1fr_auto] gap-3 items-center py-2 border-b border-border/30 last:border-0">
    <label className="text-sm font-medium text-foreground/80">{label}</label>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-48 h-9 text-sm"
    />
  </div>
);

const ColorRow = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground font-mono">{value}</p>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg border-2 border-border shadow-sm" style={{ background: value }} />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-lg border border-input cursor-pointer bg-transparent p-0.5"
      />
    </div>
  </div>
);

export const AdminCustomizeSection = () => {
  const { settings, dbReady, save, refresh } = useSiteSettings();
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
    toast.success("Settings saved! Changes are live on the site.");
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo must be under 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("site_logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const BANNER_PRESETS = [
    { label: "Small", value: "360", desc: "360px" },
    { label: "Medium", value: "480", desc: "480px" },
    { label: "Large", value: "600", desc: "600px" },
    { label: "XL", value: "720", desc: "720px" },
    { label: "Fullscreen", value: "100vh", desc: "100% screen height" },
  ];

  const tabs = [
    { key: "identity", label: "Site Info", icon: Info },
    { key: "colors", label: "Colors", icon: Palette },
    { key: "announcement", label: "Announcement", icon: Megaphone },
    { key: "banner", label: "Banner", icon: Monitor },
    { key: "sections", label: "Sections", icon: LayoutGrid },
    { key: "social", label: "Social", icon: Share2 },
    { key: "delivery", label: "Delivery", icon: Truck },
  ] as const;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* DB setup banner */}
      {!dbReady && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900 text-sm">One-time database setup required</p>
                <p className="text-xs text-amber-700 mt-1 mb-3">
                  Run this SQL once in your{" "}
                  <a href="https://supabase.com/dashboard/project/qzhcxtqkdcygzadcttyf/sql/new"
                     target="_blank" rel="noopener noreferrer"
                     className="underline font-semibold">Supabase SQL Editor</a>{" "}
                  to enable persistent settings. Until then, changes apply live but won't be saved between sessions.
                </p>
                <pre className="text-[10px] bg-amber-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-amber-900 max-h-32">
                  {SETUP_SQL}
                </pre>
                <Button size="sm" variant="outline" className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100" onClick={copySQL}>
                  {copied ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy SQL</>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dbReady && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Database connected — settings are saved and synced live.
        </div>
      )}

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-2xl">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Site Info ── */}
      {tab === "identity" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Site Identity</CardTitle>
            <CardDescription>Name, tagline, contact details, and logo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow label="Site Name" value={draft.site_name} onChange={(v) => update("site_name", v)} placeholder="ARTIXO" />
            <SettingRow label="Tagline" value={draft.site_tagline} onChange={(v) => update("site_tagline", v)} placeholder="Sri Lanka's #1 Marketplace" />
            <SettingRow label="Support Email" value={draft.support_email} onChange={(v) => update("support_email", v)} placeholder="support@artixo.lk" type="email" />
            <SettingRow label="Support Phone" value={draft.support_phone} onChange={(v) => update("support_phone", v)} placeholder="+94 11 000 0000" />
            <SettingRow label="Address" value={draft.address} onChange={(v) => update("address", v)} placeholder="Colombo, Sri Lanka" />

            {/* Logo upload */}
            <div className="pt-3 border-t border-border/30 mt-3">
              <p className="text-sm font-medium mb-3">Site Logo</p>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 shrink-0 overflow-hidden">
                  {draft.site_logo ? (
                    <img src={draft.site_logo} alt="Logo preview" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {/* File upload */}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Upload Image (max 500 KB)
                  </Button>
                  {/* URL input */}
                  <Input
                    value={draft.site_logo.startsWith("data:") ? "" : draft.site_logo}
                    onChange={(e) => update("site_logo", e.target.value)}
                    placeholder="Or paste image URL..."
                    className="h-9 text-sm"
                  />
                  {draft.site_logo && (
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive w-full" onClick={() => update("site_logo", "")}>
                      <X className="h-3.5 w-3.5" /> Remove logo (use default)
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG or SVG recommended. Leave empty to use the default Artixo logo.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Colors ── */}
      {tab === "colors" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Colors</CardTitle>
            <CardDescription>Changes apply instantly across the entire site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <ColorRow label="Primary Color (Gold)" value={draft.primary_color} onChange={(v) => update("primary_color", v)} />
            <ColorRow label="Secondary Color (Maroon)" value={draft.secondary_color} onChange={(v) => update("secondary_color", v)} />
            <ColorRow label="Accent Color (Teal)" value={draft.accent_color} onChange={(v) => update("accent_color", v)} />
          </CardContent>
        </Card>
      )}

      {/* ── Announcement Bar ── */}
      {tab === "announcement" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Announcement Bar</CardTitle>
            <CardDescription>A banner that shows at the very top of the site</CardDescription>
          </CardHeader>
          <CardContent>
            <Toggle
              label="Show Announcement Bar"
              value={draft.announcement_enabled === "true"}
              onChange={(v) => update("announcement_enabled", v ? "true" : "false")}
              description="Displays a thin bar above the navbar"
            />
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Message</label>
                <Input
                  value={draft.announcement_text}
                  onChange={(e) => update("announcement_text", e.target.value)}
                  placeholder="🎉 Free delivery on orders over Rs. 2,500!"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Link (optional)</label>
                  <Input value={draft.announcement_link} onChange={(e) => update("announcement_link", e.target.value)} placeholder="/products" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Bar Color</label>
                  <input
                    type="color"
                    value={draft.announcement_bg}
                    onChange={(e) => update("announcement_bg", e.target.value)}
                    className="h-10 w-16 rounded-lg border border-input cursor-pointer p-0.5"
                  />
                </div>
              </div>
            </div>
            {draft.announcement_enabled === "true" && (
              <div className="mt-4 rounded-xl px-4 py-2.5 text-white text-sm text-center font-medium" style={{ background: draft.announcement_bg }}>
                {draft.announcement_text || "Preview"}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Banner ── */}
      {tab === "banner" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hero Banner Size</CardTitle>
            <CardDescription>Controls the height of the main banner on the homepage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BANNER_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update("banner_height", p.value)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 transition-all ${
                    draft.banner_height === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/20 hover:border-primary/40"
                  }`}
                >
                  {/* Mini visual representation */}
                  <div className="relative w-full h-10 rounded overflow-hidden bg-gradient-to-r from-gray-700 to-gray-500 mb-1">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary/60 rounded-sm"
                      style={{ height: p.value === "100vh" ? "100%" : `${Math.round((parseInt(p.value) / 720) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
            {/* Live preview bar */}
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-gradient-to-r from-gray-800 to-gray-600 relative"
              style={{ height: draft.banner_height === "100vh" ? "200px" : `${Math.min(parseInt(draft.banner_height) / 4, 200)}px` }}>
              <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs font-medium">
                Preview — {draft.banner_height === "100vh" ? "Fullscreen" : `${draft.banner_height}px height`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sections ── */}
      {tab === "sections" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Homepage Sections</CardTitle>
            <CardDescription>Show or hide sections on the homepage</CardDescription>
          </CardHeader>
          <CardContent>
            <Toggle label="Flash Sale" value={draft.show_flash_sale === "true"} onChange={(v) => update("show_flash_sale", v ? "true" : "false")} description="Limited-time deals with countdown timer" />
            <Toggle label="Categories" value={draft.show_categories === "true"} onChange={(v) => update("show_categories", v ? "true" : "false")} description="Category browsing grid" />
            <Toggle label="Why Shop With Us" value={draft.show_why_shop === "true"} onChange={(v) => update("show_why_shop", v ? "true" : "false")} description="4-card trust badges section" />
            <Toggle label="Newsletter" value={draft.show_newsletter === "true"} onChange={(v) => update("show_newsletter", v ? "true" : "false")} description="Email subscription banner" />
          </CardContent>
        </Card>
      )}

      {/* ── Social Links ── */}
      {tab === "social" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social Links</CardTitle>
            <CardDescription>Shown in the footer — leave blank to hide</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow label="Facebook" value={draft.facebook_url} onChange={(v) => update("facebook_url", v)} placeholder="https://facebook.com/artixo" />
            <SettingRow label="Instagram" value={draft.instagram_url} onChange={(v) => update("instagram_url", v)} placeholder="https://instagram.com/artixo" />
            <SettingRow label="TikTok" value={draft.tiktok_url} onChange={(v) => update("tiktok_url", v)} placeholder="https://tiktok.com/@artixo" />
            <SettingRow label="WhatsApp Number" value={draft.whatsapp_number} onChange={(v) => update("whatsapp_number", v)} placeholder="+94771234567" />
          </CardContent>
        </Card>
      )}

      {/* ── Delivery ── */}
      {tab === "delivery" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Settings</CardTitle>
            <CardDescription>Shown on product and checkout pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow label="Free Delivery Min (Rs.)" value={draft.free_delivery_min} onChange={(v) => update("free_delivery_min", v)} type="number" placeholder="2500" />
            <SettingRow label="Standard Delivery Fee (Rs.)" value={draft.delivery_fee} onChange={(v) => update("delivery_fee", v)} type="number" placeholder="350" />
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setDraft({ ...settings })}>Reset</Button>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
