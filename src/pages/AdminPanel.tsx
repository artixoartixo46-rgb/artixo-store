import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Package, Check, X, Shield, LayoutDashboard, ShoppingBag, Users, ClipboardList,
  TrendingUp, DollarSign, Search, LogOut, Store, Image as ImageIcon, Clock, RotateCcw, Paintbrush, BadgeCheck,
  Bug, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2, Gift, Banknote,
} from "lucide-react";
import { formatLKR } from "@/lib/format";
import { AdminProductsSection } from "@/components/admin/AdminProductsSection";
import { AdminBannersSection } from "@/components/admin/AdminBannersSection";
import { AdminCustomizeSection } from "@/components/admin/AdminCustomizeSection";
import { AdminErrorMonitor } from "@/components/admin/AdminErrorMonitor";
import { AdminAffiliatesSection } from "@/components/admin/AdminAffiliatesSection";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Label } from "@/components/ui/label";

const generateReceiptPDF = (order: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(255, 209, 0);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(141, 21, 58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ARTIXO", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Order Receipt", pageWidth - 14, 18, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const createdAt = order.createdAt?.toDate?.() ?? new Date();
  doc.text(`Date: ${createdAt.toLocaleString("en-LK")}`, 14, 46);
  doc.text(`Status: ${String(order.status).toUpperCase()}`, 14, 51);
  doc.text(`Payment: ${String(order.paymentMethod).toUpperCase()}`, 14, 56);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Customer Details", 14, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 74;
  doc.text(`Name: ${order.customerName ?? "—"}`, 14, y); y += 5;
  doc.text(`Email: ${order.customerEmail ?? "—"}`, 14, y); y += 5;
  doc.text(`Phone: ${order.shippingPhone ?? "—"}`, 14, y); y += 5;
  const addrLines = doc.splitTextToSize(`Address: ${order.shippingAddress ?? "—"}`, pageWidth - 28);
  doc.text(addrLines, 14, y);
  y += addrLines.length * 5 + 4;
  if (order.notes) {
    const noteLines = doc.splitTextToSize(`Notes: ${order.notes}`, pageWidth - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 5 + 4;
  }
  const items = order.items ?? [];
  autoTable(doc, {
    startY: y + 2,
    head: [["#", "Product", "Qty", "Unit Price", "Subtotal"]],
    body: items.map((it: any, i: number) => [i + 1, it.productName, it.quantity, formatLKR(it.unitPrice), formatLKR(Number(it.unitPrice) * Number(it.quantity))]),
    headStyles: { fillColor: [141, 21, 58], textColor: 255 },
    styles: { fontSize: 9 },
  });
  const finalY = (doc as any).lastAutoTable.finalY ?? y + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: ${formatLKR(order.totalAmount)}`, pageWidth - 14, finalY + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Thank you for shopping with ARTIXO!", pageWidth / 2, 285, { align: "center" });
  doc.save(`receipt-${order.id.slice(0, 8)}.pdf`);
};

type Section = "dashboard" | "pending" | "products" | "orders" | "sellers" | "banners" | "returns" | "customize" | "verifications" | "errors" | "affiliates";

const navItems: { key: Section; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pending", label: "Pending Approval", icon: ClipboardList },
  { key: "products", label: "All Products", icon: ShoppingBag },
  { key: "orders", label: "Orders", icon: Package },
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "sellers", label: "Sellers", icon: Users },
  { key: "verifications", label: "Verifications", icon: BadgeCheck },
  { key: "returns", label: "Returns", icon: RotateCcw },
  { key: "customize", label: "Customize Site", icon: Paintbrush },
  { key: "errors", label: "Error Monitor", icon: Bug },
  { key: "affiliates", label: "Affiliates", icon: Gift },
];

const AdminPanel = () => {
  const { user, roles, loading: authLoading, signOut } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [pending, setPending] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [pendingSellers, setPendingSellers] = useState<any[]>([]);
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [verifRequests, setVerifRequests] = useState<any[]>([]);
  const [adminNoteMap, setAdminNoteMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [addSellerEmail, setAddSellerEmail] = useState("");
  const [addingsel, setAddingsel] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const channelRef = useRef<any>(null);

  const refresh = async () => {
    const [pRes, aRes, oRes, uRes, rRes, oiRes, psRes, rrRes] = await Promise.all([
      supabase.from("products").select("*").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("products").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("order_items").select("*, product:products(image_url, images)"),
      supabase.from("user_roles").select("user_id, role").eq("role", "pending_seller"),
      supabase.from("return_requests").select("*, profiles!return_requests_customer_id_fkey(full_name, email)").order("created_at", { ascending: false }),
    ]);

    const usersMap: Record<string, any> = {};
    (uRes.data ?? []).forEach((u: any) => { usersMap[u.id] = u; });

    const rolesByUser: Record<string, string[]> = {};
    (rRes.data ?? []).forEach((r: any) => {
      (rolesByUser[r.user_id] ||= []).push(r.role);
    });

    const itemsByOrder: Record<string, any[]> = {};
    (oiRes.data ?? []).forEach((it: any) => {
      const img = it.product?.image_url ?? it.product?.images?.[0] ?? null;
      (itemsByOrder[it.order_id] ||= []).push({
        productName: it.product_name,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        imageUrl: img,
      });
    });

    const pendingList = (pRes.data ?? []).map((p: any) => ({
      ...p,
      imageUrl: p.image_url,
      sellerProfile: usersMap[p.seller_id] ?? null,
    }));

    const productList = (aRes.data ?? []).map((p: any) => ({ ...p, imageUrl: p.image_url }));

    const orderList = (oRes.data ?? []).map((o: any) => {
      const customer = usersMap[o.customer_id] ?? null;
      return {
        ...o,
        items: itemsByOrder[o.id] ?? [],
        createdAt: o.created_at ? new Date(o.created_at) : new Date(),
        totalAmount: o.total_amount,
        paymentMethod: o.payment_method,
        shippingAddress: o.shipping_address,
        shippingPhone: o.shipping_phone,
        customerName: customer?.full_name ?? null,
        customerEmail: customer?.email ?? null,
      };
    });

    const sellerList = Object.entries(usersMap)
      .filter(([id]) => (rolesByUser[id] ?? []).includes("seller"))
      .map(([id, u]: any) => ({ id, shopName: u.shop_name, fullName: u.full_name, email: u.email }));

    const pendingSellerList = (psRes.data ?? []).map((r: any) => {
      const u = usersMap[r.user_id] ?? {};
      return { userId: r.user_id, shopName: u.shop_name ?? "—", fullName: u.full_name ?? "—", email: u.email ?? "—" };
    });
    setPendingSellers(pendingSellerList);
    const rrList = (rrRes.data ?? []).map((r: any) => ({
      id: r.id,
      orderId: r.order_id,
      reason: r.reason,
      status: r.status,
      adminNote: r.admin_note,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      customerName: r.profiles?.full_name ?? "—",
      customerEmail: r.profiles?.email ?? "—",
    }));
    setReturnRequests(rrList);
    setPending(pendingList);
    setAllProducts(productList);
    setOrders(orderList);
    setSellers(sellerList);

    // Load verification requests (table may not exist yet — fail silently)
    const vrRes = await (supabase as any)
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const vrData = vrRes.error ? [] : (vrRes.data ?? []);
    const vrList = vrData.map((vr: any) => ({
      ...vr,
      sellerName: usersMap[vr.seller_id]?.full_name ?? "—",
      sellerEmail: usersMap[vr.seller_id]?.email ?? "—",
      shopName: usersMap[vr.seller_id]?.shop_name ?? "—",
    }));
    setVerifRequests(vrList);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order ${status}`);
    // Send status update email asynchronously
    supabase.functions
      .invoke("send-order-confirmation", { body: { order_id: id, is_update: true } })
      .catch((e) => console.error("Status email error:", e));
    refresh();
  };



  const updateReturn = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("return_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Return request ${status}.`);
    refresh();
  };

  const reviewVerif = async (vr: any, action: "approved" | "rejected") => {
    const adminNote = adminNoteMap[vr.id] ?? "";
    // Update request status
    const { error: vrErr } = await (supabase as any)
      .from("verification_requests")
      .update({ status: action, admin_notes: adminNote, reviewed_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", vr.id);
    if (vrErr) { toast.error(vrErr.message); return; }

    // Update is_verified on profiles (column may not exist yet — ignore error)
    await (supabase as any)
      .from("profiles")
      .update({ is_verified: action === "approved" })
      .eq("id", vr.seller_id);

    toast.success(`Verification ${action} for ${vr.sellerName || vr.sellerEmail}`);
    refresh();
  };

  const addSeller = async () => {
    const email = addSellerEmail.trim().toLowerCase();
    if (!email) return;
    setAddingsel(true);
    // Look up user by email in profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();
    if (profileErr || !profile) {
      toast.error("User not found. They must sign up first.");
      setAddingsel(false);
      return;
    }
    // Check if already a seller
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", profile.id)
      .eq("role", "seller")
      .maybeSingle();
    if (existing) {
      toast.info("This user is already a seller.");
      setAddingsel(false);
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: profile.id, role: "seller" });
    if (error) { toast.error(error.message); setAddingsel(false); return; }
    toast.success(`${profile.full_name ?? email} is now a seller!`);
    setAddSellerEmail("");
    setAddingsel(false);
    refresh();
  };
  const approveSeller = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "pending_seller");
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "seller" });
    if (error) { toast.error(error.message); return; }
    toast.success("Seller approved! They can now access the seller dashboard.");
    refresh();
  };

  const rejectSeller = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "pending_seller");
    toast.success("Application rejected.");
    refresh();
  };

  // ── Chime sound via Web Audio API (no external file needed) ────────────────
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const freqs = [523, 659, 784]; // C5, E5, G5
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.45);
      });
    } catch {}
  }, []);

  // ── Browser push notification ────────────────────────────────────────────
  const pushNotify = useCallback((order: any) => {
    if (!("Notification" in window)) return;
    const send = () => {
      new Notification("🛒 New Order — ARTIXO", {
        body: `Order #${order.order_number ?? order.id?.slice(0, 8)} • ${order.total_amount ? `LKR ${Number(order.total_amount).toLocaleString()}` : ""}`,
        icon: "/icons/icon-192.png",
        tag: "artixo-new-order",
      });
    };
    if (Notification.permission === "granted") {
      send();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => { if (p === "granted") send(); });
    }
  }, []);

  // ── Request notification permission on admin load ────────────────────────
  useEffect(() => {
    if (roles.includes("admin") && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [roles]);

  // ── Supabase Realtime — subscribe to new orders ──────────────────────────
  useEffect(() => {
    if (!roles.includes("admin")) return;

    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as any;
          // Play chime + browser notification
          playChime();
          pushNotify(order);
          // In-app toast
          toast.success(
            `🛒 New order! #${order.order_number ?? order.id?.slice(0, 8)} — LKR ${Number(order.total_amount ?? order.total ?? 0).toLocaleString()}`,
            {
              duration: 8000,
              action: { label: "View", onClick: () => setSection("orders") },
            }
          );
          setNewOrderCount((c) => c + 1);
          refresh();
        }
      )
      .subscribe((status) => setLiveConnected(status === "SUBSCRIBED"));

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roles]);

  useEffect(() => {
    if (roles.includes("admin")) refresh();
  }, [roles]);

  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    return {
      revenue: totalRevenue,
      orders: orders.length,
      products: allProducts.length,
      pendingProducts: pending.length,
      pendingOrders,
      sellers: sellers.length,
    };
  }, [orders, allProducts, pending, sellers]);

  if (!authLoading && (!user || !roles.includes("admin"))) {
    return (
      <div className="container py-12 max-w-md">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl mb-2">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground mb-4">You don't have admin privileges.</p>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </Card>
      </div>
    );
  }

  const approve = async (id: string) => {
    const { error } = await supabase.from("products").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Product approved & live");
    refresh();
  };

  const reject = async (id: string) => {
    const { error } = await supabase.from("products").update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Product rejected");
    refresh();
  };


  const filteredProducts = allProducts.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">

          <SidebarHeader className="border-b border-white/10">
            <Link to="/admin" className="flex items-center gap-2 px-2 py-3">
              <div className="h-9 w-9 rounded-xl gradient-saffron flex items-center justify-center shrink-0 shadow-lg" style={{boxShadow:"0 2px 12px rgba(255,180,0,0.4)"}}>
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="font-display font-bold text-white flex items-center gap-2">
                  Artixo Admin
                  {liveConnected && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" title="Live" />}
                </div>
                <div className="text-xs text-white/50">Control Center</div>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton isActive={section === item.key} onClick={() => setSection(item.key)} tooltip={item.label}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.key === "sellers" && pendingSellers.length > 0 && (
                          <Badge className="ml-auto h-5 px-1.5 bg-orange-500 text-white">{pendingSellers.length}</Badge>
                        )}
                        {item.key === "returns" && returnRequests.filter((r) => r.status === "pending").length > 0 && (
                          <Badge className="ml-auto h-5 px-1.5 bg-red-500 text-white">{returnRequests.filter((r) => r.status === "pending").length}</Badge>
                        )}
                        {item.key === "verifications" && verifRequests.filter((r) => r.status === "pending").length > 0 && (
                          <Badge className="ml-auto h-5 px-1.5 bg-blue-500 text-white">{verifRequests.filter((r) => r.status === "pending").length}</Badge>
                        )}
                        {item.key === "pending" && pending.length > 0 && (
                          <Badge className="ml-auto h-5 px-1.5 bg-primary text-primary-foreground">{pending.length}</Badge>
                        )}
                        {item.key === "orders" && newOrderCount > 0 && (
                          <Badge className="ml-auto h-5 px-1.5 bg-green-500 text-white animate-pulse">{newOrderCount}</Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Site</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="View Storefront">
                      <Link to="/"><Store className="h-4 w-4" /><span>View Storefront</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signOut()} tooltip="Sign out">
                  <LogOut className="h-4 w-4" /><span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center gap-3 px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="font-display text-lg font-semibold capitalize">
              {navItems.find((i) => i.key === section)?.label ?? "Dashboard"}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="text-xs text-muted-foreground hidden sm:block">{user?.email}</div>
              <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-6">
            {section === "dashboard" && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Revenue" value={formatLKR(stats.revenue)} icon={DollarSign} accent="gradient-saffron" />
                  <StatCard label="Total Orders" value={stats.orders.toString()} sub={`${stats.pendingOrders} pending`} icon={Package} accent="gradient-royal" />
                  <StatCard label="Products" value={stats.products.toString()} sub={`${stats.pendingProducts} awaiting approval`} icon={ShoppingBag} />
                  <StatCard label="Sellers" value={stats.sellers.toString()} icon={Users} />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Recent Orders</h3>
                      <Button variant="ghost" size="sm" onClick={() => setSection("orders")}>View all</Button>
                    </div>
                    <div className="space-y-2">
                      {orders.slice(0, 5).map((o) => (
                        <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="text-sm">
                            <div className="font-medium">#{o.id.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground">{(o.createdAt?.toDate?.() ?? new Date()).toLocaleDateString("en-LK")}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                            <span className="font-semibold text-primary text-sm">{formatLKR(o.totalAmount)}</span>
                          </div>
                        </div>
                      ))}
                      {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Pending Approvals</h3>
                      <Button variant="ghost" size="sm" onClick={() => setSection("pending")}>Review</Button>
                    </div>
                    <div className="space-y-2">
                      {pending.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{formatLKR(p.price)}</div>
                          </div>
                          <Button size="sm" variant="success" onClick={() => approve(p.id)}><Check className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All caught up ?</p>}
                    </div>
                  </Card>
                </div>
              </>
            )}

            {section === "pending" && (
              <Card className="p-0 overflow-hidden">
                {pending.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Check className="h-10 w-10 mx-auto mb-2 text-success" />
                    All caught up! No products pending approval.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0">
                                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[260px]">{p.name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{p.description}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{p.sellerProfile?.shopName ?? p.sellerProfile?.fullName ?? "—"}</TableCell>
                          <TableCell className="font-medium">{formatLKR(p.price)}</TableCell>
                          <TableCell>{p.stock}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="success" onClick={() => approve(p.id)}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => reject(p.id)}><X className="h-4 w-4 mr-1" /> Reject</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            )}

            {section === "products" && user && <AdminProductsSection adminUserId={user.id} />}
            {section === "banners" && <AdminBannersSection />}
            {section === "customize" && <AdminCustomizeSection />}

            {section === "orders" && (
              <Card className="p-0 overflow-hidden">
                {/* Live indicator + clear badge */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${liveConnected ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{liveConnected ? "Live updates on" : "Connecting..."}</span>
                  </div>
                  {newOrderCount > 0 && (
                    <button
                      onClick={() => setNewOrderCount(0)}
                      className="text-xs text-green-600 font-medium hover:underline"
                    >
                      {newOrderCount} new order{newOrderCount > 1 ? "s" : ""} — mark seen
                    </button>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => {
                      const orderItems: any[] = o.items ?? [];
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="align-top">
                            <div className="font-mono text-xs">#{o.id.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground">{(o.createdAt?.toDate?.() ?? new Date()).toLocaleString("en-LK")}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-2 max-w-[280px]">
                              {orderItems.map((it: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 border">
                                    {it.imageUrl ? (
                                      <img src={it.imageUrl} alt={it.productName} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                                    )}
                                  </div>
                                  <div className="min-w-0 text-xs">
                                    <div className="font-medium truncate">{it.productName}</div>
                                    <div className="text-muted-foreground">× {it.quantity} · {formatLKR(it.unitPrice)}</div>
                                  </div>
                                </div>
                              ))}
                              {orderItems.length === 0 && <span className="text-xs text-muted-foreground">No items</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm align-top">
                            <div className="font-medium">{o.customerName ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{o.customerEmail ?? ""}</div>
                            <div className="text-xs text-muted-foreground mt-1">?? {o.shippingPhone}</div>
                            <div className="text-xs text-muted-foreground mt-1 max-w-[220px]">?? {o.shippingAddress}</div>
                            {o.notes && <div className="text-xs text-muted-foreground mt-1 italic max-w-[220px]">?? {o.notes}</div>}
                          </TableCell>
                          <TableCell className="text-sm uppercase align-top">{o.paymentMethod}</TableCell>
                          <TableCell className="align-top">
                            <Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"}>{o.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary align-top">{formatLKR(o.totalAmount)}</TableCell>
                          <TableCell className="text-right align-top">
                            <div className="flex flex-col gap-1 items-end">
                              <Button size="sm" variant="outline" onClick={() => generateReceiptPDF(o)}><FileDown className="h-3 w-3 mr-1" /> Receipt</Button>
                              {o.status === "pending" && <Button size="sm" variant="success" onClick={() => updateOrderStatus(o.id, "confirmed")}><Check className="h-3 w-3 mr-1" /> Approve</Button>}
                              {o.status === "confirmed" && <Button size="sm" onClick={() => updateOrderStatus(o.id, "shipped")}>Ship</Button>}
                              {o.status === "shipped" && <Button size="sm" variant="success" onClick={() => updateOrderStatus(o.id, "delivered")}>Mark Delivered</Button>}
                              {o.status !== "delivered" && o.status !== "cancelled" && (
                                <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, "cancelled")}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {orders.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {section === "sellers" && (
              <div className="space-y-4">
                {/* Pending Seller Applications */}
                {pendingSellers.length > 0 && (
                  <Card className="p-0 overflow-hidden border-orange-200">
                    <div className="px-4 py-3 border-b bg-orange-50 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="font-semibold text-orange-700">Pending Seller Applications ({pendingSellers.length})</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shop Name</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingSellers.map((s: any) => (
                          <TableRow key={s.userId} className="bg-orange-50/50">
                            <TableCell className="font-medium">{s.shopName}</TableCell>
                            <TableCell>{s.fullName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="success" onClick={() => approveSeller(s.userId)}>
                                  <Check className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => rejectSeller(s.userId)}>
                                  <X className="h-3 w-3 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* Add Seller Manually */}
                <Card className="p-4 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Add Seller by Email</label>
                    <Input
                      placeholder="seller@email.com"
                      value={addSellerEmail}
                      onChange={(e) => setAddSellerEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSeller()}
                    />
                  </div>
                  <Button variant="hero" onClick={addSeller} disabled={addingsel}>
                    {addingsel ? "Adding…" : "Add Seller"}
                  </Button>
                </Card>

                {/* Active Sellers */}
                <Card className="p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shop</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.shopName ?? "—"}</TableCell>
                          <TableCell>{s.fullName ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {sellers.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No active sellers yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}


            {section === "returns" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-orange-500" /> Return &amp; Refund Requests
                </h2>
                {returnRequests.length === 0 ? (
                  <Card className="p-12 text-center text-muted-foreground">
                    <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    No return requests yet.
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {returnRequests.map((rr: any) => (
                      <Card key={rr.id} className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <div className="font-medium text-sm">Order #{rr.order_id?.slice(0, 8).toUpperCase()}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{rr.reason ?? "No reason provided"}</div>
                          </div>
                          <Badge variant={rr.status === "pending" ? "outline" : rr.status === "approved" ? "success" : "destructive"}>
                            {rr.status}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === "verifications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-blue-500" /> Seller Verification Requests
                  </h2>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="bg-yellow-100 text-yellow-700 rounded px-2 py-0.5 font-medium">
                      {verifRequests.filter((r) => r.status === "pending").length} pending
                    </span>
                    <span className="bg-green-100 text-green-700 rounded px-2 py-0.5 font-medium">
                      {verifRequests.filter((r) => r.status === "approved").length} approved
                    </span>
                  </div>
                </div>
                {verifRequests.length === 0 ? (
                  <Card className="p-12 text-center text-muted-foreground">
                    <BadgeCheck className="h-10 w-10 mx-auto mb-2 text-blue-400" />
                    No verification requests yet.
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {verifRequests.map((vr) => (
                      <Card key={vr.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{vr.sellerName}</span>
                              {vr.status === "approved" && <VerifiedBadge size="sm" />}
                              {vr.status === "pending" && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending</Badge>}
                              {vr.status === "approved" && <Badge className="bg-green-100 text-green-700 text-xs">Approved</Badge>}
                              {vr.status === "rejected" && <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground">{vr.sellerEmail}</div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(vr.created_at).toLocaleDateString("en-LK")}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                          <div><span className="text-muted-foreground text-xs">Business</span><div className="font-medium">{vr.business_name}</div></div>
                          <div><span className="text-muted-foreground text-xs">Type</span><div className="font-medium">{vr.business_type}</div></div>
                          <div><span className="text-muted-foreground text-xs">Phone</span><div className="font-medium">{vr.phone}</div></div>
                          {vr.notes && (
                            <div className="col-span-full"><span className="text-muted-foreground text-xs">Notes</span><div className="font-medium">{vr.notes}</div></div>
                          )}
                          {vr.admin_notes && (
                            <div className="col-span-full"><span className="text-muted-foreground text-xs">Admin Notes</span><div className="font-medium text-muted-foreground">{vr.admin_notes}</div></div>
                          )}
                        </div>
                        {vr.status === "pending" && (
                          <div className="space-y-2 pt-1 border-t">
                            <Textarea
                              rows={1}
                              placeholder="Admin note (optional, shown to seller on rejection)"
                              value={adminNoteMap[vr.id] ?? ""}
                              onChange={(e) => setAdminNoteMap((m) => ({ ...m, [vr.id]: e.target.value }))}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="success" onClick={() => reviewVerif(vr, "approved")}>
                                <Check className="h-3 w-3 mr-1" /> Approve & Verify
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => reviewVerif(vr, "rejected")}>
                                <X className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        )}
                        {vr.status !== "pending" && (
                          <div className="flex gap-2 pt-1 border-t">
                            <Button size="sm" variant="outline" onClick={() => reviewVerif(vr, vr.status === "approved" ? "rejected" : "approved")}>
                              {vr.status === "approved" ? <><X className="h-3 w-3 mr-1" /> Revoke</> : <><Check className="h-3 w-3 mr-1" /> Approve</>}
         
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === "errors" && <AdminErrorMonitor />}

            {section === "affiliates" && <AdminAffiliatesSection />}

          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;
