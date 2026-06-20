/**
 * ARTIXO — Daily Sales Digest
 * Runs daily at 8:00am Sri Lanka time (2:30am UTC) via pg_cron.
 * For each seller: fetches yesterday's orders → Gemini summary → Resend email.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY           = Deno.env.get("RESEND_API_KEY")!;
const GEMINI_API_KEY           = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatLKR(n: number) {
  return `LKR ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Gemini summary ───────────────────────────────────────────────────────────

async function generateDigest(shopName: string, stats: Record<string, any>): Promise<string> {
  const { totalOrders, totalRevenue, avgOrderValue, topProducts, statusBreakdown } = stats;

  const topList = topProducts.length
    ? topProducts.map((p: any) => `${p.name} (${p.qty} sold)`).join(", ")
    : "No products sold";

  const statusList = Object.entries(statusBreakdown)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "none";

  const prompt = `You are a warm, friendly business coach writing a daily sales digest for "${shopName}", a seller on ARTIXO — Sri Lanka's e-commerce marketplace.

Yesterday's data:
- Orders: ${totalOrders}
- Revenue: LKR ${totalRevenue.toFixed(2)}
- Avg order value: LKR ${avgOrderValue.toFixed(2)}
- Top products: ${topList}
- Order statuses: ${statusList}

Write 2-3 encouraging sentences summarising yesterday. If 0 orders, give a motivating tip. End with one specific action tip for today. Max 70 words. No bullet points. Sound human, not robotic.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    });
    if (!res.ok) throw new Error("Gemini error");
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      `You received ${totalOrders} order(s) with LKR ${totalRevenue.toFixed(2)} revenue yesterday. Keep it up!`;
  } catch {
    return totalOrders > 0
      ? `Great work yesterday! You received ${totalOrders} order(s) totalling ${formatLKR(totalRevenue)}. Keep the momentum going today!`
      : "Yesterday was quiet — try sharing your shop link on social media today to drive more visits!";
  }
}

// ── Resend email ─────────────────────────────────────────────────────────────

async function sendDigestEmail(
  to: string,
  sellerName: string,
  shopName: string,
  stats: Record<string, any>,
  aiSummary: string,
  dateStr: string,
) {
  const { totalOrders, totalRevenue, avgOrderValue, topProducts } = stats;

  const topRows = topProducts.slice(0, 5).map((p: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#555">${p.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#ff6b35;font-weight:600">${formatLKR(p.revenue)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px">

  <!-- Header -->
  <tr><td style="background:#ff6b35;padding:28px 32px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1px;text-transform:uppercase">ARTIXO Daily Digest</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">Good morning, ${(sellerName || "Seller").split(" ")[0]}! ☀️</h1></td>
      <td align="right"><p style="margin:0;color:rgba(255,255,255,0.9);font-size:13px">${dateStr}</p>
          <p style="margin:4px 0 0;color:#ffe0d4;font-size:13px">${shopName || "Your Shop"}</p></td>
    </tr></table>
  </td></tr>

  <!-- AI Summary -->
  <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f0f0f0">
    <p style="margin:0;font-size:15px;color:#444;line-height:1.75">${aiSummary}</p>
  </td></tr>

  <!-- Stats row -->
  <tr><td style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:18px;background:#fff8f5;border-radius:8px">
        <p style="margin:0;font-size:30px;font-weight:700;color:#ff6b35">${totalOrders}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999">ORDERS</p>
      </td>
      <td width="12"></td>
      <td style="text-align:center;padding:18px;background:#fff8f5;border-radius:8px">
        <p style="margin:0;font-size:20px;font-weight:700;color:#ff6b35">${formatLKR(totalRevenue)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999">REVENUE</p>
      </td>
      <td width="12"></td>
      <td style="text-align:center;padding:18px;background:#fff8f5;border-radius:8px">
        <p style="margin:0;font-size:20px;font-weight:700;color:#ff6b35">${formatLKR(avgOrderValue)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999">AVG ORDER</p>
      </td>
    </tr></table>
  </td></tr>

  <!-- Top products -->
  ${topProducts.length > 0 ? `
  <tr><td style="padding:0 32px 28px">
    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.5px">Top Products Yesterday</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
      <tr style="background:#fafafa">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#aaa;font-weight:500">Product</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#aaa;font-weight:500">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#aaa;font-weight:500">Revenue</th>
      </tr>
      ${topRows}
    </table>
  </td></tr>` : ""}

  <!-- CTA -->
  <tr><td style="padding:4px 32px 32px;text-align:center">
    <a href="https://artixo.store/seller" style="display:inline-block;background:#ff6b35;color:#fff;text-decoration:none;padding:13px 36px;border-radius:8px;font-size:14px;font-weight:600">View Dashboard →</a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center">
    <p style="margin:0;font-size:12px;color:#bbb">ARTIXO · artixo.store · Sri Lanka's marketplace</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ARTIXO <noreply@artixo.store>",
      to: [to],
      subject: `☀️ Yesterday's digest — ${totalOrders} order${totalOrders !== 1 ? "s" : ""}, ${formatLKR(totalRevenue)}`,
      html,
    }),
  });

  return res.ok;
}

// ── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Yesterday range in Sri Lanka time (UTC+5:30)
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_MS);
  const todayIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_MS);
  const yesterdayIST = new Date(todayIST.getTime() - 86_400_000);

  const yesterdayLabel = new Date(yesterdayIST.getTime() + IST_MS)
    .toLocaleDateString("en-LK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // 1. All sellers
  const { data: sellerRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "seller");

  if (!sellerRoles?.length) {
    return new Response(JSON.stringify({ ok: true, message: "no sellers" }), { status: 200 });
  }

  const sellerIds = sellerRoles.map((r: any) => r.user_id);

  // 2. Profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, shop_name")
    .in("id", sellerIds);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ ok: true, message: "no profiles" }), { status: 200 });
  }

  const results = [];

  for (const profile of profiles) {
    if (!profile.email) continue;

    try {
      // 3. Yesterday's order items for this seller
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, subtotal, orders!inner(id, order_status, status)")
        .eq("seller_id", profile.id)
        .gte("created_at", yesterdayIST.toISOString())
        .lt("created_at", todayIST.toISOString());

      const rows = items ?? [];

      // 4. Calculate stats
      const orderIds = new Set(rows.map((i: any) => i.orders?.id).filter(Boolean));
      const totalOrders = orderIds.size;
      const totalRevenue = rows.reduce((s: number, i: any) => s + Number(i.subtotal ?? 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const productMap: Record<string, { qty: number; revenue: number }> = {};
      for (const item of rows) {
        const name = (item as any).product_name || "Unknown Product";
        if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 };
        productMap[name].qty += Number((item as any).quantity ?? 0);
        productMap[name].revenue += Number((item as any).subtotal ?? 0);
      }
      const topProducts = Object.entries(productMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.qty - a.qty);

      const statusBreakdown: Record<string, number> = {};
      for (const item of rows) {
        const s = (item as any).orders?.order_status || (item as any).orders?.status || "unknown";
        statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
      }

      const stats = { totalOrders, totalRevenue, avgOrderValue, topProducts, statusBreakdown };

      // 5. Gemini summary
      const aiSummary = await generateDigest(profile.shop_name || profile.full_name || "your shop", stats);

      // 6. Send email
      const sent = await sendDigestEmail(
        profile.email,
        profile.full_name ?? "",
        profile.shop_name ?? "",
        stats,
        aiSummary,
        yesterdayLabel,
      );

      results.push({ seller: profile.email, sent, orders: totalOrders });
    } catch (err) {
      results.push({ seller: profile.email, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
