import { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
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
import { Plus, Package, Trash2, Edit, Upload, ShoppingBag, MapPin, Phone, BarChart2, BadgeCheck, Clock, XCircle, CheckCircle2, Send, Star, User, ExternalLink, ImagePlus } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { OrderStatusTimeline, OrderStatus } from "@/components/OrderStatusTimeline";
import { SellerOrdersWidget, FilterKey, filterOrders } from "@/components/SellerOrdersWidget";
import { SellerAnalytics } from "@/components/SellerAnalytics";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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

  // Verification state
  const [verif, setVerif] = useState<any>(null);
  const [verifLoading, setVerifLoading] = useState(true);
  const [verifForm, setVerifForm] = useState({ business_name: "", business_type: "", phone: "", notes: "" });
  const [verifSaving, setVerifSaving] = useState(false);

  // Shop profile state
  const [profileForm, setProfileForm] = useState({ bio: "", banner_url: "", shop_name: "", full_name: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("bio, banner_url, shop_name, full_name")
      .eq("id", user.id)
      .single();
    if (data) setProfileForm({ bio: data.bio ?? "", banner_url: data.banner_url ?? "", shop_name: data.shop_name ?? "", full_name: data.full_name ?? "" });
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ bio: profileForm.bio || null, banner_url: profileForm.banner_url || null, shop_name: profileForm.shop_name || null, full_name: profileForm.full_name || null })
      .eq("id", user.id);
    setProfileSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shop profile updated!");
  };

  const uploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setBannerUploading(true);
    const ext = file.name.split(".").pop();
    const path = `banners/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setBannerUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setProfileForm((f) => ({ ...f, banner_url: pub.publicUrl }));
    setBannerUploading(false);
    e.target.value = "";
  };

  const refreshVerif = async () => {
    if (!user) return;
    setVerifLoading(true);
    const { data } = await (supabase as any)
      .from("verification_requests")
      .select("*")
      .eq("seller_id", user.id)
      .maybeSingle();
    setVerif(data ?? null);
    if (data) {
      setVerifForm({ business_name: data.business_name, business_type: data.business_type, phone: data.phone, notes: data.notes ?? "" });
    }
    setVerifLoading(false);
  };

  const submitVerif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setVerifSaving(true);
    const payload = { seller_id: user.id, ...verifForm, status: "pending", updated_at: new Date().toISOString() };
    const { error } = await (supabase as any)
      .from("verification_requests")
      .upsert(payload, { onConflict: "seller_id" });
    setVerifSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Verification request submitted!");
    refreshVerif();
  };

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
    refresh(); refreshOrders(); refreshVerif(); loadProfile();
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
    if (url) {
      setForm((f) => ({
        ...f,
        image_url: url,
        images: f.images.includes(url) ? f.images : [url, ...f.images].slice(0, 8),
      }));
      toast.success("Image uploaded");
    }
    setUploading(false); e.target.value = "";
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) { const u = await uploadFile(f); if (u) urls.push(u); }
    setForm((f) => {
      const merged = [...f.images, ...urls].slice(0, 8);
      return { ...f, image_url: f.image_url || merged[0] || "", images: merged };
    });
    setUploading(false);
    if (urls.length) toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added`);
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
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl">Seller Dashboard</h1>
          <p className="text-muted-foreground">Manage your products</p>
        </div>
        <div className="flex gap-2">
          {user && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/seller/${user.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> View Shop
              </Link>
            </Button>
          )}
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
        </div>
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
          <TabsTrigger value="analytics"><BarChart2 className="h-4 w-4 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="verification">
            <BadgeCheck className="h-4 w-4 mr-1 text-blue-500" /> Verification
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1" /> Profile
          </TabsTrigger>
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
        <TabsContent value="analytics">
          <SellerAnalytics orders={orders} products={products} />
        </TabsContent>

        <TabsContent value="verification">
          <div className="max-w-lg space-y-4">
            <div>
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-blue-500" /> Seller Verification
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Get a blue verified badge on your products and profile. Submit your details and our team will review within 1-2 business days.
              </p>
            </div>

            {verifLoading ? (
              <Card className="p-6 text-center text-muted-foreground text-sm">Loading…</Card>
            ) : verif?.status === "approved" ? (
              <Card className="p-6 border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-blue-500" />
                  <div>
                    <div className="font-semibold text-blue-700 flex items-center gap-2">
                      Verified Seller <VerifiedBadge size="md" />
                    </div>
                    <div className="text-sm text-blue-600">Your account is verified. The blue tick shows on all your products.</div>
                  </div>
                </div>
                <Separator />
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div><span className="font-medium">Business:</span> {verif.business_name}</div>
                  <div><span className="font-medium">Type:</span> {verif.business_type}</div>
                </div>
              </Card>
            ) : verif?.status === "pending" ? (
              <Card className="p-6 border-yellow-200 bg-yellow-50/30 space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-yellow-500" />
                  <div>
                    <div className="font-semibold text-yellow-700">Under Review</div>
                    <div className="text-sm text-yellow-600">Your request is being reviewed. We'll update your status soon.</div>
                  </div>
                </div>
                <Separator />
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div><span className="font-medium">Business:</span> {verif.business_name}</div>
                  <div><span className="font-medium">Type:</span> {verif.business_type}</div>
                  <div><span className="font-medium">Phone:</span> {verif.phone}</div>
                  {verif.notes && <div><span className="font-medium">Notes:</span> {verif.notes}</div>}
                </div>
              </Card>
            ) : (
              <Card className="p-5 space-y-4">
                {verif?.status === "rejected" && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-destructive text-sm">Previous request rejected</div>
                      {verif.admin_notes && <div className="text-sm text-muted-foreground mt-0.5">Reason: {verif.admin_notes}</div>}
                      <div className="text-sm text-muted-foreground mt-0.5">You can update and resubmit below.</div>
                    </div>
                  </div>
                )}
                <form onSubmit={submitVerif} className="space-y-3">
                  <div>
                    <Label>Business Name *</Label>
                    <Input required placeholder="e.g. Dino Electronics" value={verifForm.business_name}
                      onChange={(e) => setVerifForm({ ...verifForm, business_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Business Type *</Label>
                    <Select value={verifForm.business_type} onValueChange={(v) => setVerifForm({ ...verifForm, business_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="Private Limited Company">Private Limited Company</SelectItem>
                        <SelectItem value="Individual Seller">Individual Seller</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input required placeholder="+94 77 123 4567" value={verifForm.phone}
                      onChange={(e) => setVerifForm({ ...verifForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Additional Notes</Label>
                    <Textarea placeholder="Any extra info you'd like us to know…" rows={2} value={verifForm.notes}
                      onChange={(e) => setVerifForm({ ...verifForm, notes: e.target.value })} />
                  </div>
                  <Button variant="hero" type="submit" disabled={verifSaving || !verifForm.business_name || !verifForm.business_type || !verifForm.phone}>
                    {verifSaving ? "Submitting…" : <><Send className="h-4 w-4 mr-1.5" />{verif?.status === "rejected" ? "Resubmit Request" : "Submit Verification Request"}</>}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="max-w-lg space-y-5">
            <p className="text-sm text-muted-foreground">This information is shown on your public storefront.</p>
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <Label>Shop Name</Label>
                <Input
                  value={profileForm.shop_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, shop_name: e.target.value }))}
                  placeholder="My Awesome Shop"
                  maxLength={80}
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>
              <div>
                <Label>Shop Bio</Label>
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Tell customers about your shop, what you sell, and what makes you unique…"
                />
                <p className="text-xs text-muted-foreground mt-1">{profileForm.bio.length}/500</p>
              </div>
              <div>
                <Label>Shop Banner</Label>
                {profileForm.banner_url ? (
                  <div className="relative mt-1 rounded-xl overflow-hidden h-28 bg-muted">
                    <img src={profileForm.banner_url} alt="Banner" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm"
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      <ImagePlus className="h-3.5 w-3.5 mr-1" /> Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-20 mt-1 border-dashed flex-col gap-1"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={bannerUploading}
                  >
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{bannerUploading ? "Uploading…" : "Upload banner image"}</span>
                  </Button>
                )}
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={uploadBanner} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="hero" disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save Profile"}
                </Button>
                {user && (
                  <Button type="button" variant="outline" asChild>
                    <Link to={`/seller/${user.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" /> Preview Shop
                    </Link>
                  </Button>
                )}
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>

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
              <div className="flex items-center justify-between mb-1">
                <Label>Product Images</Label>
                <span className="text-xs text-muted-foreground">{form.images.length} / 8</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">First image is the primary. Click ★ on any image to make it primary.</p>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {/* Primary badge */}
                      {url === form.image_url && (
                        <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded text-[9px] font-bold px-1 py-0.5 leading-none">PRIMARY</div>
                      )}
                      {/* Set primary button */}
                      {url !== form.image_url && (
                        <button
                          type="button"
                          title="Set as primary"
                          onClick={() => setForm((f) => ({ ...f, image_url: url }))}
                          className="absolute top-0.5 left-0.5 bg-black/50 text-yellow-400 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-smooth"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                      {/* Delete button */}
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => {
                          const newImages = form.images.filter((_, j) => j !== i);
                          const newPrimary = url === form.image_url ? (newImages[0] ?? "") : form.image_url;
                          setForm((f) => ({ ...f, images: newImages, image_url: newPrimary }));
                        }}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-smooth"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={`flex items-center justify-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted transition-smooth ${form.images.length >= 8 ? "opacity-40 cursor-not-allowed" : ""}`}>
                <Upload className="h-4 w-4" />
                <span className="text-sm">{uploading ? "Uploading..." : form.images.length === 0 ? "Upload images (up to 8)" : "Add more images"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} disabled={uploading || form.images.length >= 8} />
              </label>
              {form.image_url && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Or paste main image URL</Label>
                  <Input className="mt-1" placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                </div>
              )}
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
