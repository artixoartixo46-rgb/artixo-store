import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface OrderInfo {
  id: string;
  status: string;
  shipping_address: string;
  total_amount: number;
  created_at: string;
  delivery_confirmed_at: string | null;
}

export default function ConfirmDelivery() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchOrder();
  }, [token]);

  const fetchOrder = async () => {
    const { data, error } = await supabase
      .rpc("get_order_by_token", { p_token: token });

    if (error || !data || (data as OrderInfo[]).length === 0) {
      setError("Order not found or this link is no longer valid.");
    } else {
      const o = (data as OrderInfo[])[0];
      setOrder(o);
      if (o.delivery_confirmed_at || o.status === "delivered") {
        setConfirmed(true);
      }
    }
    setLoading(false);
  };

  const confirmDelivery = async () => {
    if (!order || !token) return;
    setConfirming(true);

    const { error } = await supabase
      .rpc("confirm_delivery_by_token", { p_token: token, p_order_id: order.id });

    if (error) {
      toast.error("Failed to confirm delivery. Please try again.");
    } else {
      setConfirmed(true);
      setOrder(prev => prev ? { ...prev, status: "delivered" } : null);
      toast.success("Delivery confirmed! Thank you.");
    }
    setConfirming(false);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {confirmed ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Delivery Confirmed!</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Thank you for confirming receipt of your ARTIXO order.
            </p>
            <a href="https://artixo-store-8phu.vercel.app/orders">
              <Button variant="outline" className="w-full">View My Orders</Button>
            </a>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Your order arrived!</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Please confirm you received your package.
              </p>
            </div>

            <div className="bg-card border rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">Rs. {Number(order.total_amount).toLocaleString("en-LK")}</span>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">Delivery address</p>
                <p className="text-sm">{order.shipping_address}</p>
              </div>
            </div>

            <Button
              onClick={confirmDelivery}
              disabled={confirming}
              className="w-full h-12 text-base font-semibold"
            >
              {confirming ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirming...</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" />I received this order</>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Tap to confirm you received your package from ARTIXO.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
