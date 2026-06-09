import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Calendar, Wallet, CheckCircle2, TrendingUp, Filter } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FilterKey = "all" | "today" | "week" | "cod" | "delivered";

const FILTERS: { key: FilterKey; label: string; icon: typeof Filter }[] = [
  { key: "all", label: "All", icon: Filter },
  { key: "today", label: "Today", icon: Calendar },
  { key: "week", label: "This Week", icon: Calendar },
  { key: "cod", label: "COD only", icon: Wallet },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

export const filterOrders = (orders: any[], filter: FilterKey) => {
  if (filter === "all") return orders;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  return orders.filter((o) => {
    const created = new Date(o.created_at);
    switch (filter) {
      case "today": return created >= startOfToday;
      case "week": return created >= startOfWeek;
      case "cod": return o.payment_method === "cod";
      case "delivered": return o.status === "delivered";
      default: return true;
    }
  });
};

const sellerRevenue = (o: any) =>
  (o.my_items ?? []).reduce((s: number, it: any) => s + Number(it.unit_price) * it.quantity, 0);

interface Props {
  orders: any[];
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
}

export const SellerOrdersWidget = ({ orders, filter, onFilterChange }: Props) => {
  const counts = useMemo(() => ({
    all: orders.length,
    today: filterOrders(orders, "today").length,
    week: filterOrders(orders, "week").length,
    cod: filterOrders(orders, "cod").length,
    delivered: filterOrders(orders, "delivered").length,
  }), [orders]);

  const filtered = useMemo(() => filterOrders(orders, filter), [orders, filter]);
  const revenue = useMemo(() => filtered.reduce((s, o) => s + sellerRevenue(o), 0), [filtered]);
  const pending = filtered.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ShoppingBag className="h-3.5 w-3.5" /> Orders
          </div>
          <div className="font-display text-2xl">{filtered.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> Revenue
          </div>
          <div className="font-display text-xl text-primary">{formatLKR(revenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
          </div>
          <div className="font-display text-2xl text-success">
            {filtered.filter((o) => o.status === "delivered").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" /> Pending
          </div>
          <div className="font-display text-2xl text-primary">{pending}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.key;
            return (
              <Button
                key={f.key}
                variant={active ? "hero" : "outline"}
                size="sm"
                onClick={() => onFilterChange(f.key)}
                className={cn("h-8")}
              >
                <Icon className="h-3.5 w-3.5 mr-1" />
                {f.label}
                <Badge
                  variant="secondary"
                  className={cn("ml-2 h-5", active && "bg-primary-foreground/20 text-primary-foreground")}
                >
                  {counts[f.key]}
                </Badge>
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
