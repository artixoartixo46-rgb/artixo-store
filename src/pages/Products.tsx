import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LayoutGrid, List, SlidersHorizontal, Package, Sparkles, X } from "lucide-react";
import { formatLKR } from "@/lib/format";
import { Link } from "react-router-dom";

interface Category { id: string; name: string; slug: string; }
type Sort = "newest" | "price_asc" | "price_desc" | "name_asc";

const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  name_asc: "Name: A to Z",
};

const Products = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const cat = params.get("category") ?? "";

  // AI search params
  const aiQuery = params.get("aiQuery") ? decodeURIComponent(params.get("aiQuery")!) : "";
  const aiMaxPrice = params.get("maxPrice") ? Number(params.get("maxPrice")) : null;
  const aiMinPrice = params.get("minPrice") ? Number(params.get("minPrice")) : null;
  const aiBrand = params.get("brand") ?? "";
  const aiOnSale = params.get("onSale") === "true";
  const aiSortParam = (params.get("sort") as Sort) ?? "";

  const [products, setProducts] = useState<(ProductCardData & { brand?: string; categorySlug?: string })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  useEffect(() => {
        supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  useEffect(() => {
        setLoading(true);
    (async () => {
      // Fetch categories for slug→id mapping
      const { data: catData } = await supabase.from("categories").select("*");
      const catBySlug: Record<string, string> = {};
      (catData ?? []).forEach((c: any) => { catBySlug[c.slug] = c.id; });

      // Fetch approved products
      const { data: prodData } = await supabase
        .from("products")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      let list = (prodData ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        price: d.price,
        image_url: d.image_url ?? null,
        stock: d.stock,
        is_trending: d.is_trending ?? false,
        original_price: d.original_price ?? null,
        brand: d.brand ?? null,
        categoryId: d.category_id ?? null,
        categorySlug: (catData ?? []).find((c: any) => c.id === d.category_id)?.slug ?? null,
      }));

      // Filter by search query
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

      // Filter by category slug
      if (cat) {
        const targetCatId = catBySlug[cat];
        if (targetCatId) list = list.filter((p) => p.categoryId === targetCatId);
      }

            const max = Math.max(100, Math.ceil(Math.max(...list.map((p) => Number(p.price)), 0) / 100) * 100);
      setMaxPrice(max);

      // Apply AI price range to slider if provided
      const aiMax = params.get("maxPrice") ? Number(params.get("maxPrice")) : null;
      const aiMin = params.get("minPrice") ? Number(params.get("minPrice")) : null;
      if (aiMax || aiMin) {
        setPriceRange([Math.max(0, aiMin ?? 0), Math.min(aiMax ?? max, max)]);
      } else {
        setPriceRange([0, max]);
      }

      setBrands(Array.from(new Set(list.map((p) => p.brand).filter(Boolean))) as string[]);
      setSelectedBrand(params.get("brand") ?? "");
      setOnlyDiscounted(params.get("onSale") === "true");
      const sp = params.get("sort") as Sort | null;
      if (sp) setSort(sp); else setSort("newest");

      setProducts(list);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat, params.get("aiQuery")]);

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) => Number(p.price) >= priceRange[0] && Number(p.price) <= priceRange[1],
    );
    if (selectedBrand) list = list.filter((p: any) => p.brand === selectedBrand);
    if (onlyDiscounted) list = list.filter((p) => p.original_price && Number(p.original_price) > Number(p.price));
    switch (sort) {
      case "price_asc": list = [...list].sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price_desc": list = [...list].sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "name_asc": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return list;
  }, [products, sort, priceRange, selectedBrand, onlyDiscounted]);

  const FilterContent = (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-2 text-sm">Categories</h4>
        <div className="space-y-1.5">
          <button
            onClick={() => setParams(q ? { q } : {})}
            className={`w-full text-left text-sm px-2 py-1.5 rounded transition-smooth ${!cat ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setParams(q ? { q, category: c.slug } : { category: c.slug })}
              className={`w-full text-left text-sm px-2 py-1.5 rounded transition-smooth ${cat === c.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-3 text-sm">Price range (LKR)</h4>
        <Slider
          min={0}
          max={maxPrice}
          step={Math.max(50, Math.round(maxPrice / 100))}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{formatLKR(priceRange[0])}</span>
          <span>{formatLKR(priceRange[1])}</span>
        </div>
      </div>

      {brands.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-sm">Brand</h4>
          <Select value={selectedBrand || "all"} onValueChange={(v) => setSelectedBrand(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All brands" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyDiscounted}
            onChange={(e) => setOnlyDiscounted(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          On sale only
        </label>
      </div>
    </div>
  );

  const ListItem = ({ p }: { p: ProductCardData }) => {
    const hasDiscount = p.original_price && Number(p.original_price) > Number(p.price);
    const discountPct = hasDiscount
      ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)
      : 0;
    return (
      <Link to={`/product/${p.id}`}>
        <Card className="p-3 flex gap-4 hover:shadow-card transition-smooth">
          <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-lg bg-muted overflow-hidden shrink-0">
            {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-8 w-8" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium line-clamp-2 hover:text-primary transition-smooth">{p.name}</h3>
            <div className="flex items-baseline gap-2 mt-2 flex-wrap">
              <span className="font-display font-bold text-primary text-lg">{formatLKR(p.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-xs text-muted-foreground line-through">{formatLKR(Number(p.original_price))}</span>
                  <span className="text-xs font-bold text-destructive">-{discountPct}%</span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {p.stock > 0 ? `${p.stock} in stock` : <span className="text-destructive">Out of stock</span>}
            </div>
          </div>
        </Card>
      </Link>
    );
  };

  const activeCat = cat ? categories.find((c) => c.slug === cat) : null;
  const pageTitle = q
    ? `Search results for "${q}" | Artixo`
    : activeCat
    ? `Buy ${activeCat.name} Online in Sri Lanka | Artixo`
    : "Shop All Products Online in Sri Lanka | Artixo";
  const pageDescription = q
    ? `Browse products matching "${q}" on Artixo. Island-wide delivery and cash on delivery across Sri Lanka.`
    : activeCat
    ? `Shop ${activeCat.name} online in Sri Lanka. Verified sellers, best prices, and island-wide delivery on Artixo.`
    : "Discover thousands of products from verified Sri Lankan sellers. Fast island-wide delivery and cash on delivery on Artixo.";
  const canonicalPath = cat ? `/products?category=${cat}` : "/products";

  return (
    <div className="container py-6">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={`https://artixo.lovable.app${canonicalPath}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={`https://artixo.lovable.app${canonicalPath}`} />
        <meta property="og:type" content="website" />
      </Helmet>
      <h1 className="font-display text-2xl md:text-3xl mb-1">
        {aiQuery ? "AI Search Results" : q ? `Search: "${q}"` : activeCat?.name ?? "All Products"}
      </h1>

      {/* AI search banner */}
      {aiQuery && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 rounded-xl text-sm mb-3"
          style={{ background: "rgba(139,26,46,0.06)", border: "1px solid rgba(139,26,46,0.18)" }}
        >
          <span className="flex items-center gap-1.5 font-medium" style={{ color: "#8B1A2E" }}>
            <Sparkles className="h-3.5 w-3.5" />
            AI understood:
          </span>
          <span className="italic text-muted-foreground">"{aiQuery}"</span>
          {q && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">keyword: {q}</span>}
          {cat && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">category: {cat}</span>}
          {aiMaxPrice && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">max: {formatLKR(aiMaxPrice)}</span>}
          {aiMinPrice && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">min: {formatLKR(aiMinPrice)}</span>}
          {aiBrand && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">brand: {aiBrand}</span>}
          {aiOnSale && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">on sale</span>}
          {aiSortParam === "price_asc" && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">cheapest first</span>}
          {aiSortParam === "price_desc" && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">premium first</span>}
          <button
            onClick={() => setParams({})}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear AI filters
          </button>
        </div>
      )}

      <p className="text-muted-foreground text-sm mb-4">{filtered.length} {filtered.length === 1 ? "product" : "products"} found</p>

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <Card className="p-4 sticky top-20">{FilterContent}</Card>
        </aside>

        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4 mr-1" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="mt-4">{FilterContent}</div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 ml-auto">
              <Select value={sort} onValueChange={(v: Sort) => setSort(v)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden sm:flex border rounded-md overflow-hidden">
                <button onClick={() => setView("grid")} className={`p-2 transition-smooth ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setView("list")} className={`p-2 transition-smooth ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} aria-label="List view">
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <Card key={i} className="aspect-[3/4] animate-pulse bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              No products found. Try adjusting filters or search.
            </Card>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => <ListItem key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
