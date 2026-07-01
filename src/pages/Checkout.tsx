import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatLKR } from "@/lib/format";
import { Banknote, CreditCard, Truck, Shield, Lock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToUser } from "@/hooks/usePushNotifications";
import { getStoredReferral, clearStoredReferral } from "@/hooks/useReferral";

// --- Stripe setup ---
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;
const STRIPE_ENABLED = Boolean(STRIPE_KEY);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1a1a2e",
      fontFamily: "system-ui, sans-serif",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444" },
  },
  hidePostalCode: true,
};

// --- Sri Lanka Districts ---
const SL_DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Moneragala", "Ratnapura", "Kegalle",
];

// --- Inner Stripe Form Component ---
interface StripeFormProps {
  total: number;
  onPaymentSuccess: (paymentIntentId: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

const StripeCardForm = ({ total, onPaymentSuccess, loading, setLoading }: StripeFormProps) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleCardPay = async () => {
    if (!stripe || !elements) {
      toast.error("Stripe is not ready. Please wait.");
      return;
    }
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    try {
      // Call Supabase Edge Function to create PaymentIntent
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: {
          amount: Math.round(total * 100), // paise/cents
          currency: "lkr",
        },
      });

      if (error || !data?.clientSecret) {
        throw new Error(error?.message || "Failed to initialize payment.");
      }

      // Confirm card payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: { card: cardElement },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message || "Card payment failed.");
      }

      if (paymentIntent?.status === "succeeded") {
        onPaymentSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-green-600" />
          <span className="text-sm text-gray-600 font-medium">
            Secured by Stripe — 256-bit SSL encryption
          </span>
        </div>
        <div className="border rounded-md p-3 bg-gray-50">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Test card: 4242 4242 4242 4242 | Exp: any future date | CVC: any 3 digits
        </p>
      </div>
      <Button
        type="button"
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-base"
        onClick={handleCardPay}
        disabled={loading || !stripe}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Processing Payment...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay {formatLKR(total)} with Card
          </span>
        )}
      </Button>
    </div>
  );
};

