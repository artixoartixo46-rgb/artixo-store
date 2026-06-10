import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart2, ArrowLeft, CheckCircle2, AlertCircle, Info, User } from "lucide-react";

const ratingColor = (r: string) => {
  if (!r) return "secondary";
  const lower = r.toLowerCase();
  if (lower.includes("perfect") || lower.includes("ideal")) return "default";
  if (lower.includes("slightly")) return "secondary";
  return "destructive";
};

// Local size calculation — used when AI edge function is unavailable
const calculateSizeLocally = (measurements: any, sizeList: string[]) => {
  const { chest_cm, waist_cm, shoulder_cm } = measurements;
  const stdChart = [
    { label: "XS",  chestRange: [76, 84],   waistRange: [60, 68],  shoulderRange: [36, 40] },
    { label: "S",   chestRange: [84, 92],   waistRange: [68, 76],  shoulderRange: [40, 43] },
    { label: "M",   chestRange: [92, 100],  waistRange: [76, 84],  shoulderRange: [43, 45] },
    { label: "L",   chestRange: [100, 108], waistRange: [84, 92],  shoulderRange: [45, 47] },
    { label: "XL",  chestRange: [108, 116], waistRange: [92, 100], shoulderRange: [47, 49] },
    { label: "XXL", chestRange: [116, 126], waistRange: [100, 110], shoulderRange: [49, 52] },
  ];

  const scoredSizes = stdChart.map((entry) => {
    let score = 0;
    if (chest_cm) {
      const mid = (entry.chestRange[0] + entry.chestRange[1]) / 2;
      score += chest_cm >= entry.chestRange[0] && chest_cm < entry.chestRange[1]
        ? 30 : -Math.abs(chest_cm - mid) * 2;
    }
    if (waist_cm) {
      const mid = (entry.waistRange[0] + entry.waistRange[1]) / 2;
      score += waist_cm >= entry.waistRange[0] && waist_cm < entry.waistRange[1]
        ? 20 : -Math.abs(waist_cm - mid) * 1.5;
    }
    if (shoulder_cm) {
      const mid = (entry.shoulderRange[0] + entry.shoulderRange[1]) / 2;
      score += shoulder_cm >= entry.shoulderRange[0] && shoulder_cm < entry.shoulderRange[1]
        ? 15 : -Math.abs(shoulder_cm - mid) * 3;
    }
    return { label: entry.label, score };
  });

  const bestStdIdx = scoredSizes.reduce((best, curr, idx) =>
    curr.score > scoredSizes[best].score ? idx : best, 0);

  const sizes = sizeList.length > 0 ? sizeList : stdChart.map(e => e.label);
  const mappedIdx = Math.round(bestStdIdx * (sizes.length - 1) / (stdChart.length - 1));
  const recommendedSize = sizes[Math.min(mappedIdx, sizes.length - 1)] || "M";

  const sizeRatings: Record<string, string> = {};
  sizes.forEach((s, idx) => {
    const diff = idx - mappedIdx;
    if (diff === 0) sizeRatings[s] = "Perfect fit";
    else if (diff === -1) sizeRatings[s] = "Slightly small";
    else if (diff === 1) sizeRatings[s] = "Slightly large";
    else if (diff < 0) sizeRatings[s] = "Too small";
    else sizeRatings[s] = "Too large";
  });

  const confidence = chest_cm && waist_cm ? "high" : (chest_cm || waist_cm ? "medium" : "low");
  const notes = [
    chest_cm ? `chest ${chest_cm}cm` : null,
    waist_cm ? `waist ${waist_cm}cm` : null,
    shoulder_cm ? `shoulder ${shoulder_cm}cm` : null,
  ].filter(Boolean).join(", ");

  return {
    recommended_size: recommendedSize,
    confidence,
    fit_notes: `Based on your measurements (${notes}), size ${recommendedSize} should fit you well. Calculated from standard size charts.`,
    size_ratings: sizeRatings,
  };
};

