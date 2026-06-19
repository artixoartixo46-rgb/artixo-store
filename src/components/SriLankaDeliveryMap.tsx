import { useMemo } from "react";
import { Truck, CheckCircle2, MapPin, Package } from "lucide-react";
import type { OrderStatus } from "./OrderStatusTimeline";

interface Props {
  status: OrderStatus;
  shippingAddress: string;
}

// Seller ships from Colombo warehouse
const ORIGIN = { x: 47, y: 140, label: "Colombo" };

// Major Sri Lanka districts with SVG coordinates (viewBox 0 0 160 270)
const CITIES = [
  { key: "jaffna",         x: 80,  y: 16,  label: "Jaffna" },
  { key: "kilinochchi",    x: 85,  y: 32,  label: "Kilinochchi" },
  { key: "mullaitivu",     x: 106, y: 28,  label: "Mullaitivu" },
  { key: "vavuniya",       x: 90,  y: 50,  label: "Vavuniya" },
  { key: "mannar",         x: 56,  y: 52,  label: "Mannar" },
  { key: "anuradhapura",   x: 82,  y: 68,  label: "Anuradhapura" },
  { key: "puttalam",       x: 52,  y: 74,  label: "Puttalam" },
  { key: "trincomalee",    x: 136, y: 78,  label: "Trincomalee" },
  { key: "trinco",         x: 136, y: 78,  label: "Trincomalee" },
  { key: "polonnaruwa",    x: 108, y: 90,  label: "Polonnaruwa" },
  { key: "kurunegala",     x: 68,  y: 93,  label: "Kurunegala" },
  { key: "negombo",        x: 44,  y: 116, label: "Negombo" },
  { key: "kandy",          x: 88,  y: 114, label: "Kandy" },
  { key: "matale",         x: 90,  y: 96,  label: "Matale" },
  { key: "batticaloa",     x: 142, y: 132, label: "Batticaloa" },
  { key: "kegalle",        x: 74,  y: 136, label: "Kegalle" },
  { key: "nuwara eliya",   x: 98,  y: 140, label: "Nuwara Eliya" },
  { key: "nuwara",         x: 98,  y: 140, label: "Nuwara Eliya" },
  { key: "badulla",        x: 110, y: 152, label: "Badulla" },
  { key: "ampara",         x: 138, y: 160, label: "Ampara" },
  { key: "kalutara",       x: 48,  y: 162, label: "Kalutara" },
  { key: "ratnapura",      x: 70,  y: 172, label: "Ratnapura" },
  { key: "monaragala",     x: 120, y: 178, label: "Monaragala" },
  { key: "galle",          x: 60,  y: 220, label: "Galle" },
  { key: "matara",         x: 74,  y: 240, label: "Matara" },
  { key: "hambantota",     x: 110, y: 245, label: "Hambantota" },
];

// Simplified Sri Lanka outline path (viewBox 0 0 160 270)
const SL_PATH = [
  "M 80,3",
  "C 92,0 112,12 120,26",
  "L 130,46 L 138,70 L 145,98 L 148,126",
  "L 146,156 L 140,180 L 130,204",
  "L 120,224 L 112,240 L 104,252 L 98,260",
  "L 92,257 L 84,248 L 73,236",
  "L 62,218 L 53,196 L 45,174",
  "L 41,152 L 40,128 L 42,104",
  "L 46,82 L 52,62 L 58,44",
  "L 65,28 L 70,15 L 76,6 Z",
].join(" ");

function parseCity(address: string) {
  const lower = address.toLowerCase();
  // Multi-word first
  for (const c of CITIES) {
    if (c.key.includes(" ") && lower.includes(c.key)) return c;
  }
  for (const c of CITIES) {
    if (!c.key.includes(" ") && lower.includes(c.key)) return c;
  }
  return null;
}

