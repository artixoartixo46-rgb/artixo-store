import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, GitCommit, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ErrorReport {
  id: string;
  created_at: string;
  last_seen_at: string;
  error_type: string;
  message: string;
  stack: string | null;
  url: string | null;
  component: string | null;
  gemini_analysis: string | null;
  suggested_fix: string | null;
  fix_file: string | null;
  fix_code: string | null;
  status: string;
  github_commit_sha: string | null;
  occurrences: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  detected:  { label: "Detected",  color: "bg-blue-100 text-blue-700",   icon: AlertTriangle },
  analyzing: { label: "Analyzing", color: "bg-yellow-100 text-yellow-700", icon: Loader2 },
  analyzed:  { label: "Analyzed",  color: "bg-purple-100 text-purple-700", icon: Bug },
  fixing:    { label: "Fixing",    color: "bg-orange-100 text-orange-700", icon: Loader2 },
  fixed:     { label: "Fixed",     color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  failed:    { label: "Failed",    color: "bg-red-100 text-red-700",     icon: XCircle },
  ignored:   { label: "Ignored",   color: "bg-gray-100 text-gray-600",   icon: null },
};

const SEV_COLOR: Record<string, string> = {
  critical: "border-l-red-500",
  high:     "border-l-orange-500",
  medium:   "border-l-yellow-500",
  low:      "border-l-green-500",
};

export const AdminErrorMonitor = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "fixed">("active");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("error_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setErrors(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ignore = async (id: string) => {
    await (supabase as any).from("error_reports").update({ status: "ignored" }).eq("id", id);
    setErrors((e) => e.map((r) => r.id === id ? { ...r, status: "ignored" } : r));
    toast.success("Error marked as ignored");
  };

  const retryFix = async (err: ErrorReport) => {
    if (!err.fix_file || !err.fix_code) { toast.error("No fix available to retry"); return; }
    await (supabase as any).from("error_reports").update({ status: "fixing" }).eq("id", err.id);
    setErrors((e) => e.map((r) => r.id === err.id ? { ...r, status: "fixing" } : r));
    toast.info("Retry fix triggered — check Telegram for result");
  };

  const filtered = errors.filter((e) => {
    if (filter === "active") return !["fixed", "ignored"].includes(e.status);
    if (filter === "fixed") return e.status === "fixed";
    return true;
  });

  const counts = {
    active: errors.filter((e) => !["fixed", "ignored"].includes(e.status)).length,
    fixed: errors.filter((e) => e.status === "fixed").length,
    total: errors.length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">AI Error Monitor</h2>
          {counts.active > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {counts.active}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          {(["active", "fixed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
            >
              {f === "active" ? `Active (${counts.active})` : f === "fixed" ? `Fixed (${counts.fixed})` : `All (${counts.total})`}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Errors", value: counts.active, color: "text-destructive" },
          { label: "Auto-Fixed", value: counts.fixed, color: "text-green-600" },
          { label: "Total Caught", value: counts.total, color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Error list */}
      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading errors...
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400" />
          {filter === "active" ? "No active errors — site is healthy!" : "No errors in this category"}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((err) => {
            const cfg = STATUS_CONFIG[err.status] ?? STATUS_CONFIG.detected;
            const StatusIcon = cfg.icon;
            const isExpanded = expanded === err.id;

            return (
              <Card
                key={err.id}
                className={`border-l-4 ${SEV_COLOR.medium} overflow-hidden`}
              >
                {/* Summary row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(isExpanded ? null : err.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {StatusIcon && <StatusIcon className={`h-3 w-3 ${err.status === "analyzing" || err.status === "fixing" ? "animate-spin" : ""}`} />}
                        {cfg.label}
                      </span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{err.error_type}</span>
                      {err.occurrences > 1 && (
                        <span className="text-xs text-orange-600 font-medium">{err.occurrences}× seen</span>
                      )}
                      {err.github_commit_sha && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <GitCommit className="h-3 w-3" /> {err.github_commit_sha}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{err.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {err.url ?? "Unknown URL"} · {new Date(err.created_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                    {err.gemini_analysis && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">🔍 AI Root Cause</p>
                        <p className="text-sm">{err.gemini_analysis}</p>
                      </div>
                    )}
                    {err.suggested_fix && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">🛠 Suggested Fix</p>
                        <p className="text-sm">{err.suggested_fix}</p>
                        {err.fix_file && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{err.fix_file}</p>
                        )}
                      </div>
                    )}
                    {err.fix_code && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">📄 Code Patch</p>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40 font-mono">{err.fix_code}</pre>
                      </div>
                    )}
                    {err.stack && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">📋 Stack Trace</p>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32 font-mono text-destructive">{err.stack}</pre>
                      </div>
                    )}
                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {err.status === "analyzed" && err.fix_file && (
                        <Button size="sm" onClick={() => retryFix(err)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Apply Fix
                        </Button>
                      )}
                      {err.url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(err.url!, "_blank")}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open URL
                        </Button>
                      )}
                      {!["fixed", "ignored"].includes(err.status) && (
                        <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => ignore(err.id)}>
                          Ignore
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
