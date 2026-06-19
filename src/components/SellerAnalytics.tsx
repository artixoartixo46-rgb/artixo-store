import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { formatLKR } from "@/lib/format";
import { TrendingUp, ShoppingBag, Package, BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  orders: any[];
  products: any[];
}

const orderRevenue = (o: any) =>
  (o.my_items ?? []).reduce(
    (s: number, it: any) => s + Number(it.unitPrice) * Number(it.quantity),
    0
  );

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  processing: "#f97316",
  shipped: "#8B1A2E",
  delivered: "#16a34a",
  cancelled: "#ef4444",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-medium mb-1 text-foreground">{label}</div>
      <div className="text-primary font-semibold">{formatLKR(payload[0]?.value ?? 0)}</div>
      {payload[0]?.payload?.count > 0 && (
        <div className="text-muted-foreground text-xs mt-0.5">
          {payload[0].payload.count} order{payload[0].payload.count !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
};

export const SellerAnalytics = ({ orders, products }: Props) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);

  // ── Revenue metrics ──────────────────────────────────────────────────────
  const totalRevenue = useMemo(
    () => orders.reduce((s, o) => s + orderRevenue(o), 0),
    [orders]
  );

  const monthRevenue = useMemo(
    () =>
      orders
        .filter((o) => new Date(o.created_at) >= startOfMonth)
        .reduce((s, o) => s + orderRevenue(o), 0),
    [orders]
  );

  const weekRevenue = useMemo(
    () =>
      orders
        .filter((o) => new Date(o.created_at) >= startOfWeek)
        .reduce((s, o) => s + orderRevenue(o), 0),
    [orders]
  );

  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  // ── 30-day trend ─────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(
        (o) => o.created_at?.slice(0, 10) === dateStr
      );
      return {
        date: dateStr,
        label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        revenue: dayOrders.reduce((s, o) => s + orderRevenue(o), 0),
        count: dayOrders.length,
      };
    });
  }, [orders]);

  // ── Top products ──────────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = new Map<string, { revenue: number; qty: number }>();
    orders.forEach((o) => {
      (o.my_items ?? []).forEach((it: any) => {
        const name = it.productName ?? "Unknown";
        const rev = Number(it.unitPrice) * Number(it.quantity);
        const cur = map.get(name) ?? { revenue: 0, qty: 0 };
        map.set(name, {
          revenue: cur.revenue + rev,
          qty: cur.qty + Number(it.quantity),
        });
      });
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  const maxTopRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const ALL = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    return ALL.map((s) => ({
      status: s,
      count: orders.filter((o) => o.status === s).length,
    })).filter((s) => s.count > 0);
  }, [orders]);

  // ── Views vs Conversions (products with orders) ───────────────────────────
  // "Views" ≈ total live products  |  "Conversions" ≈ distinct products with ≥1 order
  const liveProducts = products.filter((p) => p.status === "approved").length;
  const soldProductNames = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((o) =>
      (o.my_items ?? []).forEach((it: any) => names.add(it.productName))
    );
    return names;
  }, [orders]);
  const conversionRate =
    liveProducts > 0 ? Math.round((soldProductNames.size / liveProducts) * 100) : 0;

  if (orders.length === 0 && products.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <BarChart2 className="h-16 w-16 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground">
          Analytics will appear once you add products and receive orders.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Revenue",
            value: formatLKR(totalRevenue),
            sub: `${orders.length} total orders`,
            icon: TrendingUp,
            color: "text-primary",
          },
          {
            label: "This Month",
            value: formatLKR(monthRevenue),
            sub: `${orders.filter((o) => new Date(o.created_at) >= startOfMonth).length} orders`,
            icon: TrendingUp,
            color: "text-primary",
          },
          {
            label: "This Week",
            value: formatLKR(weekRevenue),
            sub: `${orders.filter((o) => new Date(o.created_at) >= startOfWeek).length} orders`,
            icon: ShoppingBag,
            color: "text-primary",
          },
          {
            label: "Avg. Order Value",
            value: formatLKR(avgOrderValue),
            sub: `${deliveredCount} delivered`,
            icon: Package,
            color: "text-primary",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className={`font-display text-xl leading-tight ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </Card>
        ))}
      </div>

      {/* ── 30-day revenue chart ── */}
      <Card className="p-4">
        <div className="font-semibold text-sm mb-4 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          Revenue — last 30 days
        </div>
        {orders.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No order data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                }
                width={38}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar
                dataKey="revenue"
                fill="#8B1A2E"
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* ── Top products ── */}
        <Card className="p-4">
          <div className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Top Products by Revenue
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No product sales yet.
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">
                        #{i + 1}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="font-medium text-primary ml-2 shrink-0">
                      {formatLKR(p.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(p.revenue / maxTopRevenue) * 100}%`,
                        background: "#8B1A2E",
                        opacity: 1 - i * 0.15,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.qty} unit{p.qty !== 1 ? "s" : ""} sold
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Order status + conversion ── */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="font-semibold text-sm mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              Order Status Breakdown
            </div>
            {statusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-2.5">
                {statusCounts.map(({ status, count }) => {
                  const pct =
                    orders.length > 0
                      ? Math.round((count / orders.length) * 100)
                      : 0;
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{status}</span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: STATUS_COLORS[status] ?? "#8B1A2E",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Views vs Conversions ── */}
          <Card className="p-4">
            <div className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Product Conversions
            </div>
            <div className="flex items-end gap-4 mb-2">
              <div>
                <div className="text-xs text-muted-foreground">Live Products</div>
                <div className="font-display text-2xl">{liveProducts}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Products with Sales</div>
                <div className="font-display text-2xl text-primary">
                  {soldProductNames.size}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Conversion Rate</div>
                <div className="font-display text-2xl text-green-600">
                  {conversionRate}%
                </div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${conversionRate}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {soldProductNames.size} of {liveProducts} live products have received orders
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
