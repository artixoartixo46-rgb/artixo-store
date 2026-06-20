/**
 * ARTIXO — Shipping Label Generator
 * Generates a printable A6-size PDF shipping label using jsPDF.
 *
 * Usage:
 *   generateShippingLabel({ order, seller, items });
 *   // Opens a new browser tab with the PDF ready to print.
 */

import { jsPDF } from "jspdf";

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
}

export interface LabelItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface LabelSeller {
  shopName: string;
  phone?: string;
  fullName?: string;
}

export function generateShippingLabel(opts: {
  order: LabelOrder;
  seller: LabelSeller;
  items: LabelItem[];
}): void {
  const { order, seller, items } = opts;

  // A6 size in mm: 105 x 148
  const doc = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const W = 105;

  const BLACK  = "#0a0a0a";
  const GRAY   = "#6b7280";
  const LIGHT  = "#f3f4f6";
  const BORDER = "#d1d5db";
  const PRIMARY = "#F97316"; // ARTIXO saffron

  let y = 0;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(PRIMARY);
  doc.rect(0, 0, W, 14, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#ffffff");
  doc.text("ARTIXO", 5, 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("artixo.store", 5, 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SHIPPING LABEL", W - 5, 9, { align: "right" });

  y = 18;

  // ── Order ID + date ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  const dateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-LK");
  doc.text(`Order Date: ${dateStr}`, 5, y);
  doc.text(`Status: ${(order.status ?? "confirmed").toUpperCase()}`, W - 5, y, { align: "right" });
  y += 4;

  // Order ID barcode-style box
  doc.setFillColor(LIGHT);
  doc.setDrawColor(BORDER);
  doc.roundedRect(5, y, W - 10, 8, 1, 1, "FD");
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BLACK);
  doc.text(`#${order.id.slice(0, 8).toUpperCase()}`, W / 2, y + 5.5, { align: "center" });
  y += 12;

  // ── FROM / TO ────────────────────────────────────────────────────────────────
  const colW = (W - 12) / 2;
  const boxH = 30;

  // FROM box
  doc.setFillColor(LIGHT);
  doc.setDrawColor(BORDER);
  doc.roundedRect(5, y, colW, boxH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(GRAY);
  doc.text("FROM (SELLER)", 7, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BLACK);
  const fromName = seller.shopName || seller.fullName || "ARTIXO Seller";
  doc.text(doc.splitTextToSize(fromName, colW - 4), 7, y + 10);

  if (seller.phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text(seller.phone, 7, y + 23);
  }

  // TO box
  const toX = 5 + colW + 2;
  doc.setFillColor("#fff7ed");
  doc.setDrawColor(PRIMARY);
  doc.setLineWidth(0.5);
  doc.roundedRect(toX, y, colW, boxH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(PRIMARY);
  doc.text("DELIVER TO", toX + 2, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BLACK);
  const addrLines = doc.splitTextToSize(order.shipping_address, colW - 4);
  doc.text(addrLines.slice(0, 3), toX + 2, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(BLACK);
  doc.text(`📞 ${order.shipping_phone}`, toX + 2, y + 26);

  y += boxH + 4;

  // ── Items ───────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  doc.text("ITEMS", 5, y);
  y += 3;

  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.3);
  doc.line(5, y, W - 5, y);
  y += 3;

  for (const item of items.slice(0, 5)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(BLACK);
    const label = doc.splitTextToSize(`${item.productName}`, colW * 1.4);
    doc.text(label[0], 5, y);
    doc.text(`x${item.quantity}`, W / 2 + 2, y, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(
      `Rs. ${(item.unitPrice * item.quantity).toLocaleString("en-LK")}`,
      W - 5,
      y,
      { align: "right" }
    );
    y += 5;
  }

  if (items.length > 5) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(GRAY);
    doc.text(`+ ${items.length - 5} more item(s)`, 5, y);
    y += 5;
  }

  doc.setLineWidth(0.3);
  doc.line(5, y, W - 5, y);
  y += 3;

  // Total + payment
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BLACK);
  doc.text(`TOTAL: Rs. ${Number(order.total_amount).toLocaleString("en-LK")}`, 5, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  doc.text(
    order.payment_method === "cod" ? "💵 Cash on Delivery" : "🏦 Bank Transfer",
    W - 5,
    y,
    { align: "right" }
  );
  y += 6;

  // ── Tracking ────────────────────────────────────────────────────────────────
  if (order.tracking_number) {
    doc.setFillColor(LIGHT);
    doc.setDrawColor(BORDER);
    doc.roundedRect(5, y, W - 10, 10, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(GRAY);
    doc.text(`${order.courier ?? "COURIER"} TRACKING`, 8, y + 4);

    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(BLACK);
    doc.text(order.tracking_number, 8, y + 9);
    y += 14;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFillColor(PRIMARY);
  doc.rect(0, 144, W, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor("#ffffff");
  doc.text("artixo.store  •  Sri Lanka's Marketplace  •  For support: support@artixo.store", W / 2, 147, { align: "center" });

  // Open in new tab
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");

  // Revoke after 60s
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
