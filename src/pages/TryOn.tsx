import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Wand2, ArrowLeft, ImageIcon, User, ChevronRight, Download, Sparkles } from "lucide-react";

const TRYON_ENDPOINT = "https://qzhcxtqkdcygzadcttyf.supabase.co/functions/v1/tryon";

// Canvas-based try-on: overlays garment onto person photo in the browser
const generateCanvasTryOn = (personUrl: string, garmentUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject("Canvas not supported"); return; }

    const personImg = new Image();
    const garmentImg = new Image();
    personImg.crossOrigin = "anonymous";
    garmentImg.crossOrigin = "anonymous";

    personImg.onload = () => {
      const W = personImg.naturalWidth;
      const H = personImg.naturalHeight;
      canvas.width = W;
      canvas.height = H;

      // Draw person photo as background
      ctx.drawImage(personImg, 0, 0, W, H);

      garmentImg.onload = () => {
        // Position garment over upper-body area (chest region)
        // Roughly: from 15% top to 70% height, centered horizontally
        const gW = W * 0.7;
        const gH = (garmentImg.naturalHeight / garmentImg.naturalWidth) * gW;
        const gX = (W - gW) / 2;
        const gY = H * 0.14;

        // Blend garment over person with multiply-like effect
        ctx.globalAlpha = 0.88;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(garmentImg, gX, gY, gW, gH);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        // Subtle vignette for realism
        const gradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.12)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      garmentImg.onerror = () => reject("Failed to load garment image");
      garmentImg.src = garmentUrl;
    };
    personImg.onerror = () => reject("Failed to load person image");
    personImg.src = personUrl;
  });
};

const TryOn = () => {
  const { id: productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [fitProfile, setFitProfile] = useState<any>(null);
  const [personImageUrl, setPersonImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultMode, setResultMode] = useState<"ai" | "canvas" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const [{ data: prod }, { data: fp }] = await Promise.all([
        supabase.from("products").select("id, name, image_url").eq("id", productId).single(),
        supabase.from("user_fit_profiles").select("front_photo_url").eq("user_id", user.id).maybeSingle(),
      ]);
      setProduct(prod);
      if (fp) {
        setFitProfile(fp);
        if (fp.front_photo_url) setPersonImageUrl(fp.front_photo_url);
      }
    })();
  }, [productId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately using local blob URL
    const blobUrl = URL.createObjectURL(file);
    setPersonImageUrl(blobUrl);
    setResultUrl("");
    setResultMode(null);
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUploading(false); return; }

      const ext = file.name.split(".").pop();
      const path = `tryon-photos/${user.id}/${Date.now()}.${ext}`;

      // Try tryon-photos bucket, fall back to products bucket
      let uploaded = false;
      const { error: err1 } = await supabase.storage.from("tryon-photos").upload(path, file, { upsert: true });
      if (!err1) {
        const { data: urlData } = supabase.storage.from("tryon-photos").getPublicUrl(path);
        setPersonImageUrl(urlData.publicUrl);
        uploaded = true;
      }
      if (!uploaded) {
        const { error: err2 } = await supabase.storage.from("products").upload(path, file, { upsert: true });
        if (!err2) {
          const { data: urlData } = supabase.storage.from("products").getPublicUrl(path);
          setPersonImageUrl(urlData.publicUrl);
        }
      }
    } catch { /* blob URL preview still works */ }
    setUploading(false);
  };

  const handleGenerate = async () => {
    if (!personImageUrl) { toast.error("Please upload your photo first"); return; }
    if (!product?.image_url) { toast.error("Product has no image"); return; }

    setGenerating(true);
    setError("");
    setResultUrl("");
    setResultMode(null);

    // 1. Try AI edge function first
    let aiSuccess = false;
    try {
      const res = await fetch(TRYON_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          garment_image_url: product.image_url,
          person_image_url: personImageUrl,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.output_url) {
        setResultUrl(data.output_url);
        setResultMode("ai");
        toast.success("AI Try-On generated!");
        aiSuccess = true;
      }
    } catch { /* fall through to canvas */ }

    // 2. Canvas fallback — works 100% with no API key
    if (!aiSuccess) {
      try {
        toast.info("Generating try-on preview...");
        const canvasResult = await generateCanvasTryOn(personImageUrl, product.image_url);
        setResultUrl(canvasResult);
        setResultMode("canvas");
        toast.success("Try-On preview ready!");
      } catch (err) {
        setError("Could not generate try-on. Please try a different photo.");
      }
    }

    setGenerating(false);
  };

  if (!product) return <div className="container py-12 text-center">Loading...</div>;

  return (
    <div className="container max-w-2xl py-8">
      <button
        onClick={() => navigate(`/product/${productId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to product
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Virtual Try-On</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Garment */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-primary" /> Garment
          </div>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-48 w-full object-contain rounded-lg bg-muted" />
          ) : (
            <div className="h-48 flex items-center justify-center bg-muted rounded-lg text-muted-foreground text-sm">No product image</div>
          )}
          <p className="text-xs text-muted-foreground">{product.name}</p>
        </Card>

        {/* Person photo */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-primary" /> Your Photo
          </div>
          {personImageUrl ? (
            <img src={personImageUrl} alt="You" className="h-48 w-full object-contain rounded-lg bg-muted" />
          ) : (
            <div className="h-48 flex items-center justify-center bg-muted rounded-lg text-muted-foreground text-sm flex-col gap-2">
              <User className="h-8 w-8 opacity-40" />
              <span>Upload a full-body photo</span>
            </div>
          )}
          <label className="flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-muted transition-colors w-fit text-xs">
            <Upload className="h-3 w-3" />
            {uploading ? "Uploading..." : personImageUrl ? "Change Photo" : "Upload Photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {!fitProfile?.front_photo_url && (
            <button onClick={() => navigate("/fit-profile")} className="flex items-center gap-1 text-xs text-primary hover:underline">
              Save to Fit Profile <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </Card>
      </div>

      <Button onClick={handleGenerate} disabled={generating || !personImageUrl || !product?.image_url} size="lg" className="w-full">
        <Wand2 className="h-5 w-5 mr-2" />
        {generating ? "Generating try-on..." : "Generate Try-On"}
      </Button>

      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
      )}

      {/* Result */}
      {resultUrl && (
        <Card className="mt-6 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your Virtual Try-On</h2>
            {resultMode === "ai" ? (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> AI Generated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                <Wand2 className="h-3 w-3" /> Preview
              </span>
            )}
          </div>
          <img src={resultUrl} alt="Try-on result" className="w-full rounded-lg" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate(`/product/${productId}/fit-analysis`)}>
              Check Fit & Size →
            </Button>
            <a
              href={resultUrl}
              download={`tryon-${product.name}.jpg`}
              className="flex-1"
            >
              <Button variant="secondary" className="w-full">
                <Download className="h-4 w-4 mr-1" /> Save
              </Button>
            </a>
          </div>
          {resultMode === "canvas" && (
            <p className="text-xs text-center text-muted-foreground">
              For photorealistic AI try-on, add <strong>REPLICATE_API_TOKEN</strong> to Supabase secrets.
            </p>
          )}
        </Card>
      )}
    </div>
  );
};

export default TryOn;
