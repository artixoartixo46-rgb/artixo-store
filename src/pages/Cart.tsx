import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Package, ShoppingBag, TicketPercent, Check } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { toast } from "sonner";

// Simple coupons (frontend only)
const COUPONS: Record<string, { off: number; type: "pct" | "flat"; label: string }> = {
  WELCOME10: { off: 10, type: "pct", label: "10% off welcome discount" },
  LANKA500: { off: 500, type: "flat", label: "Rs. 500 off" },
  FREESHIP: { off: 0, type: "flat", label: "Free shipping (already free!)" },
};

const Cart = () => {
  const { items, total, update, remove, loading } = useCart();
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; label: string } | null>(null);

  if (authLoading) return <div className="container py-12 text-center">Loading...</div>;

  if (user && roles.includes("admin")) return <Navigate to="/admin" replace />;

  if (!user) return (
    <div className="container py-12 text-center">
      <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
      <h2 className="font-display text-2xl mb-2">Sign in to view your cart</h2>
      <Link to="/auth?redirect=/cart"><Button variant="hero" className="mt-4">Sign in</Button></Link>
    </div>
  );

  if (loading) return <div className="container py-12 text-center">Loading...</div>;

  if (items.length === 0) return (
    <div className="container py-16 text-center">
      <ShoppingBag className="h-20 w-20 mx-auto mb-4 text-muted-foreground" />
      <h2 className="font-display text-2xl mb-2">Your cart is empty</h2>
      <p className="text-muted-foreground mb-6">Discover amazing products from Sri Lankan sellers</p>
      <Link to="/products"><Button variant="hero">Start Shopping</Button></Link>
    </div>
  );

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    const c = COUPONS[code];
    if (!c) {
      toast.error("Invalid coupon code");
      return;
    }
    const discount = c.type === "pct" ? Math.round((total * c.off) / 100) : c.off;
    setApplied({ code, discount, label: c.label });
    toast.success(`Coupon applied: ${c.label}`);
  };

  const finalTotal = Math.max(0, total - (applied?.discount ?? 0));

  return (
    <div className="container py-5 md:py-8">
      <h1 className="font-display text-2xl md:text-3xl mb-4 md:mb-6">Your Cart ({items.length})</h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 md:gap-6">
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.id} className="p-3 md:p-4 flex gap-3 md:gap-4">
              <Link to={`/product/${it.product.id}`} className="h-20 w-20 md:h-24 md:w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                {it.product.image_url ? <img src={it.product.image_url} alt={it.product.name} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-8 w-8 text-muted-foreground" /></div>}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${it.product.id}`} className="font-medium text-sm md:text-base hover:text-primary line-clamp-2">{it.product.name}</Link>
                <div className="text-primary font-bold mt-1 text-sm md:text-base">{formatLKR(it.product.price)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border rounded-md">
                    <button onClick={() => update(it.id, it.quantity - 1)} className="px-2 py-1 hover:bg-muted text-sm">−</button>
                    <span className="px-2 text-sm">{it.quantity}</span>
                    <button onClick={() => update(it.id, Math.min(it.product.stock, it.quantity + 1))} className="px-2 py-1 hover:bg-muted text-sm">+</button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="font-display font-bold text-right text-sm md:text-base whitespace-nowrap">{formatLKR(it.product.price * it.quantity)}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6 h-fit lg:sticky lg:top-20 shadow-card">
          <h3 className="font-display text-xl mb-4">Order Summary</h3>

          {/* Coupon field */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <TicketPercent className="h-4 w-4 text-primary" /> Promo Code
            </label>
            {applied ? (
              <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-md p-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success" />
                  <span className="font-semibold">{applied.code}</span>
                </div>
                <button onClick={() => setApplied(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="WELCOME10"
                  className="h-9 uppercase"
                />
                <Button type="button" variant="outline" size="sm" onClick={applyCoupon}>Apply</Button>
              </div>
            )}
            {!applied && (
              <p className="text-[11px] text-muted-foreground mt-1">Try: WELCOME10, LANKA500</p>
            )}
          </div>

          <div className="space-y-2 text-sm border-b pb-3 mb-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatLKR(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="text-success">Calculated at checkout</span></div>
            {applied && (
              <div className="flex justify-between text-success">
                <span>Discount ({applied.code})</span><span>−{formatLKR(applied.discount)}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between font-display text-lg font-bold mb-4">
            <span>Total</span><span className="text-primary">{formatLKR(finalTotal)}</span>
          </div>
          <Button
            variant="hero"
            className="w-full"
            size="lg"
            onClick={() => {
              if (applied) sessionStorage.setItem("cart_coupon", JSON.stringify(applied));
              else sessionStorage.removeItem("cart_coupon");
              navigate("/checkout");
            }}
          >
            Proceed to Checkout
          </Button>
          <Link to="/products"><Button variant="ghost" className="w-full mt-2">Continue Shopping</Button></Link>
        </Card>
      </div>
    </div>
  );
};

export default Cart;
