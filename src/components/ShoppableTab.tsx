import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Upload, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { ShoppablePhoto } from "./ShoppablePhoto";

interface Product { id: string; name: string; image_url: string | null; price: number; }
interface PendingTag { productId: string; x: number; y: number; }

export function ShoppableTab({ sellerId, sellerProducts }: { sellerId: string; sellerProducts: Product[] }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // New photo state
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>("");
  const [newCaption, setNewCaption] = useState("");
  const [pendingTags, setPendingTags] = useState<PendingTag[]>([]);
  const [taggingMode, setTaggingMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => { loadPhotos(); }, [sellerId]);

  const loadPhotos = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("shoppable_photos")
      .select(`id, photo_url, caption, tags:shoppable_tags(id, product_id, x_percent, y_percent, product:products(id,name,price,image_url))`)
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    setPhotos(data ?? []);
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    setUploading(true);
    const path = `shoppable/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setNewPhotoUrl(pub.publicUrl);
    setUploading(false);
    e.target.value = "";
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!taggingMode || !selectedProduct) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingTags((t) => [...t, { productId: selectedProduct, x, y }]);
    toast.success("Tag placed! Add more or save.");
  };

  const savePhoto = async () => {
    if (!newPhotoUrl || !user) { toast.error("Upload a photo first"); return; }
    const { data: photo, error } = await (supabase as any)
      .from("shoppable_photos")
      .insert({ seller_id: user.id, photo_url: newPhotoUrl, caption: newCaption || null })
      .select().single();
    if (error) { toast.error(error.message); return; }

    if (pendingTags.length > 0) {
      await (supabase as any).from("shoppable_tags").insert(
        pendingTags.map((t) => ({ photo_id: photo.id, product_id: t.productId, x_percent: t.x, y_percent: t.y }))
      );
    }

    toast.success("Shoppable photo published!");
    setNewPhotoUrl(""); setNewCaption(""); setPendingTags([]); setTaggingMode(false); setSelectedProduct("");
    loadPhotos();
  };

  const deletePhoto = async (id: string) => {
    await (supabase as any).from("shoppable_photos").delete().eq("id", id);
    toast.success("Photo deleted");
    loadPhotos();
  };

  return (
    <div className="space-y-6">
      {/* Upload new shoppable photo */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Add Shoppable Photo</h3>

        {!newPhotoUrl ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted transition-smooth">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">{uploading ? "Uploading…" : "Upload lifestyle photo"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
          </label>
        ) : (
          <div className="space-y-3">
            {/* Preview with tag pins */}
            <div className="relative rounded-xl overflow-hidden border">
              <img
                ref={imgRef}
                src={newPhotoUrl}
                alt="preview"
                className={`w-full object-contain max-h-80 ${taggingMode ? "cursor-crosshair" : ""}`}
                onClick={handleImageClick}
                draggable={false}
              />
              {pendingTags.map((t, i) => {
                const prod = sellerProducts.find((p) => p.id === t.productId);
                return (
                  <div
                    key={i}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  >
                    <span className="h-5 w-5 bg-white border-2 border-primary rounded-full shadow-md flex items-center justify-center text-[9px] font-bold text-primary">{i + 1}</span>
                    {prod && <span className="bg-black/70 text-white text-[9px] rounded px-1 mt-0.5 whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis">{prod.name}</span>}
                    <button
                      type="button"
                      className="text-destructive mt-0.5"
                      onClick={() => setPendingTags((t2) => t2.filter((_, j) => j !== i))}
                    ><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
            </div>

            {/* Caption */}
            <Input placeholder="Caption (optional)" value={newCaption} onChange={(e) => setNewCaption(e.target.value)} />

            {/* Tag products */}
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground">🏷️ Tag products — select a product, then click on the photo</p>
              <div className="flex gap-2 flex-wrap">
                {sellerProducts.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedProduct(p.id); setTaggingMode(true); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-smooth ${selectedProduct === p.id && taggingMode ? "border-primary bg-primary/10 text-primary font-semibold" : "hover:border-primary/40"}`}
                  >
                    {p.image_url && <img src={p.image_url} className="h-5 w-5 rounded object-cover" alt="" />}
                    <span className="max-w-[100px] truncate">{p.name}</span>
                  </button>
                ))}
              </div>
              {taggingMode && selectedProduct && (
                <p className="text-xs text-primary font-medium animate-pulse">Click on the photo to place a tag ☝️</p>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setTaggingMode(false); setSelectedProduct(""); }}>
                Done tagging
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={savePhoto} className="flex-1">Publish Photo</Button>
              <Button variant="outline" onClick={() => { setNewPhotoUrl(""); setPendingTags([]); setTaggingMode(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Existing photos */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : photos.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Camera className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">No shoppable photos yet. Upload your first one above!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <ShoppablePhoto
                photoId={p.id}
                photoUrl={p.photo_url}
                caption={p.caption}
                tags={p.tags ?? []}
              />
              <button
                type="button"
                onClick={() => deletePhoto(p.id)}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-smooth shadow"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
