import { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
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
import { Plus, Package, Trash2, Edit, Upload, ShoppingBag, MapPin, Phone, BarChart2, BadgeCheck, Clock, XCircle, CheckCircle2, Send, Star, User, ExternalLink, ImagePlus, Truck, Printer, Camera, X, Film, Play, Wallet, TrendingUp, Banknote, ArrowDownToLine } from "lucide-react";
import { sendPushToUser } from "@/hooks/usePushNotifications";
import { generateShippingLabel } from "@/lib/generateShippingLabel";
import { formatLKR } from "@/lib/format";
import { ReelsTab } from "@/components/ReelsTab";
import { OrderStatusTimeline, OrderStatus } from "@/components/OrderStatusTimeline";
import { SellerOrdersWidget, FilterKey, filterOrders } from "@/components/SellerOrdersWidget";
import { SellerAnalytics } from "@/components/SellerAnalytics";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SellerWallet } from "@/components/seller/SellerWallet";

interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; price: number; stock: number; status: string;
  image_url: string | null; description: string | null; category_id: string | null;
  original_price: number | null; brand: string | null; sku: string | null;
  images: string[]; variants: any; model_url?: string | null;
  is_digital?: boolean; digital_file_url?: string | null;
}

const emptyForm = {
  name: "", description: "", price: "", original_price: "", stock: "",
  category_id: "", image_url: "", brand: "", sku: "",
  images: [] as string[],
  sizes: "",
  video_url: "",
  model_url: "",
  // Digital product fields
  is_digital: false,
  digital_file_url: "",
  // Rental fields
  listing_type: "sale" as "sale" | "rent" | "both",
  rent_price_per_day: "",
  rent_price_per_week: "",
  rent_deposit: "",
  min_rent_days: "1",
};

