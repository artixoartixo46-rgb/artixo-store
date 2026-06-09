import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Upload, Save, ArrowLeft } from "lucide-react";

const FitProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    height_cm: "",
    weight_kg: "",
    chest_cm: "",
    waist_cm: "",
    shoulder_cm: "",
    front_photo_url: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate("/auth"); return; }
      setUser(data.user);
      loadProfile(data.user.id);
    });
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("user_fit_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setForm({
        height_cm: data.height_cm?.toString() ?? "",
        weight_kg: data.weight_kg?.toString() ?? "",
        chest_cm: data.chest_cm?.toString() ?? "",
        waist_cm: data.waist_cm?.toString() ?? "",
        shoulder_cm: data.shoulder_cm?.toString() ?? "",
        front_photo_url: data.front_photo_url ?? "",
      });
    }
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `fit-photos/${user.id}/front.${ext}`;
    const { error } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Photo upload failed");
    } else {
      const { data: urlData } = supabase.storage.from("products").getPublicUrl(path);
      setForm((f) => ({ ...f, front_photo_url: urlData.publicUrl }));
      toast.success("Photo uploaded!");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      chest_cm: form.chest_cm ? parseFloat(form.chest_cm) : null,
      waist_cm: form.waist_cm ? parseFloat(form.waist_cm) : null,
      shoulder_cm: form.shoulder_cm ? parseFloat(form.shoulder_cm) : null,
      front_photo_url: form.front_photo_url || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("user_fit_profiles")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Fit profile saved!");
    }
  };

  const field = (label: string, key: keyof typeof form, unit: string) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label} ({unit})</Label>
      <Input
        id={key}
        type="number"
        min="0"
        step="0.1"
        placeholder={`e.g. ${key === "height_cm" ? "170" : key === "weight_kg" ? "65" : "90"}`}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  if (loading) return <div className="container py-12 text-center">Loading...</div>;

  return (
    <div className="container max-w-lg py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">My Fit Profile</h1>
          <p className="text-sm text-muted-foreground">Save your measurements for accurate size recommendations</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {field("Height", "height_cm", "cm")}
          {field("Weight", "weight_kg", "kg")}
          {field("Chest", "chest_cm", "cm")}
          {field("Waist", "waist_cm", "cm")}
          {field("Shoulder Width", "shoulder_cm", "cm")}
        </div>

        <div className="space-y-2">
          <Label>Front Photo (optional — used for Try-On)</Label>
          {form.front_photo_url && (
            <img
              src={form.front_photo_url}
              alt="Front photo"
              className="h-40 w-28 object-cover rounded-lg border"
            />
          )}
          <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted transition-colors w-fit text-sm">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : form.front_photo_url ? "Change Photo" : "Upload Photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Stand straight, facing forward. Best results with a plain background.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Fit Profile"}
        </Button>
      </Card>
    </div>
  );
};

export default FitProfile;