// --- Main Checkout Component ---
const Checkout = () => {
  const { items: cartItems, loading: cartLoading, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<"card" | "cod">(STRIPE_ENABLED ? "card" : "cod");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: user?.email || "",
    address: "",
    city: "",
    district: "",
    postalCode: "",
    notes: "",
  });

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email || "" }));
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (cartLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Loading cart…</div>
    </div>
  );
  if (cartItems.length === 0) return <Navigate to="/cart" replace />;

  const subtotal = cartItems.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);
  const shipping = subtotal >= 5000 ? 0 : 350;
  const total = subtotal + shipping;

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!form.name.trim()) { toast.error("Please enter your full name"); return false; }
    if (!form.phone.trim()) { toast.error("Please enter your phone number"); return false; }
    if (!form.address.trim()) { toast.error("Please enter your address"); return false; }
    if (!form.district) { toast.error("Please select your district"); return false; }
    if (!form.city.trim()) { toast.error("Please enter your city/town"); return false; }
    return true;
  };

  const saveOrder = async (paymentIntentId?: string) => {
    const shippingAddressText = [
      form.name,
      form.address,
      [form.city, form.district, form.postalCode].filter(Boolean).join(", "),
      form.email ? `Email: ${form.email}` : "",
    ].filter(Boolean).join("\n");

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        user_id: user.id,
        total_amount: total,
        total,                                                // NOT NULL legacy
        subtotal: total,                                      // NOT NULL legacy
        order_number: `ART-${Date.now()}`,                   // NOT NULL legacy
        payment_method: paymentMethod === "cod" ? "cod" : "bank_transfer",
        shipping_address: shippingAddressText,
        shipping_phone: form.phone,
        notes: [form.notes, paymentIntentId ? `Payment: ${paymentIntentId}` : ""].filter(Boolean).join(" | ") || null,
        status: paymentIntentId ? "confirmed" : "pending",
        order_status: paymentIntentId ? "confirmed" : "pending",
      })
      .select()
      .single();

    if (error || !order) {
      console.error("Order save error:", error);
      throw error ?? new Error("Order save failed");
    }

    const itemRows = cartItems
      .filter((i) => i.product?.seller_id)   // skip any item with no seller (safety guard)
      .map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.product?.name || "",
        unit_price: i.product?.price || 0,
        quantity: i.quantity,
        seller_id: i.product!.seller_id,
      }));

    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) {
      console.error("Order items save error:", itemsError);
      toast.error("Order placed but item details may be incomplete. Contact support.");
    }

    // Send order confirmation email asynchronously
    supabase.functions
      .invoke("send-order-confirmation", { body: { order_id: order.id, is_update: false } })
      .catch((emailErr) => console.error("Confirmation email error:", emailErr));

    // Push notification to buyer
    sendPushToUser(user.id, {
      title: "✅ Order Confirmed — ARTIXO",
      body: `Your order of ${formatLKR(total)} has been placed successfully!`,
      url: "/orders",
    }).catch(() => {});

    // Referral conversion — credit the affiliate if order came via referral link
    const refCode = getStoredReferral();
    if (refCode) {
      try {
        const { data: aff } = await (supabase as any)
          .from("affiliates")
          .select("id, commission_rate, status, user_id")
          .eq("referral_code", refCode)
          .eq("status", "approved")
          .maybeSingle();
        if (aff && aff.user_id !== user.id) { // can't self-refer
          const commission = Number((total * aff.commission_rate / 100).toFixed(2));
          await (supabase as any).from("referral_conversions").insert({
            affiliate_id: aff.id,
            order_id: order.id,
            order_amount: total,
            commission_amount: commission,
            status: "pending",
          });
          // Increment affiliate stats
          await (supabase as any).from("affiliates").update({
            total_conversions: aff.total_conversions + 1,
            total_earnings: aff.total_earnings + commission,
          } as any).eq("id", aff.id);
          clearStoredReferral();
        }
      } catch { /* non-critical — don't block order */ }
    }
  };

  const handleCOD = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      await saveOrder();
      clear();
      toast.success("🎉 Order placed! Cash on delivery confirmed.");
      navigate("/orders");
    } catch (err: any) {
      console.error("COD order error:", err);
      toast.error(err?.message ? `Order failed: ${err.message}` : "Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSuccess = async (paymentIntentId: string) => {
    try {
      await saveOrder(paymentIntentId);
      clear();
      toast.success("🎉 Payment successful! Your order is confirmed.");
      navigate("/orders");
    } catch {
      // Payment succeeded — still navigate
      clear();
      toast.success("🎉 Payment successful! Your order is confirmed.");
      navigate("/orders");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — Shipping + Payment */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shipping Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Shipping Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="e.g. Kamal Perera"
                      value={form.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input
                      placeholder="e.g. 077 123 4567"
                      value={form.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Street Address *</Label>
                  <Input
                    placeholder="House no, Street, Area"
                    value={form.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>District *</Label>
                    <Select
                      value={form.district}
                      onValueChange={(v) => handleInputChange("district", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {SL_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>City / Town *</Label>
                    <Input
                      placeholder="e.g. Nugegoda"
                      value={form.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input
                      placeholder="e.g. 10250"
                      value={form.postalCode}
                      onChange={(e) => handleInputChange("postalCode", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Order Notes (optional)</Label>
                  <Textarea
                    placeholder="Any special instructions for delivery..."
                    value={form.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as "card" | "cod")}
                >
                  {STRIPE_ENABLED && (
                  <div
                    className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                      paymentMethod === "card"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    <RadioGroupItem value="card" id="card" />
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <Label htmlFor="card" className="cursor-pointer font-semibold">
                        Credit / Debit Card
                      </Label>
                      <p className="text-sm text-gray-500">
                        Visa, Mastercard, Amex — Secured by Stripe
                      </p>
                    </div>
                    <div className="ml-auto flex gap-1">
                      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/visa.svg" className="h-6 w-8 object-contain" alt="Visa" />
                      <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/mastercard.svg" className="h-6 w-8 object-contain" alt="Mastercard" />
                    </div>
                  </div>
                  )}

                  <div
                    className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                      paymentMethod === "cod"
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setPaymentMethod("cod")}
                  >
                    <RadioGroupItem value="cod" id="cod" />
                    <Banknote className="h-5 w-5 text-orange-600" />
                    <div>
                      <Label htmlFor="cod" className="cursor-pointer font-semibold">
                        Cash on Delivery
                      </Label>
                      <p className="text-sm text-gray-500">Pay when your order arrives</p>
                    </div>
                  </div>
                </RadioGroup>

                {/* Stripe Card Form */}
                {STRIPE_ENABLED && paymentMethod === "card" && (
                  <div className="mt-4">
                    <Elements stripe={stripePromise}>
                      <StripeCardForm
                        total={total}
                        onPaymentSuccess={handleStripeSuccess}
                        loading={loading}
                        setLoading={setLoading}
                      />
                    </Elements>
                  </div>
                )}

                {/* COD Button */}
                {paymentMethod === "cod" && (
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 text-base mt-2"
                    onClick={handleCOD}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Placing Order...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Banknote className="h-5 w-5" />
                        Place Order — Pay on Delivery
                      </span>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right — Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-3 items-center">
                      <img
                        src={item.product?.image_url || "/placeholder.png"}
                        alt={item.product?.name || ""}
                        className="w-14 h-14 object-cover rounded-md border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.product?.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                        {formatLKR((item.product?.price || 0) * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({cartItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
                    <span>{formatLKR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Shipping
                    </span>
                    <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
                      {shipping === 0 ? "FREE" : formatLKR(shipping)}
                    </span>
                  </div>
                  {shipping === 0 && (
                    <p className="text-xs text-green-600">✓ Free shipping on orders over Rs. 5,000</p>
                  )}
                  <div className="border-t pt-2 flex justify-between text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatLKR(total)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  <p className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-green-600" /> Secure checkout
                  </p>
                  <p className="flex items-center gap-1">
                    <Truck className="h-3 w-3 text-blue-600" /> Island-wide delivery
                  </p>
                  <p className="flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-orange-600" /> Cash on delivery available
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