const SellerDashboard = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
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

  // Earnings / wallet state
  const [sellerBalance, setSellerBalance] = useState(0);
  const [commissionRate, setCommissionRate] = useState(8);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: "", bank_name: "", account_number: "", account_holder: "" });
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

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

  const loadEarnings = async () => {
    if (!user) return;
    const { data: profile } = await (supabase as any).from("profiles").select("seller_balance, commission_rate").eq("id", user.id).maybeSingle();
    if (profile) {
      setSellerBalance(Number(profile.seller_balance ?? 0));
      setCommissionRate(Number(profile.commission_rate ?? settings.default_commission_rate ?? 5));
    }
    const { data: wds } = await (supabase as any).from("withdrawals").select("*").eq("seller_id", user.id).order("requested_at", { ascending: false });
    setWithdrawals(wds ?? []);
  };

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(withdrawalForm.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (amount > sellerBalance) { toast.error(`Max available: ${formatLKR(sellerBalance)}`); return; }
    if (!withdrawalForm.bank_name.trim() || !withdrawalForm.account_number.trim() || !withdrawalForm.account_holder.trim()) {
      toast.error("Please fill all bank details"); return;
    }
    setSubmittingWithdrawal(true);
    // Deduct from balance immediately
    const newBalance = sellerBalance - amount;
    const { error: balErr } = await (supabase as any).from("profiles").upsert({ id: user.id, seller_balance: newBalance }, { onConflict: "id" });
    if (balErr) { toast.error("Balance update failed: " + balErr.message); setSubmittingWithdrawal(false); return; }
    // Insert withdrawal record
    const { error: wdErr } = await (supabase as any).from("withdrawals").insert({
      seller_id: user.id,
      gross_amount: amount,
      commission: 0, // already deducted from earnings
      net_amount: amount,
      bank_name: withdrawalForm.bank_name.trim(),
      account_number: withdrawalForm.account_number.trim(),
      account_holder: withdrawalForm.account_holder.trim(),
      status: "pending",
    });
    if (wdErr) {
      // Rollback balance
      await (supabase as any).from("profiles").upsert({ id: user.id, seller_balance: sellerBalance }, { onConflict: "id" });
      toast.error("Withdrawal request failed: " + wdErr.message);
      setSubmittingWithdrawal(false);
      return;
    }
    setSellerBalance(newBalance);
    setWithdrawalForm({ amount: "", bank_name: "", account_number: "", account_holder: "" });
    setSubmittingWithdrawal(false);
    toast.success("Withdrawal request submitted! Admin will process it within 1-2 business days.");
    loadEarnings();
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

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...payload }, { onConflict: "id" });

    setProfileSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shop profile updated!");
  };

  const uploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setBannerUploading(true);
    // Delete old banner files for this seller first
    const { data: oldFiles } = await supabase.storage
      .from("product-images")
      .list("banners", { search: user.id });
    if (oldFiles && oldFiles.length > 0) {
      await supabase.storage.from("product-images").remove(oldFiles.map((f) => `banners/${f.name}`));
    }
    const ext = file.name.split(".").pop();
    const path = `banners/${user.id}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
    if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); setBannerUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const bannerUrl = pub.publicUrl;
    const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, banner_url: bannerUrl }, { onConflict: "id" });
    if (dbErr) { toast.error("Saved to storage but DB save failed: " + dbErr.message); }
    else { toast.success("Banner updated!"); }
    setProfileForm((f) => ({ ...f, banner_url: bannerUrl }));
    setBannerUploading(false);
    e.target.value = "";
  };

  const removeBanner = async () => {
    if (!user) return;
    setBannerUploading(true);
    const { data: oldFiles } = await supabase.storage
      .from("product-images")
      .list("banners", { search: user.id });
    if (oldFiles && oldFiles.length > 0) {
      await supabase.storage.from("product-images").remove(oldFiles.map((f) => `banners/${f.name}`));
    }
    const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, banner_url: null }, { onConflict: "id" });
    if (dbErr) { toast.error("Could not remove banner from DB: " + dbErr.message); }
    else { toast.success("Banner removed"); }
    setProfileForm((f) => ({ ...f, banner_url: "" }));
    setBannerUploading(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setAvatarUploading(true);
    // Always use a unique path to avoid upsert/ownership conflicts
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;
    // Remove old avatars for this user first
    const { data: oldFiles } = await supabase.storage
      .from("product-images")
      .list("avatars", { search: user.id });
    if (oldFiles && oldFiles.length > 0) {
      await supabase.storage.from("product-images").remove(oldFiles.map((f) => `avatars/${f.name}`));
    }
    const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file);
    if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); setAvatarUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`; // Cache bust
    setProfileForm((f) => ({ ...f, avatar_url: avatarUrl }));
    const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, avatar_url: avatarUrl }, { onConflict: "id" });
    if (dbErr) { toast.error("Saved to storage but DB save failed: " + dbErr.message); }
    else { toast.success("Profile photo updated!"); }
    setAvatarUploading(false);
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

    // Step 1: get all order_items belonging to this seller
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, quantity, unit_price")
      .eq("seller_id", user.id);
    if (itemsError) { console.error("refreshOrders items:", itemsError); return; }
    if (!items || items.length === 0) { setOrders([]); return; }

    // Step 2: fetch the corresponding orders by ID — use select("*") to handle any DB schema state
    const orderIds = [...new Set(items.map((i: any) => i.order_id))];
    const { data: orderRows, error: ordersError } = await (supabase as any)
      .from("orders")
      .select("*")
      .in("id", orderIds);
    if (ordersError) { console.error("refreshOrders orders:", ordersError); return; }

    // Step 3: merge
    const orderMap = new Map<string, any>();
    for (const ord of orderRows ?? []) {
      orderMap.set(ord.id, { ...ord, my_items: [] });
    }
    for (const item of items) {
      const ord = orderMap.get((item as any).order_id);
      if (!ord) continue;
      ord.my_items.push({
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
    const { data: ord } = await supabase.from("orders").select("customer_id, status").eq("id", orderId).maybeSingle() as any;
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order marked as ${status}`);

    // ── Commission credit on delivery ─────────────────────────────────────────
    if (status === "delivered" && ord?.status !== "delivered") {
      const myTotal = orders.find((o) => o.id === orderId)?.my_items
        ?.reduce((s: number, it: any) => s + Number(it.unitPrice) * it.quantity, 0) ?? 0;
      if (myTotal > 0) {
        const { data: profile } = await (supabase as any).from("profiles").select("seller_balance, commission_rate, wallet_tier").eq("id", user!.id).maybeSingle();
        const rate = Number(profile?.commission_rate ?? settings.default_commission_rate ?? 5);
        const commission = parseFloat((myTotal * (rate / 100)).toFixed(2));
        const net = parseFloat((myTotal - commission).toFixed(2));
        const newBalance = Number(profile?.seller_balance ?? 0) + net;
        await (supabase as any).from("profiles").upsert({ id: user!.id, seller_balance: newBalance }, { onConflict: "id" });
        setSellerBalance(newBalance);
        toast.success(`+${formatLKR(net)} credited to your earnings (${rate}% commission: ${formatLKR(commission)})`);

        // ── Deduct commission from seller_wallets (deposit tier) ──────────────
        const walletTier = profile?.wallet_tier ?? "deposit";
        if (walletTier === "deposit") {
          const { data: wallet } = await (supabase as any)
            .from("seller_wallets")
            .select("balance, total_commission")
            .eq("seller_id", user!.id)
            .single();

          if (wallet) {
            const newWalletBal = parseFloat((Number(wallet.balance) - commission).toFixed(2));
            const suspend = newWalletBal <= 0;
            await (supabase as any)
              .from("seller_wallets")
              .update({
                balance: Math.max(0, newWalletBal),
                total_commission: parseFloat((Number(wallet.total_commission) + commission).toFixed(2)),
                is_suspended: suspend,
              })
              .eq("seller_id", user!.id);

            // Log transaction
            await (supabase as any).from("wallet_transactions").insert({
              seller_id: user!.id,
              type: "commission",
              amount: commission,
              balance_after: Math.max(0, newWalletBal),
              order_id: orderId,
              description: `${rate}% commission on order #${orderId.slice(-6).toUpperCase()}`,
            });

            if (suspend) {
              toast.error("⚠️ Commission wallet empty — products suspended. Please top up.", { duration: 6000 });
            } else if (newWalletBal < 400) {
              toast.warning(`Commission wallet low: Rs. ${Math.max(0, newWalletBal).toFixed(2)}. Top up soon.`, { duration: 5000 });
            }
          }
        } else {
          // Invoice tier — just log the owed commission
          await (supabase as any).from("wallet_transactions").insert({
            seller_id: user!.id,
            type: "commission",
            amount: commission,
            balance_after: null,
            order_id: orderId,
            description: `Invoice: ${rate}% commission on order #${orderId.slice(-6).toUpperCase()}`,
          });
          await (supabase as any)
            .from("seller_wallets")
            .update({ total_commission: (supabase as any).raw(`total_commission + ${commission}`) })
            .eq("seller_id", user!.id);
        }
      }
    }

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
    // Build update payload — only include tracking fields if they exist in DB (guarded by try)
    const updatePayload: Record<string, unknown> = { status: "shipped" };
    if (trackingForm.courier) updatePayload.courier = trackingForm.courier;
    if (trackingForm.trackingNumber?.trim()) updatePayload.tracking_number = trackingForm.trackingNumber.trim();
    const { error } = await (supabase as any).from("orders").update(updatePayload).eq("id", trackingForm.orderId);
    setTrackingSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked as shipped with tracking info!");
    setTrackingForm(null);
    refreshOrders();
  };

  useEffect(() => {
    supabase.from("categories").select("id,name").then(({ data }) => setCategories((data ?? []) as Category[]));
    refresh(); refreshOrders(); refreshVerif(); loadProfile(); loadEarnings();
  }, [user]);

  // Realtime: auto-refresh orders when a new order_item arrives for this seller
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items", filter: `seller_id=eq.${user.id}` },
        () => {
          refreshOrders();
          toast.success("🛒 New order received!", { duration: 5000 });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => { refreshOrders(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      model_url: typeof (p as any).model_url === "string" ? (p as any).model_url : "",
      is_digital: !!(p as any).is_digital,
      digital_file_url: typeof (p as any).digital_file_url === "string" ? (p as any).digital_file_url : "",
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

  const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File must be under 100MB"); return; }
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("digital-files").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    setForm((f) => ({ ...f, digital_file_url: path }));
    setUploading(false);
    toast.success("Digital file uploaded!");
    e.target.value = "";
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("3D model must be under 50MB"); return; }
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("3d-models").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("3d-models").getPublicUrl(path);
    setForm((f) => ({ ...f, model_url: pub.publicUrl }));
    setUploading(false);
    toast.success("3D model uploaded!");
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
      model_url: form.model_url.trim() || null,
      is_digital: form.is_digital,
      digital_file_url: form.is_digital ? (form.digital_file_url.trim() || null) : null,
      variants: { sizes: sizesArr, ...(form.video_url.trim() ? { video_url: form.video_url.trim() } : {}) },
      // Rental fields
      listing_type: form.listing_type,
      rent_price_per_day: form.rent_price_per_day ? parseFloat(form.rent_price_per_day) : null,
      rent_price_per_week: form.rent_price_per_week ? parseFloat(form.rent_price_per_week) : null,
      rent_deposit: form.rent_deposit ? parseFloat(form.rent_deposit) : null,
      min_rent_days: form.min_rent_days ? parseInt(form.min_rent_days) : 1,
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
    <div className="container py-5 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your products</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {user && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/seller/${user.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">View </span>Shop
              </Link>
            </Button>
          )}
          <Button variant="hero" size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
        <Card className="p-3 md:p-4"><div className="text-xs text-muted-foreground">Products</div><div className="font-display text-xl md:text-2xl">{products.length}</div></Card>
        <Card className="p-3 md:p-4"><div className="text-xs text-muted-foreground">Live</div><div className="font-display text-xl md:text-2xl text-success">{products.filter((p) => p.status === "approved").length}</div></Card>
        <Card className="p-3 md:p-4"><div className="text-xs text-muted-foreground">Pending</div><div className="font-display text-xl md:text-2xl text-primary">{products.filter((p) => p.status === "pending").length}</div></Card>
      </div>

      <Tabs defaultValue="products">
        <div className="overflow-x-auto scrollbar-none -mx-1 px-1 mb-4">
          <TabsList className="w-max min-w-full flex">
            <TabsTrigger value="products" className="shrink-0"><Package className="h-4 w-4 mr-1" /> Products</TabsTrigger>
            <TabsTrigger value="orders" className="shrink-0"><ShoppingBag className="h-4 w-4 mr-1" /> Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="analytics" className="shrink-0"><BarChart2 className="h-4 w-4 mr-1" /> Analytics</TabsTrigger>
            <TabsTrigger value="verification" className="shrink-0">
              <BadgeCheck className="h-4 w-4 mr-1 text-blue-500" /> Verify
            </TabsTrigger>
            <TabsTrigger value="profile" className="shrink-0">
              <User className="h-4 w-4 mr-1" /> Profile
            </TabsTrigger>
            <TabsTrigger value="earnings" className="shrink-0">
              <Wallet className="h-4 w-4 mr-1" /> Earnings
            </TabsTrigger>
            <TabsTrigger value="commission" className="shrink-0">
              <Banknote className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Commission </span>Wallet
            </TabsTrigger>
          </TabsList>
        </div>

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
                        if (user) {
                          const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, avatar_url: null }, { onConflict: "id" });
                          if (dbErr) toast.error("DB error: " + dbErr.message);
                          else toast.success("Profile photo removed");
                        }
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

        {/* ── EARNINGS TAB ─────────────────────────────────────────────────────── */}
        <TabsContent value="earnings">
          <div className="space-y-6 max-w-2xl">
            {/* Balance cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Available Balance
                </div>
                <div className="font-display text-2xl text-green-600">{formatLKR(sellerBalance)}</div>
                <div className="text-xs text-muted-foreground mt-1">Ready to withdraw</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> Commission Rate
                </div>
                <div className="font-display text-2xl">{commissionRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">ARTIXO platform fee</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Pending Withdrawals
                </div>
                <div className="font-display text-2xl text-orange-500">
                  {withdrawals.filter((w) => w.status === "pending").length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Awaiting admin</div>
              </Card>
            </div>

            {/* Info box */}
            <Card className="p-4 bg-blue-50/30 border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>How it works:</strong> When you mark an order as <em>Delivered</em>, your earnings (minus the {commissionRate}% platform commission) are automatically added to your balance. You can then request a bank transfer any time.
              </p>
            </Card>

            {/* Withdrawal request form */}
            <Card className="p-5">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" /> Request Withdrawal
              </h3>
              <form onSubmit={submitWithdrawal} className="space-y-3">
                <div>
                  <Label>Amount (LKR) *</Label>
                  <Input
                    type="number" min="100" step="0.01"
                    placeholder={`Max: ${formatLKR(sellerBalance)}`}
                    value={withdrawalForm.amount}
                    onChange={(e) => setWithdrawalForm((f) => ({ ...f, amount: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Bank Name *</Label>
                    <Input
                      placeholder="e.g. Commercial Bank"
                      value={withdrawalForm.bank_name}
                      onChange={(e) => setWithdrawalForm((f) => ({ ...f, bank_name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Account Number *</Label>
                    <Input
                      placeholder="e.g. 1234567890"
                      value={withdrawalForm.account_number}
                      onChange={(e) => setWithdrawalForm((f) => ({ ...f, account_number: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Account Holder Name *</Label>
                  <Input
                    placeholder="Name as on bank account"
                    value={withdrawalForm.account_holder}
                    onChange={(e) => setWithdrawalForm((f) => ({ ...f, account_holder: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submittingWithdrawal || sellerBalance <= 0}
                  className="w-full"
                >
                  {submittingWithdrawal ? "Submitting…" : <><ArrowDownToLine className="h-4 w-4 mr-1.5" /> Request Withdrawal</>}
                </Button>
                {sellerBalance <= 0 && (
                  <p className="text-xs text-muted-foreground text-center">No balance available. Mark delivered orders to earn.</p>
                )}
              </form>
            </Card>

            {/* Withdrawal history */}
            {withdrawals.length > 0 && (
              <Card className="p-5">
                <h3 className="font-display text-lg font-semibold mb-4">Withdrawal History</h3>
                <div className="space-y-3">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <div>
                        <div className="text-sm font-medium">{formatLKR(w.net_amount)}</div>
                        <div className="text-xs text-muted-foreground">{w.bank_name} • {w.account_number}</div>
                        <div className="text-xs text-muted-foreground">{w.requested_at ? new Date(w.requested_at).toLocaleDateString("en-LK") : ""}</div>
                      </div>
                      <Badge
                        className={
                          w.status === "approved" ? "bg-green-100 text-green-700 border-green-200" :
                          w.status === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
                          "bg-yellow-100 text-yellow-700 border-yellow-200"
                        }
                      >
                        {w.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── COMMISSION WALLET TAB ──────────────────────────────────────────── */}
        <TabsContent value="commission">
          <div className="max-w-lg">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Commission Wallet</h2>
              <p className="text-sm text-muted-foreground">
                This wallet is used to collect your platform commission (5%). It's separate from your earnings.
              </p>
            </div>
            <SellerWallet />
          </div>
        </TabsContent>

        <TabsContent value="reels">
          <ReelsTab sellerId={user.id} products={products} />
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
            {/* ── Listing Type ── */}
            <div>
              <Label>Listing Type</Label>
              <Select value={form.listing_type} onValueChange={(v) => setForm({ ...form, listing_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">🛒 For Sale Only</SelectItem>
                  <SelectItem value="rent">🔄 For Rent Only</SelectItem>
                  <SelectItem value="both">🛒🔄 For Sale & Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Rental pricing — shown only if listing_type includes rent ── */}
            {(form.listing_type === "rent" || form.listing_type === "both") && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">🔄 Rental Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Price / Day (LKR) *</Label><Input type="number" min="0" step="0.01" placeholder="e.g. 500" value={form.rent_price_per_day} onChange={(e) => setForm({ ...form, rent_price_per_day: e.target.value })} /></div>
                  <div><Label className="text-xs">Price / Week (LKR)</Label><Input type="number" min="0" step="0.01" placeholder="Optional discount" value={form.rent_price_per_week} onChange={(e) => setForm({ ...form, rent_price_per_week: e.target.value })} /></div>
                  <div><Label className="text-xs">Security Deposit (LKR)</Label><Input type="number" min="0" step="0.01" placeholder="Refundable" value={form.rent_deposit} onChange={(e) => setForm({ ...form, rent_deposit: e.target.value })} /></div>
                  <div><Label className="text-xs">Min Rental Days</Label><Input type="number" min="1" max="365" value={form.min_rent_days} onChange={(e) => setForm({ ...form, min_rent_days: e.target.value })} /></div>
                </div>
              </div>
            )}

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

            {/* 3D Model Upload */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">3D</span>
                </div>
                <Label className="font-semibold text-sm">3D / AR Model <span className="text-muted-foreground font-normal">(optional)</span></Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Upload a .glb or .gltf file (max 50MB). Buyers can view in 3D and place the product in AR on their phone.</p>

              {form.model_url ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">GLB</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{form.model_url.split("/").pop()}</p>
                    <p className="text-[10px] text-green-600">Uploaded ✓</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, model_url: "" }))}
                    className="shrink-0 text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer hover:bg-muted transition-smooth">
                  {uploading ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /><span className="text-sm">Uploading 3D model…</span></>
                  ) : (
                    <><span className="text-lg">📦</span><span className="text-sm">Upload .glb / .gltf file</span></>
                  )}
                  <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleModelUpload} disabled={uploading} />
                </label>
              )}
            </div>

            {/* Digital Product */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-purple-500/10 flex items-center justify-center">
                    <span className="text-[10px]">⬇️</span>
                  </div>
                  <Label className="font-semibold text-sm">Digital Product</Label>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_digital: !f.is_digital, digital_file_url: "" }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_digital ? "bg-purple-600" : "bg-muted"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_digital ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {form.is_digital && (
                <div className="space-y-2 pl-1">
                  <p className="text-xs text-muted-foreground">Upload the file buyers will download after purchase (PDF, ZIP, MP3, PSD, etc. — max 100MB).</p>
                  {form.digital_file_url ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-purple-500/5 border-purple-500/20">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <span className="text-lg">📁</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{form.digital_file_url.split("/").pop()}</p>
                        <p className="text-[10px] text-green-600 font-medium">Uploaded ✓</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, digital_file_url: "" }))}
                        className="shrink-0 text-destructive hover:text-destructive/80 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-purple-400/40 rounded-xl p-4 cursor-pointer hover:bg-purple-500/5 transition-smooth">
                      {uploading ? (
                        <><div className="h-4 w-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /><span className="text-sm">Uploading file…</span></>
                      ) : (
                        <><span className="text-xl">📂</span><span className="text-sm text-muted-foreground">Upload digital file (PDF, ZIP, MP3, PSD…)</span></>
                      )}
                      <input type="file" accept=".pdf,.zip,.rar,.mp3,.wav,.psd,.ai,.epub,.docx,.xlsx,.png,.jpg" className="hidden" onChange={handleDigitalFileUpload} disabled={uploading} />
                    </label>
                  )}
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
