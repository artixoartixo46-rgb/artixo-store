/**
 * ARTIXO — Premium Shipping Label Generator v2
 * Opens a professional HTML label in a new tab with QR code + barcode.
 * Uses CDN libraries (no npm install needed).
 */

export interface LabelOrder {
  id: string;
  shipping_address: string;
  shipping_phone: string;
  total_amount: number;
  payment_method: string;
  tracking_number?: string | null;
  courier?: string | null;
  created_at?: string;
  status?: string;
  shipping_city?: string | null;
}

export interface LabelItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface LabelSeller {
  shopName: string;
  phone?: string;
  email?: string;
  fullName?: string;
}

export function generateShippingLabel(opts: {
  order: LabelOrder;
  seller: LabelSeller;
  items: LabelItem[];
}): void {
  const { order, seller, items } = opts;

  const orderId = order.id.slice(0, 8).toUpperCase();
  const trackingCode = order.tracking_number || orderId;
  const dateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-LK");
  const timeStr = order.created_at
    ? new Date(order.created_at).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })
    : "";
  const trackingUrl = `https://artixo-store-8phu.vercel.app/orders`;
  const statusLabel = (order.status ?? "confirmed").replace(/_/g, " ").toUpperCase();
  const paymentLabel = order.payment_method === "cod" ? "CASH ON DELIVERY" : "BANK TRANSFER";
  const total = Number(order.total_amount).toLocaleString("en-LK");
  const sellerName = seller.shopName || seller.fullName || "ARTIXO Seller";

  const itemRows = items.map(it => `
    <tr>
      <td class="item-name">${it.productName}</td>
      <td class="item-qty">x${it.quantity}</td>
      <td class="item-price">Rs. ${(it.unitPrice * it.quantity).toLocaleString("en-LK")}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ARTIXO Shipping Label — #${orderId}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"><\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family:'Inter',sans-serif;
    background:#f0f0f0;
    display:flex;
    flex-direction:column;
    align-items:center;
    padding:30px 20px;
    min-height:100vh;
  }
  .print-bar { display:flex; gap:12px; margin-bottom:24px; align-items:center; }
  .btn-print {
    background:#F97316; color:white; border:none;
    padding:12px 32px; font-size:15px; font-weight:700;
    border-radius:10px; cursor:pointer; font-family:'Inter',sans-serif;
    letter-spacing:.5px; box-shadow:0 4px 14px rgba(249,115,22,.4);
  }
  .btn-close {
    background:#fff; color:#374151; border:1px solid #d1d5db;
    padding:12px 20px; font-size:14px; font-weight:600;
    border-radius:10px; cursor:pointer; font-family:'Inter',sans-serif;
  }
  .label {
    width:105mm; background:#fff; border-radius:12px;
    box-shadow:0 8px 40px rgba(0,0,0,.18); overflow:hidden;
  }
  /* Header */
  .header {
    background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
    padding:10px 14px 10px;
    display:flex; justify-content:space-between; align-items:center;
  }
  .brand-logo { height:38px; width:auto; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,.3)); }
  .brand-fallback { font-size:22px; font-weight:900; color:#fff; letter-spacing:-1px; line-height:1; }
  .tagline { font-size:7px; color:rgba(255,255,255,.6); margin-top:2px; font-weight:500; text-transform:uppercase; letter-spacing:1.5px; }
  .label-type { font-size:9px; font-weight:800; color:#F97316; letter-spacing:2px; text-transform:uppercase; text-align:right; }
  .label-date { font-size:7px; color:rgba(255,255,255,.5); margin-top:2px; text-align:right; }
  /* Status strip */
  .status-strip {
    background:#1f2937; display:flex; justify-content:space-between;
    align-items:center; padding:5px 14px;
  }
  .status-badge { font-size:8px; font-weight:800; letter-spacing:1.5px; color:#F97316; text-transform:uppercase; }
  .order-ref { font-family:'Roboto Mono',monospace; font-size:9px; font-weight:700; color:#fff; letter-spacing:1px; }
  /* Body */
  .body { padding:10px 12px; }
  /* QR + Barcode */
  .code-row {
    display:flex; gap:10px; align-items:center; margin-bottom:10px;
    padding:8px 10px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;
  }
  #qr-code canvas, #qr-code img { width:54px !important; height:54px !important; }
  .barcode-wrap { flex:1; display:flex; flex-direction:column; align-items:center; }
  .barcode-wrap svg { max-width:100%; height:44px; }
  .barcode-label { font-family:'Roboto Mono',monospace; font-size:6.5px; color:#9ca3af; margin-top:2px; letter-spacing:1px; }
  /* Address */
  .address-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
  .addr-box { border-radius:8px; padding:8px 9px; }
  .addr-box.from { background:#f3f4f6; border:1px solid #e5e7eb; }
  .addr-box.to { background:#fff7ed; border:1.5px solid #F97316; }
  .addr-label { font-size:6px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px; }
  .from-label { color:#6b7280; }
  .to-label { color:#F97316; }
  .addr-name { font-size:8.5px; font-weight:700; color:#111827; line-height:1.35; margin-bottom:3px; }
  .addr-detail { font-size:7px; color:#374151; line-height:1.5; }
  .addr-phone { font-size:8px; font-weight:600; color:#111827; margin-top:4px; font-family:'Roboto Mono',monospace; }
  /* Divider */
  .divider { border:none; border-top:1px dashed #d1d5db; margin:8px 0; }
  /* Section title */
  .section-title {
    font-size:6.5px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase;
    color:#6b7280; margin-bottom:5px; display:flex; align-items:center; gap:4px;
  }
  .section-title::after { content:''; flex:1; height:1px; background:#e5e7eb; }
  /* Items */
  table.items { width:100%; border-collapse:collapse; }
  table.items td { padding:3px 0; font-size:7.5px; color:#1f2937; vertical-align:top; }
  td.item-name { font-weight:500; width:58%; padding-right:4px; }
  td.item-qty { font-family:'Roboto Mono',monospace; font-weight:600; color:#6b7280; width:14%; text-align:center; }
  td.item-price { font-weight:700; text-align:right; width:28%; color:#111827; }
  /* Total bar */
  .total-bar {
    background:#1f2937; border-radius:8px; padding:8px 10px;
    display:flex; justify-content:space-between; align-items:center; margin-top:8px;
  }
  .total-label { font-size:7px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:1px; }
  .total-amount { font-size:14px; font-weight:900; color:#F97316; font-family:'Roboto Mono',monospace; }
  .payment-chip { font-size:6.5px; font-weight:700; color:#fff; background:#374151; border-radius:4px; padding:3px 7px; letter-spacing:.5px; }
  /* Tracking */
  .tracking-box {
    margin-top:8px; border:1px solid #e5e7eb; border-radius:8px;
    padding:7px 10px; display:flex; justify-content:space-between;
    align-items:center; background:#f9fafb;
  }
  .tracking-courier { font-size:7px; font-weight:800; color:#6b7280; letter-spacing:1px; text-transform:uppercase; }
  .tracking-number { font-family:'Roboto Mono',monospace; font-size:9px; font-weight:700; color:#111827; margin-top:1px; }
  .tracking-chip { font-size:6px; font-weight:700; color:#F97316; border:1px solid #F97316; border-radius:4px; padding:2px 6px; letter-spacing:.5px; }
  /* Footer */
  .footer {
    background:linear-gradient(135deg,#1f2937 0%,#111827 100%);
    padding:7px 14px; display:flex; justify-content:space-between;
    align-items:center; margin-top:10px;
  }
  .footer-left { font-size:6px; color:#6b7280; letter-spacing:.5px; }
  .footer-right { font-size:6px; color:#F97316; font-weight:600; }
  /* Print */
  @media print {
    body { background:white; padding:0; }
    .print-bar { display:none; }
    .label { box-shadow:none; border-radius:0; width:105mm; margin:0 auto; }
    @page { size:A6; margin:4mm; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <button class="btn-print" onclick="window.print()">&#128424; Print Label</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
<div class="label">
  <div class="header">
    <div>
      <img class="brand-logo"
           src="https://artixo-store-8phu.vercel.app/artixo-logo.png"
           alt="ARTIXO"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <span class="brand-fallback" style="display:none">ARTIXO</span>
      <div class="tagline">Sri Lanka's Marketplace</div>
    </div>
    <div>
      <div class="label-type">Shipping Label</div>
      <div class="label-date">${dateStr} ${timeStr}</div>
    </div>
  </div>
  <div class="status-strip">
    <span class="status-badge">${statusLabel}</span>
    <span class="order-ref">#${orderId}</span>
  </div>
  <div class="body">
    <div class="code-row">
      <div id="qr-code"></div>
      <div class="barcode-wrap">
        <svg id="barcode"></svg>
        <div class="barcode-label">${trackingCode}</div>
      </div>
    </div>
    <div class="address-row">
      <div class="addr-box from">
        <div class="addr-label from-label">FROM (SELLER)</div>
        <div class="addr-name">${sellerName}</div>
        ${seller.email ? `<div class="addr-detail">${seller.email}</div>` : ""}
        ${seller.phone ? `<div class="addr-phone">${seller.phone}</div>` : ""}
      </div>
      <div class="addr-box to">
        <div class="addr-label to-label">DELIVER TO</div>
        <div class="addr-name">${order.shipping_address.replace(/\n/g, "<br/>")}</div>
        <div class="addr-phone">${order.shipping_phone}</div>
      </div>
    </div>
    <hr class="divider"/>
    <div class="section-title">Package Contents</div>
    <table class="items"><tbody>${itemRows}</tbody></table>
    <div class="total-bar">
      <div>
        <div class="total-label">Order Total</div>
        <div class="total-amount">Rs. ${total}</div>
      </div>
      <div class="payment-chip">${paymentLabel}</div>
    </div>
    ${order.tracking_number ? `
    <div class="tracking-box">
      <div>
        <div class="tracking-courier">${order.courier ?? "Courier"} Tracking</div>
        <div class="tracking-number">${order.tracking_number}</div>
      </div>
      <div class="tracking-chip">TRACKABLE</div>
    </div>` : ""}
  </div>
  <div class="footer">
    <span class="footer-left">artixo.store &bull; support@artixo.store &bull; Sri Lanka</span>
    <span class="footer-right">Scan QR to track order</span>
  </div>
</div>
<script>
  new QRCode(document.getElementById("qr-code"), {
    text: "${trackingUrl}",
    width: 54, height: 54,
    colorDark: "#1f2937", colorLight: "#f9fafb",
    correctLevel: QRCode.CorrectLevel.M
  });
  JsBarcode("#barcode", "${trackingCode}", {
    format: "CODE128", lineColor: "#1f2937",
    width: 1.8, height: 40, displayValue: false, margin: 0, background: "transparent"
  });
<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
