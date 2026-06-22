import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const VAPID_PUBLIC_KEY = "BLg1i4C8IE93FvebnaNjqx75MSS84V8mWZcL-xY5K69dmGtjsUm1N3vf3uyGl9WVkjfDZAsDH7zXq3l4-2jwFTk";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission as PushPermission);
    checkSubscribed();
  }, []);

  const checkSubscribed = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {}
  };

  const subscribe = async () => {
    if (!supported) { toast.error("Push notifications not supported in this browser"); return; }
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") {
        toast.error("Notification permission denied");
        setLoading(false);
        return;
      }

      // Get service worker + subscribe
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      const { data: { user } } = await supabase.auth.getUser();

      // Save to Supabase
      const { error } = await (supabase as any).from("push_subscriptions").upsert({
        user_id: user?.id ?? null,
        endpoint: json.endpoint,
        p256dh: (json.keys as any)?.p256dh ?? "",
        auth: (json.keys as any)?.auth ?? "",
      }, { onConflict: "endpoint" });

      if (error) throw error;
      setSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to enable notifications");
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push notifications disabled");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to disable notifications");
    }
    setLoading(false);
  };

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}

// Helper: send a push notification to a specific user (calls Vercel API route)
export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  try {
    const { data } = await (supabase as any).from("push_subscriptions").select("*").eq("user_id", userId);
    if (!data?.length) return;
    await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptions: data, payload }),
    });
  } catch {}
}

// Helper: broadcast to all subscriptions (admin use — no userId filter)
export async function broadcastPush(payload: { title: string; body: string; url?: string }) {
  try {
    const { data } = await (supabase as any).from("push_subscriptions").select("endpoint,p256dh,auth");
    if (!data?.length) return;
    await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptions: data, payload }),
    });
  } catch {}
}