const FitAnalysis = () => {
  const { id: productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [fitProfile, setFitProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [hasMeasurements, setHasMeasurements] = useState(false);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const [{ data: prod }, { data: fp }] = await Promise.all([
        supabase.from("products").select("id, name, variants").eq("id", productId).single(),
        supabase
          .from("user_fit_profiles")
          .select("height_cm, weight_kg, chest_cm, waist_cm, shoulder_cm")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setProduct(prod);
      if (fp) {
        setFitProfile(fp);
        setHasMeasurements(!!(fp.height_cm || fp.chest_cm || fp.waist_cm));
      }
    })();
  }, [productId]);

  const handleAnalyze = async () => {
    if (!fitProfile) return;
    setLoading(true);
    setError("");
    setResult(null);

    const rawVariants = product?.variants ?? {};
    const sizesArr: string[] = Array.isArray(rawVariants.sizes) ? rawVariants.sizes : [];
    const sizeChart = sizesArr.length > 0
      ? sizesArr.reduce((acc: any, s: string) => { acc[s] = s; return acc; }, {})
      : null;

    const measurements = {
      height_cm: fitProfile.height_cm,
      weight_kg: fitProfile.weight_kg,
      chest_cm: fitProfile.chest_cm,
      waist_cm: fitProfile.waist_cm,
      shoulder_cm: fitProfile.shoulder_cm,
    };

    let analysisResult = null;

    // Try AI edge function first
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("fit-analysis", {
        body: { measurements, product_name: product?.name, size_chart: sizeChart },
      });
      if (!fnErr && !data?.error && data?.recommended_size) {
        analysisResult = data;
        toast.success("AI fit analysis complete!");
      }
    } catch {
      // Edge function not available — fall through to local calculation
    }

    // Fallback: local size calculation
    if (!analysisResult) {
      analysisResult = calculateSizeLocally(measurements, sizesArr);
      toast.success("Fit analysis complete!");
    }

    setResult(analysisResult);
    setLoading(false);
  };

  if (!product) return <div className="container py-12 text-center">Loading...</div>;

  const sizeRatings = result?.size_ratings ? Object.entries(result.size_ratings) : [];

  return (
    <div className="container max-w-lg py-8">
      <button
        onClick={() => navigate(`/product/${productId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to product
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Fit Analysis</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
      </div>

      {!hasMeasurements && (
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">No measurements saved yet</p>
              <p className="text-xs text-amber-700 mt-0.5">Save your measurements to get an accurate fit recommendation.</p>
              <button
                onClick={() => navigate("/fit-profile")}
                className="mt-2 text-xs text-amber-700 underline"
              >
                Set up Fit Profile →
              </button>
            </div>
          </div>
        </Card>
      )}

      {fitProfile && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Your Measurements</span>
            <button
              onClick={() => navigate("/fit-profile")}
              className="ml-auto text-xs text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            {[
              ["Height", fitProfile.height_cm, "cm"],
              ["Weight", fitProfile.weight_kg, "kg"],
              ["Chest", fitProfile.chest_cm, "cm"],
              ["Waist", fitProfile.waist_cm, "cm"],
              ["Shoulder", fitProfile.shoulder_cm, "cm"],
            ].map(([label, val, unit]) => (
              <div key={label as string} className="bg-muted/50 rounded-lg p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-semibold text-sm">{val ? `${val} ${unit}` : "—"}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button
        onClick={handleAnalyze}
        disabled={loading || !hasMeasurements}
        size="lg"
        className="w-full mb-4"
      >
        <BarChart2 className="h-5 w-5 mr-2" />
        {loading ? "Analyzing..." : "Analyze My Fit"}
      </Button>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <Card className="p-5 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Recommended Size</div>
            <div className="text-5xl font-display font-bold text-primary">{result.recommended_size}</div>
            <Badge variant={result.confidence === "high" ? "default" : "secondary"}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {result.confidence} confidence
            </Badge>
          </div>

          {result.fit_notes && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              {result.fit_notes}
            </div>
          )}

          {sizeRatings.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">All Sizes</div>
              <div className="space-y-1.5">
                {sizeRatings.map(([size, rating]) => (
                  <div key={size} className="flex items-center gap-3">
                    <span className={`w-10 text-center text-sm font-bold rounded ${size === result.recommended_size ? "text-primary" : "text-muted-foreground"}`}>
                      {size}
                    </span>
                    <Badge variant={ratingColor(rating as string) as any} className="text-xs">
                      {rating as string}
                    </Badge>
                    {size === result.recommended_size && (
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/product/${productId}/tryon`)}
          >
            <BarChart2 className="h-4 w-4 mr-2" /> See Virtual Try-On
          </Button>
        </Card>
      )}
    </div>
  );
};

export default FitAnalysis;
