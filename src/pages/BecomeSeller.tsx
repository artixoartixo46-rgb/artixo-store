import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store, Check, Clock } from "lucide-react";

const BecomeSeller = () => {
  const { user, roles, loading: authLoading, refreshRoles } = useAuth();
  const [shopName, setShopName] = useState("");
  const [shopDesc, setShopDesc] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) return <div className="container py-12 text-center">Loading...</div>;
  if (!user) return <Navigate to="/auth?redirect=/become-seller" replace />;
  if (roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (roles.includes("seller")) return <Navigate to="/seller" replace />;

  // Already submitted — waiting for admin approval
  if (roles.includes("pending_seller")) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card className="p-10 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl">Application Under Review</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Your seller application has been submitted and is waiting for admin approval.
            You will get full access to your seller dashboard once approved.
          </p>
          <p className="text-xs text-muted-foreground">Have questions? Contact us at support@artixo.in</p>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) { toast.error("Shop name is required"); return; }
    setLoading(true);
    try {
      // Save shop info to profile
      await supabase
        .from("profiles")
        .update({ shop_name: shopName.trim() })
        .eq("id", user.id);

      // Check if already applied
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "pending_seller")
        .maybeSingle();

      if (!existing) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: "pending_seller" });
        if (roleErr) throw roleErr;
      }

      await refreshRoles();
      toast.success("Application submitted! The admin will review and approve your account.");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8 max-w-3xl">
      <Card className="p-8 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl gradient-saffron flex items-center justify-center text-primary-foreground shadow-glow">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl">Become a Seller</h1>
            <p className="text-sm text-muted-foreground">Open your shop in minutes</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {["Free to start", "Island-wide reach", "Admin support"].map((b) => (
            <div key={b} className="flex items-center gap-2 text-sm bg-success/10 text-success rounded-lg p-3">
              <Check className="h-4 w-4" /> {b}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Shop Name *</Label>
            <Input required value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Colombo Crafts" />
          </div>
          <div>
            <Label>Shop Description</Label>
            <Textarea value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} placeholder="Tell customers what you sell..." rows={3} />
          </div>
          <div>
            <Label>Contact Phone *</Label>
            <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 123 4567" />
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your application will be reviewed by admin before your seller account is activated.
          </p>
        </form>
      </Card>
    </div>
  );
};

export default BecomeSeller;
