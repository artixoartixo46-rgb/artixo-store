import { useEffect, useState } from "react";
import { Bell, Mail, Phone, MessageSquare, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationPrefs {
  email_order_updates: boolean;
  sms_order_updates: boolean;
  phone_number: string;
}

const defaultPrefs: NotificationPrefs = {
  email_order_updates: true,
  sms_order_updates: false,
  phone_number: "",
};

const Settings = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          email_order_updates: data.email_order_updates,
          sms_order_updates: data.sms_order_updates,
          phone_number: data.phone_number ?? "",
        });
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        email_order_updates: prefs.email_order_updates,
        sms_order_updates: prefs.sms_order_updates,
        phone_number: prefs.phone_number || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Notification settings saved!");
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <div className="container py-16 text-center text-muted-foreground">
        Please sign in to manage your settings.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-16 text-center text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about your orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-base font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive order status updates via email ({user.email})
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.email_order_updates}
              onCheckedChange={(checked) =>
                setPrefs((p) => ({ ...p, email_order_updates: checked }))
              }
            />
          </div>

          <Separator />

          {/* SMS Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-base font-medium">SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive order status updates via SMS
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.sms_order_updates}
              onCheckedChange={(checked) =>
                setPrefs((p) => ({ ...p, sms_order_updates: checked }))
              }
            />
          </div>

          {/* Phone Number (shown when SMS is enabled) */}
          {prefs.sms_order_updates && (
            <div className="ml-8 space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+94 7X XXX XXXX"
                value={prefs.phone_number}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, phone_number: e.target.value }))
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Enter your Sri Lanka phone number with country code (+94)
              </p>
            </div>
          )}

          <Separator />

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
