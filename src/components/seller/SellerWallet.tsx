import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet, TrendingDown, ArrowDownCircle, AlertTriangle,
  CheckCircle2, Clock, Info, ChevronDown, ChevronUp,
  Building2, Banknote
} from "lucide-react";

interface WalletData {
  balance: number;
  total_deposited: number;
  total_commission: number;
  tier: "deposit" | "invoice";
  is_suspended: boolean;
  tier_upgraded_at: string | null;
}

interface Transaction {
  id: string;
  type: "deposit" | "commission" | "refund" | "adjustment";
  amount: number;
  balance_after: number | null;
  description: string | null;
  created_at: string;
}

const MIN_DEPOSIT = 1000;
const LOW_BALANCE_THRESHOLD = 400;

export const SellerWallet = () => {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const sym = settings.currency_symbol || "Rs.";

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [showTxns, setShowTxns] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadWallet();
  }, [user]);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const { data: w } = await (supabase as any)
        .from("seller_wallets")
        .select("*")
        .eq("seller_id", user!.id)
        .single();

      if (w) setWallet(w);

      const { data: t } = await (supabase as any)
        .from("wallet_transactions")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (t) setTxns(t);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground text-sm">
          Loading wallet…
        </CardContent>
      </Card>
    );
  }

  // No wallet yet — needs setup
  if (!wallet) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-8 text-center space-y-3">
          <Wallet className="h-10 w-10 mx-auto text-amber-500" />
          <p className="font-semibold text-amber-800">Wallet not set up yet</p>
          <p className="text-sm text-amber-700">Contact admin to activate your seller wallet.</p>
        </CardContent>
      </Card>
    );
  }

  const isLow = wallet.tier === "deposit" && wallet.balance < LOW_BALANCE_THRESHOLD;
  const isSuspended = wallet.is_suspended;
  const isInvoice = wallet.tier === "invoice";

  const txnIcon = (type: string) => {
    if (type === "deposit" || type === "refund") return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
    if (type === "commission") return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Info className="h-4 w-4 text-blue-400" />;
  };

  const txnColor = (type: string) =>
    type === "commission" ? "text-red-600" : "text-green-600";

  const txnSign = (type: string) =>
    type === "commission" ? "-" : "+";

  return (
    <div className="space-y-4">
      {/* Suspension warning */}
      {isSuspended && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Account Suspended — Wallet Empty</p>
            <p className="text-xs mt-1">Your products are hidden. Top up your wallet to resume selling.</p>
          </div>
        </div>
      )}

      {/* Low balance warning */}
      {!isSuspended && isLow && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Low Balance — Top Up Soon</p>
            <p className="text-xs mt-1">Balance below {sym} {LOW_BALANCE_THRESHOLD}. Products will be hidden when it reaches zero.</p>
          </div>
        </div>
      )}

      {/* Main wallet card */}
      <Card className={
        isSuspended ? "border-red-300 bg-red-50/50" :
        isLow ? "border-amber-300" : "border-green-200 bg-green-50/30"
      }>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Commission Wallet
            </CardTitle>
            <Badge variant={isInvoice ? "default" : "secondary"} className={
              isInvoice
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "bg-slate-100 text-slate-700"
            }>
              {isInvoice ? "✦ Invoice Tier" : "Deposit Tier"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Balance */}
          {!isInvoice && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Available Balance</p>
              <p className={`text-4xl font-bold ${
                isSuspended ? "text-red-600" :
                isLow ? "text-amber-600" : "text-green-700"
              }`}>
                {sym} {wallet.balance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Commission is auto-deducted when orders are delivered
              </p>
            </div>
          )}

          {/* Invoice tier info */}
          {isInvoice && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 text-center space-y-1">
              <CheckCircle2 className="h-8 w-8 text-blue-600 mx-auto" />
              <p className="font-semibold text-blue-800 text-sm">Invoice Tier Active</p>
              <p className="text-xs text-blue-600">
                Commission is invoiced monthly. No upfront deposit needed.
              </p>
              {wallet.tier_upgraded_at && (
                <p className="text-xs text-blue-400 mt-1">
                  Upgraded {new Date(wallet.tier_upgraded_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Deposited</p>
              <p className="font-bold text-sm text-green-700">{sym} {wallet.total_deposited.toFixed(2)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Commission Paid</p>
              <p className="font-bold text-sm text-red-600">{sym} {wallet.total_commission.toFixed(2)}</p>
            </div>
          </div>

          {/* Top-up instructions */}
          {!isInvoice && (
            <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                How to Top Up
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <span>Transfer to: <strong className="text-foreground">People's Bank — 123 456 789</strong><br/>Account: <strong className="text-foreground">ARTIXO (PVT) LTD</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <span>Use your email as reference: <strong className="text-foreground">seller@email.com</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-primary/10 text-primary rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <span>Email slip to: <strong className="text-foreground">wallet@artixo.lk</strong> — credited within 24h</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-1">Minimum top-up: {sym} {MIN_DEPOSIT.toLocaleString()}</p>
            </div>
          )}

          {/* Invoice tier — upgrade path info */}
          {!isInvoice && wallet.total_deposited >= MIN_DEPOSIT && (
            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg p-3 border border-blue-100">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Keep a good track record for 3 months to unlock <strong>Invoice Tier</strong> — no deposit required!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction history */}
      {txns.length > 0 && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTxns(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Transaction History
              </CardTitle>
              {showTxns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>

          {showTxns && (
            <CardContent className="pt-0">
              <div className="space-y-2">
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {txnIcon(t.type)}
                      <div>
                        <p className="text-xs font-medium capitalize">{t.type}</p>
                        <p className="text-[11px] text-muted-foreground">{t.description || "—"}</p>
                        <p className="text-[11px] text-muted-foreground/60">
                          {new Date(t.created_at).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${txnColor(t.type)}`}>
                        {txnSign(t.type)}{sym} {Math.abs(t.amount).toFixed(2)}
                      </p>
                      {t.balance_after !== null && (
                        <p className="text-[11px] text-muted-foreground">Bal: {sym} {t.balance_after.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};
