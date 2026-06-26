import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatLKR } from "@/lib/format";
import { Package, ChevronDown, ChevronUp, MapPin, Phone, Search, RotateCcw, Truck, ExternalLink, Wifi, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OrderStatusTimeline, OrderStatus } from "@/components/OrderStatusTimeline";
import { SriLankaDeliveryMap } from "@/components/SriLankaDeliveryMap";
import { toast } from "sonner";

const COURIER_TRACKING_URLS: Record<string, string> = {
  "DHL":              "https://www.dhl.com/lk-en/home/tracking.html?tracking-id=",
  "Domex":            "https://domex.lk/tracking?waybill=",
  "Lanka Logistics":  "https://www.lankalogistics.lk/tracking?waybill=",
  "Kapruka":          "https://www.kapruka.com/track?id=",
  "Pronto":           "https://pronto.lk/track?id=",
};

function getCourierUrl(courier: string, trackingNumber: string): string | null {
  const base = COURIER_TRACKING_URLS[courier];
  if (!base || !trackingNumber) return null;
  return base + encodeURIComponent(trackingNumber);
}

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-accent text-accent-foreground",
  shipped: "bg-primary text-primary-foreground",
  delivered: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const Orders = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("");
  const [tracked, setTracked] = useState<any | null>(null);
  const [tracking, setTracking] = useState(false);
  // Return/refund state
  const [returnedOrders, setReturnedOrders] = useState<Set<string>>(new Set());
  const [returnForm, setReturnForm] = useState<{ orderId: string; reason: string } | null>(null);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [disputeForm, setDisputeForm] = useState<{ orderId: string; reason: string; description: string } | null>(null);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [filedDisputes, setFiledDisputes] = useState<Set<string>>(new Set());

  const loadOrders = async () => {
    if (!user) return;
    try {
      const { data: ords, error } = await (supabase as any)
        .from("orders")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // For each order, fetch its items
      const ordersWithItems = await Promise.all((ords ?? []).map(async (o: any) => {
        const { data: items } = await (supabase as any)
          .from("order_items")
          .select("*")
          .eq("order_id", o.id);
        return { ...o, order_items: items ?? [] };
      }));
      setOrders(ordersWithItems);
    } catch (e: any) {
      console.error("Orders load error:", e);
      setOrders([]); // silently show empty — don't error-toast the user
    } finally {
      setLoading(false);
    }
  };

  const loadReturnRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("return_requests")
      .select("order_id")
      .eq("customer_id", user.id);
    if (data) {
      setReturnedOrders(new Set(data.map((r: any) => r.order_id)));
    }
  };

  useEffect(() => {
    if (!user) return;
    loadOrders();
    loadReturnRequests();

    // Realtime — live order status updates (no refresh needed)
    const channel = supabase
      .channel(`orders-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
          // Flash highlight for 3s
          setRecentlyUpdated((prev) => new Set([...prev, updated.id]));
          setTimeout(() => setRecentlyUpdated((prev) => { const n = new Set(prev); n.delete(updated.id); return n; }), 3000);

          const statusLabels: Record<string, string> = {
            pending: "⏳ Pending",
            confirmed: "✅ Confirmed",
            shipped: "🚚 Shipped",
            delivered: "📦 Delivered!",
            cancelled: "❌ Cancelled",
          };
          toast.success(
            `Order #${String(updated.id).slice(0, 8).toUpperCase()} — ${statusLabels[updated.status] ?? updated.status}`,
            { description: updated.tracking_number ? `Tracking: ${updated.courier} ${updated.tracking_number}` : undefined, duration: 5000 }
          );
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Use user.id not user — prevents re-fire on every JWT token refresh

  const handleTrack = async () => {
    const id = trackId.trim();
    if (!id) return;
    setTracking(true);
    setTracked(null);
    const { data, error } = await (supabase as any)
      .from("orders")
      .select("*")
      .or(`id.eq.${id},order_number.ilike.${id}%`)
      .limit(1)
      .maybeSingle();
    setTracking(false);
    if (error || !data) {
      toast.error("Order not found");
      return;
    }
    // Fetch items separately — avoid nested join RLS recursion
    const { data: items } = await (supabase as any)
      .from("order_items")
      .select("*")
      .eq("order_id", data.id);
    setTracked({ ...data, order_items: items ?? [] });
  };

  const submitReturn = async () => {
    if (!returnForm || !user) return;
    if (!returnForm.reason.trim()) {
      toast.error("Please describe the reason for your return/refund request.");
      return;
    }
    setSubmittingReturn(true);
    const { error } = await supabase.from("return_requests").insert({
      order_id: returnForm.orderId,
      customer_id: user.id,
      reason: returnForm.reason.trim(),
    });
    setSubmittingReturn(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnedOrders((prev) => new Set([...prev, returnForm.orderId]));
    setReturnForm(null);
    toast.success("Return/refund request submitted. The admin will review it shortly.");
  };

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (user && roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (loading) return <div className="container py-12 text-center">Loading...</div>;

  const handleDownload = async (filePath: string, productName: string) => {
    const { data, error } = await supabase.storage
      .from("digital-files")
      .createSignedUrl(filePath, 60 * 60); // 1 hour expiry
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = productName || "download";
    a.click();
    toast.success("Download started!");
  };

  const submitDispute = async () => {
    if (!disputeForm || !user) return;
    if (!disputeForm.reason.trim() || !disputeForm.description.trim()) { toast.error("Please fill in all fields"); return; }
    setSubmittingDispute(true);
    const order = orders.find((o: any) => o.id === disputeForm.orderId);
    if (!order) { setSubmittingDispute(false); return; }
    const { error } = await (supabase as any).from("disputes").insert({
      order_id: disputeForm.orderId,
      buyer_id: user.id,
      seller_id: order.seller_id || order.order_items?.[0]?.seller_id,
      reason: disputeForm.reason,
      description: disputeForm.description,
    });
    setSubmittingDispute(false);
    if (error) { toast.error(error.message); return; }
    setFiledDisputes((prev) => new Set([...prev, disputeForm.orderId]));
    setDisputeForm(null);
    toast.success("Dispute filed — admin will review shortly");
  };

  const renderOrderCard = (o: any, opts: { expandable?: boolean } = { expandable: true }) => {
    const isOpen = opts.expandable ? expanded === o.id : true;
    const createdAt = o.created_at ? new Date(o.created_at) : new Date();
    const orderItems: any[] = o.order_items ?? [];
    const alreadyRequested = returnedOrders.has(o.id);
    const isReturnFormOpen = returnForm?.orderId === o.id;
    const justUpdated = recentlyUpdated.has(o.id);
    return (
      <Card key={o.id} className={`p-5 transition-all duration-500 ${justUpdated ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Order #{String(o.id).slice(0, 8)}</div>
            <div className="text-sm">{createdAt.toLocaleString("en-LK")}</div>
          </div>
          <Badge className={statusColors[o.status]}>{String(o.status).toUpperCase()}</Badge>
        </div>

        <OrderStatusTimeline status={o.status as OrderStatus} />

        {/* Courier tracking banner */}
        {o.tracking_number && (
          <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">{o.courier} tracking</div>
                <div className="font-mono text-sm font-medium">{o.tracking_number}</div>
              </div>
            </div>
            {getCourierUrl(o.courier, o.tracking_number) && (
              <a
                href={getCourierUrl(o.courier, o.tracking_number)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Track Live
                </Button>
              </a>
            )}
          </div>
        )}

        {o.status !== "cancelled" && (
          <div className="mb-3">
            <SriLankaDeliveryMap
              status={o.status as OrderStatus}
              shippingAddress={o.shipping_address || ""}
            />
          </div>
        )}

        <Separator className="my-3" />

        <div className="space-y-2 mb-3 text-sm">
          {orderItems.map((it: any, idx: number) => {
            // Use product_snapshot (captured at order time) as primary source
            const snap = it.product_snapshot ?? {};
            const img = snap.image_url || (snap.images && snap.images[0]) || it.product?.image_url || it.product?.images?.[0];
            const isDigital = snap.is_digital ?? it.product?.is_digital ?? false;
            const digitalUrl = snap.digital_file_url ?? it.product?.digital_file_url;
            return (
              <div key={idx} className="flex items-center gap-3">
                {img ? (
                  <img src={img} alt={it.product_name} className="h-12 w-12 rounded object-cover border" />
                ) : (
                  <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{it.product_name || snap.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {isDigital ? (
                      <span className="text-purple-600 font-medium">⬇️ Digital</span>
                    ) : (
                      <span>Qty {it.quantity}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{formatLKR(it.unit_price * it.quantity)}</div>
                  {isDigital && digitalUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-purple-400/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                      onClick={() => handleDownload(digitalUrl, it.product_name)}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-3 border-t text-sm">
          <span className="text-muted-foreground">
            {o.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
          </span>
          <span className="font-display font-bold text-primary text-lg">{formatLKR(o.total_amount)}</span>
        </div>

        {/* Return / Refund button — only for delivered orders */}
        {o.status === "delivered" && opts.expandable && (
          <div className="mt-3 pt-3 border-t">
            {alreadyRequested ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="h-4 w-4" />
                Return/refund request submitted — awaiting admin review.
              </div>
            ) : isReturnFormOpen ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Describe the issue (e.g. damaged item, wrong product received…)"
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitReturn} disabled={submittingReturn}>
                    {submittingReturn ? "Submitting…" : "Submit Request"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReturnForm(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setReturnForm({ orderId: o.id, reason: "" })}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Request Return / Refund
              </Button>
            )}
          </div>
        )}

        {/* Dispute Resolution */}
        {["confirmed","processing","shipped","delivered"].includes(o.status) && opts.expandable && (
          <div className="mt-2 pt-2 border-t">
            {filedDisputes.has(o.id) ? (
              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                <span>⚖️</span>
                Dispute submitted — under admin review.
              </div>
            ) : disputeForm?.orderId === o.id ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">File a Dispute</p>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                >
                  <option value="">Select reason…</option>
                  <option value="Item not received">Item not received</option>
                  <option value="Item not as described">Item not as described</option>
                  <option value="Damaged / defective item">Damaged / defective item</option>
                  <option value="Wrong item received">Wrong item received</option>
                  <option value="Counterfeit product">Counterfeit product</option>
                  <option value="Other">Other</option>
                </select>
                <Textarea
                  placeholder="Describe the issue in detail…"
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitDispute} disabled={submittingDispute} className="bg-orange-600 hover:bg-orange-700 text-white">
                    {submittingDispute ? "Submitting…" : "Submit Dispute"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDisputeForm(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm" variant="ghost"
                className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-500/10 text-xs"
                onClick={() => setDisputeForm({ orderId: o.id, reason: "", description: "" })}
              >
                ⚖️ File a Dispute
              </Button>
            )}
          </div>
        )}

        {opts.expandable && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setExpanded(isOpen ? null : o.id)}
          >
            {isOpen ? <><ChevronUp className="h-4 w-4 mr-1" /> Hide details</> : <><ChevronDown className="h-4 w-4 mr-1" /> Shipping details</>}
          </Button>
        )}

        {isOpen && (
          <div className="mt-3 pt-3 border-t space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{o.shipping_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{o.shipping_phone}</span>
            </div>
            {o.notes && <p className="text-muted-foreground italic">"{o.notes}"</p>}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">My Orders</h1>
        <div className="flex items-center gap-1.5 text-xs">
          {realtimeConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-green-600 font-medium">Live updates on</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Connecting…</span>
            </>
          )}
        </div>
      </div>

      {/* Track by ID */}
      <Card className="p-4 mb-6">
        <div className="text-sm font-medium mb-2">Track an order</div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter Order ID (e.g. 8a3f...)"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          />
          <Button onClick={handleTrack} disabled={tracking}>
            <Search className="h-4 w-4 mr-1" /> {tracking ? "..." : "Track"}
          </Button>
        </div>
        {tracked && (
          <div className="mt-4">
            {renderOrderCard(tracked, { expandable: false })}
          </div>
        )}
      </Card>

      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No orders yet.</p>
          <Link to="/products" className="text-primary hover:underline">Start shopping</Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => renderOrderCard(o))}
        </div>
      )}
    </div>
  );
};

export default Orders;