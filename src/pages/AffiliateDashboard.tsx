import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Link2, Copy, TrendingUp, Users, DollarSign, ShoppingBag,
  Clock, CheckCircle2, XCircle, Banknote, Share2, Gift, Sparkles,
} from "lucide-react";
import { formatLKR } from "@/lib/format";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://artixo-store-artixoartixo46-rgbs-projects.vercel.app";

function genCode(email: string, uid: string) {
  const prefix = email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "USER";
  const suffix = uid.slice(0, 4).toUpperCase();
  return `${prefix}${suffix}`;
}

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ method: "", details: "" });
  const [savingPayout, setSavingPayout] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("affiliates").select("*").eq("user_id", user.id).maybeSingle();
    setAffiliate(data ?? null);
    if (data) {
      const { data: conv } = await (supabase as any)
        .from("referral_conversions").select("*").eq("affiliate_id", data.id)
        .order("created_at", { ascending: false });
      setConversions(conv ?? []);
      setPayoutForm({ method: data.payout_method ?? "", details: data.payout_details ?? "" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const join = async () => {
    if (!user) return;
    setJoining(true);
    const code = genCode(user.email ?? "", user.id);
    const { error } = await (supabase as any).from("affiliates").insert({
      user_id: user.id,
      referral_code: code,
      commission_rate: 10,
      status: "pending",
    });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Applied! We'll review and approve within 24h.");
    load();
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/?ref=${code}`);
    toast.success("Referral link copied!");
  };

  const savePayout = async () => {
    if (!affiliate) return;
    setSavingPayout(true);
    const { error } = await (supabase as any).from("affiliates").update({
      payout_method: payoutForm.method,
      payout_details: payoutForm.details,
    }).eq("id", affiliate.id);
    setSavingPayout(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout details saved!");
  };

  const pendingEarnings = conversions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount), 0);
  const approvedEarnings = conversions.filter(c => c.status === "approved").reduce((s, c) => s + Number(c.commission_amount), 0);

  if (loading) return <div className="container py-12 text-center text-muted-foreground">Loading…</div>;

  // ── Not yet an affiliate ─────────────────────────────────────────────────────
  if (!affiliate) {
    return (
      <div className="container py-16 max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-4">
            <Gift className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-display text-4xl mb-3">ARTIXO Affiliate Program</h1>
          <p className="text-muted-foreground text-lg">Earn <span className="text-primary font-bold">10% commission</span> on every sale you refer. Share your link — we handle the rest.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Link2, label: "Get your link", desc: "Unique referral URL tied to your account" },
            { icon: Share2, label: "Share everywhere", desc: "WhatsApp, Instagram, TikTok, email" },
            { icon: Banknote, label: "Earn 10%", desc: "On every order placed via your link" },
          ].map(({ icon: Icon, label, desc }) => (
            <Card key={label} className="p-5 text-center space-y-2">
              <div className="flex justify-center"><Icon className="h-7 w-7 text-primary" /></div>
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6 text-center space-y-4">
          <Sparkles className="h-8 w-8 text-primary mx-auto" />
          <div>
            <div className="font-display text-xl">Ready to start earning?</div>
            <p className="text-sm text-muted-foreground mt-1">Applications are reviewed within 24 hours. No follower minimum required.</p>
          </div>
          <Button variant="hero" size="lg" onClick={join} disabled={joining}>
            {joining ? "Applying…" : "Join the Affiliate Program"}
          </Button>
        </Card>
      </div>
    );
  }

  // ── Affiliate dashboard ──────────────────────────────────────────────────────
  const statusColor = affiliate.status === "approved" ? "bg-success text-success-foreground" : affiliate.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-destructive text-destructive-foreground";
  const referralLink = `${BASE_URL}/?ref=${affiliate.referral_code}`;

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Gift className="h-7 w-7 text-primary" /> Affiliate Dashboard
          </h1>
          <p className="text-muted-foreground mt-0.5">Your code: <span className="font-mono font-bold text-primary">{affiliate.referral_code}</span></p>
        </div>
        <Badge className={statusColor}>{affiliate.status.toUpperCase()}</Badge>
      </div>

      {affiliate.status === "pending" && (
        <Card className="p-4 border-yellow-200 bg-yellow-50/30 flex items-center gap-3 mb-6">
          <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="text-sm text-yellow-800">Your application is under review. We'll approve within 24 hours. You can share your link now — conversions will be tracked once approved.</div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total clicks", value: affiliate.total_clicks, icon: Users },
          { label: "Conversions", value: affiliate.total_conversions, icon: ShoppingBag },
          { label: "Pending earnings", value: formatLKR(pendingEarnings), icon: Clock },
          { label: "Approved earnings", value: formatLKR(approvedEarnings), icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-primary" />
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
            <div className="font-display text-xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      {/* Referral Link */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Your referral link</Label>
        </div>
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="font-mono text-xs bg-muted" />
          <Button variant="outline" size="icon" onClick={() => copyLink(affiliate.referral_code)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Share this link. Anyone who shops via your link earns you <strong>{affiliate.commission_rate}%</strong> commission.</p>

        {/* Quick share */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🛍️ Shop on ARTIXO and get the best deals! ${referralLink}`)}`, "_blank")}>
            <Share2 className="h-3 w-3" /> WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, "_blank")}>
            <Share2 className="h-3 w-3" /> Facebook
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Shop on ARTIXO 🛍️`)}&url=${encodeURIComponent(referralLink)}`, "_blank")}>
            <Share2 className="h-3 w-3" /> X / Twitter
          </Button>
        </div>
      </Card>

      {/* Conversions */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Conversion history</Label>
        </div>
        {conversions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No conversions yet. Share your link to start earning!</div>
        ) : (
          <div className="space-y-2">
            {conversions.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="text-sm">
                  <div>Order #{String(c.order_id ?? "–").slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-LK")}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary">{formatLKR(c.commission_amount)}</div>
                  <Badge className={`text-[10px] ${c.status === "paid" ? "bg-success text-success-foreground" : c.status === "approved" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}>
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payout details */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Banknote className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Payout details</Label>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Payment method</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Bank Transfer, bKash, PayPal"
              value={payoutForm.method}
              onChange={(e) => setPayoutForm(f => ({ ...f, method: e.target.value }))}
            />
          </div>
          <div>
            <Label>Account details</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Bank name, account number, name on account…"
              value={payoutForm.details}
              onChange={(e) => setPayoutForm(f => ({ ...f, details: e.target.value }))}
            />
          </div>
          <Button variant="hero" onClick={savePayout} disabled={savingPayout}>
            {savingPayout ? "Saving…" : "Save payout details"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Minimum payout: LKR 1,000. Payouts processed weekly on Fridays.</p>
      </Card>
    </div>
  );
};

export default AffiliateDashboard;
