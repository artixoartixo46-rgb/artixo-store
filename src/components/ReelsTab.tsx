import { useEffect, useRef, useState } from "react";
import { Film, Upload, Trash2, Play, Eye, Heart, Link2, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product { id: string; name: string; price: number; }

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string;
  likes: number;
  views: number;
  product_id: string | null;
  created_at: string;
}

interface ReelsTabProps {
  sellerId: string;
  products: Product[];
}

export const ReelsTab = ({ sellerId, products }: ReelsTabProps) => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [productId, setProductId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const fetchReels = async () => {
    const { data } = await supabase
      .from("reels")
      .select("id, video_url, thumbnail_url, caption, likes, views, product_id, created_at")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    setReels((data ?? []) as Reel[]);
    setLoading(false);
  };

  useEffect(() => { fetchReels(); }, [sellerId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100MB");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!videoFile) { toast.error("Select a video first"); return; }
    setUploading(true);
    try {
      const ext = videoFile.name.split(".").pop() ?? "mp4";
      const path = `${sellerId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("reels")
        .upload(path, videoFile, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from("reels").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("reels").insert({
        seller_id: sellerId,
        video_url: pub.publicUrl,
        caption: caption.trim(),
        product_id: productId || null,
        likes: 0,
        views: 0,
      });
      if (insertErr) throw insertErr;

      toast.success("Reel uploaded! 🎬");
      setVideoFile(null);
      setVideoPreview(null);
      setCaption("");
      setProductId("");
      if (videoInputRef.current) videoInputRef.current.value = "";
      fetchReels();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    }
    setUploading(false);
  };

  const handleDelete = async (reel: Reel) => {
    if (!confirm("Delete this reel?")) return;
    setDeleting(reel.id);
    try {
      // Extract storage path from URL
      const url = new URL(reel.video_url);
      const storagePath = url.pathname.split("/reels/")[1];
      if (storagePath) {
        await supabase.storage.from("reels").remove([storagePath]);
      }
      await supabase.from("reels").delete().eq("id", reel.id);
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
      toast.success("Reel deleted");
    } catch {
      toast.error("Delete failed");
    }
    setDeleting(null);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" /> Product Reels
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload 15–60s videos. They appear on the /reels feed for buyers to discover & buy.
          </p>
        </div>
        <a
          href="/reels"
          target="_blank"
          rel="noreferrer"
          className="text-xs flex items-center gap-1 text-primary hover:underline"
        >
          <Eye className="h-3.5 w-3.5" /> View feed
        </a>
      </div>

      {/* Upload card */}
      <div className="border rounded-2xl p-4 space-y-4 bg-muted/20">
        <p className="text-sm font-medium">Upload New Reel</p>

        {/* Video picker */}
        {videoPreview ? (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-64 mx-auto w-fit">
            <video
              ref={previewRef}
              src={videoPreview}
              controls
              className="h-full w-auto max-w-full mx-auto"
            />
            <button
              onClick={() => { setVideoFile(null); setVideoPreview(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 flex items-center justify-center text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-all">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Click to upload video</p>
            <p className="text-xs text-muted-foreground">MP4, WebM, MOV • Max 100MB • 15–60 seconds</p>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {/* Caption */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={150}
            placeholder="Describe your product… #fashion #srilanka"
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{caption.length}/150</p>
        </div>

        {/* Link product */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Link2 className="h-3 w-3" /> Link a Product (optional)
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">No product linked</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — LKR {Number(p.price).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!videoFile || uploading}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg,#8B1A2E,#c0392b)" }}
        >
          {uploading ? (
            <><div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Uploading…</>
          ) : (
            <><Plus className="h-4 w-4" />Publish Reel</>
          )}
        </button>
      </div>

      {/* My reels */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" /> My Reels ({reels.length})
        </h3>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1,2,3].map((i) => (
              <div key={i} className="aspect-[9/16] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-2xl">
            <Film className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reels yet — upload your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {reels.map((reel) => (
              <div key={reel.id} className="relative group rounded-xl overflow-hidden bg-black aspect-[9/16]">
                <video
                  src={reel.video_url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                  onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Play icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-0 transition-opacity">
                  <Play className="h-8 w-8 text-white fill-white drop-shadow" />
                </div>

                {/* Stats */}
                <div className="absolute bottom-2 left-2 flex items-center gap-2 text-white text-xs">
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{reel.views}</span>
                  <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{reel.likes}</span>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(reel)}
                  disabled={deleting === reel.id}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  {deleting === reel.id
                    ? <div className="h-3 w-3 border border-white/50 border-t-white rounded-full animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>

                {/* Caption */}
                {reel.caption && (
                  <p className="absolute bottom-7 left-2 right-2 text-white text-[10px] leading-tight line-clamp-2 drop-shadow">
                    {reel.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
