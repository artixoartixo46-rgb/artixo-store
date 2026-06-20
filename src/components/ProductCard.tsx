import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Check, Star } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useProductRating } from "@/components/ReviewSection";
import { VerifiedBadge, useSellerVerified } from "@/components/VerifiedBadge";

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number;
  is_trending?: boolean;
  original_price?: number | null;
  seller_id?: string | null;
}

export const ProductCard = ({ p }: { p: ProductCardData }) => {
  const { add } = useCart();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const { avg, count } = useProductRating(p.id);
  const isVerified = useSellerVerified(p.seller_id);

  const hasDiscount = p.original_price && Number(p.original_price) > Number(p.price);
  const discountPct = hasDiscount
    ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)
    : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    await add(p.id);
    setAdding(false);
    // Only show success checkmark if user is logged in (otherwise toast error shows)
    if (user) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

  return (
    <Card className="group overflow-hidden animate-fade-in p-0">
      <Link to={`/product/${p.id}`} className="block">
        <div className="aspect-square bg-muted relative overflow-hidden">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.name}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-bounce"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-12 w-12" />
            </div>
          )}
          {p.is_trending && (
            <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">🔥 Trending</Badge>
          )}
          {hasDiscount && (
            <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground">-{discountPct}%</Badge>
          )}
          {p.stock === 0 && (
            <Badge variant="destructive" className="absolute bottom-2 right-2">Out of stock</Badge>
          )}
        </div>
      </Link>
      <div className="p-3 space-y-2">
        <Link to={`/product/${p.id}`}>
          <h3 className="font-medium line-clamp-2 text-sm min-h-[2.5rem] hover:text-primary transition-smooth flex items-start gap-1">
            <span>{p.name}</span>
            {isVerified && <VerifiedBadge size="sm" className="shrink-0 mt-0.5" />}
          </h3>
        </Link>
        {avg !== null && count > 0 && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3 w-3 ${s <= Math.round(avg) ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-0.5">({count})</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold text-primary">{formatLKR(p.price)}</span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">{formatLKR(Number(p.original_price))}</span>
            )}
          </div>
          <Button
            size="icon"
            variant={added ? "success" : "hero"}
            className="h-8 w-8"
            disabled={p.stock === 0 || adding}
            onClick={handleAddToCart}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
};
