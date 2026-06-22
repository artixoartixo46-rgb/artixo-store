import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Gift, Check, X, DollarSign, TrendingUp, Users, Search, Banknote } from "lucide-react";
import { formatLKR } from "@/lib/format";

export const AdminAffiliatesSection = () => {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "conversions">("all");

  const load = async () => {
    setLoading(true);
    const { data: affs } = await (supabase as any)
      .from("affiliates")
      .select("*, profiles(email, full_name)")
      .order("created_at", { ascending: false });
    setAffiliates(affs ?? []);

    const { data: convs } = await (supabase as any)
      .from("referral_conversions")
      .select("*, affiliates(referral_code)")
      .order("created_at", { ascending: false })
      .limit(100);
    setConversions(convs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await (supabase as any).from("affiliates").update({ status: "approved" }).eq("id", id);
    toast.success("Affiliate approved");
    load();
  };

  const suspend = async (id: string) => {
    await (supabase as any).from("affiliates").update({ status: "suspended" }).eq("id", id);
    toast.success("Affiliate suspended");
    load();
  };

  const markConversionPaid = async (id: string, affiliateId: string, amount: number) => {
    await (supabase as any).from("referral_conversions").update({ status: "paid" }).eq("id", id);
    // Increment paid_earnings
    const aff = affiliates.find(a => a.id === affiliateId);
    if (aff) {
      await (supabase as any).from("affiliates").update({ paid_earnings: Number(aff.paid_earnings) + amount }).eq("id", affiliateId);
    }
    toast.success("Conversion marked as paid");
    load();
  };

  const approveConversion = async (id: string) => {
    await (supabase as any).from("referral_conversions").update({ status: "approved" }).eq("id", id);
    toast.success("Conversion approved");
    load();
  };

  const totalCommission = affiliates.reduce((s, a) => s + Number(a.total_earnings ?? 0), 0);
  const totalPaid = affiliates.reduce((s, a) => s + Number(a.paid_earnings ?? 0), 0);
  const totalPending = conversions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount), 0);

  const filteredAffs = affiliates.filter(a => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (a.referral_code ?? "").toLowerCase().includes(q) ||
           (a.profiles?.email ?? "").toLowerCase().includes(q) ||
           (a.profiles?.full_name ?? "").toLowerCase().includes(q);
  });

  const statusColor = (s: string) => s === "approved" ? "bg-green-100 text-green-800" : s === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
  const convColor = (s: string) => s === "paid" ? "bg-green-100 text-green-800" : s === "approved" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">Affiliate Management</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total affiliates", value: affiliates.length, icon: Users },
          { label: "Total commissions", value: formatLKR(totalCommission), icon: TrendingUp },
          { label: "Pending payout", value: formatLKR(totalPending), icon: Banknote },
          { label: "Total paid", value: formatLKR(totalPaid), icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-1.5 mb-1"><Icon className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{label}</span></div>
            <div className="font-display text-xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(["all", "pending", "conversions"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {t === "all" ? "All Affiliates" : t === "pending" ? `Pending Approval (${affiliates.filter(a => a.status === "pending").length})` : "Conversions"}
          </button>
        ))}
      </div>

      {activeTab !== "conversions" && (
        <>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input className="max-w-xs h-8" placeholder="Search by email or code…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-2">
              {filteredAffs.filter(a => activeTab === "all" || a.status === "pending").map(a => (
                <Card key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold font-mono">{a.referral_code}</div>
                    <div className="text-sm text-muted-foreground">{a.profiles?.email ?? a.user_id}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.total_clicks} clicks · {a.total_conversions} conversions · {formatLKR(a.total_earnings)} earned · {a.commission_rate}% rate
                    </div>
                    {a.payout_method && (
                      <div className="text-xs text-muted-foreground">Payout: {a.payout_method} — {a.payout_details}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor(a.status)}>{a.status}</Badge>
                    {a.status === "pending" && (
                      <Button size="sm" variant="default" className="gap-1" onClick={() => approve(a.id)}>
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                    )}
                    {a.status === "approved" && (
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => suspend(a.id)}>
                        <X className="h-3 w-3" /> Suspend
                      </Button>
                    )}
                    {a.status === "suspended" && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => approve(a.id)}>
                        <Check className="h-3 w-3" /> Reactivate
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {filteredAffs.filter(a => activeTab === "all" || a.status === "pending").length === 0 && (
                <div className="text-center py-10 text-muted-foreground">No affiliates found</div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "conversions" && (
        <div className="space-y-2">
          {conversions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No conversions yet</div>
          ) : (
            conversions.map(c => (
              <Card key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Code: {c.affiliates?.referral_code ?? "–"}</div>
                  <div className="text-xs text-muted-foreground">
                    Order #{String(c.order_id ?? "–").slice(0, 8)} · Order: {formatLKR(c.order_amount)} · Commission: <span className="font-bold text-primary">{formatLKR(c.commission_amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-LK")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={convColor(c.status)}>{c.status}</Badge>
                  {c.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => approveConversion(c.id)}>Approve</Button>
                  )}
                  {c.status === "approved" && (
                    <Button size="sm" variant="default" onClick={() => markConversionPaid(c.id, c.affiliate_id, Number(c.commission_amount))}>
                      Mark Paid
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};
