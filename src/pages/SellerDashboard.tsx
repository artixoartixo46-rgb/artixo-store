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
import { Plus, Package, Trash2, Edit, Upload, ShoppingBag, MapPin, Phone, BarChart2, BadgeCheck, Clock, XCircle, CheckCircle2, Send, Star, User, ExternalLink, ImagePlus, Truck, Printer, Camera, X, Film, Play } from "lucide-react";
import { sendPushToUser } from "@/hooks/usePushNotifications";
import { generateShippingLabel } from "@/lib/generateShippingLabel";
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
  video_url: "",
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
  const [videoUploading, setVideoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [orderFilter, setOrderFilter] = useState<FilterKey>("all");

  // Courier tracking state
  const [trackingForm, setTrackingForm] = useState<{ orderId: string; courier: string; trackingNumber: string } | null>(null);
  const [trackingSaving, setTrackingSaving] = useState(false);

  // Verification state
  const [verif, setVerif] = useState<any>(null);
  const [verifLoading, setVerifLoading] = useState(true);
  const [verifForm, setVerifForm] = useState({ business_name: "", business_type: "", phone: "", notes: "" });
  const [verifSaving, setVerifSaving] = useState(false);

  // Shop profile state
  const [profileForm, setProfileForm] = useState({ bio: "", banner_url: "", avatar_url: "", shop_name: "", full_name: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProfileForm({
      bio: data.shop_description ?? "",
      banner_url: data.banner_url ?? "",
      avatar_url: data.avatar_url ?? "",
      shop_name: data.shop_name ?? "",
      full_name: data.full_name ?? "",
    });
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    // banner_url is stored in Supabase Storage at a predictable path (no DB column needed)
    // avatar_url IS a real DB column — save it
    const payload: any = {
      shop_description: profileForm.bio || null,
      shop_name: profileForm.shop_name || null,
      full_name: profileForm.full_name || null,
    };
    if (profileForm.avatar_url !== undefined) payload.avatar_url = profileForm.avatar_url || null;

    const { error } = await (supabase as any)
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    setProfileSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shop profile updated!");
  };

  const uploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setBannerUploading(true);
    // Delete old banner files for this seller before uploading new one
    try {
      const { data: oldFiles } = await supabase.storage
        .from("product-images")
        .list("banners", { search: user.id });
      if (oldFiles && oldFiles.length > 0) {
        await supabase.storage.from("product-images").remove(oldFiles.map((f) => `banners/${f.name}`));
      }
    } catch (_) { /* ignore cleanup errors */ }
    const ext = file.name.split(".").pop();
    const path = `banners/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setBannerUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const bannerUrl = pub.publicUrl;
    // Save banner_url to DB (column may not exist in older installs — ignore error)
    try { await (supabase as any).from("profiles").update({ banner_url: bannerUrl }).eq("id", user.id); } catch (_) {}
    setProfileForm((f) => ({ ...f, banner_url: bannerUrl }));
    setBannerUploading(false);
    toast.success("Banner updated!");
    e.target.value = "";
  };

  const removeBanner = async () => {
    if (!user) return;
    setBannerUploading(true);
    try {
      const { data: oldFiles } = await supabase.storage
        .from("product-images")
        .list("banners", { search: user.id });
      if (oldFiles && oldFiles.length > 0) {
        await supabase.storage.from("product-images").remove(oldFiles.map((f) => `banners/${f.name}`));
      }
    } catch (_) { /* ignore */ }
    try { await (supabase as any).from("profiles").update({ banner_url: null }).eq("id", user.id); } catch (_) {}
    setProfileForm((f) => ({ ...f, banner_url: "" }));
    setBannerUploading(false);
    toast.success("Banner removed");
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;  // Overwrite same file each time
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setAvatarUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`; // Cache bust
    setProfileForm((f) => ({ ...f, avatar_url: avatarUrl }));
    // Auto-save avatar_url to DB immediately
    await (supabase as any).from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    setAvatarUploading(false);
    toast.success("Profile photo updated!");
    e.target.value = "";
  };

  const refreshVerif = async () => {
    if (!user) return;
    setVerifLoading(true);
    const { data, error } = await (supabase as any)
      .from("verification_requests")
      .select("*")
      .eq("seller_id", user.id)
      .maybeSingle();
    if (error) { setVerifLoading(false); return; } // table may not exist yet
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
    if (error) {
      if (error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        toast.error("Verification system is being set up. Please try again in a moment.");
      } else {
        toast.error(error.message);
      }
      return;
    }
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
      .select("*, orders(id, status, created_at, shipping_address, shipping_phone, total_amount, notes, tracking_number, courier, payment_method)")
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
    if (status === "shipped") {
      setTrackingForm({ orderId, courier: "DHL", trackingNumber: "" });
      return;
    }
    const { data: ord } = await supabase.from("orders").select("customer_id").eq("id", orderId).maybeSingle() as any;
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order marked as ${status}`);
    // Push notification to buyer
    if (ord?.customer_id) {
      const statusMsg: Record<string, string> = {
        confirmed: "Your order has been confirmed! 🎉",
        shipped: "Your order is on its way! 🚚",
        delivered: "Your order has been delivered! ✅",
        cancelled: "Your order has been cancelled.",
      };
      sendPushToUser(ord.customer_id, {
        title: "Order Update — ARTIXO",
        body: statusMsg[status] ?? `Order status: ${status}`,
        url: "/orders",
      }).catch(() => {});
    }
    refreshOrders();
  };

  const saveTrackingAndShip = async () => {
    if (!trackingForm) return;
    setTrackingSaving(true);
    const { error } = await supabase.from("orders").update({
      status: "shipped",
      courier: trackingForm.courier,
      tracking_number: trackingForm.trackingNumber.trim() || null,
    }).eq("id", trackingForm.orderId);
    setTrackingSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked as shipped with tracking info!");
    setTrackingForm(null);
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
      video_url: typeof v.video_url === "string" ? v.video_url : "",
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

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const maxMB = 50;
    if (file.size > maxMB * 1024 * 1024) { toast.error(`Video must be under ${maxMB}MB`); return; }
    setVideoUploading(true);
    const ext = file.name.split(".").pop();
    const path = `videos/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setVideoUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, video_url: pub.publicUrl }));
    setVideoUploading(false);
    toast.success("Video uploaded!");
    e.target.value = "";
  };

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
      variants: { sizes: sizesArr, ...(form.video_url.trim() ? { video_url: form.video_url.trim() } : {}) },
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
                        {o.tracking_number && (
                          <div className="flex items-center gap-2 text-xs bg-muted/60 rounded px-2 py-1.5">
                            <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium">{o.courier}:</span>
                            <span className="font-mono">{o.tracking_number}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-primary">Your portion: {formatLKR(myTotal)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => generateShippingLabel({
                              order: o,
                              seller: { shopName: profileForm.shop_name || profileForm.full_name, phone: user?.email },
                              items: o.my_items,
                            })}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print Label
                          </Button>
                        </div>
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
          <div className="max-w-xl space-y-6">
            <p className="text-sm text-muted-foreground">This info is shown on your public storefront.</p>

            {/* ── BANNER SECTION ── */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Shop Banner</Label>
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 to-secondary/20 border border-border"
                style={{ height: "140px" }}>
                {profileForm.banner_url ? (
                  <img src={profileForm.banner_url} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImagePlus className="h-8 w-8 opacity-40" />
                    <span className="text-xs opacity-60">No banner yet</span>
                  </div>
                )}
                {/* Overlay buttons */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 hover:bg-black/20 transition-all group">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="opacity-0 group-hover:opacity-100 transition-all shadow-lg gap-1.5"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={bannerUploading}
                  >
                    {bannerUploading ? (
                      <><div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /><span>Uploading…</span></>
                    ) : (
                      <><Camera className="h-3.5 w-3.5" />{profileForm.banner_url ? "Change Banner" : "Upload Banner"}</>
                    )}
                  </Button>
                  {profileForm.banner_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="opacity-0 group-hover:opacity-100 transition-all shadow-lg gap-1.5"
                      onClick={removeBanner}
                      disabled={bannerUploading}
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
                {/* Always-visible change button for mobile */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-xs gap-1.5"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={bannerUploading}
                >
                  {bannerUploading ? "Uploading…" : <><Camera className="h-3 w-3" />{profileForm.banner_url ? "Change" : "Upload"}</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Recommended: 1200×400px. JPG or PNG.</p>
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={uploadBanner} />
            </div>

            {/* ── AVATAR SECTION ── */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Profile Photo</Label>
              <div className="flex items-center gap-5">
                {/* Clickable avatar */}
                <div
                  className="relative h-24 w-24 rounded-2xl bg-primary/10 border-2 border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group"
                  onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                  title="Click to change profile photo"
                >
                  {profileForm.avatar_url ? (
                    <img src={profileForm.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-primary font-bold text-3xl">
                      {(profileForm.full_name || profileForm.shop_name || "S")[0].toUpperCase()}
                    </span>
                  )}
                  {/* Camera overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {avatarUploading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-5 w-5 text-white" />
                        <span className="text-white text-[10px] font-medium">Change</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? (
                      <><div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Uploading…</>
                    ) : (
                      <><Camera className="h-4 w-4" /> Upload Photo</>
                    )}
                  </Button>
                  {profileForm.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground gap-1.5 justify-start"
                      onClick={async () => {
                        setProfileForm((f) => ({ ...f, avatar_url: "" }));
                        if (user) await (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id);
                        toast.success("Profile photo removed");
                      }}
                    >
                      <X className="h-3 w-3" /> Remove photo
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP. Max 5MB.</p>
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </div>

            <Separator />

            {/* ── PROFILE FORM ── */}
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Shop Name</Label>
                  <Input
                    value={profileForm.shop_name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, shop_name: e.target.value }))}
                    placeholder="My Awesome Shop"
                    maxLength={80}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Your full name"
                    maxLength={80}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Shop Bio</Label>
                <Textarea
                  rows={4}
                  maxLength={500}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Tell customers about your shop, what you sell, and what makes you unique…"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">{profileForm.bio.length}/500</p>
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

            {/* ── VIDEO SECTION ── */}
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Film className="h-4 w-4 text-primary" />
                <Label>Product Demo Video</Label>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Upload an MP4 (max 50MB) or paste a YouTube link. Buyers can watch the demo on the product page.</p>

              {/* Preview */}
              {form.video_url && (
                <div className="mb-3 relative rounded-xl overflow-hidden bg-black border" style={{ height: "160px" }}>
                  {form.video_url.includes("youtube") || form.video_url.includes("youtu.be") ? (
                    <iframe
                      src={form.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("shorts/", "embed/")}
                      className="w-full h-full"
                      allowFullScreen
                      title="Video preview"
                    />
                  ) : (
                    <video src={form.video_url} controls className="w-full h-full" />
                  )}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, video_url: "" }))}
                    className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Upload button */}
              {!form.video_url && (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer hover:bg-muted transition-smooth mb-2">
                  {videoUploading ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /><span className="text-sm">Uploading video…</span></>
                  ) : (
                    <><Play className="h-4 w-4 text-primary" /><span className="text-sm">Upload video file (MP4, MOV, WebM)</span></>
                  )}
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} disabled={videoUploading} />
                </label>
              )}

              {/* YouTube URL input */}
              <div>
                <Label className="text-xs text-muted-foreground">Or paste YouTube / video URL</Label>
                <Input
                  className="mt-1"
                  placeholder="https://youtube.com/watch?v=... or direct MP4 URL"
                  value={form.video_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="hero" disabled={saving || uploading}>{saving ? "Saving..." : editing ? "Update Product" : "Submit for Approval"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Courier Tracking Dialog — shown when seller selects "Shipped" */}
      <Dialog open={!!trackingForm} onOpenChange={(o) => !o && setTrackingForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />Enter Courier Tracking Info</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Courier / Delivery Service</Label>
              <Select value={trackingForm?.courier ?? "DHL"} onValueChange={(v) => setTrackingForm((f) => f ? { ...f, courier: v } : f)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DHL">DHL Sri Lanka</SelectItem>
                  <SelectItem value="Domex">Domex Courier</SelectItem>
                  <SelectItem value="Lanka Logistics">Lanka Logistics</SelectItem>
                  <SelectItem value="Pronto">Pronto Delivery</SelectItem>
                  <SelectItem value="Kapruka">Kapruka Logistics</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tracking Number (Waybill)</Label>
              <Input
                className="mt-1 font-mono"
                placeholder="e.g. 1234567890"
                value={trackingForm?.trackingNumber ?? ""}
                onChange={(e) => setTrackingForm((f) => f ? { ...f, trackingNumber: e.target.value } : f)}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank if you don't have one yet</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTrackingForm(null)}>Cancel</Button>
              <Button variant="hero" className="flex-1" disabled={trackingSaving} onClick={saveTrackingAndShip}>
                {trackingSaving ? "Saving…" : <><Truck className="h-4 w-4 mr-1.5" />Mark as Shipped</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerDashboard;
