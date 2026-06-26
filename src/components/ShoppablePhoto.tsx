import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { toast } from "sonner";

interface Tag {
  id: string;
  product_id: string;
  x_percent: number;
  y_percent: number;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

interface Props {
  photoId: string;
  photoUrl: string;
  caption?: string | null;
  sellerName?: string;
  sellerId?: string;
  tags: Tag[];
}

export function ShoppablePhoto({ photoUrl, caption, sellerName, sellerId, tags }: Props) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { add } = useCart();

  const handleAddToCart = async (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    if (!tag.product) return;
    await add(tag.product_id, 1);
    toast.success(`${tag.product.name} added to cart!`);
  };

  return (
    <div className="relative rounded-xl overflow-hidden group bg-muted">
      <img
        src={photoUrl}
        alt={caption ?? "Shoppable photo"}
        className="w-full h-full object-cover"
        draggable={false}
        onClick={() => setActiveTag(null)}
      />

      {/* Tag pins */}
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${tag.x_percent}%`, top: `${tag.y_percent}%` }}
          onClick={(e) => { e.stopPropagation(); setActiveTag(activeTag === tag.id ? null : tag.id); }}
        >
          {/* Pulsing dot */}
          <span className="relative flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-white border-2 border-primary shadow-md" />
          </span>

          {/* Product popup */}
          {activeTag === tag.id && tag.product && (
            <div
              className="absolute z-20 bottom-7 left-1/2 -translate-x-1/2 w-48 bg-background border rounded-xl shadow-xl p-2 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-2 items-start">
                {tag.product.image_url && (
                  <img src={tag.product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold line-clamp-2 leading-tight">{tag.product.name}</p>
                  <p className="text-xs font-bold text-primary mt-0.5">{formatLKR(tag.product.price)}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={(e) => handleAddToCart(e, tag)}>
                  <ShoppingCart className="h-3 w-3" /> Add
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" asChild>
                  <Link to={`/product/${tag.product_id}`}>View</Link>
                </Button>
              </div>
            </div>
          )}
        </button>
      ))}

      {/* Caption + seller */}
      {(caption || sellerName) && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 pointer-events-none">
          {caption && <p className="text-white text-sm font-medium line-clamp-2">{caption}</p>}
          {sellerName && sellerId && (
            <Link to={`/seller/${sellerId}`} className="text-white/70 text-xs hover:text-white pointer-events-auto">
              @{sellerName}
            </Link>
          )}
        </div>
      )}

      {/* Tag count badge */}
      {tags.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold rounded-full px-2 py-0.5 pointer-events-none">
          🛍️ {tags.length} item{tags.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
