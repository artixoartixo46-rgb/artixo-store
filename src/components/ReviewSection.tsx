import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Star, Sparkles, Loader2, User } from "lucide-react";
import { toast } from "sonner";

const GEMINI_MODEL = "gemini-2.0-flash-lite";

// Uses the pre-existing `reviews` table (always in PostgREST schema cache)
// Column mapping: user_id=reviewer, comment=review text, rating=int

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Props {
  productId: string;
  productName: string;
}

// ── AI sentiment summary ──────────────────────────────────────────────────────
async function summariseReviews(reviews: Review[], productName: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || reviews.length < 2) return null;

  const lines = reviews
    .slice(0, 20)
    .map((r) => `★${r.rating}/5 — ${r.comment || "(no text)"}`)
    .join("\n");

  const prompt = `You are a review summariser for an e-commerce marketplace in Sri Lanka.
Product: "${productName}"
Reviews:
${lines}

Write ONE short sentence (max 20 words) summarising the overall sentiment. No quotes, no markdown.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 60 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Star picker ───────────────────────────────────────────────────────────────
const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" role="group" aria-label="Select rating">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${s} star${s > 1 ? "s" : ""}`}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              s <= (hovered || value) ? "fill-primary text-primary" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// ── Static stars ──────────────────────────────────────────────────────────────
const Stars = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) => {
  const cls = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
};

// ── Rating bar ────────────────────────────────────────────────────────────────
const RatingBar = ({ star, count, total }: { star: number; count: number; total: number }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-4 text-right text-muted-foreground">{star}</span>
    <Star className="h-3 w-3 fill-primary text-primary shrink-0" />
    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
      />
    </div>
    <span className="w-6 text-muted-foreground">{count}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const ReviewSection = ({ productId, productName }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [editing, setEditing] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);

    // Use the pre-existing `reviews` table — always in PostgREST cache
    const { data, error } = await (supabase as any)
      .from("reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Reviews load]", error.message);
      setLoading(false);
      return;
    }

    const list: Review[] = data ?? [];
    setReviews(list);
    setLoading(false);

    if (user) {
      const own = list.find((r) => r.user_id === user.id) ?? null;
      setMyReview(own);
      if (own) {
        setMyRating(own.rating);
        setMyText(own.comment ?? "");
      }
    }

    if (list.length >= 2) {
      setSummaryLoading(true);
      summariseReviews(list, productName).then((s) => {
        setAiSummary(s);
        setSummaryLoading(false);
      });
    }
  }, [productId, user, productName]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const submit = async () => {
    if (!user) { toast.error("Sign in to leave a review"); return; }
    if (myRating === 0) { toast.error("Please select a star rating"); return; }
    setSubmitting(true);

    const { error } = await (supabase as any)
      .from("reviews")
      .upsert(
        {
          product_id: productId,
          user_id: user.id,
          rating: myRating,
          comment: myText.trim() || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product_id" }
      );

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(myReview ? "Review updated!" : "Review submitted!");
    setEditing(false);
    setAiSummary(null);
    loadReviews();
  };

  const deleteReview = async () => {
    if (!myReview) return;
    const { error } = await (supabase as any)
      .from("reviews")
      .delete()
      .eq("id", myReview.id);

    if (error) { toast.error(error.message); return; }
    toast.success("Review deleted");
    setMyReview(null);
    setMyRating(0);
    setMyText("");
    setEditing(false);
    loadReviews();
  };

  const total = reviews.length;
  const avg = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const starCounts = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: reviews.filter((r) => r.rating === s).length,
  }));

  const canShowForm = user && (!myReview || editing);

  return (
    <div className="mt-8 space-y-6">
      <h2 className="font-display text-2xl">Ratings &amp; Reviews</h2>

      {/* AI summary */}
      {(aiSummary || summaryLoading) && (
        <Card className="p-3 flex items-start gap-2.5 border-primary/20 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating AI summary…
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-medium text-primary mr-1.5">AI Summary:</span>
              {aiSummary}
            </p>
          )}
        </Card>
      )}

      {/* Overview */}
      {total > 0 && (
        <div className="flex gap-6 flex-wrap">
          <div className="flex flex-col items-center justify-center min-w-[80px]">
            <span className="font-display text-5xl font-bold text-primary leading-none">
              {avg.toFixed(1)}
            </span>
            <Stars rating={avg} size="md" />
            <span className="text-xs text-muted-foreground mt-1">
              {total} review{total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex-1 space-y-1.5 min-w-[160px]">
            {starCounts.map(({ star, count }) => (
              <RatingBar key={star} star={star} count={count} total={total} />
            ))}
          </div>
        </div>
      )}

      {total > 0 && <Separator />}

      {/* Write / edit review */}
      {!user ? (
        <p className="text-sm text-muted-foreground">
          <a href="/auth" className="text-primary hover:underline">Sign in</a> to leave a review.
        </p>
      ) : myReview && !editing ? (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium">Your review</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteReview}>Delete</Button>
            </div>
          </div>
          <Stars rating={myReview.rating} />
          {myReview.comment && (
            <p className="text-sm mt-2 text-foreground">{myReview.comment}</p>
          )}
        </Card>
      ) : canShowForm ? (
        <Card className="p-4 space-y-3">
          <p className="text-sm font-medium">{editing ? "Edit your review" : "Write a review"}</p>
          <StarPicker value={myRating} onChange={setMyRating} />
          <Textarea
            placeholder="Share your experience… (optional)"
            value={myText}
            onChange={(e) => setMyText(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button variant="hero" size="sm" disabled={submitting || myRating === 0} onClick={submit}>
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
              ) : editing ? "Update Review" : "Submit Review"}
            </Button>
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => {
                setEditing(false);
                setMyRating(myReview!.rating);
                setMyText(myReview!.comment ?? "");
              }}>Cancel</Button>
            )}
          </div>
        </Card>
      ) : null}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => {
            const isMe = r.user_id === user?.id;
            const name = isMe ? "You" : "Customer";
            const initials = isMe ? "ME" : "C";
            const date = new Date(r.created_at).toLocaleDateString("en-LK", {
              year: "numeric", month: "short", day: "numeric",
            });
            return (
              <div key={r.id} className="flex gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {initials || <User className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{name}</span>
                    <Stars rating={r.rating} />
                    <span className="text-xs text-muted-foreground">{date}</span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-foreground mt-1 leading-relaxed">{r.comment}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Exported hook for ProductCard / ProductDetail header ──────────────────────
export const useProductRating = (productId: string) => {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!productId) return;

    (supabase as any)
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .then(({ data, error }: any) => {
        if (error || !data || data.length === 0) return;
        const ratings: number[] = data.map((r: any) => Number(r.rating));
        const total = ratings.length;
        const sum = ratings.reduce((s: number, v: number) => s + v, 0);
        setCount(total);
        setAvg(sum / total);
      });
  }, [productId]);

  return { avg, count };
};
