import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Package, Trash2, Edit, Upload, ShoppingBag, MapPin, Phone } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { OrderStatusTimeline, OrderStatus } from "@/components/OrderStatusTimeline";
import { SellerOrdersWidget, FilterKey, filterOrders } from "@/components/SellerOrdersWidget";

interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; price: number; stock: number; status: string;
  image_url: string | null; description: string | null; category_id: string | null;
  original_price: number | null; brand: string | null; sku: string | null;
  images: string[]; variants: any;
}

const emptyForm = {
  name: "", description: "", price: "", original_price: "", stock: "",
  category_id: "", image_url: "", brand: "", sku: "",
  images: [] as string[],
  sizes: "",
};

const SellerDashboard = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<FilterKey>("all");

  const refresh = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("products").select("*").eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setProducts((data ?? []) as Product[]);
  };

  const refreshOrders = async () => {
    if (!user) return;
    const { data: items, error } = await supabase
      .from("order_items")
      .select("*, orders(id, status, created_at, shipping_address, shipping_phone, total_amount, notes)")
      .eq("seller_id", user.id);
    if (error) return;
    const orderMap = new Map<string, any>();
    for (const item of items ?? []) {
      const ord = (item as any).orders;
      if (!ord) continue;
      if (!orderMap.has(ord.id)) orderMap.set(ord.id, { ...ord, my_items: [] });
      orderMap.get(ord.id).my_items.push({
        productName: (item as any).product_name,
        quantity: (item as any).quantity,
        unitPrice: (item as any).unit_price,
      });
    }
    setOrders(Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order marked as ${status}`);
    refreshOrders();
  };

  useEffect(() => {
    supabase.from("categories").select("id,name").then(({ data }) => setCategories((data ?? []) as Category[]));
    refresh(); refreshOrders();
  }, [user]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!authLoading && user && roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (!authLoading && user && !roles.includes("seller")) return <Navigate to="/become-seller" replace />;

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const openEdit = (p: Product) => {
    setEditing(p);
    const v = p.variants && typeof p.variants === "object" && !Array.isArray(p.variants) ? p.variants : {};
    setForm({
      name: p.name, description: p.description ?? "", price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      stock: String(p.stock), category_id: p.category_id ?? "",
      image_url: p.image_url ?? "", brand: p.brand ?? "", sku: p.sku ?? "",
      images: Array.isArray(p.images) ? p.images : [],
      sizes: Array.isArray(v.sizes) ? v.sizes.join(", ") : "",
    });
    setOpen(true);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleMainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    if (url) { setForm((f) => ({ ...f, image_url: f.image_url || url, images: f.images.includes(url) ? f.images : [...f.images, url] })); toast.success("Image uploaded"); }
    setUploading(false); e.target.value = "";
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) { const u = await uploadFile(f); if (u) urls.push(u); }
    setForm((f) => ({ ...f, image_url: f.image_url || urls[0] || "", images: [...f.images, ...urls].slice(0, 8) }));
    setUploading(false);
    if (urls.length) toast.success(`${urls.length} image(s) added`);
    e.target.value = "";
  };

  const removeGalleryImage = (idx: number) => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return;
    const priceNum = parseFloat(form.price);
    const origNum = form.original_price ? parseFloat(form.original_price) : null;
    if (origNum && origNum <= priceNum) { toast.error("Original price must be higher than selling price"); return; }
    setSaving(true);
    const sizesArr = form.sizes.split(",").map((s) => s.trim()).filter(Boolean);
    const payload: any = {
      seller_id: user.id, name: form.name, description: form.description || null,
      price: priceNum, original_price: origNum, stock: parseInt(form.stock),
      category_id: form.category_id || null, image_url: form.image_url || form.images[0] || null,
      images: form.images, brand: form.brand || null, sku: form.sku || null,
      variants: { sizes: sizesArr },
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert({ ...payload, status: "pending" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Product updated" : "Product submitted for admin approval");
    setOpen(false); refresh();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); refresh();
  };
﻿  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Seller Dashboard</h1>
          <p className="text-muted-foreground">Manage your products</p>
        </div>
        <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total Products</div><div className="font-display text-2xl">{products.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Live</div><div className="font-display text-2xl text-success">{products.filter((p) => p.status === "approved").length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pending Approval</div><div className="font-display text-2xl text-primary">{products.filter((p) => p.status === "pending").length}</div></Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" /> Products</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 mr-1" /> Orders ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {products.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Package className="h-16 w-16 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No products yet. Add your first one!</p>
              <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
            </Card>
          ) : (
            <div className="grid gap-3">
              {products.map((p) => (
                <Card key={p.id} className="p-4 flex gap-4 items-center">
                  <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-1">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{formatLKR(p.price)} - Stock: {p.stock}</div>
                  </div>
                  <Badge className={p.status === "approved" ? "bg-success text-success-foreground" : p.status === "pending" ? "bg-primary/20 text-primary" : "bg-destructive text-destructive-foreground"}>{p.status}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <SellerOrdersWidget orders={orders} filter={orderFilter} onFilterChange={setOrderFilter} />
          {(() => {
            const visible = filterOrders(orders, orderFilter);
            if (orders.length === 0) return (<Card className="p-12 text-center border-dashed"><ShoppingBag className="h-16 w-16 mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">No orders yet for your products.</p></Card>);
            if (visible.length === 0) return (<Card className="p-12 text-center border-dashed"><ShoppingBag className="h-16 w-16 mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">No orders match this filter.</p></Card>);
            return (
              <div className="space-y-4">
                {visible.map((o: any) => {
                  const myTotal = o.my_items.reduce((s: number, it: any) => s + Number(it.unitPrice) * it.quantity, 0);
                  const createdAt = o.created_at ? new Date(o.created_at) : new Date();
                  return (
                    <Card key={o.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Order #{String(o.id).slice(0, 8)}</div>
                          <div className="text-sm">{createdAt.toLocaleString("en-LK")}</div>
                        </div>
                        <Badge>{o.status.toUpperCase()}</Badge>
                      </div>
                      <OrderStatusTimeline status={o.status as OrderStatus} />
                      <Separator className="my-3" />
                      <div className="space-y-1 mb-3 text-sm">
                        {o.my_items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.productName} x{it.quantity}</span>
                            <span>{formatLKR(it.unitPrice * it.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5 text-sm pt-2 border-t">
                        <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span>{o.shipping_address}</span></div>
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /><span>{o.shipping_phone}</span></div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t">
                        <span className="font-display font-bold text-primary">Your portion: {formatLKR(myTotal)}</span>
                        {o.status !== "delivered" && o.status !== "cancelled" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Update status:</Label>
                            <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v as OrderStatus)}>
                              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
﻿
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div><Label>Product Name *</Label><Input required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Brand</Label><Input maxLength={60} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>SKU</Label><Input maxLength={60} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} /></div>
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Selling Price *</Label><Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Original Price</Label><Input type="number" min="0" step="0.01" placeholder="For discount" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></div>
              <div><Label>Stock *</Label><Input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sizes (comma-separated)</Label><Input placeholder="S, M, L, XL" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} /></div>
            <Separator />
            <div>
              <Label>Main Image</Label>
              {form.image_url && <img src={form.image_url} alt="" className="h-24 w-24 rounded-lg object-cover mb-2 border" />}
              <label className="flex items-center justify-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted transition-smooth mb-2">
                <Upload className="h-4 w-4" /><span className="text-sm">{uploading ? "Uploading..." : "Click to upload main image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleMainUpload} disabled={uploading} />
              </label>
              <Input placeholder="Or paste image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div>
              <Label>Additional Images</Label>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeGalleryImage(i)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-smooth">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted transition-smooth">
                <Upload className="h-4 w-4" /><span className="text-sm">{uploading ? "Uploading..." : "Add gallery images"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} disabled={uploading || form.images.length >= 8} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="hero" disabled={saving || uploading}>{saving ? "Saving..." : editing ? "Update Product" : "Submit for Approval"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerDashboard;
