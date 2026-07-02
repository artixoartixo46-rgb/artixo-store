import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, ChevronDown, ChevronUp, Send, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface Answer {
  id: string;
  answer: string;
  created_at: string;
  seller_id: string;
  sellerName: string | null;
}

interface Question {
  id: string;
  question: string;
  created_at: string;
  user_id: string;
  askerName: string | null;
  answer: Answer | null;
}

interface Props {
  productId: string;
  sellerId: string | null | undefined;
}

const VISIBLE = 5;

export const ProductQA = ({ productId, sellerId }: Props) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerText] = useState<Record<string, string>>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const askRef = useRef<HTMLTextAreaElement>(null);

  const isSeller = !!user && !!sellerId && user.id === sellerId;

  const load = async () => {
    setLoading(true);

    // Fetch questions (no FK join — profiles fetched separately)
    const qRes = await (supabase as any)
      .from("product_questions")
      .select("id, question, created_at, user_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (qRes.error || !qRes.data) { setLoading(false); return; }
    const qs = qRes.data;

    // Fetch asker profiles
    const askerIds = [...new Set(qs.map((q: any) => q.user_id).filter(Boolean))];
    let askerMap: Record<string, any> = {};
    if (askerIds.length > 0) {
      const { data: askers } = await (supabase as any)
        .from("profiles").select("id, full_name, shop_name").in("id", askerIds);
      for (const p of askers ?? []) askerMap[p.id] = p;
    }

    // Fetch answers (no FK join — profiles fetched separately)
    const qIds = qs.map((q: any) => q.id);
    let answersMap: Record<string, Answer> = {};
    if (qIds.length > 0) {
      const { data: ans } = await (supabase as any)
        .from("product_answers")
        .select("id, question_id, answer, created_at, seller_id")
        .in("question_id", qIds);

      // Fetch seller profiles
      const sellerIds = [...new Set((ans ?? []).map((a: any) => a.seller_id).filter(Boolean))];
      let sellerMap: Record<string, any> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await (supabase as any)
          .from("profiles").select("id, full_name, shop_name").in("id", sellerIds);
        for (const p of sellers ?? []) sellerMap[p.id] = p;
      }

      for (const a of ans ?? []) {
        const sp = sellerMap[a.seller_id];
        answersMap[a.question_id] = {
          id: a.id,
          answer: a.answer,
          created_at: a.created_at,
          seller_id: a.seller_id,
          sellerName: sp?.shop_name || sp?.full_name || "Seller",
        };
      }
    }

    setQuestions(qs.map((q: any) => ({
      id: q.id,
      question: q.question,
      created_at: q.created_at,
      user_id: q.user_id,
      askerName: askerMap[q.user_id]?.full_name || "Customer",
      answer: answersMap[q.id] ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to ask a question"); return; }
    const q = questionText.trim();
    if (q.length < 5) { toast.error("Question too short"); return; }
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("product_questions")
      .insert({ product_id: productId, user_id: user.id, question: q });
    setSubmitting(false);
    if (error) {
      toast.error(error.message?.includes("schema cache") || error.message?.includes("does not exist")
        ? "Q&A is being set up. Try again shortly."
        : error.message);
      return;
    }
    toast.success("Question posted!");
    setQuestionText("");
    setAsking(false);
    load();
  };

  const submitAnswer = async (questionId: string) => {
    if (!user) return;
    const a = (answerText[questionId] ?? "").trim();
    if (!a) { toast.error("Answer cannot be empty"); return; }
    setAnswerSubmitting(true);
    const { error } = await (supabase as any)
      .from("product_answers")
      .upsert({ question_id: questionId, seller_id: user.id, answer: a }, { onConflict: "question_id" });
    setAnswerSubmitting(false);
    if (error) { toast.error(error.message?.includes("schema cache") ? "Q&A is being set up." : error.message); return; }
    toast.success("Answer posted!");
    setAnsweringId(null);
    setAnswerText((t) => ({ ...t, [questionId]: "" }));
    load();
  };

  const visible = showAll ? questions : questions.slice(0, VISIBLE);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Questions & Answers</h2>
          {questions.length > 0 && (
            <Badge variant="secondary" className="text-xs">{questions.length}</Badge>
          )}
        </div>
        {!asking && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!user) { toast.error("Sign in to ask a question"); return; }
              setAsking(true);
              setTimeout(() => askRef.current?.focus(), 50);
            }}
          >
            Ask a question
          </Button>
        )}
      </div>

      {/* Ask form */}
      {asking && (
        <Card className="p-4 mb-5 bg-muted/30">
          <form onSubmit={submitQuestion} className="space-y-3">
            <Textarea
              ref={askRef}
              placeholder="What would you like to know about this product?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{questionText.length}/500</p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAsking(false); setQuestionText(""); }}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="hero" disabled={submitting || questionText.trim().length < 5}>
                <Send className="h-3.5 w-3.5 mr-1" />
                {submitting ? "Posting…" : "Post Question"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Question list */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading Q&A…</div>
      ) : questions.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((q) => (
            <div key={q.id} className="space-y-2">
              {/* Question */}
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">{q.askerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 text-foreground leading-relaxed">Q: {q.question}</p>
                </div>
              </div>

              {/* Answer */}
              {q.answer ? (
                <div className="flex gap-3 ml-10">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-primary">{q.answer.sellerName}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">Seller</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(q.answer.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 leading-relaxed">A: {q.answer.answer}</p>
                    {/* Seller can edit their answer */}
                    {isSeller && (
                      <button
                        className="text-xs text-muted-foreground hover:text-primary mt-1 underline-offset-2 hover:underline"
                        onClick={() => {
                          setAnsweringId(q.id);
                          setAnswerText((t) => ({ ...t, [q.id]: q.answer!.answer }));
                        }}
                      >
                        Edit answer
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* No answer yet */
                <div className="ml-10">
                  {isSeller ? (
                    answeringId === q.id ? (
                      <div className="space-y-2 mt-1">
                        <Textarea
                          placeholder="Write your answer…"
                          value={answerText[q.id] ?? ""}
                          onChange={(e) => setAnswerText((t) => ({ ...t, [q.id]: e.target.value }))}
                          rows={2}
                          maxLength={1000}
                          className="resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="hero"
                            disabled={answerSubmitting || !(answerText[q.id] ?? "").trim()}
                            onClick={() => submitAnswer(q.id)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {answerSubmitting ? "Posting…" : "Post Answer"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAnsweringId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs mt-1"
                        onClick={() => { setAnsweringId(q.id); setAnswerText((t) => ({ ...t, [q.id]: "" })); }}
                      >
                        Answer this question
                      </Button>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-1">Not yet answered by seller</p>
                  )}
                </div>
              )}

              {/* Edit answer form (when answer exists and seller clicks Edit) */}
              {q.answer && isSeller && answeringId === q.id && (
                <div className="ml-10 space-y-2">
                  <Textarea
                    placeholder="Update your answer…"
                    value={answerText[q.id] ?? q.answer.answer}
                    onChange={(e) => setAnswerText((t) => ({ ...t, [q.id]: e.target.value }))}
                    rows={2}
                    maxLength={1000}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="hero"
                      disabled={answerSubmitting || !(answerText[q.id] ?? "").trim()}
                      onClick={() => submitAnswer(q.id)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {answerSubmitting ? "Saving…" : "Save Answer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnsweringId(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              <Separator />
            </div>
          ))}

          {questions.length > VISIBLE && (
            <button
              className="text-sm text-primary hover:underline flex items-center gap-1 mx-auto"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? (
                <><ChevronUp className="h-4 w-4" /> Show less</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> Show all {questions.length} questions</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
