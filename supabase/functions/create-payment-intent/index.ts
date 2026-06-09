import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) return json(401, { error: "Unauthorized" });

    const { amount, currency = "lkr" } = await req.json();

    // Server-side bounds: 50 paise minimum, ~1,000,000 LKR maximum
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return json(400, { error: "amount must be a finite number" });
    }
    if (amount < 50) return json(400, { error: "Amount too small" });
    if (amount > 100_000_000) return json(400, { error: "Amount too large" });

    const allowedCurrencies = ["lkr", "usd", "eur", "gbp", "inr"];
    if (typeof currency !== "string" || !allowedCurrencies.includes(currency.toLowerCase())) {
      return json(400, { error: "Unsupported currency" });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.floor(amount),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { source: "lankabazaar", user_id: user.id },
    });

    return json(200, { clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error("Payment intent error:", err);
    return json(500, { error: "Failed to create payment intent" });
  }
});
