import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatCurrency(amount) {
  return `LKR ${Number(amount).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusLabel(status) {
  const labels = {
    pending: "Order Received",
    confirmed: "Order Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

function getStatusColor(status) {
  const colors = {
    pending: "#f59e0b",
    confirmed: "#3b82f6",
    processing: "#8b5cf6",
    shipped: "#06b6d4",
    delivered: "#10b981",
    cancelled: "#ef4444",
    refunded: "#6b7280",
  };
  return colors[status] ?? "#6b7280";
}

function buildEmailHtml(order, items, customerEmail, isUpdate) {
  const statusColor = getStatusColor(order.status);
  const statusLabel = getStatusLabel(order.status);
  const orderId = order.id.split("-")[0].toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleDateString("en-LK", {
    year: "numeric", month: "long", day: "numeric",
  });

  const itemRows = items.map((item) =>
    `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">${item.product_name}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;text-align:center;">${item.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;text-align:right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;text-align:right;font-weight:600;">${formatCurrency(item.unit_price * item.quantity)}</td>
    </tr>`
  ).join("");

  const heroTitle = isUpdate ? `Your order has been updated` : "Order Confirmed!";
  const heroMessage = isUpdate
    ? `Your order status has changed to <strong>${statusLabel}</strong>. Here is the latest update.`
    : "Thank you for your purchase! We have received your order and it is being processed. You will receive further updates as your order progresses.";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 40px;text-align:center;">
  <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:4px;margin-bottom:4px;">ARTIXO</div>
  <div style="font-size:12px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">Sri Lanka's Premium Marketplace</div>
</td></tr>
<tr><td style="padding:24px 40px 0;text-align:center;">
  <span style="display:inline-block;background-color:${statusColor};color:#fff;padding:6px 20px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${statusLabel}</span>
</td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
  <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1a1a2e;">${heroTitle}</h1>
  <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">${heroMessage}</p>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;color:#6b7280;">Order ID</td>
        <td style="font-size:14px;font-weight:700;color:#1a1a2e;text-align:right;">#${orderId}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;color:#6b7280;">Order Date</td>
        <td style="font-size:14px;color:#374151;text-align:right;">${orderDate}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;color:#6b7280;">Payment</td>
        <td style="font-size:14px;color:#374151;text-align:right;">${order.payment_method === "cod" ? "Cash on Delivery" : "Card Payment"}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;color:#6b7280;">Shipping To</td>
        <td style="font-size:14px;color:#374151;text-align:right;">${order.shipping_address}</td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1a1a2e;">Order Items</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#f1f5f9;">
      <th style="padding:12px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
      <th style="padding:12px 16px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
      <th style="padding:12px 16px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Price</th>
      <th style="padding:12px 16px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Subtotal</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</td></tr>
<tr><td style="padding:0 40px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td></td>
    <td style="width:260px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:15px;color:#94a3b8;">Total Amount</td>
            <td style="font-size:20px;font-weight:800;color:#fff;text-align:right;">${formatCurrency(order.total_amount)}</td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:0 40px 32px;text-align:center;">
  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Track your order anytime on ARTIXO</p>
  <a href="https://artixo.lovable.app/orders" style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">Track My Order</a>
</td></tr>
<tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">This email was sent to ${customerEmail}</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;">2026 ARTIXO - Sri Lanka's Premium Online Marketplace. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAuth = createClient(supabaseUrl!, anonKey!);
    const { data: { user: caller } } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { order_id, is_update = false } = await req.json();

    if (!order_id || typeof order_id !== "string") {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: caller must be the customer, a seller on the order, or an admin
    let allowed = order.customer_id === caller.id;
    if (!allowed) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRole) {
        allowed = true;
      } else {
        const { data: sellerItem } = await supabase
          .from("order_items")
          .select("id")
          .eq("order_id", order_id)
          .eq("seller_id", caller.id)
          .limit(1)
          .maybeSingle();
        if (sellerItem) allowed = true;
      }
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .eq("order_id", order_id);

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      order.customer_id
    );

    if (userError || !userData?.user?.email) {
      console.error("User fetch error:", userError);
      return new Response(
        JSON.stringify({ error: "Customer email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerEmail = userData.user.email;
    const orderItems = items ?? [];
    const orderId = order.id.split("-")[0].toUpperCase();
    const statusLabel = getStatusLabel(order.status);

    // Load user notification preferences (default: email on, sms off)
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_order_updates, sms_order_updates, phone_number")
      .eq("user_id", order.customer_id)
      .maybeSingle();

    const emailEnabled = prefs ? prefs.email_order_updates : true;
    const smsEnabled = prefs ? prefs.sms_order_updates : false;
    const phoneNumber = prefs?.phone_number;

    const result: Record<string, unknown> = { order_id, status: order.status };

    // ---------- SMS via Twilio (optional) ----------
    if (smsEnabled && phoneNumber) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");
      if (twilioSid && twilioToken && twilioFrom) {
        try {
          const smsBody = `ARTIXO: Your order #${orderId} is now ${statusLabel}. Track: https://artixo.lovable.app/orders`;
          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: phoneNumber, From: twilioFrom, Body: smsBody }),
            },
          );
          const twilioData = await twilioRes.json();
          result.sms = twilioRes.ok ? { sent: true, sid: twilioData.sid } : { sent: false, error: twilioData };
          if (!twilioRes.ok) console.error("Twilio error:", twilioData);
        } catch (e) {
          console.error("SMS send failed:", e);
          result.sms = { sent: false, error: String(e) };
        }
      } else {
        result.sms = { sent: false, error: "Twilio not configured" };
      }
    } else {
      result.sms = { sent: false, reason: smsEnabled ? "no_phone_number" : "disabled" };
    }

    // ---------- Email via Resend ----------
    if (!emailEnabled) {
      result.email = { sent: false, reason: "disabled" };
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailHtml = buildEmailHtml(order, orderItems, customerEmail, is_update);

    const emailSubject = is_update
      ? `Order #${orderId} - Status Updated: ${statusLabel}`
      : `Order Confirmed! #${orderId} - Thank you for shopping at ARTIXO`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ARTIXO Orders <orders@resend.dev>",
        to: [customerEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      result.email = { sent: false, error: resendData };
    } else {
      console.log(`Email sent to ${customerEmail} for order ${order_id}`);
      result.email = { sent: true, id: resendData.id, to: customerEmail };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
