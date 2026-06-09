import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Image as ImageIcon, Upload, Film } from "lucide-react";

interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  cta_text: string | null;
  display_order: number;
  is_active: boolean;
}

const empty = {
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "/products",
  cta_text: "Shop Now",
  display_order: 0,
  is_active: true,
};

const isAnimatedBanner = (url: string) => {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "gif" || ext === "webp";
};

export const AdminBannersSection = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setBanners((data ?? []) as Banner[]);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, display_order: banners.length });
    setOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      link_url: b.link_url ?? "",
      cta_text: b.cta_text ?? "",
      display_order: b.display_order,
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("banners").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: pub.publicUrl }));
    toast.success("Image uploaded");
    setUploading(false);
  };

  const save = async () => {
    if (!form.image_url) { toast.error("Please upload a banner image"); return; }
    setSaving(true);
    const payload = {
      title: form.title || null,
      subtitle: form.subtitle || null,
      image_url: form.image_url,
      link_url: form.link_url || null,
      cta_text: form.cta_text || null,
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("banners").update(payload).eq("id", editing.id)
      : await supabase.from("banners").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Banner updated" : "Banner added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Banner deleted");
    load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b">
        <div>
          <h3 className="font-semibold">Hero Banners</h3>
          <p className="text-xs text-muted-foreground">
            Manage homepage hero banners. Active banners auto-rotate every 6s.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Banner</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Banner Image / Animated GIF *</Label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-24 w-40 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {form.image_url ? (
                      <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
                      />
                      <div className="border border-dashed rounded p-3 text-sm text-center cursor-pointer hover:bg-muted/50">
                        <Upload className="h-4 w-4 inline mr-1" />
                        {uploading ? "Uploading..." : "Click to upload image / GIF"}
                      </div>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Supports JPG, PNG, GIF (animated), and WebP (animated).
                    </p>
                    <Input
                      placeholder="Or paste image / GIF URL"
                      value={form.image_url}
                      onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Big Sale!" /></div>
                <div><Label>CTA Text</Label><Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Shop Now" /></div>
              </div>
              <div><Label>Subtitle</Label><Textarea rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Up to 50% off..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/products" /></div>
                <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active (visible on homepage)</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving || uploading}>{saving ? "Saving..." : "Save Banner"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {banners.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2" />
          No banners yet. Add one to customize the homepage hero.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preview</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="relative h-12 w-20 rounded bg-muted overflow-hidden">
                    <img src={b.image_url} alt={b.title ?? ""} className="h-full w-full object-cover" />
                    {isAnimatedBanner(b.image_url) && (
                      <span className="absolute bottom-0 left-0 bg-black/70 text-white text-[9px] px-1 rounded-tr flex items-center gap-0.5">
                        <Film className="h-2.5 w-2.5" /> GIF
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.title ?? "—"}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">{b.subtitle}</div>
                </TableCell>
                <TableCell>{b.display_order}</TableCell>
                <TableCell><Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};
