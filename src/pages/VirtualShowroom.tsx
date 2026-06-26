import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { formatLKR } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { ShoppingCart, Home, RotateCcw } from "lucide-react";

interface PlacedItem {
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  price: number;
  x: number; // % of canvas
  y: number;
  w: number;
  h: number;
}

const WALL_COLOR = "#e8e0d5";
const FLOOR_COLOR = "#c8b89a";
const SKIRTING_COLOR = "#bfae98";

export default function VirtualShowroom() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [selected, setSelected] = useState<PlacedItem | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offX: number; offY: number } | null>(null);
  const [category, setCategory] = useState("furniture");
  const { add } = useCart();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("products").select("id,name,price,image_url,category_id")
        .eq("status", "approved").limit(30);
      setProducts(data ?? []);
    };
    load();
  }, []);

  // Draw room
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const horizon = H * 0.55;

    ctx.clearRect(0, 0, W, H);

    // Wall
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, W, horizon);

    // Floor (perspective trapezoid)
    ctx.fillStyle = FLOOR_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, horizon); ctx.lineTo(W, horizon);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();

    // Skirting board
    ctx.fillStyle = SKIRTING_COLOR;
    ctx.fillRect(0, horizon - 8, W, 8);

    // Floor tiles
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    const tileW = W / 6;
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * tileW, horizon); ctx.lineTo(i * tileW, H); ctx.stroke();
    }
    for (let j = 0; j <= 4; j++) {
      const y = horizon + (j / 4) * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw placed items (back to front by y)
    const sorted = [...placed].sort((a, b) => a.y - b.y);
    sorted.forEach((item) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const x = (item.x / 100) * W - item.w / 2;
        const y = (item.y / 100) * H - item.h;
        ctx.drawImage(img, x, y, item.w, item.h);
        if (selected?.id === item.id) {
          ctx.strokeStyle = "#8B1A2E";
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 2, y - 2, item.w + 4, item.h + 4);
        }
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.ellipse(x + item.w / 2, (item.y / 100) * H + 4, item.w * 0.4, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      img.src = item.imageUrl;
    });
  }, [placed, selected]);

  const addToRoom = (product: any) => {
    const newItem: PlacedItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      imageUrl: product.image_url ?? "",
      price: product.price,
      x: 30 + Math.random() * 40,
      y: 75 + Math.random() * 15,
      w: 120, h: 120,
    };
    setPlaced((p) => [...p, newItem]);
    setSelected(newItem);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    const W = canvas.width, H = canvas.height;

    const hit = [...placed].reverse().find((item) => {
      const ix = (item.x / 100) * W - item.w / 2;
      const iy = (item.y / 100) * H - item.h;
      const cx = (mx / 100) * W, cy = (my / 100) * H;
      return cx >= ix && cx <= ix + item.w && cy >= iy && cy <= iy + item.h;
    });
    setSelected(hit ?? null);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    const W = canvas.width, H = canvas.height;

    const hit = [...placed].reverse().find((item) => {
      const ix = (item.x / 100) * W - item.w / 2;
      const iy = (item.y / 100) * H - item.h;
      const cx = (mx / 100) * W, cy = (my / 100) * H;
      return cx >= ix && cx <= ix + item.w && cy >= iy && cy <= iy + item.h;
    });
    if (hit) {
      canvas.setPointerCapture(e.pointerId);
      setDragging({ id: hit.id, offX: mx - hit.x, offY: my - hit.y });
      setSelected(hit);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    setPlaced((p) => p.map((item) => item.id === dragging.id
      ? { ...item, x: Math.min(95, Math.max(5, mx - dragging.offX)), y: Math.min(95, Math.max(56, my - dragging.offY)) }
      : item
    ));
  };

  const handleCanvasPointerUp = () => setDragging(null);

  const resizeSelected = (delta: number) => {
    if (!selected) return;
    setPlaced((p) => p.map((item) => item.id === selected.id
      ? { ...item, w: Math.max(60, item.w + delta), h: Math.max(60, item.h + delta) }
      : item
    ));
  };

  const removeSelected = () => {
    if (!selected) return;
    setPlaced((p) => p.filter((i) => i.id !== selected.id));
    setSelected(null);
  };

  const buySelected = async () => {
    if (!selected) return;
    await add(selected.productId, 1);
    toast.success(`${selected.name} added to cart!`);
  };

  return (
    <div className="container py-6">
      <SEO title="Virtual Showroom — ARTIXO" description="Place furniture and decor in your virtual room before buying" />
      <div className="mb-4 flex items-center gap-2">
        <Home className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Virtual Showroom</h1>
        <span className="text-muted-foreground text-sm">— Place products in your room before buying</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        {/* Room canvas */}
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={800} height={500}
            className="w-full rounded-xl border shadow-sm cursor-pointer bg-background"
            onClick={handleCanvasClick}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
          />
          <p className="text-xs text-muted-foreground text-center">Click a product below to place it. Drag to move. Use controls to resize.</p>

          {/* Selected item controls */}
          {selected && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border flex-wrap">
              <span className="text-sm font-medium flex-1 truncate">{selected.name}</span>
              <span className="text-sm font-bold text-primary">{formatLKR(selected.price)}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => resizeSelected(-20)} title="Shrink">-</Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => resizeSelected(20)} title="Grow">+</Button>
              <Button size="sm" className="h-7 gap-1" onClick={buySelected}><ShoppingCart className="h-3 w-3" /> Buy</Button>
              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={removeSelected}><RotateCcw className="h-3 w-3" /></Button>
            </div>
          )}
        </div>

        {/* Product picker */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Tap to place in room:</p>
          <div className="grid grid-cols-2 gap-2 max-h-[520px] overflow-y-auto pr-1">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToRoom(p)}
                className="rounded-xl border overflow-hidden text-left hover:border-primary/60 hover:shadow-sm transition-smooth group"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                  }
                </div>
                <div className="p-1.5">
                  <p className="text-xs font-medium line-clamp-1">{p.name}</p>
                  <p className="text-xs text-primary font-bold">{formatLKR(p.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
