import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    stock: number;
    seller_id: string;
  };
}

type CartRow = Omit<CartItem, "product"> & { product: CartItem["product"] | null };

interface CartCtx {
  items: CartItem[];
  loading: boolean;
  add: (productId: string, qty?: number) => Promise<void>;
  update: (id: string, qty: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  total: number;
  count: number;
}

const Ctx = createContext<CartCtx | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity, product:products(id, name, price, image_url, stock, seller_id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(((data ?? []) as CartRow[]).filter((item) => item.product).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.product as CartItem["product"],
      })) as CartItem[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (productId: string, qty = 1) => {
    if (!user) { toast.error("Please sign in to add to cart"); return; }
    const existing = items.find((i) => i.product_id === productId);
    if (existing) {
      await update(existing.id, existing.quantity + qty);
    } else {
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: productId,
        quantity: qty,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Added to cart");
      await refresh();
    }
  };

  const update = async (id: string, qty: number) => {
    if (qty <= 0) return remove(id);
    const { error } = await supabase.from("cart_items").update({ quantity: qty }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  };

  const clear = async () => {
    if (!user) return;
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setItems([]);
  };

  const total = items.reduce((s, i) => s + Number(i.product?.price ?? 0) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, loading, add, update, remove, clear, refresh, total, count }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
