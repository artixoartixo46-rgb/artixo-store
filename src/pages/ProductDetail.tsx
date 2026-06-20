import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Package,
  Store,
  Truck,
  Shield,
  RotateCcw,
  Heart,
  Share2,
  Star,
  ChevronRight,
  Zap,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { formatLKR } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { ProductCard } from "@/components/ProductCard";
import { ReviewSection, useProductRating } from "@/components/ReviewSection";
import { ProductQA } from "@/components/ProductQA";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { SEO, buildProductSchema, orgSchema } from "@/components/SEO";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [related, setRelated] = useState<any[]>([]);
  const [activeImage, setActiveImage] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { add } = useCart();
  const { avg: realAvg, count: realCount } = useProductRating(id ?? "");

  useEffect(() => {
        if (!id) return;
    let cancelled = false;
    setLoading(true);
    setProduct(null);
    setRelated([]);
    setActiveImage("");
    setSelectedVariants({});
    setQty(1);
    window.scrollTo(0, 0);

    (async () => {
      // Fetch product by id
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Load category
      let categoryData: { name: string; slug: string } | null = null;
      if (data.category_id) {
        const { data: cData } = await supabase
          .from("categories")
          .select("name, slug")
          .eq("id", data.category_id)
          .single();
        if (cData) categoryData = cData as any;
      }

      // Load seller profile
      let sellerProfile: { fullName: string | null; shopName: string | null; isVerified: boolean; sellerId: string | null } | null = null;
      if (data.seller_id) {
        const { data: sData } = await (supabase as any)
          .from("profiles")
          .select("full_name, shop_name, is_verified")
          .eq("id", data.seller_id)
          .maybeSingle();
        if (sData) {
          sellerProfile = {
            fullName: sData.full_name ?? null,
            shopName: sData.shop_name ?? null,
            isVerified: sData.is_verified ?? false,
            sellerId: data.seller_id,
          };
        } else {
          // Fallback: column may not exist yet — fetch without is_verified
          const { data: sData2 } = await (supabase as any)
            .from("profiles")
            .select("full_name, shop_name")
            .eq("id", data.seller_id)
            .maybeSingle();
          if (sData2) {
            sellerProfile = {
              fullName: sData2.full_name ?? null,
              shopName: sData2.shop_name ?? null,
              isVerified: false,
              sellerId: data.seller_id,
            };
          }
        }
      }

      // Load related products
      let relatedDocs: any[] = [];
      if (data.category_id) {
        const { data: rData } = await supabase
          .from("products")
          .select("*")
          .eq("status", "approved")
          .eq("category_id", data.category_id)
          .neq("id", id)
          .limit(6);
        relatedDocs = (rData ?? []).map((rd: any) => ({
          id: rd.id,
          name: rd.name,
          price: rd.price,
          image_url: rd.image_url ?? null,
          stock: rd.stock,
          is_trending: rd.is_trending ?? false,
          original_price: rd.original_price ?? null,
        }));
      }

      if (cancelled) return;

      setProduct({
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        originalPrice: data.original_price ?? null,
        stock: data.stock,
        imageUrl: data.image_url ?? null,
        images: data.images ?? [],
        brand: data.brand ?? null,
        sku: data.sku ?? null,
        specifications: data.specifications ?? {},
        variants: data.variants ?? [],
        categories: categoryData,
        sellerProfile,
      });
      setRelated(relatedDocs);
      setActiveImage(data.image_url ?? (data.images?.[0] ?? ""));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="container py-12 text-center">Loading...</div>;
  if (!product)
    return (
      <div className="container py-12 text-center">
        Product not found.{" "}
        <Link to="/products" className="text-primary">Browse all</Link>
      </div>
    );

  const rating = realAvg ?? 0;
  const reviewCount = realCount;
  const soldCount = Math.floor(Math.random() * 1000) + 50;
  const hasOriginal = product.originalPrice && Number(product.originalPrice) > Number(product.price);
  const originalPrice = hasOriginal ? Number(product.originalPrice) : Number(product.price) * 1.25;
  const discountPct = Math.round(((originalPrice - product.price) / originalPrice) * 100);
  const gallery: string[] = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...((product.images ?? []) as string[]).filter((u: string) => u !== product.imageUrl),
  ];
  const specEntries = Object.entries(product.specifications ?? {});
  // Parse variants from DB format {sizes:[], colors:[{name,image}|string]}
  const rawVariants = product.variants ?? {};
  const sizesArr: string[] = Array.isArray(rawVariants.sizes) ? rawVariants.sizes : [];
  const colorsArr: { name: string; image: string }[] = Array.isArray(rawVariants.colors)
    ? rawVariants.colors.map((c: any) => typeof c === "string" ? { name: c, image: "" } : c)
    : [];
  const videoUrl: string = typeof rawVariants.video_url === "string" ? rawVariants.video_url : "";
  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const embedUrl = isYouTube
    ? videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/").replace("shorts/", "embed/")
    : "";

  const handleBuyNow = async () => {
    await add(product.id, qty);
    navigate("/checkout");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const toggleWishlist = () => {
    setWishlisted((w) => !w);
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
  };

  const productSchema = buildProductSchema({
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    price: Number(product.price),
    image: gallery,
    brand: product.brand ?? undefined,
    sku: product.sku ?? undefined,
    stock: product.stock,
    ratingValue: rating > 0 ? rating : undefined,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    category: product.categories?.name ?? undefined,
  });

  return (
    <div className="bg-muted/30 min-h-screen pb-24 md:pb-8">
      <SEO
        title={product.name}
        description={product.description ? product.description.slice(0, 155) + (product.description.length > 155 ? "…" : "") : `Buy ${product.name} in Sri Lanka. Fast island-wide delivery on ARTIXO.`}
        canonical={`/product/${product.id}`}
        image={gallery[0]}
        type="product"
        schema={[productSchema, orgSchema]}
      />
      {/* Breadcrumbs */}
      <div className="container pt-4">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <Link to="/" className="hover:text-primary transition-smooth">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/products" className="hover:text-primary transition-smooth">Products</Link>
          {product.categories && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link to={`/products?category=${product.categories.slug}`} className="hover:text-primary transition-smooth">
                {product.categories.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </nav>
      </div>

      <div className="container py-4">
        <div className="grid lg:grid-cols-[1fr_1.2fr_320px] gap-4">
          {/* Image gallery */}
          <div className="lg:sticky lg:top-20 self-start space-y-2">
            <Card
              className="aspect-square overflow-hidden bg-background relative group"
              onClick={() => {
                if (activeImage && activeImage !== "__video__") {
                  const i = gallery.indexOf(activeImage);
                  setLightboxIndex(i >= 0 ? i : 0);
                  setLightboxOpen(true);
                }
              }}
              style={{ cursor: activeImage && activeImage !== "__video__" ? "zoom-in" : "default" }}
            >
              {activeImage === "__video__" ? (
                isYouTube ? (
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Product video" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <video src={videoUrl} controls autoPlay className="w-full h-full" onClick={(e) => e.stopPropagation()} />
                )
              ) : activeImage ? (
                <>
                  <img src={activeImage} alt={product.name} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
                  <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="h-4 w-4 text-white" />
                  </div>
                  {gallery.length > 1 && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-medium rounded-full px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {gallery.indexOf(activeImage) + 1} / {gallery.length}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </Card>

            {(videoUrl || gallery.length > 1) && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {videoUrl && (
                  <button
                    onClick={() => setActiveImage("__video__")}
                    className={`shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-smooth relative bg-black flex items-center justify-center ${activeImage === "__video__" ? "border-primary" : "border-transparent hover:border-muted-foreground/40"}`}
                  >
                    <Package className="h-6 w-6 text-white/70" />
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-white/80 font-medium">VIDEO</span>
                  </button>
                )}
                {gallery.map((url, i) => (
                  <button
                    key={i}
                    onMouseEnter={() => setActiveImage(url)}
                    onClick={() => setActiveImage(url)}
                    className={`shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-smooth ${activeImage === url ? "border-primary" : "border-transparent hover:border-muted-foreground/40"}`}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox */}
          {lightboxOpen && gallery.length > 0 && (
            <ImageLightbox
              images={gallery}
              startIndex={lightboxIndex}
              productName={product.name}
              onClose={() => setLightboxOpen(false)}
            />
          )}

          {/* Details */}
          <Card className="p-5 space-y-4 bg-background">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display text-xl md:text-2xl leading-snug flex-1">{product.name}</h1>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={toggleWishlist}>
                  <Heart className={`h-5 w-5 ${wishlisted ? "fill-primary text-primary" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleShare}>
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {(product.brand || product.sku) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {product.brand && <span>Brand: <span className="text-foreground font-medium">{product.brand}</span></span>}
                {product.brand && product.sku && <Separator orientation="vertical" className="h-3" />}
                {product.sku && <span>SKU: <span className="text-foreground font-medium">{product.sku}</span></span>}
              </div>
            )}

            <div className="flex items-center gap-3 text-sm flex-wrap">
              {reviewCount > 0 ? (
                <>
                  <div className="flex items-center gap-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`h-4 w-4 ${s <= Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="font-medium">{rating.toFixed(1)}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-muted-foreground">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</span>
                  <Separator orientation="vertical" className="h-4" />
                </>
              ) : (
                <span className="text-muted-foreground text-xs">No reviews yet</span>
              )}
              <span className="text-muted-foreground">{soldCount} sold</span>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 space-y-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-display font-bold text-primary">{formatLKR(product.price)}</span>
                <span className="text-muted-foreground line-through text-sm">{formatLKR(originalPrice)}</span>
                <Badge className="bg-destructive text-destructive-foreground">-{discountPct}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {product.stock > 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-success font-medium">In Stock</span>
                  <span className="text-muted-foreground">({product.stock} available)</span>
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 text-destructive" />
                  <span className="text-destructive font-medium">Out of stock</span>
                </>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Product Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {product.description || "No description provided."}
              </p>
            </div>

            {specEntries.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Specifications</h3>
                  <div className="border rounded-lg overflow-hidden">
                    {specEntries.map(([k, v], i) => (
                      <div key={k} className={`grid grid-cols-[140px_1fr] text-sm ${i % 2 === 0 ? "bg-muted/40" : "bg-background"}`}>
                        <div className="p-2.5 text-muted-foreground border-r">{k}</div>
                        <div className="p-2.5">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(sizesArr.length > 0 || colorsArr.length > 0) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {sizesArr.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1.5">
                        Size: <span className="text-muted-foreground font-normal">{selectedVariants["Size"] || "Select"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sizesArr.map((val) => {
                          const active = selectedVariants["Size"] === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSelectedVariants((s) => ({ ...s, Size: val }))}
                              className={`px-3 py-1.5 text-sm rounded-lg border-2 transition-smooth ${active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/50"}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {colorsArr.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1.5">
                        Color: <span className="text-muted-foreground font-normal">{selectedVariants["Color"] || "Select"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {colorsArr.map((cv) => {
                          const active = selectedVariants["Color"] === cv.name;
                          return (
                            <button
                              key={cv.name}
                              type="button"
                              onClick={() => {
                                setSelectedVariants((s) => ({ ...s, Color: cv.name }));
                                if (cv.image) setActiveImage(cv.image);
                              }}
                              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-smooth ${active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                            >
                              {cv.image ? (
                                <img src={cv.image} alt={cv.name} className="h-12 w-12 rounded object-cover" />
                              ) : (
                                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <span className={`text-xs font-medium ${active ? "text-primary" : ""}`}>{cv.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {product.stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-lg">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-1.5 hover:bg-muted transition-smooth">−</button>
                  <span className="px-4 font-medium min-w-[2.5rem] text-center">{qty}</span>
                  <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="px-3 py-1.5 hover:bg-muted transition-smooth">+</button>
                </div>
              </div>
            )}

            {product.stock > 0 && (
              <>
              <div className="hidden md:flex items-center gap-3 pt-2">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => add(product.id, qty)}>
                  <ShoppingCart className="h-5 w-5 mr-2" /> Add to Cart
                </Button>
                <Button variant="hero" size="lg" className="flex-1" onClick={handleBuyNow}>
                  <Zap className="h-5 w-5 mr-2" /> Buy Now
                </Button>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/product/${product.id}/tryon`)}>
                  <Wand2 className="h-4 w-4 mr-1" /> Virtual Try-On
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/product/${product.id}/fit-analysis`)}>
                  <Wand2 className="h-4 w-4 mr-1" /> Fit Analysis
                </Button>
              </div>
              </>
            )}
          </Card>

          {/* Right: Seller + Delivery */}
          <div className="space-y-4">
            <Card className="p-4 space-y-3 bg-background">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Sold by</div>
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    {product.sellerProfile?.sellerId ? (
                      <Link
                        to={`/seller/${product.sellerProfile.sellerId}`}
                        className="truncate hover:text-primary transition-colors"
                      >
                        {product.sellerProfile?.shopName || product.sellerProfile?.fullName || "ARTIXO Seller"}
                      </Link>
                    ) : (
                      <span className="truncate">{product.sellerProfile?.shopName || product.sellerProfile?.fullName || "ARTIXO Seller"}</span>
                    )}
                    {product.sellerProfile?.isVerified && <VerifiedBadge size="sm" />}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div><div className="font-medium">Island-wide Delivery</div><div className="text-xs text-muted-foreground">Delivered in 2-5 business days</div></div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div><div className="font-medium">Cash on Delivery</div><div className="text-xs text-muted-foreground">Pay when you receive</div></div>
                </div>
                <div className="flex items-start gap-2">
                  <RotateCcw className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                  <div><div className="font-medium">7-Day Returns</div><div className="text-xs text-muted-foreground">Easy refund if damaged</div></div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <ReviewSection productId={product.id} productName={product.name} />

        <ProductQA productId={product.id} sellerId={product.sellerProfile?.sellerId} />

        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-2xl mb-4">You may also like</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {related.map((r) => <ProductCard key={r.id} p={r} />)}
            </div>
          </div>
        )}
      </div>

      {product.stock > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-3 flex gap-2 z-50 shadow-lg">
          <Button variant="outline" className="flex-1" onClick={() => add(product.id, qty)}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Cart
          </Button>
          <Button variant="hero" className="flex-1" onClick={handleBuyNow}>
            <Zap className="h-4 w-4 mr-1" /> Buy Now
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;