export const SriLankaDeliveryMap = ({ status, shippingAddress }: Props) => {
  const dest = useMemo(() => parseCity(shippingAddress), [shippingAddress]);

  const isShipped    = status === "shipped";
  const isDelivered  = status === "delivered";
  const showRoute    = (isShipped || isDelivered) && dest;

  const lineLength = dest
    ? Math.ceil(Math.sqrt(Math.pow(dest.x - ORIGIN.x, 2) + Math.pow(dest.y - ORIGIN.y, 2)))
    : 100;

  // Unique animation key so each order gets its own animation
  const animId = useMemo(() => `route-${Math.random().toString(36).slice(2)}`, []);

  const statusInfo = {
    pending:    { icon: "⏳", text: "Awaiting seller confirmation",    color: "hsl(var(--muted-foreground))" },
    confirmed:  { icon: "✅", text: "Order confirmed — preparing soon", color: "hsl(var(--muted-foreground))" },
    processing: { icon: "🏭", text: "Packing at Colombo warehouse",    color: "hsl(var(--muted-foreground))" },
    shipped:    { icon: "🚚", text: "Package in transit",              color: "#8B1A2E" },
    delivered:  { icon: "🎉", text: "Package delivered!",             color: "#16a34a" },
    cancelled:  { icon: "❌", text: "Order cancelled",                 color: "#dc2626" },
  }[status] ?? { icon: "📦", text: "Processing", color: "hsl(var(--muted-foreground))" };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "hsl(var(--muted) / 0.3)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ background: "hsl(var(--muted) / 0.5)" }}
      >
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Truck className="h-3 w-3" />
          Delivery Route — Sri Lanka
        </span>
        {isDelivered && (
          <span className="text-xs font-medium text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </span>
        )}
        {isShipped && (
          <span className="text-xs font-medium" style={{ color: "#8B1A2E" }}>
            In Transit 🚚
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex gap-3 p-3 items-start">
        {/* Map */}
        <svg
          viewBox="0 0 160 270"
          style={{ width: "110px", flexShrink: 0, height: "auto" }}
          aria-label="Sri Lanka delivery map"
        >
          {/* Island fill */}
          <path
            d={SL_PATH}
            style={{
              fill: "hsl(var(--muted))",
              stroke: "hsl(var(--border))",
              strokeWidth: "1.5",
              strokeLinejoin: "round",
            }}
          />

          {/* Minor city dots */}
          {CITIES.filter(c => !c.key.includes(" ") && c.key !== "trinco" && c.key !== "nuwara").map(c => (
            <circle
              key={c.key}
              cx={c.x}
              cy={c.y}
              r="1.8"
              style={{ fill: "hsl(var(--muted-foreground))", opacity: 0.25 }}
            />
          ))}

          {/* Animated route line */}
          {showRoute && (
            <>
              <style>{`
                @keyframes ${animId} {
                  from { stroke-dashoffset: ${lineLength}; }
                  to   { stroke-dashoffset: 0; }
                }
              `}</style>
              <line
                x1={ORIGIN.x} y1={ORIGIN.y}
                x2={dest.x}   y2={dest.y}
                stroke="#8B1A2E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={lineLength}
                strokeDashoffset={isDelivered ? 0 : lineLength}
                style={
                  isShipped
                    ? { animation: `${animId} 1.8s ease-out forwards` }
                    : undefined
                }
              />
              {/* Midpoint truck icon (shipped only) */}
              {isShipped && (
                <circle
                  cx={(ORIGIN.x + dest.x) / 2}
                  cy={(ORIGIN.y + dest.y) / 2}
                  r="3.5"
                  fill="#8B1A2E"
                  opacity="0.7"
                >
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
            </>
          )}

          {/* Origin — Colombo */}
          <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" fill="#8B1A2E" />
          <text
            x={ORIGIN.x + 7}
            y={ORIGIN.y + 3}
            fontSize="7"
            style={{ fill: "hsl(var(--muted-foreground))" }}
          >
            Colombo
          </text>

          {/* Destination */}
          {dest && (
            <>
              <circle
                cx={dest.x}
                cy={dest.y}
                r="5"
                fill={
                  isDelivered
                    ? "#16a34a"
                    : isShipped
                    ? "#8B1A2E"
                    : "hsl(var(--muted-foreground))"
                }
              />
              {/* Pulse ring when in transit */}
              {isShipped && (
                <circle cx={dest.x} cy={dest.y} r="5" fill="#8B1A2E" opacity="0.5">
                  <animate attributeName="r"       from="5"  to="13" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0"  dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <text
                x={dest.x > 100 ? dest.x - 7 : dest.x + 7}
                y={dest.y + 3}
                fontSize="7"
                textAnchor={dest.x > 100 ? "end" : "start"}
                style={{ fill: "hsl(var(--muted-foreground))" }}
              >
                {dest.label}
              </text>
            </>
          )}
        </svg>

        {/* Info panel */}
        <div className="flex-1 min-w-0 space-y-2 text-xs">
          {/* From / To */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: "#8B1A2E" }} />
              <span className="text-muted-foreground">From</span>
              <span className="font-medium truncate">Colombo Warehouse</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  background: isDelivered ? "#16a34a" : isShipped ? "#8B1A2E" : "hsl(var(--muted-foreground))",
                }}
              />
              <span className="text-muted-foreground">To</span>
              {dest ? (
                <span className="font-medium truncate">{dest.label}</span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Your location
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background:
                isDelivered
                  ? "rgba(22,163,74,0.1)"
                  : isShipped
                  ? "rgba(139,26,46,0.08)"
                  : "hsl(var(--muted))",
              color: statusInfo.color,
            }}
          >
            <span>{statusInfo.icon}</span>
            <span>{statusInfo.text}</span>
          </div>

          {/* ETA */}
          {isShipped && (
            <div className="text-muted-foreground text-[11px]">
              📅 Est. delivery: <span className="font-medium text-foreground">1–3 business days</span>
            </div>
          )}

          {/* Carrier */}
          <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
            <Package className="h-3 w-3" />
            Island-wide delivery by ARTIXO Logistics
          </div>
        </div>
      </div>
    </div>
  );
};
