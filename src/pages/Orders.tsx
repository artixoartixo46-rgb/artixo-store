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
import { Package, ChevronDown, ChevronUp, MapPin, Phone, Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OrderStatusTimeline, OrderStatus } from "@/components/OrderStatusTimeline";
import { toast } from "sonner";

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

  const loadOrders = async () => {
    if (!user) return;
    const { data: ords, error } = await supabase
      .from("orders")
      .select("*, order_items(*, product:products(image_url, images))")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load orders");
    } else {
      setOrders(ords ?? []);
    }
    setLoading(false);
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

    // Realtime subscription for status updates
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === (payload.new as any).id ? { ...o, ...payload.new } : o))
          );
          toast.info(`Order #${String((payload.new as any).id).slice(0, 8)} -> ${(payload.new as any).status}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTrack = async () => {
    const id = trackId.trim();
    if (!id) return;
    setTracking(true);
    setTracked(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, product:products(image_url, images))")
      .or(`id.eq.${id},id.ilike.${id}%`)
      .limit(1)
      .maybeSingle();
    setTracking(false);
    if (error || !data) {
      toast.error("Order not found");
      return;
    }
    setTracked(data);
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

  const renderOrderCard = (o: any, opts: { expandable?: boolean } = { expandable: true }) => {
    const isOpen = opts.expandable ? expanded === o.id : true;
    const createdAt = o.created_at ? new Date(o.created_at) : new Date();
    const orderItems: any[] = o.order_items ?? [];
    const alreadyRequested = returnedOrders.has(o.id);
    const isReturnFormOpen = returnForm?.orderId === o.id;
    return (
      <Card key={o.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Order #{String(o.id).slice(0, 8)}</div>
            <div className="text-sm">{createdAt.toLocaleString("en-LK")}</div>
          </div>
          <Badge className={statusColors[o.status]}>{String(o.status).toUpperCase()}</Badge>
        </div>

        <OrderStatusTimeline status={o.status as OrderStatus} />

        <Separator className="my-3" />

        <div className="space-y-2 mb-3 text-sm">
          {orderItems.map((it: any, idx: number) => {
            const img = it.product?.image_url || it.product?.images?.[0];
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
                  <div className="truncate">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">Qty {it.quantity}</div>
                </div>
                <div className="font-medium">{formatLKR(it.unit_price * it.quantity)}</div>
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
      <h1 className="font-display text-3xl mb-6">My Orders</h1>

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