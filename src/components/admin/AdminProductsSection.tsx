import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, Upload, Search, Package, FileSpreadsheet, Download,
} from "lucide-react";
import { formatLKR } from "@/lib/format";

interface Category { id: string; name: string }
interface ProductRow {
  id: string; name: string; price: number; stock: number; status: string;
  image_url: string | null; description: string | null; category_id: string | null;
  original_price: number | null; brand: string | null; sku: string | null;
  is_trending: boolean;
  variants: any;
  images: string[];
}

const emptyForm = {
  name: "", description: "", price: "", original_price: "", stock: "",
  category_id: "", image_url: "", brand: "", sku: "", is_trending: false,
  sizes: "",
  colorVariants: [] as { name: string; image: string }[],
  video_url: "",
  images: [] as string[],
};

export const AdminProductsSection = ({ adminUserId }: { adminUserId: string }) => {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);
  const [newColorName, setNewColorName] = useState("");

  const refresh = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setProducts((data ?? []) as ProductRow[]);
  };

  useEffect(() => {
    supabase.from("categories").select("id,name").then(({ data }) => {
      setCategories((data ?? []) as Category[]);
    });
    refresh();
  }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    const v = p.variants && typeof p.variants === "object" && !Array.isArray(p.variants) ? p.variants : {};
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      stock: String(p.stock),
      category_id: p.category_id ?? "",
      image_url: p.image_url ?? "",
      brand: p.brand ?? "",
      sku: p.sku ?? "",
      is_trending: p.is_trending,
      sizes: Array.isArray(v.sizes) ? v.sizes.join(", ") : "",
      colorVariants: Array.isArray(v.colors)
      ? v.colors.map((c) => typeof c === "string" ? { name: c, image: "" } : c)
      : [],
      video_url: typeof v.video_url === "string" ? v.video_url : "",
      images: Array.isArray(p.images) ? p.images : [],
    });
    setOpen(true);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${adminUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      setForm((f) => ({ ...f, image_url: f.image_url || url, images: [...f.images, url] }));
      toast.success("Image uploaded");
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      setForm((f) => ({
        ...f,
        image_url: f.image_url || urls[0],
        images: [...f.images, ...urls],
      }));
      toast.success(`${urls.length} image(s) uploaded`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (url: string) => {
    setForm((f) => ({
      ...f,
      images: f.images.filter((u) => u !== url),
      image_url: f.image_url === url ? (f.images.find((u) => u !== url) ?? "") : f.image_url,
    }));
  };

  const setAsMain = (url: string) => {
    setForm((f) => ({ ...f, image_url: url }));
    toast.success("Main image updated");
  };

  const addColorVariant = () => {
    const name = newColorName.trim();
    if (!name) { toast.error("Enter a color name"); return; }
    if (form.colorVariants.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Color already added"); return;
    }
    setForm((f) => ({ ...f, colorVariants: [...f.colorVariants, { name, image: "" }] }));
    setNewColorName("");
  };

  const removeColorVariant = (index: number) => {
    setForm((f) => ({ ...f, colorVariants: f.colorVariants.filter((_, i) => i !== index) }));
  };

  const uploadColorImage = async (file: File, index: number) => {
    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      setForm((f) => {
        const cv = [...f.colorVariants];
        cv[index] = { ...cv[index], image: url };
        const newImages = f.images.includes(url) ? f.images : [...f.images, url];
        return { ...f, colorVariants: cv, image_url: f.image_url || url, images: newImages };
      });
      toast.success("Color image uploaded");
    }
    setUploading(false);
  };

  const uploadVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("Video must be under 100 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${adminUserId}/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, video_url: pub.publicUrl }));
    toast.success("Video uploaded!");
    setUploading(false);
    e.target.value = "";
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(form.price);
    const origNum = form.original_price ? parseFloat(form.original_price) : null;
    if (origNum && origNum <= priceNum) { toast.error("Original price must be higher than selling price"); return; }
    setSaving(true);
    const sizesArr = form.sizes.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      seller_id: adminUserId,
      name: form.name,
      description: form.description || null,
      price: priceNum,
      original_price: origNum,
      stock: parseInt(form.stock),
      category_id: form.category_id || null,
      image_url: form.image_url || form.images[0] || null,
      images: form.images,
      brand: form.brand || null,
      sku: form.sku || null,
      is_trending: form.is_trending,
      variants: { sizes: sizesArr, colors: form.colorVariants, video_url: form.video_url || null },
      status: "approved" as const,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Product updated — live now" : "Product added — live on website");
    setOpen(false);
    refresh();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    refresh();
  };

  // Bulk CSV upload
  const csvTemplate =
    "name,description,price,original_price,stock,brand,sku,category,image_url,is_trending,sizes,colors\n" +
    "Sample Tea,Premium Ceylon black tea 250g,1200,1500,50,Dilmah,DLM-001,,https://example.com/tea.jpg,true,,\n" +
    "Sample Shirt,Cotton t-shirt,1500,,30,,,,,false,S|M|L|XL,Red|Blue|Black\n";

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const parseLine = (line: string): string[] => {
      const out: string[] = []; let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === "," && !inQ) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur); return out;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkBusy(true); setBulkResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("CSV is empty or invalid"); setBulkBusy(false); return; }
      const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
      const errors: string[] = [];
      let ok = 0, fail = 0;
      const inserts: any[] = [];
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const lineNo = idx + 2;
        if (!r.name) { errors.push(`Line ${lineNo}: missing name`); fail++; continue; }
        const price = parseFloat(r.price);
        if (isNaN(price) || price < 0) { errors.push(`Line ${lineNo}: invalid price`); fail++; continue; }
        const stock = parseInt(r.stock || "0");
        const orig = r.original_price ? parseFloat(r.original_price) : null;
        const catId = r.category ? catMap.get(r.category.toLowerCase()) ?? null : null;
        const sizesArr = (r.sizes || "").split("|").map((s) => s.trim()).filter(Boolean);
        const colorsArr = (r.colors || "").split("|").map((s) => s.trim()).filter(Boolean);
        inserts.push({
          seller_id: adminUserId,
          name: r.name,
          description: r.description || null,
          price,
          original_price: orig && orig > price ? orig : null,
          stock: isNaN(stock) ? 0 : stock,
          brand: r.brand || null,
          sku: r.sku || null,
          category_id: catId,
          image_url: r.image_url || (r.images ? r.images.split("|").map((u) => u.trim()).filter(Boolean)[0] : null),
          images: r.images ? r.images.split("|").map((u) => u.trim()).filter(Boolean) : (r.image_url ? [r.image_url] : []),
          is_trending: ["true", "1", "yes"].includes((r.is_trending || "").toLowerCase()),
          variants: { sizes: sizesArr, colors: colorsArr },
          status: "approved" as const,
        });
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from("products").insert(inserts);
        if (error) { fail += inserts.length; errors.push(error.message); }
        else { ok = inserts.length; }
      }
      setBulkResult({ ok, fail, errors: errors.slice(0, 10) });
      if (ok > 0) toast.success(`${ok} product(s) uploaded & live`);
      if (fail > 0) toast.error(`${fail} row(s) failed`);
      refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBulkBusy(false); e.target.value = "";
    }
  };

  const filtered = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
        <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); }}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Bulk Upload
        </Button>
        <Button variant="ghost" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> CSV Template</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, brand, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 px-0" />
          <span className="text-xs text-muted-foreground">{filtered.length} item(s)</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-1">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.brand ?? "—"} {p.sku ? `• ${p.sku}` : ""}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatLKR(p.price)}</TableCell>
                  <TableCell><span className={p.stock === 0 ? "text-destructive font-medium" : ""}>{p.stock}</span></TableCell>
                  <TableCell>
                    <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No products</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div><Label>Product Name *</Label><Input required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Brand</Label><Input maxLength={60} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>SKU</Label><Input maxLength={60} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Selling Price *</Label><Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Original Price</Label><Input type="number" min="0" step="0.01" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></div>
              <div><Label>Stock *</Label><Input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sizes (comma-separated)</Label>
                <Input placeholder="S, M, L, XL" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} />
              </div>
              <div className="space-y-3">
                <Label>Colors &amp; Images</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Red, Navy Blue..."
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColorVariant(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addColorVariant}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {form.colorVariants.length > 0 && (
                  <div className="space-y-2">
                    {form.colorVariants.map((cv, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {cv.image ? (
                            <img src={cv.image} alt={cv.name} className="h-10 w-10 rounded object-cover border shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded border-2 border-dashed flex items-center justify-center bg-background shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm font-medium truncate">{cv.name}</span>
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadColorImage(file, idx); e.target.value = ""; }}
                          />
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span><Upload className="h-3 w-3 mr-1" />{cv.image ? "Change" : "Upload"}</span>
                          </Button>
                        </label>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeColorVariant(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {form.colorVariants.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add colors above. Each color can have its own product image.</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Product Video (optional)</Label>
              <div className="flex gap-2 items-center">
                <label className="cursor-pointer flex-shrink-0">
                  <input type="file" accept="video/*" className="hidden" onChange={uploadVideoFile} disabled={uploading} />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span><Upload className="h-3.5 w-3.5 mr-1" /> Upload video</span>
                  </Button>
                </label>
                <Input
                  placeholder="or paste YouTube / video URL"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                />
                {form.video_url && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setForm({ ...form, video_url: "" })}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              {form.video_url && (
                <div className="rounded-lg overflow-hidden border bg-black aspect-video w-full max-w-xs">
                  {(form.video_url.includes("youtube.com") || form.video_url.includes("youtu.be")) ? (
                    <iframe
                      src={form.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : (
                    <video src={form.video_url} controls className="w-full h-full" />
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Supports YouTube links or direct video files (MP4, max 100 MB).</p>
            </div>

            <div className="space-y-2">
              <Label>Product Images (multiple allowed)</Label>
              <div className="flex flex-wrap gap-2">
                {form.images.map((url) => (
                  <div key={url} className="relative group">
                    <img
                      src={url}
                      alt=""
                      className={`h-20 w-20 rounded object-cover border-2 ${form.image_url === url ? "border-primary" : "border-border"}`}
                    />
                    {form.image_url === url && (
                      <span className="absolute -top-1 -left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">Main</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center gap-1">
                      {form.image_url !== url && (
                        <button type="button" onClick={() => setAsMain(url)} className="text-[10px] text-white bg-primary px-1.5 py-0.5 rounded">Set main</button>
                      )}
                      <button type="button" onClick={() => removeImage(url)} className="text-[10px] text-white bg-destructive px-1.5 py-0.5 rounded">Remove</button>
                    </div>
                  </div>
                ))}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleMultipleImageUpload} />
                  <div className="h-20 w-20 rounded border-2 border-dashed flex flex-col items-center justify-center hover:bg-muted/40 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">{uploading ? "…" : "Add"}</span>
                  </div>
                </label>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="or paste image URL and press Add"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (form.image_url && !form.images.includes(form.image_url)) {
                      setForm((f) => ({ ...f, images: [...f.images, f.image_url] }));
                    }
                  }}
                >
                  Add URL
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">First image is the main image. Hover an image to set as main or remove.</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_trending} onChange={(e) => setForm({ ...form, is_trending: e.target.checked })} />
              Mark as trending
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Product"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk Upload Products</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Upload a CSV with columns: <code className="text-xs bg-muted px-1 rounded">name, description, price, original_price, stock, brand, sku, category, image_url, is_trending</code>. Category must match an existing category name.
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Download Template</Button>
            <label className="block">
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBulkUpload} disabled={bulkBusy} />
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm font-medium">{bulkBusy ? "Uploading…" : "Click to select CSV file"}</div>
                <div className="text-xs text-muted-foreground mt-1">Up to a few hundred rows</div>
              </div>
            </label>
            {bulkResult && (
              <Card className="p-3 text-sm space-y-2">
                <div className="flex gap-4">
                  <span className="text-success font-medium">✓ {bulkResult.ok} added</span>
                  {bulkResult.fail > 0 && <span className="text-destructive font-medium">✗ {bulkResult.fail} failed</span>}
                </div>
                {bulkResult.errors.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                    {bulkResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
