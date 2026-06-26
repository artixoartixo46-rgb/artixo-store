import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  seller_responded: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  admin_review: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function SellerDisputesTab({ sellerId }: { sellerId: string }) {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [sellerId]);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("disputes")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    setDisputes(data ?? []);
    setLoading(false);
  };

  const respond = async (disputeId: string) => {
    const response = responseText[disputeId]?.trim();
    if (!response) { toast.error("Please write a response"); return; }
    setSubmitting(disputeId);
    const { error } = await (supabase as any)
      .from("disputes")
      .update({ seller_response: response, status: "seller_responded" })
      .eq("id", disputeId);
    setSubmitting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Response submitted");
    setResponseText((p) => ({ ...p, [disputeId]: "" }));
    load();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading disputes…</div>;

  if (disputes.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <div className="text-4xl mb-3">⚖️</div>
        <p className="text-muted-foreground">No disputes filed against your products.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{disputes.length} dispute{disputes.length !== 1 ? "s" : ""} — respond promptly to avoid admin escalation</p>
      {disputes.map((d) => (
        <Card key={d.id} className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold text-sm">{d.reason}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Order #{String(d.order_id).slice(0, 8)} · {new Date(d.created_at).toLocaleDateString("en-LK")}</div>
            </div>
            <Badge className={STATUS_COLORS[d.status] || ""}>{d.status.replace("_", " ").toUpperCase()}</Badge>
          </div>

          <div className="text-sm bg-muted/40 rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Buyer's complaint:</p>
            <p>{d.description}</p>
          </div>

          {d.admin_decision && (
            <div className="text-sm bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
              <p className="text-xs font-semibold text-purple-600 mb-1">⚖️ Admin Decision:</p>
              <p>{d.admin_decision}</p>
            </div>
          )}

          {d.seller_response ? (
            <div className="text-sm bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
              <p className="text-xs font-semibold text-blue-600 mb-1">Your Response:</p>
              <p>{d.seller_response}</p>
            </div>
          ) : d.status === "open" ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Write your response to the buyer's complaint…"
                rows={3}
                value={responseText[d.id] ?? ""}
                onChange={(e) => setResponseText((p) => ({ ...p, [d.id]: e.target.value }))}
              />
              <Button size="sm" onClick={() => respond(d.id)} disabled={submitting === d.id}>
                {submitting === d.id ? "Submitting…" : "Submit Response"}
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
