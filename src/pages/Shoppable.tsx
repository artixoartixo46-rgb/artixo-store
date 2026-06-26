import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppablePhoto } from "@/components/ShoppablePhoto";
import { SEO } from "@/components/SEO";
import { Camera } from "lucide-react";

const Shoppable = () => {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("shoppable_photos")
        .select(`
          id, photo_url, caption, seller_id, created_at,
          seller:profiles(full_name, shop_name),
          tags:shoppable_tags(id, product_id, x_percent, y_percent,
            product:products(id, name, price, image_url)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(40);
      setPhotos(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="container py-6">
      <SEO title="Shoppable Photos — ARTIXO" description="Tap any pin to shop the look on ARTIXO" />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Camera className="h-6 w-6 text-primary" /> Shop the Look
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Tap the white dots to discover & buy tagged products</p>
      </div>

      {loading ? (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse" style={{ height: `${180 + (i % 3) * 60}px` }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="py-20 text-center">
          <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">No shoppable photos yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Sellers can add them from their dashboard.</p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
          {photos.map((p) => (
            <div key={p.id} className="break-inside-avoid">
              <ShoppablePhoto
                photoId={p.id}
                photoUrl={p.photo_url}
                caption={p.caption}
                sellerId={p.seller_id}
                sellerName={p.seller?.shop_name || p.seller?.full_name}
                tags={p.tags ?? []}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shoppable;
