import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, ShieldCheck, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_UI: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Under Review",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "ID Verified ✓", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Rejected",       color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",          icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function SellerIdVerification({ userId }: { userId: string }) {
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<{ nic_front: string; nic_back: string; selfie: string }>({ nic_front: "", nic_back: "", selfie: "" });

  const nicFrontRef = useRef<HTMLInputElement>(null);
  const nicBackRef  = useRef<HTMLInputElement>(null);
  const selfieRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  const load = async () => {
    const { data } = await (supabase as any).from("id_verifications").select("*").eq("seller_id", userId).maybeSingle();
    setExisting(data ?? null);
    setLoading(false);
  };

  const uploadFile = async (file: File, slot: "nic_front" | "nic_back" | "selfie"): Promise<string> => {
    const path = `id-verify/${userId}/${slot}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, slot: "nic_front" | "nic_back" | "selfie") => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, slot);
      setFiles((f) => ({ ...f, [slot]: url }));
      toast.success(`${slot.replace("_", " ")} uploaded!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    if (!files.nic_front || !files.nic_back || !files.selfie) {
      toast.error("Please upload all 3 documents"); return;
    }
    const payload = { seller_id: userId, nic_front_url: files.nic_front, nic_back_url: files.nic_back, selfie_url: files.selfie, status: "pending" };
    const { error } = await (supabase as any).from("id_verifications").upsert(payload, { onConflict: "seller_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted for review! We'll verify within 24 hours.");
    load();
  };

  if (loading) return null;

  const statusUi = existing ? STATUS_UI[existing.status] : null;

  return (
    <Card className="p-5 space-y-4 border-2 border-dashed border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Identity Verification</h3>
        {statusUi && (
          <Badge className={`ml-auto flex items-center gap-1 ${statusUi.color}`}>
            {statusUi.icon} {statusUi.label}
          </Badge>
        )}
      </div>

      {existing?.status === "approved" ? (
        <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Your identity has been verified. The 🪪 ID Verified badge is now shown on your storefront.
        </div>
      ) : existing?.status === "pending" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Your documents are under review. We'll update your status within 24 hours.</p>
          <div className="flex gap-2">
            {[{ label: "NIC Front", url: existing.nic_front_url }, { label: "NIC Back", url: existing.nic_back_url }, { label: "Selfie", url: existing.selfie_url }].map((d) => (
              <div key={d.label} className="text-center">
                <img src={d.url} alt={d.label} className="h-16 w-16 object-cover rounded-lg border" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Upload your NIC (front & back) + a selfie holding your NIC. We verify within 24 hours.</p>

          <div className="grid grid-cols-3 gap-3">
            {([
              { slot: "nic_front" as const, label: "NIC Front", ref: nicFrontRef, emoji: "🪪" },
              { slot: "nic_back"  as const, label: "NIC Back",  ref: nicBackRef,  emoji: "🔄" },
              { slot: "selfie"    as const, label: "Selfie + NIC", ref: selfieRef, emoji: "🤳" },
            ]).map(({ slot, label, ref, emoji }) => (
              <div key={slot} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  disabled={uploading}
                  className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-smooth hover:border-primary/60 hover:bg-muted/50 ${files[slot] ? "border-green-500/60 bg-green-50/50 dark:bg-green-900/20" : ""}`}
                >
                  {files[slot] ? (
                    <img src={files[slot]} alt={label} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <span className="text-2xl">{emoji}</span>
                      <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                    </>
                  )}
                </button>
                <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, slot)} />
              </div>
            ))}
          </div>

          {existing?.status === "rejected" && existing.admin_note && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              <strong>Rejection reason:</strong> {existing.admin_note}
            </div>
          )}

          <Button onClick={submit} disabled={uploading || !files.nic_front || !files.nic_back || !files.selfie} className="w-full gap-2">
            <ShieldCheck className="h-4 w-4" /> Submit for Verification
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Your documents are kept private and only seen by ARTIXO admin.</p>
        </>
      )}
    </Card>
  );
}
