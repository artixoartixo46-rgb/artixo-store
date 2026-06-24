import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Star, Shield, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

interface RentalProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  image_url: string | null;
  rent_price_per_day: number;
  rent_price_per_week: number | null;
  rent_deposit: number | null;
  min_rent_days: number;
  listing_type: string;
  category_id: string | null;
  description: string | null;
}

const CATEGORIES = [
  { label: "All", value: "" },
  { label: "📷 Cameras", value: "camera" },
  { label: "👗 Fashion", value: "fashion" },
  { label: "🪑 Furniture", value: "furniture" },
  { label: "⚽ Sports", value: "sports" },
  { label: "🎉 Events", value: "event" },
  { label: "🔧 Tools", value: "tool" },
];

const Rentals = () => {
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, price, images, image_url, rent_price_per_day, rent_price_per_week, rent_deposit, min_rent_days, listing_type, category_id, description")
      .in("listing_type", ["rent", "both"])
      .then(({ data }) => {
        setProducts((data ?? []) as RentalProduct[]);
        setLoading(false);
      });
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const getImage = (p: RentalProduct) =>
    p.images?.[0] ?? p.image_url ?? "/placeholder.svg";

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEO title="Rent Products — ARTIXO" description="Rent cameras, wedding dresses, furniture and more. Daily & weekly rates." />

      {/* Hero */}
      <div
        className="relative overflow-hidden py-10 px-4 text-white text-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
      >
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-3">
            🔄 Rental Marketplace
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-2">Rent, Don't Buy</h1>
          <p className="text-white/70 text-sm max-w-xs mx-auto mb-6">
            Cameras, dresses, equipment & more — rent for a day or a week!
          </p>

          {/* Search */}
          <div className="max-w-sm mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rentals…"
              className="w-full pl-9 pr-4 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white placeholder:text-white/40 outline-none focus:bg-white/25 transition-all text-sm"
            />
          </div>
        </div>
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-blue-500/10" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-purple-500/10" />
      </div>

      {/* Trust badges */}
      <div className="bg-white border-b">
        <div className="container py-3 flex items-center justify-center gap-6 text-xs text-muted-foreground overflow-x-auto scrollbar-none">
          <span className="flex items-center gap-1.5 shrink-0"><Shield className="h-3.5 w-3.5 text-green-500" /> Verified Listings</span>
          <span className="flex items-center gap-1.5 shrink-0"><Calendar className="h-3.5 w-3.5 text-blue-500" /> Flexible Dates</span>
          <span className="flex items-center gap-1.5 shrink-0"><MapPin className="h-3.5 w-3.5 text-red-500" /> Island-wide</span>
          <span className="flex items-center gap-1.5 shrink-0"><Star className="h-3.5 w-3.5 text-yellow-500" /> Rated Renters</span>
        </div>
      </div>

      {/* Category pills */}
      <div className="container py-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                category === c.value
                  ? "text-white shadow-sm"
                  : "bg-white border text-foreground/70 hover:border-primary/40"
              }`}
              style={category === c.value ? { background: "linear-gradient(135deg, #1a1a2e, #0f3460)" } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="container">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="font-semibold text-lg mb-2">No rentals yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Be the first to list something for rent!
            </p>
            <Link to="/seller">
              <button className="px-6 py-2.5 rounded-full font-semibold text-white text-sm"
                style={{ background: "linear-gradient(135deg, #1a1a2e, #0f3460)" }}>
                List Your Item
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`}>
                <div className="group rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md border border-transparent hover:border-blue-200 transition-all">
                  {/* Image */}
                  <div className="aspect-square overflow-hidden relative bg-muted">
                    <img
                      src={getImage(p)}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Rent badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #1a1a2e, #0f3460)" }}>
                      FOR RENT
                    </div>
                    {p.listing_type === "both" && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-yellow-900">
                        BUY TOO
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug mb-2">{p.name}</p>

                    {/* Pricing */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-extrabold" style={{ color: "#0f3460" }}>
                          LKR {p.rent_price_per_day?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/day</span>
                      </div>
                      {p.rent_price_per_week && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-green-600">
                            LKR {p.rent_price_per_week.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/week</span>
                        </div>
                      )}
                    </div>

                    {/* Min days + deposit */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {p.min_rent_days > 1 && (
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          Min {p.min_rent_days} days
                        </span>
                      )}
                      {p.rent_deposit && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          Deposit: LKR {p.rent_deposit.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Rentals;
