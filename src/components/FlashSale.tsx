import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { Link } from "react-router-dom";

interface Props { products: ProductCardData[] }

export const FlashSale = ({ products }: Props) => {
  // 24-hour rolling countdown for visual effect
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end.getTime() - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTime({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (products.length === 0) return null;

  const Box = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 font-display font-bold text-lg min-w-[2.5rem] text-center tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</span>
    </div>
  );

  return (
    <section className="container py-8">
      <Card className="overflow-hidden border-0 shadow-card">
        <div className="gradient-saffron px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-primary-foreground">
            <Zap className="h-5 w-5 fill-current" />
            <h2 className="font-display text-lg md:text-2xl font-extrabold">Flash Sale</h2>
            <span className="hidden sm:inline text-sm opacity-80">Ends today!</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary-foreground hidden sm:inline">Ends in:</span>
            <div className="flex items-end gap-1">
              <Box value={time.h} label="Hrs" />
              <span className="font-bold text-secondary pb-5">:</span>
              <Box value={time.m} label="Min" />
              <span className="font-bold text-secondary pb-5">:</span>
              <Box value={time.s} label="Sec" />
            </div>
            <Link to="/products" className="hidden md:inline text-xs text-primary-foreground hover:underline ml-2">
              See all →
            </Link>
          </div>
        </div>
        <div className="p-3 md:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {products.slice(0, 6).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </Card>
    </section>
  );
};
